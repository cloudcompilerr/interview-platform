# Interview Platform

A complete interview management and candidate assessment tool that runs entirely in your browser — no backend, no database, no monthly bill. Record interviews, score candidates, generate professional reports, and keep everything backed up to GitHub, all for **$0/month**.

## Features

- **Login screen** — quick username/password gate (no real auth backend needed for a single-team internal tool)
- **Dashboard** — live statistics: total interviews, completion rate, domain breakdown, recommendation breakdown, average scores
- **Leveled interview recording** — create interviews, pick a domain and a candidate level (Fresher → Expert), record responses question-by-question, rate each on a 1–10 scale
- **Behavioral & SDLC baked in** — every interview automatically includes level-matched behavioral/SDLC questions alongside the technical domain, no separate round needed
- **Reference answers** — each question can carry a model answer you can reveal during the session, so you can judge a response even outside your own area of expertise
- **Question bank** — view, add, and delete questions per domain and level, with 45 sensible defaults pre-loaded across all three domains
- **Scoring & recommendations** — Technical / Behavioral / SDLC scores, an overall assessment, and a RECOMMEND / CONSIDER / REJECT call
- **AI-assisted feedback collation (optional)** — jot bullet-point notes during the interview and turn them into a polished assessment with your own Claude API key; falls back to a simple offline formatter automatically when there's no key or no connection
- **Report generation** — download any interview as a clean TXT report, a machine-readable JSON file, or an Excel-compatible CSV
- **Data management** — browse and delete interviews, export your entire dataset as one JSON backup, and re-import it later
- **Offline-first** — every feature above works with zero internet connection except the optional AI collation step, which degrades gracefully when offline

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000), sign in with any username/password, and start your first interview.

## Architecture: Offline-First

Interview Platform is a static React app. Everything — domains, questions, interviews, scores, reports — is stored in your browser's `localStorage`. There is no server, no API, and no database to run, patch, or pay for. The one optional exception is AI-assisted feedback collation, which calls the Claude API directly from your browser using your own key and degrades to an offline formatter automatically when unavailable. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full breakdown.

## Data Storage

- All data lives in `localStorage` under four keys (`ip_session_v1`, `ip_domains_v2`, `ip_interviews_v2`, `ip_settings_v1`).
- Data survives page refreshes, browser restarts, and computer reboots.
- Data is only lost if you (or your browser) clear site data/cache for this origin.
- Use **Data & Reports → Export All Data** regularly to keep an off-browser JSON backup, and **Import Backup** to restore it on any machine.

## Deployment Options

| Option | Cost | Command |
| --- | --- | --- |
| GitHub Pages (auto) | $0 | Just `git push` to `main` — a GitHub Action builds and deploys for you |
| GitHub Pages (manual) | $0 | `npm run deploy` |
| Vercel / Netlify | $0 (free tier) | Connect the repo, build command `npm run build`, output dir `build` |
| Local only | $0 | `npm start` (dev) or serve the `build/` folder with any static file server |

Every push to `main` (other than docs-only changes) triggers `.github/workflows/deploy.yml`, which builds the app and publishes `build/` to the `gh-pages` branch — no manual step needed. To deploy by hand instead:

```bash
npm run build
npm run deploy
```

Your app is live at `https://cloudcompilerr.github.io/interview-platform/`.

## Cost

**$0/month, forever.** No servers, no database, no third-party API calls, no subscriptions.

## License

MIT — see [LICENSE](LICENSE) if present, or use freely with attribution.

---

Built to be easy to run, easy to share with your team, and easy to extend. If you get stuck, check [SETUP_GUIDE.md](SETUP_GUIDE.md) or [docs/FAQ.md](docs/FAQ.md).
