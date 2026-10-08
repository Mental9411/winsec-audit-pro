import csv
import io
import json
import time
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)

SEVERITY_COLORS = {
    "critical": colors.HexColor("#FF3860"),
    "high": colors.HexColor("#FF6B35"),
    "medium": colors.HexColor("#FFB020"),
    "low": colors.HexColor("#00C8FF"),
    "info": colors.HexColor("#7C8AA6"),
}


def _flatten_findings(results: dict) -> list:
    findings = []
    for module, res in results.items():
        for f in res.get("findings", []):
            findings.append(f)
    return findings


def generate_json_report(scan: dict) -> bytes:
    payload = {
        "scan_id": scan["id"],
        "scan_type": scan["scan_type"],
        "started_at": scan["started_at"],
        "finished_at": scan.get("finished_at"),
        "overall_score": scan.get("overall_score"),
        "overall_label": scan.get("overall_label"),
        "results": json.loads(scan["results_json"]) if scan.get("results_json") else {},
        "findings": json.loads(scan["findings_json"]) if scan.get("findings_json") else [],
    }
    return json.dumps(payload, indent=2).encode("utf-8")


def generate_csv_report(scan: dict) -> bytes:
    findings = json.loads(scan["findings_json"]) if scan.get("findings_json") else []
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["module", "severity", "title", "description"])
    writer.writeheader()
    for f in findings:
        writer.writerow(f)
    return buf.getvalue().encode("utf-8")


def generate_html_report(scan: dict, system_info: dict = None) -> bytes:
    findings = json.loads(scan["findings_json"]) if scan.get("findings_json") else []
    system_info = system_info or {}
    rows = "".join(
        f"""<tr>
            <td><span class="badge {f['severity']}">{f['severity'].upper()}</span></td>
            <td>{f['module']}</td>
            <td>{f['title']}</td>
            <td>{f['description']}</td>
        </tr>"""
        for f in findings
    )
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Windows Security Audit Report</title>
<style>
body {{ font-family: 'Segoe UI', system-ui, sans-serif; background:#0B0F19; color:#E7ECF5; padding:2rem; }}
h1 {{ color:#00FF88; }}
table {{ width:100%; border-collapse: collapse; margin-top:1rem; }}
th, td {{ border:1px solid #263042; padding:0.6rem; text-align:left; font-size:0.9rem; }}
th {{ background:#141c2e; color:#00C8FF; }}
.badge {{ padding:2px 8px; border-radius:999px; font-size:0.75rem; font-weight:600; }}
.critical {{ background:#FF3860; color:#fff; }}
.high {{ background:#FF6B35; color:#fff; }}
.medium {{ background:#FFB020; color:#1a1200; }}
.low {{ background:#00C8FF; color:#001820; }}
.info {{ background:#7C8AA6; color:#fff; }}
.score {{ font-size:3rem; color:#00FF88; font-weight:800; }}
.meta {{ color:#7C8AA6; }}
</style></head>
<body>
<h1>Windows Security Audit Report</h1>
<p class="meta">Scan ID: {scan['id']} &middot; Type: {scan['scan_type']} &middot;
Generated: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(scan.get('finished_at') or time.time()))}</p>
<p class="meta">Host: {system_info.get('hostname', 'Unknown')} &middot; OS: {system_info.get('os_name', 'Unknown')}</p>
<div class="score">{scan.get('overall_score', '-')}/100 <span style="font-size:1.2rem;color:#7C8AA6;">({scan.get('overall_label', '')})</span></div>
<h2>Findings ({len(findings)})</h2>
<table>
<thead><tr><th>Severity</th><th>Module</th><th>Title</th><th>Description</th></tr></thead>
<tbody>{rows}</tbody>
</table>
</body></html>"""
    return html.encode("utf-8")


def generate_pdf_report(scan: dict, system_info: dict = None) -> bytes:
    system_info = system_info or {}
    findings = json.loads(scan["findings_json"]) if scan.get("findings_json") else []

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleCyber", parent=styles["Title"], textColor=colors.HexColor("#0B0F19"))
    heading_style = ParagraphStyle("HeadingCyber", parent=styles["Heading2"], textColor=colors.HexColor("#0B0F19"))
    normal = styles["BodyText"]

    story = [
        Paragraph("Windows Security Audit Report", title_style),
        Spacer(1, 6),
        Paragraph(
            f"Scan ID: {scan['id']} &nbsp;|&nbsp; Type: {scan['scan_type'].title()} &nbsp;|&nbsp; "
            f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(scan.get('finished_at') or time.time()))}",
            normal,
        ),
        Paragraph(
            f"Host: {system_info.get('hostname', 'Unknown')} &nbsp;|&nbsp; "
            f"OS: {system_info.get('os_name', 'Unknown')} {system_info.get('os_version', '')}",
            normal,
        ),
        Spacer(1, 14),
        Paragraph(f"Overall Security Score: {scan.get('overall_score', '-')}/100 ({scan.get('overall_label', '')})", heading_style),
        Spacer(1, 10),
    ]

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    summary_table_data = [["Critical", "High", "Medium", "Low", "Info"], [str(counts[s]) for s in ["critical", "high", "medium", "low", "info"]]]
    summary_table = Table(summary_table_data, colWidths=[1.4 * inch] * 5)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#141c2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F5F7FA")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 18))

    story.append(Paragraph(f"Findings ({len(findings)})", heading_style))
    story.append(Spacer(1, 8))

    if not findings:
        story.append(Paragraph("No findings recorded for this scan.", normal))
    else:
        data = [["Severity", "Module", "Title"]]
        for f in findings:
            data.append([f["severity"].upper(), f["module"], f["title"]])
        table = Table(data, colWidths=[0.9 * inch, 1.3 * inch, 4.2 * inch], repeatRows=1)
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#141c2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for i, f in enumerate(findings, start=1):
            style_cmds.append(("TEXTCOLOR", (0, i), (0, i), SEVERITY_COLORS.get(f["severity"], colors.black)))
        table.setStyle(TableStyle(style_cmds))
        story.append(table)
        story.append(Spacer(1, 16))
        story.append(Paragraph("Detailed Descriptions & Recommendations", heading_style))
        for f in findings:
            story.append(Spacer(1, 6))
            story.append(Paragraph(f"<b>[{f['severity'].upper()}] {f['title']}</b>", normal))
            story.append(Paragraph(f["description"], normal))

    story.append(PageBreak())
    story.append(Paragraph("Executive Summary", heading_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(_executive_summary(scan, counts), normal))

    doc.build(story)
    return buf.getvalue()


def _executive_summary(scan, counts) -> str:
    score = scan.get("overall_score", 0)
    label = scan.get("overall_label", "Unknown")
    total = sum(counts.values())
    return (
        f"This automated security audit produced an overall score of {score}/100 ({label}), "
        f"based on {total} finding(s) across critical ({counts['critical']}), high ({counts['high']}), "
        f"medium ({counts['medium']}), low ({counts['low']}), and informational ({counts['info']}) severities. "
        "Findings in the critical and high categories should be addressed first, as they represent the "
        "most direct paths to compromise (e.g. disabled protections, weak authentication, or exposed "
        "services). This report is generated from a point-in-time, read-only scan and should be re-run "
        "periodically or after making configuration changes."
    )
