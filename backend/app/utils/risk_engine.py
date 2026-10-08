"""
Turns parsed module data into a list of findings (with severity) and an
overall 0-100 security score. Pure functions, easy to unit test.
"""
from .parsers import SUSPICIOUS_PORTS

SEVERITY_WEIGHT = {"critical": 25, "high": 15, "medium": 8, "low": 3, "info": 0}
# Max total penalty any one severity bucket can contribute, no matter how
# many findings of that severity pile up - see compute_overall_score.
SEVERITY_CAP = {"critical": 80, "high": 50, "medium": 30, "low": 15, "info": 0}
SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"]


def finding(module, severity, title, description):
    return {"module": module, "severity": severity, "title": title, "description": description}


def evaluate_users(usernames: list, details_by_user: dict) -> list:
    findings = []
    guest_active = details_by_user.get("Guest", {}).get("account_active", "").lower() == "yes"
    if guest_active:
        findings.append(finding("users", "high", "Guest account is enabled",
                                 "The built-in Guest account allows anonymous or low-friction access and should be disabled unless specifically required."))
    for uname, detail in details_by_user.items():
        no_password = detail.get("password_required", "").lower() == "no"
        active = detail.get("account_active", "").strip().lower() == "yes"
        if no_password and active:
            findings.append(finding("users", "critical", f"Account '{uname}' has no password required",
                                     "This account is enabled AND doesn't require a password - a critical, trivially exploitable weakness."))
        elif no_password and not active:
            # A disabled account can't be logged into regardless of its password
            # setting, so this is worth noting but isn't an active exploit path -
            # flagging it as critical (as an earlier version of this check did)
            # produces false positives for Windows' own disabled built-in
            # accounts (Guest, DefaultAccount, WDAGUtilityAccount, WsiAccount, etc.)
            # and tanks the score even on a freshly-installed, well-configured system.
            findings.append(finding("users", "low", f"Disabled account '{uname}' has no password required",
                                     "The account is currently disabled, so this isn't exploitable today - but set a password before ever re-enabling it."))
    admin_like = [u for u in usernames if u.lower() not in ("guest", "defaultaccount", "wdagutilityaccount")]
    if len(admin_like) > 8:
        findings.append(finding("users", "low", f"{len(admin_like)} local accounts present",
                                 "A large number of local accounts increases the attack surface - review for unused accounts."))
    return findings


def evaluate_admin_group(members: list) -> list:
    findings = []
    non_standard = [m for m in members if m.lower() not in ("administrator",)]
    if len(members) > 3:
        findings.append(finding("admin_group", "medium", f"{len(members)} accounts have administrator rights",
                                 "Minimize standing administrator membership to reduce blast radius if any one account is compromised."))
    if non_standard and len(non_standard) == len(members):
        findings.append(finding("admin_group", "info", "Built-in Administrator not listed",
                                 "Confirm the built-in Administrator account is intentionally excluded or disabled, not just hidden."))
    return findings


def evaluate_ports(ports: list) -> list:
    findings = []

    listening = [
        p for p in ports
        if p["state"] == "LISTENING" or p["protocol"] == "UDP"
    ]

    # 0.0.0.0 means the service is bound to all IPv4 interfaces.
    # It does NOT automatically mean the port is remotely or
    # Internet exposed. Firewall and network reachability must
    # be verified separately.
    all_interfaces = [
        p for p in listening
        if p["local_address"].startswith("0.0.0.0")
    ]

    seen_ports = set()

    for p in all_interfaces:
        try:
            port_num = int(p["local_address"].rsplit(":", 1)[-1])
        except ValueError:
            continue

        if port_num in SUSPICIOUS_PORTS and port_num not in seen_ports:
            seen_ports.add(port_num)

            # A listener bound to all interfaces is an attack-surface
            # observation, but it is not proof of remote exposure.
            severity = "medium"

            findings.append(
                finding(
                    "open_ports",
                    severity,
                    f"Port {port_num} ({SUSPICIOUS_PORTS[port_num]}) is listening",
                    (
                        f"{SUSPICIOUS_PORTS[port_num]} is listening on all "
                        f"IPv4 interfaces (0.0.0.0). This does not by itself "
                        f"confirm remote or Internet exposure. Verify Windows "
                        f"Firewall rules and remote reachability."
                    ),
                )
            )

    if len(listening) > 25:
        findings.append(
            finding(
                "open_ports",
                "low",
                f"{len(listening)} listening ports found",
                "A large number of listening services increases attack surface - review which are actually needed.",
            )
        )

    return findings

def evaluate_processes(procs: list) -> list:
    findings = []
    unsigned_hint = [p for p in procs if p["name"].lower() not in KNOWN_SYSTEM_PROCS and p["user"] == ""]
    if len(unsigned_hint) > 0:
        findings.append(finding("processes", "info", f"{len(unsigned_hint)} system-context processes without a user session",
                                 "Normal for many system services - cross-check any unfamiliar names against vendor documentation."))
    high_mem = [p for p in procs if p["mem_kb"] > 1_500_000]
    if high_mem:
        findings.append(finding("processes", "low", f"{len(high_mem)} process(es) using over 1.5GB RAM",
                                 "High memory usage isn't inherently a security issue, but unexpected processes doing so are worth investigating."))
    return findings


KNOWN_SYSTEM_PROCS = {"system", "system idle process", "registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe", "lsass.exe"}


def evaluate_scheduled_tasks(tasks: list) -> list:
    findings = []
    unknown_authors = [t for t in tasks if t["author"] in ("N/A", "Unknown", "") and t["task_name"] not in ("N/A",)]
    if len(unknown_authors) > 3:
        findings.append(finding("scheduled_tasks", "medium", f"{len(unknown_authors)} scheduled tasks with no listed author",
                                 "Tasks without a clear author/publisher are harder to attribute - review for anything unexpected, especially ones running as SYSTEM."))
    return findings


def evaluate_startup(items: list) -> list:
    findings = []
    unknown = [i for i in items if not i["command"] or "unknown" in i["caption"].lower()]
    if unknown:
        findings.append(finding("startup", "medium", f"{len(unknown)} startup entries with missing command info",
                                 "Startup entries with no resolvable command path are common malware persistence indicators - verify each one."))
    if len(items) > 15:
        findings.append(finding("startup", "low", f"{len(items)} programs configured to run at startup",
                                 "A large number of startup items can slow boot time and expand the attack surface."))
    return findings


def evaluate_firewall(profiles: dict) -> list:
    findings = []
    for name, data in profiles.items():
        if data.get("state") == "OFF":
            findings.append(finding("firewall", "critical", f"{name.title()} firewall profile is disabled",
                                     f"The Windows Firewall is OFF for the {name} profile, leaving the system unprotected from unsolicited inbound network traffic on that profile."))
    return findings


def evaluate_defender(defender: dict) -> list:
    findings = []
    if not defender.get("running"):
        findings.append(finding("defender", "critical", "Microsoft Defender is not running",
                                 f"Windows Defender service state is '{defender.get('state')}'. Real-time malware protection is not active."))
    return findings


def evaluate_password_policy(policy: dict) -> list:
    findings = []
    try:
        min_len = int(policy.get("min_password_length", "0"))
    except ValueError:
        min_len = 0
    if min_len < 8:
        findings.append(finding("password_policy", "high", f"Minimum password length is only {min_len} characters",
                                 "NIST and CIS benchmarks recommend a minimum of 8-14 characters depending on whether MFA is also enforced."))
    if str(policy.get("lockout_threshold", "")).lower() in ("never", "0"):
        findings.append(finding("password_policy", "high", "Account lockout threshold is disabled",
                                 "Without a lockout threshold, accounts are vulnerable to unlimited online password-guessing attempts."))
    try:
        history = int(policy.get("password_history", "0"))
        if history < 5:
            findings.append(finding("password_policy", "medium", f"Password history only remembers {history} password(s)",
                                     "A short password history lets users cycle back to old, possibly-compromised passwords quickly."))
    except ValueError:
        pass
    return findings


def evaluate_shares(shares: list) -> list:
    findings = []
    non_admin = [s for s in shares if not s["is_admin_share"]]
    if non_admin:
        findings.append(finding("shares", "medium", f"{len(non_admin)} non-administrative share(s) exposed",
                                 "Review permissions on each shared folder to ensure only intended users/groups have access."))
    return findings


def evaluate_software(software: list) -> list:
    findings = []
    if len(software) > 150:
        findings.append(finding("software", "info", f"{len(software)} software packages installed",
                                 "A large software footprint increases patching burden - consider removing unused applications."))
    return findings


def evaluate_arp(entries: list) -> list:
    findings = []
    mac_to_ips = {}
    for e in entries:
        mac_to_ips.setdefault(e["mac"], set()).add(e["ip"])
    duplicates = {mac: ips for mac, ips in mac_to_ips.items() if len(ips) > 1 and mac not in ("ff-ff-ff-ff-ff-ff",)}
    if duplicates:
        findings.append(finding("arp_table", "high", f"{len(duplicates)} MAC address(es) mapped to multiple IPs",
                                 "This can indicate ARP spoofing/poisoning on the local network segment - investigate immediately."))
    return findings


def compute_overall_score(all_findings: list) -> dict:
    """
    Turns a list of findings into a 0-100 score.

    The naive version of this (flat `100 - sum(weights)`) has a real problem:
    a handful of findings - even a single legitimate critical plus a couple
    of mediums - can trivially floor the score at 0, with zero
    differentiation between "a few real issues" and "everything is on
    fire". That makes the score useless as a signal.

    Instead, each severity's contribution grows with diminishing returns
    (the first finding counts fully, each additional one adds less) and is
    capped, so:
      - one critical + a couple of lower-severity findings lands in a
        realistic "Poor/Fair" range instead of an uninformative 0, and
      - a system that's genuinely bad across every category still bottoms
        out low, but the score before that point stays meaningful.
    """
    counts = {s: 0 for s in SEVERITY_ORDER}
    for f in all_findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1

    penalty = 0.0
    for sev, count in counts.items():
        if count == 0:
            continue
        base = SEVERITY_WEIGHT.get(sev, 0)
        cap = SEVERITY_CAP.get(sev, 0)
        # First finding costs the full base weight; each additional finding
        # of the same severity adds only 40% as much, so repeats of the
        # same issue type don't linearly keep crushing the score.
        raw = base * (1 + 0.4 * (count - 1))
        penalty += min(cap, raw)

    score = max(0, round(100 - penalty))
    if score >= 85:
        label = "Excellent"
    elif score >= 70:
        label = "Good"
    elif score >= 50:
        label = "Fair"
    elif score >= 30:
        label = "Poor"
    else:
        label = "Critical"
    return {"score": score, "label": label, "counts": counts, "total_findings": len(all_findings)}
