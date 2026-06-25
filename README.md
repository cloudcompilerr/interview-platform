# Interview Platform

A complete interview management and candidate assessment tool that runs entirely in your browser — no backend, no database, no monthly bill. Record interviews, score candidates, generate professional reports, and keep everything backed up to GitHub, all for **$0/month**.

## Features

- **Login screen** — quick username/password gate (no real auth backend needed for a single-team internal tool)
- **Dashboard** — live statistics: total interviews, completion rate, domain breakdown, recommendation breakdown, average scores
- **Interview recording** — create interviews, pick a domain, record candidate responses question-by-question, rate each on a 1–10 scale
- **Question bank** — view, add, and delete questions per domain, with sensible defaults pre-loaded
- **Scoring & recommendations** — Technical / Behavioral / SDLC scores, free-text overall assessment, and a RECOMMEND / CONSIDER / REJECT call
- **Report generation** — download any interview as a clean TXT report, a machine-readable JSON file, or an Excel-compatible CSV
- **Data management** — browse and delete interviews, export your entire dataset as one JSON backup, and re-import it later
- **Offline-first** — works with zero internet connection after the first load; nothing ever calls an external API

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000), sign in with any username/password, and start your first interview.

## Architecture: Offline-First

Interview Platform is a static React app. Everything — domains, questions, interviews, scores, reports — is stored in your browser's `localStorage`. There is no server, no API, and no database to run, patch, or pay for. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full breakdown.

## Data Storage

- All data lives in `localStorage` under three keys (`ip_session_v1`, `ip_domains_v1`, `ip_interviews_v1`).
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
