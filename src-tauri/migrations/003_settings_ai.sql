-- System settings
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    school_year TEXT NOT NULL DEFAULT 'AY 2025-2026',
    admin_password TEXT NOT NULL DEFAULT 'admin1234',
    cbu_reg_pct REAL NOT NULL DEFAULT 300,
    cbu_st_pct REAL NOT NULL DEFAULT 80,
    cbu_com_pct REAL NOT NULL DEFAULT 80,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT OR IGNORE INTO settings (id, school_year, admin_password, cbu_reg_pct, cbu_st_pct, cbu_com_pct)
VALUES (1, 'AY 2025-2026', 'admin1234', 300, 80, 80);

-- Nemotron AI configuration
CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nemotron_api_key TEXT DEFAULT '',
    nemotron_model TEXT NOT NULL DEFAULT 'nvidia/nemotron-3-5-super-vl',
    nemotron_api_url TEXT NOT NULL DEFAULT 'https://integrate.api.nvidia.com/v1/chat/completions',
    deepseek_api_key TEXT DEFAULT '',
    deepseek_model TEXT NOT NULL DEFAULT 'deepseek-chat',
    deepseek_api_url TEXT NOT NULL DEFAULT 'https://api.deepseek.com/v1/chat/completions',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_config (id, nemotron_model, nemotron_api_url, deepseek_model, deepseek_api_url)
VALUES (1, 'nvidia/nemotron-3-5-super-vl', 'https://integrate.api.nvidia.com/v1/chat/completions', 'deepseek-chat', 'https://api.deepseek.com/v1/chat/completions');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settings_id ON settings(id);
