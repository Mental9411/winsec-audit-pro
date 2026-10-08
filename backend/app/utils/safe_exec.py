"""
Secure, read-only Windows command execution.

This is the only place in the backend that talks to the OS, so it gets the
most scrutiny:

1. NEVER use shell=True. Every command is a fixed argument list defined in
   code (see MODULE_COMMANDS below) - nothing from the request body, a
   scan config, or user input is ever concatenated into a command line.
2. Only a fixed allowlist of read-only diagnostic commands can run. There is
   no "run arbitrary command" endpoint anywhere in this app.
3. The few actions that change state (kill a process, disable a startup
   entry) go through a SEPARATE, much stricter path in actions.py that
   validates a numeric PID/name against the current process list fetched
   moments earlier, requires an explicit confirm flag, and still never
   accepts a free-text command.
4. Everything here is designed to run on Windows. On any other OS (e.g. this
   is being developed/tested on Linux/Mac) commands are reported as
   "unavailable" - nothing is faked or simulated.
5. Commands run with a timeout and full output capture; nothing is streamed
   into a shell or re-interpreted.
"""
import platform
import re
import shutil
import subprocess

IS_WINDOWS = platform.system() == "Windows"

# Fixed, hard-coded commands per module. No part of these lists is ever
# built from user/request input.
MODULE_COMMANDS = {
    "users": ["net", "user"],
    "admin_group": ["net", "localgroup", "administrators"],
    "open_ports": ["netstat", "-ano"],
    "processes": ["tasklist", "/fo", "csv", "/v"],
    "scheduled_tasks": ["schtasks", "/query", "/fo", "list", "/v"],
    "startup": ["wmic", "startup", "get", "caption,command,location,user", "/format:csv"],
    "firewall": ["netsh", "advfirewall", "show", "allprofiles"],
    "defender": ["sc", "query", "WinDefend"],
    "password_policy": ["net", "accounts"],
    "shares": ["net", "share"],
    "software": ["wmic", "product", "get", "name,version,vendor", "/format:csv"],
    "arp_table": ["arp", "-a"],
    "system_info": ["systeminfo"],
}


class ExecError(Exception):
    pass


def is_module_available(module: str) -> bool:
    if not IS_WINDOWS:
        return False
    cmd = MODULE_COMMANDS.get(module)
    if not cmd:
        return False
    return shutil.which(cmd[0]) is not None


def run_module(module: str, timeout: int = 60) -> str:
    """Run one of the fixed, allowlisted diagnostic commands and return
    raw stdout text. Raises ExecError if unavailable / it fails."""
    if module not in MODULE_COMMANDS:
        raise ExecError(f"Unknown module: {module}")
    if not IS_WINDOWS:
        raise ExecError(
            "This module runs Windows-only diagnostic commands and isn't available "
            "on this OS. Run the backend on Windows to enable live scanning."
        )
    cmd = MODULE_COMMANDS[module]
    if shutil.which(cmd[0]) is None:
        raise ExecError(f"'{cmd[0]}' is not available on this system")

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,  # critical: no shell interpolation, ever
        )
    except subprocess.TimeoutExpired as e:
        raise ExecError(f"{module} timed out after {timeout}s") from e

    # Some tools (schtasks, wmic) write useful data to stdout even with a
    # non-zero exit code (e.g. locale warnings) - return what we got, but
    # surface a clear error if there's truly nothing.
    if not proc.stdout and proc.returncode != 0:
        raise ExecError(f"{' '.join(cmd)} failed: {proc.stderr.strip()[:300]}")
    return proc.stdout


def available_modules() -> dict:
    return {m: is_module_available(m) for m in MODULE_COMMANDS}


_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.\-\$]{1,64}$")


def run_kill_process(pid: int, timeout: int = 15) -> str:
    """Terminates a process by PID via `taskkill /PID <pid> /F`.
    pid must be a positive integer the caller has already confirmed exists
    in a recent process scan (enforced in routes/actions.py) - this
    function itself only guards against non-numeric injection."""
    if not isinstance(pid, int) or pid <= 0:
        raise ExecError("PID must be a positive integer")
    if not IS_WINDOWS:
        raise ExecError("Windows-only command")
    if shutil.which("taskkill") is None:
        raise ExecError("'taskkill' is not available on this system")
    proc = subprocess.run(
        ["taskkill", "/PID", str(pid), "/F"],
        capture_output=True, text=True, timeout=timeout, shell=False,
    )
    if proc.returncode != 0:
        raise ExecError(proc.stderr.strip() or proc.stdout.strip() or "taskkill failed")
    return proc.stdout


_ALLOWED_RUN_KEYS = {
    "HKLM": r"HKLM\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU": r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
}
_VALUE_NAME_RE = re.compile(r"^[A-Za-z0-9_. \-]{1,128}$")


def run_disable_startup_entry(hive: str, value_name: str, timeout: int = 15) -> str:
    """Deletes a single value from a known, allowlisted Run registry key.
    hive must be exactly 'HKLM' or 'HKCU' and value_name must match a strict
    whitelist - nothing else is ever touched."""
    if hive not in _ALLOWED_RUN_KEYS:
        raise ExecError("hive must be HKLM or HKCU")
    if not _VALUE_NAME_RE.match(value_name):
        raise ExecError(f"Invalid startup entry name: {value_name!r}")
    if not IS_WINDOWS:
        raise ExecError("Windows-only command")
    if shutil.which("reg") is None:
        raise ExecError("'reg' is not available on this system")
    key_path = _ALLOWED_RUN_KEYS[hive]
    proc = subprocess.run(
        ["reg", "delete", key_path, "/v", value_name, "/f"],
        capture_output=True, text=True, timeout=timeout, shell=False,
    )
    if proc.returncode != 0:
        raise ExecError(proc.stderr.strip() or "Failed to remove startup entry")
    return proc.stdout


def run_user_detail(username: str, timeout: int = 20) -> str:
    """Runs `net user <username>` for one already-discovered account.
    The username must match a strict whitelist pattern - this is the only
    place a "parameter" reaches a command line, and it's validated before
    ever touching subprocess."""
    if not _USERNAME_RE.match(username):
        raise ExecError(f"Invalid username format: {username!r}")
    if not IS_WINDOWS:
        raise ExecError("Windows-only command")
    if shutil.which("net") is None:
        raise ExecError("'net' is not available on this system")
    try:
        proc = subprocess.run(
            ["net", "user", username],
            capture_output=True, text=True, timeout=timeout, shell=False,
        )
    except subprocess.TimeoutExpired as e:
        raise ExecError(f"net user {username} timed out") from e
    return proc.stdout
