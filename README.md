# Draft Check

**Live:** [add your link here]

Paste a blog draft before you publish. Draft Check runs 13 SEO content checks and shows the few fixes that matter most, each tied to the exact sentence.

## Why I built it

When I started doing SEO for an AI startup, I had every professional tool: Semrush, Ahrefs, Search Console. They're built for specialists and show site-wide dashboards with hundreds of metrics. None of them answered the one question a writer has before publishing: *what should I change in this draft?*

Over a year, our small content team worked through a checklist by hand before every post. That checklist helped grow organic traffic 22x. Draft Check turns it into a tool anyone can use in seconds.

## How to use it

1. Open the live link.
2. Paste your draft, copied from Google Docs or Notion so headings, links and images come with it, or as Markdown.
3. Select **Check my draft**. You get up to 5 fixes, most important first.

No sign-up. Your draft isn't saved.

## What it checks

| # | Check | How |
|---|---|---|
| 1 | Answers the main question in the first 50–70 words | AI |
| 2 | Has something original: own data, case study or first-hand experience | AI |
| 3 | Answers the likely follow-up questions | AI |
| 4 | Title clearly and accurately describes the post | AI |
| 5 | Natural language, no keyword stuffing | AI |
| 6 | No spelling or grammar mistakes | AI |
| 7 | Paragraphs are 2–4 sentences | Rule |
| 8 | Long content broken into sections with headings | Rule |
| 9 | Reading level around grade 10–12 | Rule |
| 10 | Every statistic linked to its source | Rule |
| 11 | Descriptive link text, not "click here" | Rule |
| 12 | Links to relevant resources (at least 3) | Rule |
| 13 | Images placed near relevant text | Rule |

Every check is grounded in Google's [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), except #1, which comes from research on how search snippets and AI answers quote pages.

## How it works

- **Rules where rules are enough.** Seven checks are plain code that runs in the browser: free, instant and consistent.
- **AI only where judgment is needed.** Questions like "does this paragraph actually answer the title?" can't be counted, so those six checks go to Google's Gemini in a single request.
- **AI that admits uncertainty.** When the model can't tell, the check says *Not sure* instead of guessing.
- **Feedback on every fix.** Each fix asks "Was this right?" so I can see which checks users disagree with.

## What I deliberately left out

- **Site audits, keyword research and backlink data.** Specialist tools already do this, and it's exactly the overwhelm this tool removes.
- **Checks Google says don't matter,** like heading order or word count.
- **"Rewrite my post with AI."** The writer stays the author; the tool points to what to change.

## Evaluation

I measured the tool against my own manual audits of [N] published blogs: does it tick the same boxes I would?

| Version | Agreement with my audits | Rule checks | AI checks | What changed |
|---|---|---|---|---|
| v1 | ?% | ?% | ?% | First version |
| v2 | ?% | ?% | ?% | |

## Privacy

Drafts aren't stored. The six AI checks are sent to Google's Gemini. Analytics record only counts (checks run, which checks failed, feedback), never the text.

## Built with

HTML, CSS and JavaScript · a Vercel serverless function · Gemini API · PostHog
