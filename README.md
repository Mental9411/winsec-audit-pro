# Windows Security Audit Pro

A read-only Windows security auditing desktop application: scans local
security posture (users, firewall, Defender, ports, processes, startup,
scheduled tasks, shares, software, password policy, ARP table, system info),
scores risk, visualizes results, generates reports, and includes an AI
Security Assistant that explains findings in plain English.

> **v1.0.1 fixes:** the overall security score formula was a flat linear
> sum with no caps, so a small handful of findings could floor it at 0
> with no differentiation between "a few real issues" and "everything is
> broken" (see `risk_engine.compute_overall_score`) - it now uses
> diminishing returns and per-severity caps for a much more informative
> score. The AI Assistant's error messages are also now provider-specific
> and actionable (e.g. "Ollama isn't reachable - install it and run
> `ollama pull llama3`") instead of a raw exception string, and there's a
> new **Test Connection** button in Settings plus a readiness banner on
> the AI Assistant page (`GET /api/ai/status`).

> **v1.0.2 fixes:** the Live Terminal page had two real client-side bugs
> in `frontend/src/lib/ws.js`. First, its dev WebSocket URL was hardcoded
> to `ws://localhost:5174/ws` - if Vite fell back to a different port
> (5174 already in use) or the app was accessed from a different
> host/port, the socket silently failed forever with no visible error
> while the rest of the app (which uses relative `/api` calls) kept
> working fine. Second, `wsClient` is a singleton that starts connecting
> the instant the app loads, but each page only registered its listener on
> mount - so navigating to Live Terminal *after* a scan already ran showed
> nothing, since that page only displayed messages that happened to arrive
> after you got there. The client now derives its URL from the page's
> actual host (with a `127.0.0.1:8000` fallback for packaged Electron
> builds loading via `file://`), keeps a rolling backlog per event so
> late-mounting pages get full history immediately, and Live Terminal now
> shows a live/reconnecting status indicator.

```
Frontend : React + Vite + Tailwind CSS v4 + Framer Motion + Chart.js/Recharts + lucide-react
Backend  : Python FastAPI + WebSockets + SQLite + ReportLab
Desktop  : Electron shell wrapping the frontend, talking to the local backend over HTTP/WS
```

## How this works

The backend runs a fixed set of **read-only** Windows diagnostic commands
(`net user`, `netstat -ano`, `tasklist`, `netsh advfirewall show allprofiles`,
etc.), parses their output, evaluates it against a risk-scoring engine, and
serves the results over REST + WebSocket to the React UI. The two state-
changing actions the brief asks for (kill a process, disable a startup
entry) are implemented but **gated**: they require an explicit `confirm`
flag and only operate on a PID/entry that was actually observed in the
most recent scan - there's no free-text "run this command" endpoint
anywhere in the app.

### Why some modules say "unavailable"

All 13 modules run genuinely on Windows. If you run the backend on macOS/
Linux (e.g. for frontend development), the Windows-only commands aren't
present, and the API reports each module as unavailable rather than
faking scan data - you'll see this reflected honestly in the UI. Run the
backend on a real Windows machine (or a Windows VM) to get live results.

### Command execution safety (`backend/app/utils/safe_exec.py`)

- **Never uses `shell=True`.** Every diagnostic command is a fixed,
  hard-coded argument list in code - nothing from a request body is ever
  concatenated into a command line.
- Only a fixed allowlist of read-only commands can run (see
  `MODULE_COMMANDS`). There is no generic "execute command" endpoint.
- The few parameterized lookups (`net user <username>` for per-account
  detail) validate the parameter against a strict whitelist regex before
  it ever reaches `subprocess`.
- `kill-process` and `disable-startup` (the only mutating actions) require
  `confirm: true` in the request AND cross-check the target against the
  most recently scanned process/startup list - you can't kill a PID the
  app hasn't itself observed.

## AI Security Assistant

No AI provider or API key ships with this app. Configure your own in
Settings:
- **Ollama** (default) - a free local model, no key needed. Install
  [Ollama](https://ollama.com), pull a model (e.g. `ollama pull llama3`),
  and the app talks to it at `http://localhost:11434`.
- **OpenAI-compatible endpoint** - bring your own API key and base URL
  (works with OpenAI itself or any compatible self-hosted/proxy server).
- **Anthropic** - bring your own Claude API key.

The assistant is given the latest scan's findings as context (see
`backend/app/utils/ai_assistant.py`) so it can answer questions about
*your* system - explaining findings, suggesting hardening steps, drafting
PowerShell remediation scripts, and writing executive summaries.

## Quick start (development)

**Backend** (works on any OS for UI development; run on Windows for real scans)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5174, proxies /api and /ws to :8000
```

**Electron (desktop shell, dev mode)**
```bash
# with backend + frontend dev servers already running:
cd electron
npm install
npm start
```

## Building a distributable Windows app

1. Build the frontend: `cd frontend && npm run build` → `frontend/dist`
2. Bundle the Python backend into a standalone executable with
   [PyInstaller](https://pyinstaller.org/):
   ```bash
   cd backend
   pip install pyinstaller
   pyinstaller --onefile --name winsec-backend run.py
   # outputs backend/dist/winsec-backend.exe on Windows
   ```
3. Package the desktop app:
   ```bash
   cd electron
   npm install
   npm run dist   # electron-builder → ../release/*.exe (NSIS installer)
   ```

`electron/main.js` looks for the bundled backend executable at
`resources/backend/winsec-backend.exe` in a packaged build and starts it
automatically; in dev mode it assumes you're already running `uvicorn`
separately.

## Project structure

```
winsec-audit-pro/
├── backend/
│   ├── app/
│   │   ├── modules/scanner.py     # orchestrates one scan (exec → parse → risk)
│   │   ├── routes/                # scan, reports, actions, settings, ai, ws, dashboard
│   │   └── utils/
│   │       ├── safe_exec.py       # allowlisted, no-shell command execution
│   │       ├── parsers.py         # raw command output -> structured data
│   │       ├── risk_engine.py     # findings + 0-100 scoring
│   │       ├── reports.py         # PDF / HTML / JSON / CSV generation
│   │       ├── ai_assistant.py    # configurable AI provider chat
│   │       └── db.py              # SQLite: scans, findings, settings
│   └── run.py
├── frontend/
│   └── src/
│       ├── pages/                 # Landing, ScanScreen, Dashboard, AuditModules, …
│       ├── components/            # Sidebar, Topbar, GlassCard, DataTable, ScoreGauge…
│       └── lib/                   # api.js (REST), ws.js (WebSocket client)
└── electron/
    ├── main.js                    # spawns bundled backend + loads the UI
    └── preload.js                 # minimal, sandboxed - no privileged APIs exposed
```

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/scan/modules` | Which modules are available on this host |
| POST | `/api/scan/start` | Start a scan (`quick`\|`deep`\|`full`) |
| POST | `/api/scan/{id}/cancel` | Cancel a running scan |
| GET | `/api/scan/{id}` | Full results + findings for one scan |
| GET | `/api/scan/latest` | Latest completed scan |
| GET | `/api/scan/history` | Scan history |
| GET | `/api/dashboard/summary` | Aggregated dashboard data |
| GET | `/api/reports/{id}/{pdf\|html\|json\|csv}` | Download a report |
| POST | `/api/actions/kill-process` | Terminate a PID (requires `confirm: true`, must be in latest scan) |
| POST | `/api/actions/disable-startup` | Remove a Run-key startup entry (requires `confirm: true`) |
| GET/PUT | `/api/settings` | Read/update settings incl. AI provider config |
| POST | `/api/ai/chat` | Chat with the AI assistant (scan-aware) |
| WS | `/ws` | Live scan progress, terminal lines, notifications |

## Security notes

- **Read-only by default.** Every module in `MODULE_COMMANDS` is a
  diagnostic, non-mutating command.
- The two mutating actions (kill process, disable startup entry) require
  explicit confirmation and are cross-checked against real, previously
  observed scan data - not free-text input.
- History, findings, and settings (including your AI API key) are stored
  **locally** in SQLite - nothing is sent anywhere except your own chosen
  AI provider, and only when you use the AI Assistant.
- CORS is open (`*`) for local development - this app is designed to run
  entirely on `localhost` via the Electron shell; if you expose the backend
  more broadly, lock down CORS and add authentication first.
- This is intended for auditing systems you own or are authorized to
  assess - for security administrators, educators, and students.
"# winsec-audit-pro" 
