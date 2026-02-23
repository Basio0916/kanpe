CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled session',
    duration TEXT NOT NULL DEFAULT '0:00',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    summary TEXT NOT NULL DEFAULT '',
    participants INTEGER NOT NULL DEFAULT 0,
    ai_assists INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS captions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    time TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('MIC', 'SYS')),
    status TEXT NOT NULL CHECK(status IN ('interim', 'final')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('recap', 'next-speak', 'followup', 'questions')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captions_session ON captions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_session ON ai_logs(session_id);
