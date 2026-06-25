# 15-Minute Quickstart

## 1. Install & run (2 minutes)

```bash
git clone https://github.com/cloudcompilerr/interview-platform.git
cd interview-platform
npm install
npm start
```

The app opens at [http://localhost:3000](http://localhost:3000).

## 2. Log in (30 seconds)

Type any username and any password, then click **Sign In**. This is a demo gate — there's no real backend to authenticate against, and nothing is sent anywhere.

## 3. Create your first interview (3 minutes)

1. Click **New Interview** in the sidebar.
2. Enter a candidate name, e.g. `Alex Rivera`.
3. Pick a domain — try **Generative AI**.
4. Pick a candidate level — try **Entry-Level**. The question count updates to show how many questions (domain + Behavioral & SDLC, both at this level) will be used.
5. Set the interviewer name and date (defaults are fine).
6. Click **Start Interview**.

## 4. Record responses (5 minutes)

For each question shown:

1. Type a short summary of how the candidate answered in the **Candidate Response** box.
2. Pick a **Rating** from 1–10.
3. If a question has one, click **Show Reference Answer** to reveal what a strong answer covers — handy if the question is outside your own expertise.

When you're done with all questions, click **Continue to Assessment**.

## 5. Finish the assessment (2 minutes)

1. Set **Technical**, **Behavioral**, and **SDLC** scores.
2. Jot quick **Feedback Notes** as bullet points, one per line, then click **Generate Assessment from Notes** to turn them into a paragraph (uses Claude if you've added an API key in Settings and you're online; otherwise falls back to plain formatting automatically) — or just type the **Overall Assessment** directly.
3. Pick a **Recommendation** — Recommend, Consider, or Reject.
4. Click **Complete Interview**.

You're dropped into the **Report** view automatically.

## 6. Generate & download a report (1 minute)

On the Report screen, click any of:

- **Download TXT** — plain-text summary, good for email or printing
- **Download JSON** — full structured record, good for tooling/automation
- **Download CSV** — opens cleanly in Excel/Google Sheets

## 7. Export your data (1 minute)

Go to **Data & Reports** → **Export All Data (JSON)**. This downloads every domain, question, and interview as one backup file — keep it somewhere safe outside the browser.

## 8. Deploy to GitHub Pages (1 minute)

```bash
npm run build
npm run deploy
```

Your app is now live at `https://cloudcompilerr.github.io/interview-platform/`. Share that URL with your team — each person's data stays local to their own browser.

That's it — you've created an interview, scored it, generated a report, backed up your data, and deployed the whole platform, for $0.
