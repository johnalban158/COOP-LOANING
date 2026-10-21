-- Officers table
CREATE TABLE IF NOT EXISTS officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    fullname TEXT NOT NULL,
    mobile TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    created_by TEXT DEFAULT 'ICMADMIN',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    school_year TEXT NOT NULL DEFAULT 'AY 2025-2026',
    last_login TEXT,
    must_change_pw INTEGER NOT NULL DEFAULT 1
);

-- Deductions table
CREATE TABLE IF NOT EXISTS deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 0,
    applies_to TEXT DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    created_by TEXT DEFAULT 'Officer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Remarks table
CREATE TABLE IF NOT EXISTS remarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_officers_email ON officers(email);
CREATE INDEX IF NOT EXISTS idx_officers_role ON officers(role);
CREATE INDEX IF NOT EXISTS idx_deductions_member_id ON deductions(member_id);
CREATE INDEX IF NOT EXISTS idx_remarks_member_id ON remarks(member_id);
