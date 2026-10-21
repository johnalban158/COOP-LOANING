-- Members table
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'sksu1234',
    email TEXT NOT NULL DEFAULT '',
    member_type TEXT NOT NULL DEFAULT 'JO',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    capital REAL NOT NULL DEFAULT 0,
    date_joined TEXT,
    phone TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    role TEXT NOT NULL DEFAULT 'Member',
    must_change_pw INTEGER NOT NULL DEFAULT 1,
    activated_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Loan applications table
CREATE TABLE IF NOT EXISTS loan_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    loan_type TEXT NOT NULL,
    amount_requested REAL NOT NULL,
    term INTEGER NOT NULL,
    date_submitted TEXT NOT NULL,
    date_approved TEXT,
    application_status TEXT NOT NULL DEFAULT 'Pending',
    reason_if_declined TEXT DEFAULT '',
    total_past_dues REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    net_proceeds REAL DEFAULT 0,
    date_released TEXT,
    released_by TEXT,
    school TEXT,
    purpose TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Loans table (approved loans)
CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    amount REAL NOT NULL,
    monthly_payment REAL NOT NULL,
    term_months INTEGER NOT NULL,
    total_payable REAL NOT NULL,
    date_released TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    balance REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    school_year TEXT,
    total_past_dues REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    net_proceeds REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Type-specific loan sheets (Regular, Commodity, Short-Term)
CREATE TABLE IF NOT EXISTS loans_regular (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    amount REAL NOT NULL,
    monthly_payment REAL NOT NULL,
    term_months INTEGER NOT NULL,
    total_payable REAL NOT NULL,
    date_released TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    balance REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    school_year TEXT,
    total_past_dues REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    net_proceeds REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans_commodity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    amount REAL NOT NULL,
    monthly_payment REAL NOT NULL,
    term_months INTEGER NOT NULL,
    total_payable REAL NOT NULL,
    date_released TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    balance REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    school_year TEXT,
    total_past_dues REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    net_proceeds REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loans_short_term (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    amount REAL NOT NULL,
    monthly_payment REAL NOT NULL,
    term_months INTEGER NOT NULL,
    total_payable REAL NOT NULL,
    date_released TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    balance REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    school_year TEXT,
    total_past_dues REAL DEFAULT 0,
    other_deductions REAL DEFAULT 0,
    net_proceeds REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_email TEXT NOT NULL DEFAULT '',
    loan_type TEXT NOT NULL,
    month_num INTEGER NOT NULL DEFAULT 1,
    amount REAL NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'Cash',
    reference TEXT DEFAULT '',
    date_paid TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    proof_url TEXT DEFAULT '',
    or_number TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_loans_member_id ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_applications_member_id ON loan_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON loan_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_or ON payments(or_number);
