import json
from fastapi import APIRouter
from ..utils import db

router = APIRouter()


@router.get("/dashboard/summary")
def dashboard_summary():
    scan = db.latest_completed_scan()
    history = db.list_scans(limit=10)

    if not scan:
        return {
            "has_scan": False,
            "overall_score": None,
            "overall_label": None,
            "counts": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "recent_scans": history,
            "modules": {},
        }

    results = json.loads(scan["results_json"]) if scan.get("results_json") else {}
    findings = json.loads(scan["findings_json"]) if scan.get("findings_json") else []
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    module_cards = {}
    for module, res in results.items():
        module_cards[module] = {
            "available": res.get("available", False),
            "finding_count": len(res.get("findings", [])),
            "error": res.get("error"),
        }

    return {
        "has_scan": True,
        "scan_id": scan["id"],
        "scan_type": scan["scan_type"],
        "finished_at": scan.get("finished_at"),
        "overall_score": scan.get("overall_score"),
        "overall_label": scan.get("overall_label"),
        "counts": counts,
        "recent_scans": history,
        "modules": module_cards,
        "system_info": results.get("system_info", {}).get("data", {}),
        "firewall": results.get("firewall", {}).get("data", {}),
        "defender": results.get("defender", {}).get("data", {}),
        "password_policy": results.get("password_policy", {}).get("data", {}),
        "users": results.get("users", {}).get("data", {}),
        "open_ports": results.get("open_ports", {}).get("data", {}),
        "processes": results.get("processes", {}).get("data", {}),
        "startup": results.get("startup", {}).get("data", {}),
    }
