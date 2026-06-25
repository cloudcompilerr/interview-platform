# Architecture

## Overview

Interview Platform is a single-page React application with no backend. Every feature — authentication, interview recording, scoring, reporting, and data export — runs client-side in the browser.

```
Browser
  ├─ React app (src/App.jsx)
  │    ├─ Login gate (demo auth, no server)
  │    ├─ Dashboard / New Interview / Question Bank / Data & Reports / Settings / Report views
  │    ├─ Report builders (TXT / JSON / CSV)
  │    └─ Optional: direct browser → Anthropic API call (bring-your-own key) for feedback collation
  └─ localStorage
       ├─ ip_session_v1     (current logged-in user)
       ├─ ip_domains_v2     (domains + leveled question bank, with reference answers)
       ├─ ip_interviews_v2  (all interview records)
       └─ ip_settings_v1    (your own Anthropic API key, if you choose to add one)
```

There is no backend server and no database. The only network call the app ever makes is the one optional, user-initiated request to Anthropic's API described below — everything else is local.

## How Offline Works

Once the browser has downloaded the app's static assets (HTML/CSS/JS bundle), every core interaction — creating an interview, rating a response, generating a report — is pure client-side JavaScript reading from and writing to `localStorage`. No fetch/XHR calls happen for any of that. This means:

- The app works on a plane, in a basement server room, anywhere, for every feature except the one below.
- The one exception is **"Generate Assessment from Notes"** in an interview session: if you've added your own Anthropic API key under **Settings**, that single button calls the Claude Messages API directly from your browser via `fetch()` (see `collateFeedbackWithAI()` in `src/App.jsx`) with the `anthropic-dangerous-direct-browser-access` header, to turn your bullet notes into a paragraph. A plain `fetch()` is used instead of `@anthropic-ai/sdk` because the SDK's credential-resolution code does a dynamic `import('node:fs')` that Create React App's stock Webpack 5 config can't bundle without ejecting. If there's no key, or `navigator.onLine` is false, or the request fails for any reason (rate limit, network error, etc.), the app catches that and falls back to `formatBulletsToParagraph()` — a deterministic, fully offline formatter — so the interview is never blocked. The "Computer Vision" / "Generative AI" domain names elsewhere in the app are just question categories and never trigger a model call.
- A service worker / PWA manifest (`public/manifest.json`) lets the app be "installed" on desktop/mobile home screens, but standard browser caching already makes repeat visits instant.

## `localStorage` Explained

`localStorage` is a key-value store built into every browser, scoped to the origin (protocol + domain + port) that wrote it. Interview Platform uses four keys:

| Key | Contents |
| --- | --- |
| `ip_session_v1` | `{ username, loginAt }` for the current session |
| `ip_domains_v2` | Array of `{ id, name, questions: [{ id, text, level, referenceAnswer }] }` |
| `ip_interviews_v2` | Array of full interview records (candidate, level, responses, scores, recommendation, feedback notes, timestamps) |
| `ip_settings_v1` | `{ anthropicApiKey }` — empty unless you've added a key under Settings |

Reads/writes are wrapped in try/catch (see `safeLoad` / `safeSave` in `src/App.jsx`) so a corrupted value or a full quota never crashes the app — it falls back to sensible defaults and logs the error to the console instead.

Typical `localStorage` quota is 5–10 MB per origin, which comfortably holds thousands of interview records as JSON text.

## GitHub Sync Strategy

`localStorage` is local to one browser on one machine — it is **not** synced across devices by default. To move data between machines or back it up off-device:

1. Use **Data & Reports → Export All Data** to download a single JSON backup file.
2. Commit that file into a `backups/` folder in this repo (optional), or store it wherever you keep backups.
3. On another machine, run the app and use **Import Backup** to restore it (merged by record ID, so re-importing is safe and idempotent).

The `.github/workflows/backup.yml` workflow runs daily and commits/pushes any pending repository changes (e.g. backup files you've added), giving you git history as a safety net — but it cannot reach into a user's browser, since GitHub Actions has no access to client-side `localStorage`.

## Component Structure

Everything lives in `src/App.jsx` as a single file, by design (easy to read top-to-bottom, easy to hand to another AI assistant or engineer for changes):

- **Constants & defaults** — storage keys, rating scale, recommendation/status enums, candidate `LEVELS`, the `BEHAVIORAL_DOMAIN_ID` constant (the domain spliced into every interview), default domains/questions, and `CLAUDE_MODEL_ID`
- **Pure utilities** — id generation, date formatting, `localStorage` helpers, report builders (TXT/CSV/JSON), CSV escaping, file download helper, `formatBulletsToParagraph()` (offline fallback), `collateFeedbackWithAI()` (optional Claude call)
- **Presentational components** — `Badge`, `EmptyState`, `ToastBanner`, `ErrorBoundary`
- **View components** — `LoginView`, `NavShell`, `DashboardView`, `NewInterviewView`, `SessionView`, `QuestionBankView`, `DataView`, `SettingsView`, `ReportView`
- **`InterviewPlatform`** — the orchestrator: owns all state, persists to `localStorage` via `useEffect`, and wires handlers down to each view
- **`APP_STYLES`** — a single inline CSS string injected via a `<style>` tag, covering layout, components, and responsive breakpoints

`src/index.css` holds global resets, design tokens (CSS variables), and typography that apply before React even mounts.

## Data Persistence

- State is initialized synchronously from `localStorage` on first render (lazy `useState` initializers), so there's no flash of empty data.
- Every state change (`domains`, `interviews`, `session`) is persisted via a `useEffect` that writes straight back to `localStorage`.
- Because writes happen on every change (not on a timer), there's no "save" button and no risk of losing the last few seconds of work to a crash or accidental tab close.

## Future Scaling Options

If/when a team outgrows a single-browser, single-machine tool:

- **Shared backend** — swap the `localStorage` read/write functions for `fetch` calls to a small API (e.g. a serverless function + a managed Postgres/SQLite instance). The view components don't need to change, only the data layer.
- **Real authentication** — replace the demo `LoginView` with OAuth (GitHub/Google) or your company SSO.
- **Multi-user collaboration** — once there's a backend, add per-interviewer accounts and shared visibility into the same candidate pipeline.
- **Search/filtering at scale** — for thousands of interviews, move from in-memory `Array.filter` to indexed queries once data lives in a real database.

None of this is required to use the app productively today — it's just the natural next step if requirements grow beyond what a single browser's local storage can reasonably hold.
