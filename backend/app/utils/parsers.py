"""
Parsers that turn raw Windows command-line output into structured JSON.
Each function is pure (str -> dict/list) so it can be unit tested with
fixture text without needing a live Windows host.
"""
import csv
import io
import re


def parse_user_list(raw: str) -> list:
    """Parses `net user` output into a flat username list."""
    lines = raw.splitlines()
    usernames = []
    in_body = False
    for line in lines:
        if line.startswith("---"):
            in_body = True
            continue
        if "command completed" in line.lower():
            break
        if in_body and line.strip():
            usernames.extend(line.split())
    return usernames


def parse_user_detail(raw: str) -> dict:
    """Parses `net user <username>` output into structured fields."""
    fields = {}
    for line in raw.splitlines():
        m = re.match(r"^(.{29})(.*)$", line)
        if not m:
            continue
        key = m.group(1).strip()
        value = m.group(2).strip()
        if key and value:
            fields[key] = value
    return {
        "account_active": fields.get("Account active", "Unknown"),
        "password_required": fields.get("Password required", "Unknown"),
        "password_expires": fields.get("Password expires", "Unknown"),
        "last_logon": fields.get("Last logon", "Never"),
        "local_group_memberships": fields.get("Local Group Memberships", "").replace("*", "").split() if fields.get("Local Group Memberships") else [],
    }


def parse_admin_group(raw: str) -> list:
    lines = raw.splitlines()
    members = []
    in_members = False
    dash_count = 0
    for line in lines:
        if line.startswith("---"):
            dash_count += 1
            in_members = dash_count >= 1
            continue
        if "command completed" in line.lower():
            break
        if in_members and line.strip():
            members.append(line.strip())
    return members


def parse_open_ports(raw: str) -> list:
    entries = []
    for line in raw.splitlines():
        line = line.strip()
        m = re.match(r"^(TCP|UDP)\s+(\S+)\s+(\S+)\s+(\S+)?\s*(\d+)?$", line)
        if not m:
            continue
        proto, local, foreign, state, pid = m.groups()
        if proto == "UDP" and pid is None and state and state.isdigit():
            pid, state = state, None
        entries.append({
            "protocol": proto,
            "local_address": local,
            "foreign_address": foreign,
            "state": state or "",
            "pid": int(pid) if pid and pid.isdigit() else None,
        })
    return entries


SUSPICIOUS_PORTS = {
    21: "FTP (unencrypted)", 23: "Telnet (unencrypted)", 135: "RPC endpoint mapper",
    139: "NetBIOS", 445: "SMB", 3389: "RDP", 5900: "VNC", 1433: "MSSQL",
    3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis (often unauthenticated)",
}


def parse_processes(raw: str) -> list:
    """Parses `tasklist /fo csv /v` CSV output."""
    reader = csv.DictReader(io.StringIO(raw))
    procs = []
    for row in reader:
        mem = row.get("Mem Usage", "0 K").replace(",", "").replace("K", "").strip()
        try:
            mem_kb = int(mem)
        except ValueError:
            mem_kb = 0
        procs.append({
            "name": row.get("Image Name", ""),
            "pid": row.get("PID", ""),
            "session": row.get("Session Name", ""),
            "mem_kb": mem_kb,
            "status": row.get("Status", ""),
            "user": row.get("User Name", ""),
            "cpu_time": row.get("CPU Time", ""),
            "window_title": row.get("Window Title", ""),
        })
    return procs


def parse_scheduled_tasks(raw: str) -> list:
    blocks = re.split(r"\n\s*\n", raw.strip())
    tasks = []
    for block in blocks:
        fields = {}
        for line in block.splitlines():
            if ":" in line:
                key, _, val = line.partition(":")
                fields[key.strip()] = val.strip()
        if fields.get("TaskName") or fields.get("HostName"):
            tasks.append({
                "task_name": fields.get("TaskName", "Unknown"),
                "next_run": fields.get("Next Run Time", "N/A"),
                "status": fields.get("Status", "Unknown"),
                "author": fields.get("Author", "Unknown"),
                "run_as_user": fields.get("Run As User", "Unknown"),
                "task_to_run": fields.get("Task To Run", ""),
            })
    return tasks


def parse_startup(raw: str) -> list:
    """Parses `wmic startup get caption,command,location,user /format:csv`."""
    reader = csv.DictReader(io.StringIO(raw.strip()))
    items = []
    for row in reader:
        caption = row.get("Caption", "").strip()
        if not caption:
            continue
        items.append({
            "caption": caption,
            "command": row.get("Command", "").strip(),
            "location": row.get("Location", "").strip(),
            "user": row.get("User", "").strip(),
        })
    return items


def parse_firewall(raw: str) -> dict:
    profiles = {}
    current = None
    for line in raw.splitlines():
        m = re.match(r"^(Domain|Private|Public) Profile Settings:", line.strip())
        if m:
            current = m.group(1).lower()
            profiles[current] = {}
            continue
        if current and ":" not in line and line.strip().upper() in ("ON", "OFF"):
            profiles[current]["state"] = line.strip().upper()
            continue
        if current:
            kv = re.match(r"^\s*(State|Firewall Policy|Settings)\s*(.*)$", line)
            if kv and kv.group(2).strip():
                key = kv.group(1)
                val = kv.group(2).strip()
                if key == "State":
                    profiles[current]["state"] = val.upper()
                elif key == "Firewall Policy":
                    profiles[current]["policy"] = val
    for p in ("domain", "private", "public"):
        profiles.setdefault(p, {}).setdefault("state", "UNKNOWN")
    return profiles


def parse_defender(raw: str) -> dict:
    state = "UNKNOWN"
    m = re.search(r"STATE\s*:\s*\d+\s+(\w+)", raw)
    if m:
        state = m.group(1)
    return {"service": "WinDefend", "state": state, "running": state == "RUNNING"}


def parse_password_policy(raw: str) -> dict:
    fields = {}
    for line in raw.splitlines():
        m = re.match(r"^(.{45,60}?):?\s{2,}(.+)$", line)
        if m:
            fields[m.group(1).strip()] = m.group(2).strip()
        elif ":" in line:
            key, _, val = line.partition(":")
            if val.strip():
                fields[key.strip()] = val.strip()

    def find(*keys):
        for k in fields:
            for target in keys:
                if target.lower() in k.lower():
                    return fields[k]
        return "Unknown"

    return {
        "min_password_length": find("Minimum password length"),
        "max_password_age": find("Maximum password age"),
        "min_password_age": find("Minimum password age"),
        "password_history": find("password history"),
        "lockout_threshold": find("Lockout threshold"),
        "lockout_duration": find("Lockout duration"),
    }


def parse_shares(raw: str) -> list:
    lines = raw.splitlines()
    shares = []
    started = False
    for line in lines:
        if line.startswith("---"):
            started = True
            continue
        if "command completed" in line.lower() or not line.strip():
            continue
        if started:
            parts = re.split(r"\s{2,}", line.strip())
            if parts:
                shares.append({
                    "name": parts[0],
                    "resource": parts[1] if len(parts) > 1 else "",
                    "remark": parts[2] if len(parts) > 2 else "",
                    "is_admin_share": parts[0].endswith("$"),
                })
    return shares


def parse_software(raw: str) -> list:
    reader = csv.DictReader(io.StringIO(raw.strip()))
    items = []
    for row in reader:
        name = row.get("Name", "").strip()
        if not name:
            continue
        items.append({
            "name": name,
            "vendor": row.get("Vendor", "").strip(),
            "version": row.get("Version", "").strip(),
        })
    return items


def parse_arp_table(raw: str) -> list:
    entries = []
    interface = None
    for line in raw.splitlines():
        iface_m = re.match(r"^Interface:\s*(\S+)", line)
        if iface_m:
            interface = iface_m.group(1)
            continue
        row_m = re.match(r"^\s*([\d.]+)\s+([0-9a-fA-F-]{17})\s+(\w+)", line)
        if row_m and interface:
            entries.append({
                "interface": interface,
                "ip": row_m.group(1),
                "mac": row_m.group(2).lower(),
                "type": row_m.group(3),
            })
    return entries


def parse_system_info(raw: str) -> dict:
    fields = {}
    last_key = None
    for line in raw.splitlines():
        if not line.strip():
            continue
        m = re.match(r"^([A-Za-z][^:]{2,40}):\s*(.*)$", line)
        if m and not line.startswith(" "):
            last_key = m.group(1).strip()
            fields[last_key] = m.group(2).strip()

    def find(*keys):
        for k in fields:
            for target in keys:
                if target.lower() in k.lower():
                    return fields[k]
        return "Unknown"

    return {
        "os_name": find("OS Name"),
        "os_version": find("OS Version"),
        "hostname": find("Host Name"),
        "domain": find("Domain"),
        "architecture": find("System Type"),
        "boot_time": find("System Boot Time"),
        "bios_version": find("BIOS Version"),
        "total_ram": find("Total Physical Memory"),
    }
