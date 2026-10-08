import asyncio
import json
import time
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..modules.scanner import SCAN_PROFILES, MODULE_LABELS, run_single_module
from ..utils import db, safe_exec
from ..utils.risk_engine import compute_overall_score
from ..utils.ws_manager import manager

router = APIRouter()

_RUNNING_SCANS = {}  # scan_id -> {"cancel": bool}


class StartScanRequest(BaseModel):
    scan_type: str = "quick"  # quick | deep | full


@router.get("/scan/modules")
def modules_status():
    return {
        "available": safe_exec.available_modules(),
        "labels": MODULE_LABELS,
        "profiles": {k: v for k, v in SCAN_PROFILES.items()},
    }


@router.post("/scan/start")
async def start_scan(req: StartScanRequest):
    if req.scan_type not in SCAN_PROFILES:
        raise HTTPException(400, f"Unknown scan_type: {req.scan_type}")

    scan_id = uuid.uuid4().hex[:12]
    db.create_scan(scan_id, req.scan_type)
    _RUNNING_SCANS[scan_id] = {"cancel": False}

    asyncio.create_task(_run_scan(scan_id, req.scan_type))
    return {"scan_id": scan_id, "status": "running", "modules": SCAN_PROFILES[req.scan_type]}


async def _run_scan(scan_id: str, scan_type: str):
    modules = SCAN_PROFILES[scan_type]
    results = {}
    all_findings = []
    total = len(modules)

    await manager.broadcast("scan:started", {"scan_id": scan_id, "scan_type": scan_type, "total_modules": total})

    for idx, module in enumerate(modules, start=1):
        if _RUNNING_SCANS.get(scan_id, {}).get("cancel"):
            db.fail_scan(scan_id, "Cancelled by user")
            await manager.broadcast("scan:cancelled", {"scan_id": scan_id})
            _RUNNING_SCANS.pop(scan_id, None)
            return

        label = MODULE_LABELS.get(module, module)
        await manager.broadcast("terminal", {"line": f"Running: {' '.join(safe_exec.MODULE_COMMANDS.get(module, [module]))}"})
        await manager.broadcast("module:start", {"scan_id": scan_id, "module": module, "label": label, "index": idx, "total": total})

        result = await asyncio.to_thread(run_single_module, module)
        results[module] = result
        findings = result.get("findings", [])
        all_findings.extend(findings)

        status = "error" if "error" in result and not result.get("data") else "completed"
        await manager.broadcast("terminal", {"line": f"Completed: {label} ({len(findings)} finding(s))" if status == "completed" else f"Skipped: {label} - {result.get('error')}"})
        await manager.broadcast("module:done", {
            "scan_id": scan_id, "module": module, "status": status,
            "error": result.get("error"), "finding_count": len(findings),
            "progress": round(idx / total * 100),
        })

        for f in findings:
            if f["severity"] in ("critical", "high"):
                await manager.broadcast("notification", {"severity": f["severity"], "title": f["title"], "module": f["module"]})

    overall = compute_overall_score(all_findings)
    db.finish_scan(scan_id, results, all_findings, overall)
    _RUNNING_SCANS.pop(scan_id, None)

    await manager.broadcast("scan:completed", {
        "scan_id": scan_id, "overall_score": overall["score"], "overall_label": overall["label"],
        "counts": overall["counts"], "total_findings": overall["total_findings"],
    })


@router.post("/scan/{scan_id}/cancel")
def cancel_scan(scan_id: str):
    if scan_id not in _RUNNING_SCANS:
        raise HTTPException(404, "Scan not running")
    _RUNNING_SCANS[scan_id]["cancel"] = True
    return {"scan_id": scan_id, "status": "cancelling"}


@router.get("/scan/history")
def scan_history(limit: int = 50):
    return {"items": db.list_scans(limit=limit)}


@router.get("/scan/latest")
def latest_scan():
    scan = db.latest_completed_scan()
    if not scan:
        return {"scan": None}
    return {"scan": _serialize_scan(scan)}


@router.get("/scan/{scan_id}")
def get_scan(scan_id: str):
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    return _serialize_scan(scan)


def _serialize_scan(scan: dict) -> dict:
    out = dict(scan)
    out["results"] = json.loads(scan["results_json"]) if scan.get("results_json") else {}
    out["findings"] = json.loads(scan["findings_json"]) if scan.get("findings_json") else []
    out.pop("results_json", None)
    out.pop("findings_json", None)
    return out
