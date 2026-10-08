import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ..utils import db, reports as report_gen

router = APIRouter()

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "html": "text/html",
    "json": "application/json",
    "csv": "text/csv",
}


@router.get("/reports/{scan_id}/{fmt}")
def download_report(scan_id: str, fmt: str):
    if fmt not in _MEDIA_TYPES:
        raise HTTPException(400, f"Unsupported format: {fmt}. Use one of {list(_MEDIA_TYPES)}")
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")
    if scan["status"] != "completed":
        raise HTTPException(400, "Scan is not complete yet")

    results = json.loads(scan["results_json"]) if scan.get("results_json") else {}
    system_info = results.get("system_info", {}).get("data", {})

    if fmt == "pdf":
        content = report_gen.generate_pdf_report(scan, system_info)
    elif fmt == "html":
        content = report_gen.generate_html_report(scan, system_info)
    elif fmt == "json":
        content = report_gen.generate_json_report(scan)
    else:
        content = report_gen.generate_csv_report(scan)

    filename = f"winsec-audit-{scan_id}.{fmt}"
    return Response(
        content=content,
        media_type=_MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
