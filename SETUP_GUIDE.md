# Setup Guide

## Prerequisites

- **Node.js** 16 or later (18+ recommended) — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js)
- A modern browser (Chrome, Firefox, Safari, or Edge)
- Git, if you plan to push to GitHub (optional for purely local use)

Check your versions:

```bash
node -v
npm -v
```

## Installation

```bash
git clone https://github.com/cloudcompilerr/interview-platform.git
cd interview-platform
npm install
npm start
```

The app opens automatically at [http://localhost:3000](http://localhost:3000). If it doesn't, open that URL manually.

## First Interview Walkthrough

1. **Sign in** — type any username and password. This is a demo gate, not real authentication; it just personalizes the session.
2. **Go to Dashboard** — you'll see empty stats since there's no data yet.
3. **Click "New Interview"** — fill in the candidate's name, pick a domain (Computer Vision, Generative AI, or Behavioral & SDLC), set the interviewer name and date, then **Start Interview**.
4. **Answer questions** — for each pre-loaded question, type the candidate's response and pick a 1–10 rating.
5. **Switch to "Final Assessment"** — set Technical, Behavioral, and SDLC scores, write an overall assessment, and choose a recommendation (Recommend / Consider / Reject).
6. **Click "Complete Interview"** — this locks in the report and takes you to the Report view.
7. **Download the report** — choose TXT, JSON, or CSV.

## Feature Overview

| Area | What you can do |
| --- | --- |
| Dashboard | See totals, domain breakdown, recommendation breakdown, recent activity |
| New Interview | Start a new candidate session against any domain |
| Question Bank | Add or delete questions per domain |
| Data & Reports | View/delete any interview, export everything to JSON, import a backup, see storage usage |
| Report | Per-interview scorecard with TXT/JSON/CSV downloads |

## Troubleshooting

**`npm install` fails or hangs**
Delete `node_modules` and `package-lock.json`, then retry: `rm -rf node_modules package-lock.json && npm install`.

**Port 3000 already in use**
`PORT=3001 npm start` runs the dev server on a different port.

**My data disappeared**
It's stored in this browser's `localStorage` for this exact origin (e.g. `http://localhost:3000` or your GitHub Pages URL). Switching browsers, using a private/incognito window, or clearing site data will all start you from a blank slate. Always keep a JSON export from **Data & Reports** as a backup.

**Blank page after `npm run build` + serving locally**
Make sure `"homepage": "."` is set in `package.json` (it is, by default) so asset paths are relative.

**GitHub Pages shows a 404**
Confirm the `gh-pages` branch exists (`npm run deploy` creates it) and that GitHub Pages is enabled under **Settings → Pages** with source set to the `gh-pages` branch.

## Support

- Questions about Claude Code itself: run `/help` inside Claude Code, or see https://github.com/anthropics/claude-code/issues
- Project-specific questions: open an issue at https://github.com/cloudcompilerr/interview-platform/issues
