# 🤖 CampusCoop — Agent Assignments

This document defines the AI agent roles for the CampusCoop migration project.

## Agent Roster

| Role | Agent | Model | Responsibility |
|------|-------|-------|----------------|
| **Backend Agent** | Nemotron 3.5 Super VL | `nvidia/nemotron-3-5-super-vl` | Rust/Tauri commands, SQLite DB logic, AI chat, document analysis, loan recommendations |
| **Frontend Agent** | Deepseek | `deepseek-chat` | React + Vite UI, components, pages, state, API integration, styling |
| **Database** | — | **SQLite** (free, embedded) | Local file-based database at `campuscoop.db` — no server required |
| **Testing** | — | **Beam Free** | Test execution & QA |

---

## Stack Summary

- **Desktop Framework**: Tauri v2 (Rust backend)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Routing**: React Router DOM v6
- **Database**: SQLite (via `tauri-plugin-sql`) — free, zero-config, single file
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **HTTP Client**: axios
- **Mobile**: Capacitor (optional, for Android/iOS builds)
- **Backend AI**: Nemotron 3.5 Super VL (via NVIDIA NIM API)
- **Frontend AI Config**: Deepseek (code assistance, loan calculator, chat)

---

## File Map (Agents)

```
campuscoop-tauri/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entry + command registration (Nemotron)
│   │   ├── commands.rs          # All Tauri command bridges (Nemotron)
│   │   ├── models.rs            # Data models / structs (Nemotron)
│   │   ├── database.rs          # SQLite connection + migrations (Nemotron)
│   │   ├── auth.rs              # Member/officer/auth logic (Nemotron)
│   │   ├── loans.rs             # Loan CRUD, approval, release (Nemotron)
│   │   ├── payments.rs          # Payment record, confirm, OR numbers (Nemotron)
│   │   ├── members.rs           # Members, dashboard, CBU, settings (Nemotron)
│   │   ├── officers.rs          # Officer account management (Nemotron)
│   │   └── nemotron.rs          # Nemotron 3.5 Super VL AI integration (Nemotron)
│   ├── migrations/
│   │   ├── 001_initial.sql      # Core schema (members, loans, payments, apps)
│   │   ├── 002_officers_deductions.sql
│   │   └── 003_settings_ai.sql  # Settings + AI config
│   ├── Cargo.toml               # Rust dependencies (Nemotron)
│   └── tauri.conf.json          # Tauri config (Nemotron)
├── src/                         # React frontend (Deepseek)
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── lib/
│   └── types.ts
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── AGENTS.md                    # This file
```

---

## Database Choice: SQLite

**Why SQLite (free):**
- Zero server cost — runs as a local file (`campuscoop.db`)
- No setup required on user's machine
- ACID compliant, supports concurrent reads
- Works offline (desktop-first Tauri app)
- Easy to backup (copy single file)
- `tauri-plugin-sql` provides first-class Tauri integration

**Migration path from Google Sheets:** Your existing Google Sheets data can be imported via CSV into SQLite during first launch.

---

## Testing: Beam Free

Use Beam Free for test execution and QA on:
- Auth flows (login, reset, profile setup)
- Loan application → approve → release workflow
- Payment recording → OR number → confirmation
- Member dashboard data consistency

---

## Environment Variables (Backend / Nemotron)

Create a `.env` file in `src-tauri/`:

```
NEMOTRON_API_KEY=your_nvidia_nim_api_key
NEMOTRON_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NEMOTRON_MODEL=nvidia/nemotron-3-5-super-vl
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

---

## How to Edit Faster

- **Frontend changes** → Edit `src/` (React/Deepseek agent) → `npm run dev` reloads instantly
- **Backend changes** → Edit `src-tauri/src/` (Nemotron agent) → `cargo run` or `npm run tauri:dev`
- **Database changes** → Add new migration SQL in `src-tauri/migrations/` (Nemotron agent)
- **AI features** → Edit `src-tauri/src/nemotron.rs` (Nemotron agent)
