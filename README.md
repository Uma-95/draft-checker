# Draft Check

Paste a blog draft before you publish. Draft Check runs 10 checks from my SEO, GEO and AEO checklist and shows the few fixes that matter most, each tied to the exact sentence.

**Input → process → output**

- **Input:** the draft (pasted from Google Docs, Notion, or as Markdown), plus an optional main question and target keyword.
- **Process:** 10 checks. Eight are plain rules. Two need judgment, so they use AI (Gemini).
- **Output:** up to 5 fixes, most important first, plus a pass/fail list of all 10 checks.

## The 10 checks (in priority order)

| # | Check | How it's checked |
|---|---|---|
| 1 | Main question answered in the first 50–70 words | AI |
| 2 | Each section opens with its own direct answer | AI |
| 3 | H2s written as questions (at least half) | Rule |
| 4 | A one-sentence definition near the top | Rule |
| 5 | Comparison table for an "X vs Y" topic | Rule (only for comparison posts) |
| 6 | Numbered steps for a how-to | Rule (only for how-to posts) |
| 7 | FAQ section | Rule |
| 8 | Paragraphs of 2–4 sentences | Rule |
| 9 | Keyword in the first 100 words | Rule (only if a keyword is given) |
| 10 | Key takeaways box near the top | Rule |

Why AI only for 1 and 2: "does this paragraph actually answer the question?" needs judgment. Everything else is a simple rule, which is free, instant and exact.

## What each file does

- **`index.html`** is the page people see: the draft box, the button, the fixes panel and the styling. It also loads PostHog for analytics.
- **`app.js`** is the brain in the browser. It cleans up whatever is pasted into headings, paragraphs, lists and tables; runs the 8 rule checks; sends the opening and the sections to `/api/check` for the 2 AI checks; picks the top fixes; and records anonymous usage events.
- **`api/check.js`** runs on Vercel's servers, not in the browser. It adds the secret Gemini key, asks Gemini the two answer questions, and sends back only the results. The key never reaches the visitor.

## Setup (about 30 minutes)

1. **GitHub:** create a public repository called `draft-checker` and upload all the files, keeping `api/check.js` inside a folder named `api`.
2. **Vercel:** sign in with GitHub (Hobby plan), choose **Add New Project**, pick `draft-checker`, and deploy.
3. **Gemini key:** in Google AI Studio, select **Get API key** and create one. In Vercel, open the project's settings, go to **Environment Variables**, and add:
   - `GEMINI_API_KEY` = your key
   - `GEMINI_MODEL` = the current Flash model name shown in AI Studio (optional; the default is `gemini-2.5-flash`, so set this if that model is no longer available)

   Redeploy after adding them.
4. **Privacy and cost:** turn on billing for the Google Cloud project behind the key and set a small budget alert. With billing on, Google treats the content as paid-tier data and doesn't use it to improve its products. Budget alerts only notify you; they don't stop spending.
5. **PostHog:** create a project in your personal PostHog account. Copy its project key into `index.html` where it says `YOUR_POSTHOG_PROJECT_KEY`. If your project is in the EU region, change the host line too.
6. **Test:** open your `.vercel.app` link, paste a draft, and select **Check my draft**.

If the AI checks show "Didn't run", open Vercel's **Logs** for the project; the Gemini error is printed there (usually a missing key or a wrong model name).

## Analytics (no draft text is ever sent)

Autocapture and session recording are off, so PostHog never sees what people type. Events:

| Event | When | Useful properties |
|---|---|---|
| `$pageview` | Page opens | UTM tags from the link |
| `check_run` | A check finishes | `is_recheck`, `fails`, `failed_checks`, `unsure`, `word_count`, `ai_ok` |
| `fix_feedback` | Someone answers "Was this right?" | `check_id`, `right` |
| `results_copied` | Copy results is used | — |
| `ai_error` | The AI check fails | `reason` |

Success metric: share of `check_run` events with `is_recheck = true`. Guardrail: share of `fix_feedback` with `right = false`, per check.

## Running the eval set

The eval asks one thing: **does the tool tick the same boxes I would?**

1. Take the blog posts I've already checked by hand against the 10 checks (Pass / Fix / Not relevant).
2. Paste each post into the tool, add its main question and keyword, run it, open **All 10 checks**, and select **Copy results**.
3. Paste the result next to my own judgment in the eval sheet and mark each row as a match or not.
4. Report overall agreement, and agreement per check.

What to do with the results:

- **A rule check that disagrees with me** is a bug or a threshold question. Fix it in `app.js` (the settings are at the top) and re-run.
- **An AI check that disagrees with me** is a prompt problem. Edit `INSTRUCTIONS` in `api/check.js`, bump `PROMPT_VERSION` (v1 → v2), redeploy, and re-run the same posts. Record each version's score:

| Prompt version | AI checks matching my judgment | What I changed |
|---|---|---|
| v1 | ?/? | First prompt |
| v2 | ?/? | |

- "Not sure" from the AI counts as a mismatch in the score, but it's the safe kind: the tool admitted it couldn't tell.
- Run a few posts twice to check the AI gives the same answer each time.

## Changing the rules

All the thresholds are at the top of `app.js`: priority order, number of fixes shown, the 70-word and 100-word windows, the sentence limit for paragraphs, and the share of H2s that should be questions. The wording of each check and its "why it matters" line lives in `CHECKS` in the same file.

## What it deliberately doesn't do

- No site audits, keyword research or backlink data. Specialist tools already do that, and it's exactly the overwhelm this tool removes.
- No "rewrite my post with AI". The writer stays the author; the tool points to what to change.
