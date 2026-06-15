-- 조직도
CREATE TABLE IF NOT EXISTS org_unit (
    id           TEXT PRIMARY KEY,
    level        TEXT NOT NULL CHECK(level IN ('company','division','hq','team')),
    parent_id    TEXT,
    name         TEXT NOT NULL,
    leader       TEXT,
    leader_title TEXT,
    leader_role  TEXT
);

-- 세션 (날짜는 session_schedule에서 관리)
CREATE TABLE IF NOT EXISTS session (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type                TEXT    NOT NULL CHECK(type IN ('팀장', '팀빌딩', '크로스펑셔널')),
    cohort              INTEGER NOT NULL,
    division            TEXT,
    bonbu               TEXT,
    team                TEXT,
    participating_teams TEXT,
    linked_session_id   INTEGER,
    target_weeks        INTEGER,        -- 목표 주수 (참고용, 실제는 스케줄로 결정)
    created_at          TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (linked_session_id) REFERENCES session(id)
);

-- 회차별 스케줄
CREATE TABLE IF NOT EXISTS session_schedule (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     INTEGER NOT NULL REFERENCES session(id),
    seq            INTEGER NOT NULL,        -- 회차 번호
    scheduled_date TEXT,                    -- YYYY-MM-DD (NULL = 미정)
    start_time     TEXT DEFAULT '10:00',    -- HH:MM
    duration_min   INTEGER,                 -- 소요 시간(분)
    content_name   TEXT,                    -- 콘텐츠명
    content_note   TEXT,                    -- 메모
    status         TEXT DEFAULT 'planned'
                   CHECK(status IN ('planned','confirmed','completed','cancelled')),
    created_at     TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 응답
CREATE TABLE IF NOT EXISTS response (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES session(id),
    cohort     INTEGER NOT NULL,
    phase      TEXT    NOT NULL CHECK(phase IN ('사전', '중간', '사후')),
    q1 INTEGER, q2 INTEGER, q3 INTEGER,
    q4 INTEGER, q5 INTEGER, q6 INTEGER,
    q7 INTEGER, q8 INTEGER,
    q9  TEXT, q10 TEXT, q11 TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 기수×phase×문항 평균 집계 뷰
CREATE VIEW IF NOT EXISTS cohort_stat AS
SELECT
    s.type,
    r.cohort,
    r.phase,
    COUNT(*)   AS n,
    AVG(r.q1)  AS q1_avg, AVG(r.q2) AS q2_avg, AVG(r.q3) AS q3_avg,
    AVG(r.q4)  AS q4_avg, AVG(r.q5) AS q5_avg, AVG(r.q6) AS q6_avg,
    AVG(r.q7)  AS q7_avg,
    AVG(r.q8)  AS q8_avg
FROM response r
JOIN session s ON s.id = r.session_id
GROUP BY s.type, r.cohort, r.phase;
