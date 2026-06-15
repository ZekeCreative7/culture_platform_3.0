import sqlite3
import os
import json
from typing import Optional

_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_DIR, "culture.db")
SCHEMA_PATH = os.path.join(_DIR, "schema.sql")

TARGET_WEEKS = {"팀빌딩": 8, "팀장": 4, "크로스펑셔널": 6}


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema = f.read()
    conn = get_conn()
    conn.executescript(schema)
    conn.commit()
    conn.close()


# ── Org Chart ────────────────────────────────────────────────────

def get_org_units(level: str, parent_id: str = None) -> list:
    conn = get_conn()
    if parent_id:
        rows = conn.execute(
            "SELECT * FROM org_unit WHERE level=? AND parent_id=? ORDER BY name",
            (level, parent_id),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM org_unit WHERE level=? ORDER BY name", (level,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_org_unit(unit_id: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM org_unit WHERE id=?", (unit_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# ── Session ──────────────────────────────────────────────────────

def add_session(
    type_: str,
    cohort: int,
    division: str = None,
    bonbu: str = None,
    team: str = None,
    participating_teams: list = None,
    linked_session_id: int = None,
) -> int:
    pt_json = json.dumps(participating_teams, ensure_ascii=False) if participating_teams else None
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO session
           (type, cohort, division, bonbu, team, participating_teams,
            linked_session_id, target_weeks)
           VALUES (?,?,?,?,?,?,?,?)""",
        (type_, cohort, division, bonbu, team, pt_json,
         linked_session_id, TARGET_WEEKS[type_]),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id


def list_sessions() -> list:
    conn = get_conn()
    rows = conn.execute("SELECT * FROM session ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if d.get("participating_teams"):
            d["participating_teams"] = json.loads(d["participating_teams"])
        result.append(d)
    return result


def list_sessions_by_type(type_: str) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM session WHERE type=? ORDER BY created_at DESC", (type_,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_session(session_id: int) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute("SELECT * FROM session WHERE id=?", (session_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("participating_teams"):
        d["participating_teams"] = json.loads(d["participating_teams"])
    return d


# ── Session Schedule ──────────────────────────────────────────────

def add_schedule_items(session_id: int, items: list):
    """items: list of dicts with seq, scheduled_date, start_time, duration_min, content_name, content_note"""
    rows = [
        {
            "session_id":     session_id,
            "seq":            item["seq"],
            "scheduled_date": item.get("scheduled_date"),
            "start_time":     item.get("start_time", "10:00"),
            "duration_min":   item.get("duration_min", 60),
            "content_name":   item.get("content_name", ""),
            "content_note":   item.get("content_note", ""),
            "status":         "confirmed" if item.get("scheduled_date") else "planned",
        }
        for item in items
    ]
    conn = get_conn()
    conn.executemany(
        """INSERT INTO session_schedule
           (session_id, seq, scheduled_date, start_time, duration_min,
            content_name, content_note, status)
           VALUES (:session_id,:seq,:scheduled_date,:start_time,:duration_min,
                   :content_name,:content_note,:status)""",
        rows,
    )
    conn.commit()
    conn.close()


def get_schedule(session_id: int) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM session_schedule WHERE session_id=? ORDER BY seq",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_schedule_item(item_id: int, scheduled_date=None, start_time=None,
                         content_name=None, content_note=None, status=None):
    fields, vals = [], []
    if scheduled_date is not None:
        fields.append("scheduled_date=?"); vals.append(scheduled_date)
    if start_time is not None:
        fields.append("start_time=?"); vals.append(start_time)
    if content_name is not None:
        fields.append("content_name=?"); vals.append(content_name)
    if content_note is not None:
        fields.append("content_note=?"); vals.append(content_note)
    if status is not None:
        fields.append("status=?"); vals.append(status)
    if not fields:
        return
    vals.append(item_id)
    conn = get_conn()
    conn.execute(f"UPDATE session_schedule SET {', '.join(fields)} WHERE id=?", vals)
    conn.commit()
    conn.close()


def add_schedule_item(session_id: int, seq: int, scheduled_date=None,
                      start_time="10:00", duration_min=60,
                      content_name="", content_note=""):
    status = "confirmed" if scheduled_date else "planned"
    conn = get_conn()
    conn.execute(
        """INSERT INTO session_schedule
           (session_id, seq, scheduled_date, start_time, duration_min,
            content_name, content_note, status)
           VALUES (?,?,?,?,?,?,?,?)""",
        (session_id, seq, scheduled_date, start_time, duration_min,
         content_name, content_note, status),
    )
    conn.commit()
    conn.close()


# ── Response ─────────────────────────────────────────────────────

def save_responses(rows: list):
    conn = get_conn()
    conn.executemany(
        """INSERT INTO response
           (session_id, cohort, phase, q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11)
           VALUES (:session_id,:cohort,:phase,:q1,:q2,:q3,:q4,:q5,:q6,:q7,:q8,:q9,:q10,:q11)""",
        rows,
    )
    conn.commit()
    conn.close()


# ── Analytics ────────────────────────────────────────────────────

def get_all_cohorts() -> list:
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT cohort FROM response ORDER BY cohort").fetchall()
    conn.close()
    return [r["cohort"] for r in rows]


def get_cohort_stats(cohort: int, session_type: str = "팀장") -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM cohort_stat WHERE cohort=? AND type=?",
        (cohort, session_type),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_qualitative(session_id: int, phase: str) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT q9, q10, q11 FROM response WHERE session_id=? AND phase=?",
        (session_id, phase),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_phases_for_session(session_id: int) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT phase FROM response WHERE session_id=?", (session_id,)
    ).fetchall()
    conn.close()
    return [r["phase"] for r in rows]


def get_cohort_stats_all_types(cohort: int) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM cohort_stat WHERE cohort=?", (cohort,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
