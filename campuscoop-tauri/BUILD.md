# CampusCoop - Setup & Build Guide

## 📁 Project Structure
```
campuscoop-tauri/          # Tauri + React + Vite desktop app
├── src/                   # React frontend (Deepseek agent)
├── src-tauri/             # Rust backend (Nemotron agent)
│   ├── src/               # Rust source
│   ├── migrations/        # SQLite schema migrations
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri config
├── capacitor.config.ts    # Capacitor mobile config
├── .env.example           # API keys template
├── AGENTS.md              # Agent assignments
└── package.json           # Node.js dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd campuscoop-tauri
npm install
```

### 2. Configure API Keys
```bash
cp .env.example .env
# Edit .env and add your NVIDIA NIM API key for Nemotron
```

### 3. Run in Development (Desktop)
```bash
# Terminal 1: Start the Vite dev server
npm run dev

# Terminal 2: Start Tauri (in another terminal)
npm run tauri:dev
```

### 4. Build for Production
```bash
npm run tauri:build
```

### 5. Mobile (Capacitor) - Optional
```bash
# Initialize Capacitor (one-time)
npm run capacitor:init

# Add Android
npm run capacitor:add:android

# Build web assets + sync
npm run build
npm run capacitor:sync

# Open in Android Studio
npm run capacitor:open:android
```

## 🤖 Agent Assignments

| Role | Agent | Model | Files |
|------|-------|-------|-------|
| Backend | Nemotron 3.5 Super VL | `nvidia/nemotron-3-5-super-vl` | `src-tauri/src/` |
| Frontend | Deepseek | `deepseek-chat` | `src/` |
| Database | SQLite (free, embedded) | — | `campuscoop.db` |
| Testing | Beam Free | — | QA |

## 📊 Database: SQLite (Free)
- Zero-cost, serverless, single file (`campuscoop.db`)
- Auto-created on first launch
- Migrations in `src-tauri/migrations/`
- No Render setup needed — runs locally

## 🔐 Default Logins
| Role | Username | Password |
|------|----------|----------|
| Master Admin | ICMADMIN | ICM12345 |
| Member | 09171234567 | sksu1234 |
| Officer (demo) | 1 | 1 |

## 📝 Features Ported from Apps Script
- Member login & profile setup
- Officer login (5 roles)
- Loan applications (apply, approve, reject, release)
- Payment recording with OR numbers
- Member dashboard with CBU tracking
- Treasurer release queue
- Settings management
- Nemotron AI chat & loan recommendations

## 🌐 Admin on Render
You mentioned setting up an admin on Render. Since this is a Tauri desktop app with local SQLite, you don't need Render for the database. However, if you want a web admin panel, you can deploy the Vite build (`npm run build`) to Render as a static site, and it will connect to the Tauri desktop app or a separate API.
