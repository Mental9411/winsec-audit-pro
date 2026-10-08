"""
Orchestrates one full/quick/deep scan: runs each module's command (or
reports it unavailable on non-Windows hosts), parses the output, evaluates
findings, and returns a combined structure for the frontend and the AI
assistant's context.
"""
from ..utils import safe_exec, parsers, risk_engine

# scan_type -> which modules run. "quick" skips the slower/heavier ones.
SCAN_PROFILES = {
    "quick": ["users", "admin_group", "firewall", "defender", "open_ports", "password_policy"],
    "deep": list(safe_exec.MODULE_COMMANDS.keys()),
    "full": list(safe_exec.MODULE_COMMANDS.keys()),
}

MODULE_LABELS = {
    "users": "User Accounts",
    "admin_group": "Administrator Group",
    "open_ports": "Open Ports",
    "processes": "Running Processes",
    "scheduled_tasks": "Scheduled Tasks",
    "startup": "Startup Programs",
    "firewall": "Windows Firewall",
    "defender": "Microsoft Defender",
    "password_policy": "Password Policy",
    "shares": "Shared Folders",
    "software": "Installed Software",
    "arp_table": "ARP Table",
    "system_info": "System Information",
}

MAX_USER_DETAIL_LOOKUPS = 25


def run_single_module(module: str) -> dict:
    """Runs one module end-to-end: exec -> parse -> risk. Returns
    {"data": ..., "findings": [...]} or {"error": ...} if unavailable."""
    try:
        raw = safe_exec.run_module(module)
    except safe_exec.ExecError as e:
        return {"error": str(e), "available": False}

    try:
        if module == "users":
            usernames = parsers.parse_user_list(raw)
            details = {}
            for uname in usernames[:MAX_USER_DETAIL_LOOKUPS]:
                try:
                    detail_raw = safe_exec.run_user_detail(uname)
                    details[uname] = parsers.parse_user_detail(detail_raw)
                except safe_exec.ExecError:
                    continue
            data = {"usernames": usernames, "details": details, "total": len(usernames)}
            findings = risk_engine.evaluate_users(usernames, details)

        elif module == "admin_group":
            members = parsers.parse_admin_group(raw)
            data = {"members": members, "total": len(members)}
            findings = risk_engine.evaluate_admin_group(members)

        elif module == "open_ports":
            ports = parsers.parse_open_ports(raw)
            data = {"ports": ports, "total": len(ports)}
            findings = risk_engine.evaluate_ports(ports)

        elif module == "processes":
            procs = parsers.parse_processes(raw)
            data = {"processes": procs, "total": len(procs)}
            findings = risk_engine.evaluate_processes(procs)

        elif module == "scheduled_tasks":
            tasks = parsers.parse_scheduled_tasks(raw)
            data = {"tasks": tasks, "total": len(tasks)}
            findings = risk_engine.evaluate_scheduled_tasks(tasks)

        elif module == "startup":
            items = parsers.parse_startup(raw)
            data = {"items": items, "total": len(items)}
            findings = risk_engine.evaluate_startup(items)

        elif module == "firewall":
            profiles = parsers.parse_firewall(raw)
            data = {"profiles": profiles}
            findings = risk_engine.evaluate_firewall(profiles)

        elif module == "defender":
            defender = parsers.parse_defender(raw)
            data = defender
            findings = risk_engine.evaluate_defender(defender)

        elif module == "password_policy":
            policy = parsers.parse_password_policy(raw)
            data = policy
            findings = risk_engine.evaluate_password_policy(policy)

        elif module == "shares":
            shares = parsers.parse_shares(raw)
            data = {"shares": shares, "total": len(shares)}
            findings = risk_engine.evaluate_shares(shares)

        elif module == "software":
            software = parsers.parse_software(raw)
            data = {"software": software, "total": len(software)}
            findings = risk_engine.evaluate_software(software)

        elif module == "arp_table":
            entries = parsers.parse_arp_table(raw)
            data = {"entries": entries, "total": len(entries)}
            findings = risk_engine.evaluate_arp(entries)

        elif module == "system_info":
            data = parsers.parse_system_info(raw)
            findings = []

        else:
            return {"error": f"No handler for module {module}", "available": False}

    except Exception as e:  # parsing must never crash the whole scan
        return {"error": f"Failed to parse {module} output: {e}", "available": True}

    return {"data": data, "findings": findings, "available": True}
