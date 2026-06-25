# Frequently Asked Questions

### Where is my data stored?

In your browser's `localStorage`, scoped to the exact URL you're using (e.g. `http://localhost:3000` or `https://cloudcompilerr.github.io/interview-platform/`). It never leaves your machine unless you explicitly export it.

### Will it work offline?

Yes. After the first page load, the app makes no network calls at all — no API, no Claude, no analytics. You can disconnect Wi-Fi entirely and keep recording interviews.

### What if my computer crashes mid-interview?

Every keystroke is persisted to `localStorage` immediately (there's no "save" button, nothing is held only in memory), so the most you'd lose is whatever you typed in the few hundred milliseconds before the crash. Reopen the app and your in-progress interview is exactly where you left it under **Dashboard → Continue** or **Data & Reports → Resume**.

### What if I clear my browser cache?

That's the one scenario that does delete your data — clearing site data/cookies/cache for this origin wipes `localStorage` along with it. Mitigate this by exporting a JSON backup regularly from **Data & Reports → Export All Data**.

### Can I customize the questions?

Yes — go to **Question Bank**, pick a domain tab, and add or delete questions freely. New interviews use whatever questions are currently in the bank for that domain; existing in-progress or completed interviews keep the questions they were started with, so editing the bank later never rewrites history.

### Can I add a new domain?

Not from the UI today (domains are Computer Vision, Generative AI, and Behavioral & SDLC out of the box) — adding a fourth domain means editing the `DEFAULT_DOMAINS` constant in `src/App.jsx`. It's a small, well-isolated change; see `docs/ARCHITECTURE.md` for where that lives.

### What's the cost breakdown?

| Item | Cost |
| --- | --- |
| Running the app | $0 — static files, no server |
| Hosting on GitHub Pages | $0 |
| Storing data | $0 — browser `localStorage`, no database |
| "AI" features | $0 — domain names only, no live model calls |
| **Total** | **$0/month, forever** |

### How do I share this with my team?

Share the GitHub Pages URL (`https://cloudcompilerr.github.io/interview-platform/`) or have teammates run it locally with `npm install && npm start`. Each person's browser keeps its own independent data — this is a single-user-per-browser tool, not a shared multi-user database. If you need shared visibility across interviewers, see the "Future Scaling Options" section in `docs/ARCHITECTURE.md`.

### Is my data backed up anywhere besides my browser?

Not automatically. Use **Export All Data** regularly and store the JSON file wherever you keep other backups (cloud drive, USB, a `backups/` folder committed to this repo, etc.). The included GitHub Action (`.github/workflows/backup.yml`) backs up the *repository* daily, not your browser's `localStorage` — those are different things.

### Does this use Claude or any AI API?

No. The domain names (Computer Vision, Generative AI, Behavioral & SDLC) describe the *subject matter* of the interview questions — they are not live calls to any AI model. Claude API integration is explicitly out of scope and not required for any feature to work.
