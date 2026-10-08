import sqlite3
import json
import time
import os
from contextlib import contextmanager

_DB_PATH = None


def init_db(path):
    global _DB_PATH
    _DB_PATH = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                scan_type TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at REAL NOT NULL,
                finished_at REAL,
                overall_score INTEGER,
                overall_label TEXT,
                results_json TEXT,
                findings_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS terminal_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id TEXT,
                line TEXT,
                created_at REAL
            )
        """)
        conn.commit()


@contextmanager
def get_conn():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def create_scan(scan_id, scan_type):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO scans (id, scan_type, status, started_at) VALUES (?,?,?,?)",
            (scan_id, scan_type, "running", time.time()),
        )
        conn.commit()


def finish_scan(scan_id, results, findings, overall):
    with get_conn() as conn:
        conn.execute(
            """UPDATE scans SET status=?, finished_at=?, results_json=?, findings_json=?,
               overall_score=?, overall_label=? WHERE id=?""",
            ("completed", time.time(), json.dumps(results), json.dumps(findings),
             overall["score"], overall["label"], scan_id),
        )
        conn.commit()


def fail_scan(scan_id, error):
    with get_conn() as conn:
        conn.execute(
            "UPDATE scans SET status=?, finished_at=?, results_json=? WHERE id=?",
            ("failed", time.time(), json.dumps({"error": error}), scan_id),
        )
        conn.commit()


def get_scan(scan_id):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM scans WHERE id=?", (scan_id,)).fetchone()
        return dict(row) if row else None


def list_scans(limit=50):
    with get_conn() as conn:
        rows = conn.execute("SELECT id, scan_type, status, started_at, finished_at, overall_score, overall_label FROM scans ORDER BY started_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]


def latest_completed_scan():
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM scans WHERE status='completed' ORDER BY finished_at DESC LIMIT 1").fetchone()
        return dict(row) if row else None


def add_terminal_line(scan_id, line):
    with get_conn() as conn:
        conn.execute("INSERT INTO terminal_log (scan_id, line, created_at) VALUES (?,?,?)", (scan_id, line, time.time()))
        conn.commit()


def get_setting(key, default=None):
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default


def set_setting(key, value):
    with get_conn() as conn:
        conn.execute("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value))
        conn.commit()


def get_all_settings():
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}
