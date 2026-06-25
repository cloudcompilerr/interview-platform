# Frequently Asked Questions

### Where is my data stored?

In your browser's `localStorage`, scoped to the exact URL you're using (e.g. `http://localhost:3000` or `https://cloudcompilerr.github.io/interview-platform/`). It never leaves your machine unless you explicitly export it.

### Will it work offline?

Yes, for every core feature — recording interviews, scoring, generating and downloading reports, managing the question bank, exporting/importing data. The one optional exception is **Generate Assessment from Notes** (turning bullet-point feedback into a paragraph via Claude): if you've added an API key in **Settings** and you're online, it calls the Claude API directly from your browser; if not, it automatically falls back to a simple offline formatter instead. Either way, nothing blocks you from finishing an interview.

### What if my computer crashes mid-interview?

Every keystroke is persisted to `localStorage` immediately (there's no "save" button, nothing is held only in memory), so the most you'd lose is whatever you typed in the few hundred milliseconds before the crash. Reopen the app and your in-progress interview is exactly where you left it under **Dashboard → Continue** or **Data & Reports → Resume**.

### What if I clear my browser cache?

That's the one scenario that does delete your data — clearing site data/cookies/cache for this origin wipes `localStorage` along with it. Mitigate this by exporting a JSON backup regularly from **Data & Reports → Export All Data**.

### Can I customize the questions?

Yes — go to **Question Bank**, pick a domain tab, and add or delete questions freely. Each question has a **level** (Fresher, Entry, Intermediate, Advanced, Expert) and an optional **reference answer**. New interviews pull whatever questions are currently in the bank for that domain *and level*; existing in-progress or completed interviews keep the exact questions and reference answers they were started with, so editing the bank later never rewrites history.

### What is the candidate level for, and what is a reference answer?

When you start a new interview, you pick a domain and a candidate level. The level decides which questions get pulled in — a Fresher gets fundamentals, an Expert gets architecture/trade-off questions. Every interview also automatically includes the level-matched **Behavioral & SDLC** questions, regardless of which technical domain you picked, so you don't have to run a separate behavioral round. Each question can carry a short **reference answer** — a few sentences on what a strong response covers — which you can reveal during the session (it's hidden by default) so you can judge a candidate's answer even if you're not deeply familiar with that question's subject matter yourself.

### Can I add a new domain?

Not from the UI today (domains are Computer Vision, Generative AI, and Behavioral & SDLC out of the box) — adding a fourth domain means editing the `DEFAULT_DOMAINS` constant in `src/App.jsx`. It's a small, well-isolated change; see `docs/ARCHITECTURE.md` for where that lives.

### What's the cost breakdown?

| Item | Cost |
| --- | --- |
| Running the app | $0 — static files, no server |
| Hosting on GitHub Pages | $0 |
| Storing data | $0 — browser `localStorage`, no database |
| AI-assisted feedback collation | $0 from this app — optional, pay-as-you-go on your own Anthropic API key if you choose to use it |
| **Total** | **$0/month, forever**, plus pennies of optional API usage only if you enable AI collation |

### How do I share this with my team?

Share the GitHub Pages URL (`https://cloudcompilerr.github.io/interview-platform/`) or have teammates run it locally with `npm install && npm start`. Each person's browser keeps its own independent data — this is a single-user-per-browser tool, not a shared multi-user database. If you need shared visibility across interviewers, see the "Future Scaling Options" section in `docs/ARCHITECTURE.md`.

### Is my data backed up anywhere besides my browser?

Not automatically. Use **Export All Data** regularly and store the JSON file wherever you keep other backups (cloud drive, USB, a `backups/` folder committed to this repo, etc.). The included GitHub Action (`.github/workflows/backup.yml`) backs up the *repository* daily, not your browser's `localStorage` — those are different things.

### Does this use Claude or any AI API?

Only for one optional feature: turning interviewer bullet notes into a polished overall-assessment paragraph. Go to **Settings**, paste your own Anthropic API key, and it's stored only in your browser's `localStorage` — never sent anywhere except directly to Anthropic's API when you click "Generate Assessment from Notes." Without a key configured (the default), or whenever you're offline, that same button falls back to a simple local formatter instead — no feature is ever blocked by missing AI access. The domain names (Computer Vision, Generative AI, Behavioral & SDLC) just describe the *subject matter* of the interview questions and have nothing to do with this.
