import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..utils import db, safe_exec
from ..utils.ws_manager import manager

router = APIRouter()


class KillProcessRequest(BaseModel):
    pid: int
    confirm: bool = False


class DisableStartupRequest(BaseModel):
    hive: str  # "HKLM" or "HKCU"
    value_name: str
    confirm: bool = False


def _latest_processes() -> list:
    scan = db.latest_completed_scan()
    if not scan:
        return []
    results = json.loads(scan["results_json"]) if scan.get("results_json") else {}
    return results.get("processes", {}).get("data", {}).get("processes", [])


def _latest_startup_items() -> list:
    scan = db.latest_completed_scan()
    if not scan:
        return []
    results = json.loads(scan["results_json"]) if scan.get("results_json") else {}
    return results.get("startup", {}).get("data", {}).get("items", [])


@router.post("/actions/kill-process")
async def kill_process(req: KillProcessRequest):
    if not req.confirm:
        raise HTTPException(400, "This action requires explicit confirmation (confirm: true)")

    # Only allow killing a PID that showed up in the most recent process
    # scan - this prevents blindly terminating arbitrary/system PIDs that
    # were never actually observed on this host.
    known_pids = {int(p["pid"]) for p in _latest_processes() if str(p["pid"]).isdigit()}
    if req.pid not in known_pids:
        raise HTTPException(400, "PID was not found in the most recent process scan. Re-run a scan first.")
    if req.pid in (0, 4):  # System Idle Process, System
        raise HTTPException(400, "Refusing to kill a core system process")

    try:
        safe_exec.run_kill_process(req.pid)
    except safe_exec.ExecError as e:
        raise HTTPException(400, str(e))

    await manager.broadcast("terminal", {"line": f"Killed process PID {req.pid}"})
    await manager.broadcast("notification", {"severity": "info", "title": f"Process {req.pid} terminated", "module": "processes"})
    return {"pid": req.pid, "status": "terminated"}


@router.post("/actions/disable-startup")
async def disable_startup(req: DisableStartupRequest):
    if not req.confirm:
        raise HTTPException(400, "This action requires explicit confirmation (confirm: true)")
    if req.hive not in ("HKLM", "HKCU"):
        raise HTTPException(400, "hive must be HKLM or HKCU")

    known_names = {i["caption"] for i in _latest_startup_items()}
    if req.value_name not in known_names:
        raise HTTPException(400, "Startup entry was not found in the most recent scan. Re-run a scan first.")

    try:
        safe_exec.run_disable_startup_entry(req.hive, req.value_name)
    except safe_exec.ExecError as e:
        raise HTTPException(400, str(e))

    await manager.broadcast("terminal", {"line": f"Disabled startup entry: {req.value_name} ({req.hive})"})
    return {"value_name": req.value_name, "hive": req.hive, "status": "disabled"}
