/* Draft Check: SEO content checks before you publish.
   Paste a draft -> 16 checks from my SEO checklist -> the top fixes, most important first.
   10 checks are plain rules in this file. 6 need judgment, so they go to AI in one request (/api/check). */

/* ---------- 1. Settings you can change ---------- */

// Order = priority. The first failing checks (up to MAX_FIXES) become the fixes shown.
const PRIORITY = [
  "answer_first", "original", "follow_ups", "title_clear", "keyword_stuffing", "grammar",
  "paragraphs", "sections", "reading_level", "stats_linked", "anchor_text", "links_count", "visuals"
];
const MAX_FIXES = 5;
const MAX_SENTENCES = 4;        // paragraphs with more sentences than this get flagged
const MAX_GRADE = 12;           // reading level above this gets flagged
const NEEDS_H2_WORDS = 300;     // posts longer than this need H2 sections
const MAX_SECTION_WORDS = 500;  // H2 sections longer than this need subheadings
const LONG_SECTION_WORDS = 300; // sections longer than this need an image, chart or table
const MIN_LINKS = 3;            // links to your other posts and trusted sources

/* ---------- 2. What each check says to the writer ---------- */

const CHECKS = {
  answer_first:     { name: "Answers the main question in the first 50–70 words", why: "Readers and search engines decide in the first lines whether the page answers them. A buried answer loses both." },
  original:         { name: "Has something original: own data, case study or experience", why: "Google asks for content you create from what you know, not a rehash of what's already published." },
  follow_ups:       { name: "Answers the likely follow-up questions", why: "Readers rarely have one question. Answering the next ones keeps them on your page instead of going back to search." },
  title_clear:      { name: "Title clearly and accurately describes the post", why: "Google uses your title to decide how to show the page, and readers use it to decide whether to click." },
  keyword_stuffing: { name: "Natural language, no keyword stuffing", why: "Repeating the same words over and over tires readers and is against Google's spam policies." },
  grammar:          { name: "No spelling or grammar mistakes", why: "Google lists well-written content, free of spelling and grammar mistakes, as a sign of quality." },
  paragraphs:       { name: "Paragraphs are 2–4 sentences", why: "Google recommends breaking long content into paragraphs. Short ones are easier to read, especially on mobile." },
  sections:         { name: "Long content broken into sections with headings", why: "Google recommends sections and headings so readers can navigate the page." },
  reading_level:    { name: "Reading level around grade 10–12", why: "Easy-to-read content keeps readers on the page. Dense academic prose makes them leave." },
  stats_linked:     { name: "Every statistic linked to its source", why: "A link to the source backs up your number, for readers and for search engines." },
  anchor_text:      { name: "Descriptive link text", why: "Link text tells readers and Google what the linked page is about. 'Click here' tells them nothing." },
  links_count:      { name: "Links to relevant resources (at least 3)", why: "Google finds most new pages through links, and links to good sources support what you're saying." },
  visuals:          { name: "Images placed near relevant text", why: "Google recommends images near the text they relate to. They also break up long sections for readers." }
};

/* ---------- 3. Text helpers ---------- */

const words = (t) => (t || "").trim().split(/\s+/).filter(Boolean);
const firstWords = (t, n) => words(t).slice(0, n).join(" ");
const lastWords = (t, n) => words(t).slice(-n).join(" ");
const sentences = (t) => (t || "").trim().split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/).filter((s) => s.trim());
const short = (t, n = 14) => { const w = words(t); return w.slice(0, n).join(" ") + (w.length > n ? "…" : ""); };
const endWithStop = (t) => (/[.!?:]["'”)]?$/.test(t.trim()) ? t.trim() : t.trim() + ".");
const joinText = (parts) => parts.filter((p) => p && p.trim()).map(endWithStop).join(" ");

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}
// Flesch-Kincaid grade level
function gradeLevel(text) {
  const s = sentences(text).length || 1;
  const w = words(text);
  if (w.length < 50) return null;
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  return 0.39 * (w.length / s) + 11.8 * (syl / w.length) - 15.59;
}

/* ---------- 4. Reading the paste into blocks ---------- */
// A block is one piece of the draft:
// { type: "h1"|"h2"|"h3"|"p"|"ul"|"ol"|"table"|"img", text, items, rows, links: [{text, href}], alt }

function markdownToBlocks(text) {
  const blocks = [];
  let para = [];
  const LINK = /(?<!!)\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g;
  const linksIn = (s) => [...s.matchAll(LINK)].map((m) => ({ text: m[1].trim(), href: m[2] }));
  const plain = (s) => s.replace(LINK, "$1").replace(/[*_`]/g, "");
  const flush = () => {
    if (!para.length) return;
    const raw = para.join(" ");
    blocks.push({ type: "p", text: plain(raw).trim(), links: linksIn(raw) });
    para = [];
  };
  const pushItem = (type, raw) => {
    const last = blocks[blocks.length - 1];
    const item = plain(raw).trim();
    if (last && last.type === type) { last.items.push(item); last.links.push(...linksIn(raw)); }
    else blocks.push({ type, items: [item], links: linksIn(raw) });
  };
  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    let m;
    if (!line) { flush(); continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) { flush(); blocks.push({ type: "img", alt: m[1].trim(), links: [] }); continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); blocks.push({ type: "h" + Math.min(m[1].length, 3), level: m[1].length, text: plain(m[2]).trim(), links: linksIn(m[2]) }); continue; }
    if ((m = line.match(/^[-*+•]\s+(.*)$/))) { flush(); pushItem("ul", m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flush(); pushItem("ol", m[1]); continue; }
    if (/^\|.*\|$/.test(line)) {
      flush();
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split("|").map((c) => plain(c).trim());
      const last = blocks[blocks.length - 1];
      if (last && last.type === "table") last.rows.push(cells); else blocks.push({ type: "table", rows: [cells], links: [] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

function linksOf(el) {
  return [...el.querySelectorAll("a[href]")].map((a) => ({ text: a.textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href") }));
}

function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const SEL = "h1,h2,h3,h4,h5,h6,p,li,table,img";
  const nodes = [...doc.body.querySelectorAll(SEL)].filter((n) => n.tagName === "IMG" ? !n.parentElement.closest("table") : !n.parentElement.closest("h1,h2,h3,h4,h5,h6,p,li,table"));
  const blocks = [];
  for (const n of nodes) {
    const tag = n.tagName.toLowerCase();
    if (tag === "img") { blocks.push({ type: "img", alt: (n.getAttribute("alt") || "").trim(), links: [] }); continue; }
    if (tag === "table") {
      const rows = [...n.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()));
      if (rows.length) blocks.push({ type: "table", rows, links: linksOf(n) });
      continue;
    }
    const text = n.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (tag === "li") {
      const type = n.closest("ol") ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) { last.items.push(text); last.links.push(...linksOf(n)); }
      else blocks.push({ type, items: [text], links: linksOf(n) });
      continue;
    }
    if (/^h[1-6]$/.test(tag)) { blocks.push({ type: "h" + Math.min(+tag[1], 3), level: +tag[1], text, links: linksOf(n) }); continue; }
    blocks.push({ type: "p", text, links: linksOf(n) });
  }
  return blocks;
}

function readEditorBlocks(editor) {
  const blocks = [];
  for (const el of editor.children) {
    const tag = el.tagName.toLowerCase();
    if (el.classList.contains("img-ph")) { blocks.push({ type: "img", alt: el.dataset.alt || "", links: [] }); continue; }
    if (tag === "ul" || tag === "ol") {
      const items = [...el.querySelectorAll("li")].map((li) => li.textContent.trim()).filter(Boolean);
      if (items.length) blocks.push({ type: tag, items, links: linksOf(el) });
    } else if (tag === "table") {
      const rows = [...el.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
      if (rows.length) blocks.push({ type: "table", rows, links: linksOf(el) });
    } else {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const isH = /^h[1-6]$/.test(tag);
      blocks.push({ type: isH ? "h" + Math.min(+tag[1], 3) : "p", level: isH ? +tag[1] : undefined, text, links: linksOf(el) });
    }
  }
  if (!blocks.length && editor.textContent.trim()) return markdownToBlocks(editor.innerText);
  return blocks;
}

/* ---------- 5. Understanding the draft ---------- */

const isHeading = (b) => /^h[1-3]$/.test(b.type);
const textOf = (b) => b.text || (b.items || []).join(". ") || (b.rows || []).map((r) => r.join(" ")).join(". ") || "";

function analyse(blocks) {
  const h1Index = blocks.findIndex((b) => b.type === "h1");
  const title = h1Index >= 0 ? blocks[h1Index].text : ((blocks.find((b) => b.text) || {}).text || "");
  const body = h1Index >= 0 ? blocks.slice(h1Index + 1) : blocks;
  const bodyText = joinText(body.filter((b) => !isHeading(b) && b.type !== "img").map(textOf));
  const proseText = joinText(body.filter((b) => b.type === "p").map((b) => b.text));

  // Sections: each H2 with everything under it, until the next H2
  const sections = [];
  body.forEach((b, i) => {
    if (b.type !== "h2") return;
    const inside = [];
    for (let j = i + 1; j < body.length && body[j].type !== "h2"; j++) inside.push(body[j]);
    sections.push({ heading: b.text, blocks: inside, text: joinText(inside.filter((x) => !isHeading(x) && x.type !== "img").map(textOf)) });
  });

  // Body with headings marked, for the AI
  const outline = body.map((b) => isHeading(b) ? `\n${"#".repeat(+b.type[1])} ${b.text}\n` : (b.type === "img" ? "[image]" : textOf(b))).join("\n");

  return { blocks, title, body, bodyText, proseText, sections, outline };
}

/* ---------- 6. The 10 rule checks ---------- */

const result = (id, status, fix = "", quote = "") => ({ id, status, fix, quote });

function ruleChecks(d) {
  const out = {};
  const bodyLinks = d.body.flatMap((b) => b.links || []);

  // Paragraphs of 2–4 sentences
  const longParas = d.body.filter((b) => b.type === "p" && sentences(b.text).length > MAX_SENTENCES);
  out.paragraphs = !longParas.length
    ? result("paragraphs", "pass")
    : result("paragraphs", "fail", `${longParas.length} paragraph${longParas.length > 1 ? "s have" : " has"} more than ${MAX_SENTENCES} sentences. Split ${longParas.length > 1 ? "them" : "it"} into 2–4 sentence paragraphs.`, short(longParas[0].text));

  // Long content broken into sections with headings
  const totalWords = words(d.bodyText).length;
  if (totalWords <= NEEDS_H2_WORDS) out.sections = result("sections", "na");
  else if (!d.sections.length) out.sections = result("sections", "fail", `This post is ${totalWords.toLocaleString()} words with no H2 sections. Break it into sections with clear headings.`);
  else {
    const walls = d.sections.filter((s) => words(s.text).length > MAX_SECTION_WORDS && !s.blocks.some((b) => b.type === "h3"));
    out.sections = !walls.length
      ? result("sections", "pass")
      : result("sections", "fail", `${walls.length} section${walls.length > 1 ? "s run" : " runs"} over ${MAX_SECTION_WORDS} words with no subheading. Add H3s to break ${walls.length > 1 ? "them" : "it"} up.`, walls.slice(0, 3).map((s) => s.heading).join(" · "));
  }

  // Reading level (Flesch-Kincaid grade)
  const grade = gradeLevel(d.proseText);
  if (grade === null) out.reading_level = result("reading_level", "na");
  else out.reading_level = grade <= MAX_GRADE
    ? result("reading_level", "pass", `Grade ${grade.toFixed(1)}.`)
    : result("reading_level", "fail", `The writing reads at about grade ${grade.toFixed(1)}. Aim for 10–12: shorter sentences and plainer words.`);

  // Every statistic linked to its source
  const STAT = /(\d+(\.\d+)?\s?%|\b\d{1,3}(,\d{3})+\b|\b\d+(\.\d+)?\s?(x|times|million|billion|thousand|percent)\b)/i;
  const unlinked = [];
  for (const b of d.body) {
    if (b.type !== "p" && b.type !== "ul" && b.type !== "ol") continue;
    if ((b.links || []).length) continue;
    const parts = b.type === "p" ? sentences(b.text) : b.items;
    // Skip code examples and prices: they aren't claims that need a source
    const CODE_OR_PRICE = /[{}=`]|[$₹€£]\s?\d|\b\d+(\.\d+)?\s?(usd|inr|eur)\b|per (seat|month|year|user)/i;
    parts.filter((x) => STAT.test(x) && !CODE_OR_PRICE.test(x)).forEach((x) => unlinked.push(x));
  }
  if (!d.body.some((b) => STAT.test(textOf(b)))) out.stats_linked = result("stats_linked", "na");
  else out.stats_linked = !unlinked.length
    ? result("stats_linked", "pass")
    : result("stats_linked", "fail", `${unlinked.length} statistic${unlinked.length > 1 ? "s have" : " has"} no source link. Link each number to where it comes from.`, short(unlinked[0], 20));

  // Descriptive link text
  const VAGUE = /^(click here|here|read more|learn more|more|this|link|this link|this article|this post|this page|see here|go here)$/i;
  if (!bodyLinks.length) out.anchor_text = result("anchor_text", "na");
  else {
    const vague = bodyLinks.filter((l) => VAGUE.test(l.text.replace(/[.!:]+$/, "").trim()));
    out.anchor_text = !vague.length
      ? result("anchor_text", "pass")
      : result("anchor_text", "fail", `${vague.length} link${vague.length > 1 ? "s use" : " uses"} vague text. Say where the link goes, e.g. "our RAG evaluation guide" instead of "click here".`, vague.slice(0, 3).map((l) => `"${l.text}"`).join(" · "));
  }

  // Links to relevant resources
  out.links_count = bodyLinks.length >= MIN_LINKS
    ? result("links_count", "pass", `${bodyLinks.length} links.`)
    : result("links_count", "fail", `The post has ${bodyLinks.length} link${bodyLinks.length === 1 ? "" : "s"}. Add at least ${MIN_LINKS}: to your related posts and to trusted sources that back up your points.`);

  // Images near relevant text in long sections
  const sects = d.sections.length ? d.sections : [{ heading: d.title, blocks: d.body, text: d.bodyText }];
  const bare = sects.filter((s) => words(s.text).length > LONG_SECTION_WORDS && !s.blocks.some((b) => b.type === "img" || b.type === "table"));
  out.visuals = !bare.length
    ? result("visuals", "pass")
    : result("visuals", "fail", `${bare.length} long section${bare.length > 1 ? "s have" : " has"} no image, chart or table. Add one next to the text it explains.`, bare.slice(0, 3).map((s) => s.heading).join(" · "));

  return out;
}

/* ---------- 7. The 6 AI checks ---------- */

function aiPayload(d) {
  return {
    title: d.title.slice(0, 300),
    intro: firstWords(d.bodyText, 150),
    body: d.outline.slice(0, 15000),
    ending: lastWords(d.bodyText, 150)
  };
}

const AI_IDS = ["answer_first", "original", "follow_ups", "title_clear", "keyword_stuffing", "grammar"];
const PASS = ["answers_directly", "present", "covered", "clear", "natural", "clean"];
const FAIL = ["buried", "not_answered", "absent", "gaps", "unclear", "stuffed", "errors"];

function aiChecks(d, ai) {
  const out = {};
  if (!ai) {
    AI_IDS.forEach((id) => (out[id] = result(id, "error", "This check couldn't run. Try again in a minute.")));
    return out;
  }
  const status = (x) => (x && PASS.includes(x.status) ? "pass" : x && FAIL.includes(x.status) ? "fail" : "unsure");
  const unsure = (id, what) => result(id, "unsure", `Not sure. Check manually: ${what}`);
  const list = (arr) => (arr || []).filter(Boolean).slice(0, 5).join(" · ");
  const note = (x) => (x && x.note ? " " + x.note : "");

  const a = ai.answer_first || {};
  if (status(a) === "pass") out.answer_first = result("answer_first", "pass", "", a.answer_sentence);
  else if (status(a) === "fail") out.answer_first = result("answer_first", "fail",
    a.status === "buried"
      ? `The answer to "${d.title}" comes too late. Move this sentence into your first 50–70 words.${note(a)}`
      : `The opening doesn't answer "${d.title}". Start with a 1–2 sentence direct answer, then explain.${note(a)}`,
    a.answer_sentence || "");
  else out.answer_first = unsure("answer_first", "does the opening answer the title's question within 70 words?");

  const o = ai.original || {};
  out.original = status(o) === "pass" ? result("original", "pass", "", o.evidence || "")
    : status(o) === "fail" ? result("original", "fail", `Nothing here is unique to you yet. Add your own data, a short case study, or first-hand experience.${note(o)}`)
    : unsure("original", "does the post include your own data, a case study, or first-hand experience?");

  const f = ai.follow_ups || {};
  out.follow_ups = status(f) === "pass" ? result("follow_ups", "pass")
    : status(f) === "fail" ? result("follow_ups", "fail", `Readers will likely ask these next, and the post doesn't answer them. Add a short section for each.${note(f)}`, list(f.unanswered))
    : unsure("follow_ups", "does the post answer the questions a reader would ask next?");

  const t = ai.title_clear || {};
  out.title_clear = status(t) === "pass" ? result("title_clear", "pass")
    : status(t) === "fail" ? result("title_clear", "fail", `The title doesn't clearly describe what the post covers.${note(t)}`, t.suggested_title ? `Suggested: ${t.suggested_title}` : "")
    : unsure("title_clear", "does the title accurately describe what the post covers?");

  const k = ai.keyword_stuffing || {};
  out.keyword_stuffing = status(k) === "pass" ? result("keyword_stuffing", "pass")
    : status(k) === "fail" ? result("keyword_stuffing", "fail", `A phrase is repeated more than reads naturally. Vary the wording or cut some repeats.${note(k)}`, k.phrase ? `"${k.phrase}"` : "")
    : unsure("keyword_stuffing", "is any word or phrase repeated unnaturally?");

  const g = ai.grammar || {};
  out.grammar = status(g) === "pass" ? result("grammar", "pass")
    : status(g) === "fail" ? result("grammar", "fail", `Fix these spelling or grammar mistakes before publishing.${note(g)}`, list(g.errors))
    : unsure("grammar", "proofread for spelling and grammar mistakes.");

  return out;
}

async function callAI(payload) {
  const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) {
    if (res.status === 429) throw new Error("busy");
    let code = "";
    try { const j = await res.json(); code = [j.error, j.status, j.detail].filter(Boolean).join(" · "); } catch (e) {}
    throw new Error(code || "http_" + res.status);
  }
  return res.json();
}

/* ---------- 8. Picking the fixes ---------- */

const pickFixes = (results) => PRIORITY.map((id) => results[id]).filter((r) => r && r.status === "fail").slice(0, MAX_FIXES);

/* ---------- 9. The page ---------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STATUS_LABEL = { pass: "Pass", fail: "Fix", na: "Not relevant", unsure: "Not sure", error: "Didn't run", pending: "Checking…" };
const track = (event, props) => { try { if (window.posthog && window.posthog.capture) window.posthog.capture(event, props); } catch (e) {} };

function linkify(text, links) {
  let html = esc(text);
  for (const l of links || []) {
    if (!l.text || !/^https?:|^\/|^#/.test(l.href || "")) continue;
    const t = esc(l.text);
    const i = html.indexOf(t);
    if (i >= 0) html = html.slice(0, i) + `<a href="${esc(l.href)}">${t}</a>` + html.slice(i + t.length);
  }
  return html;
}

function blocksToHtml(blocks) {
  return blocks.map((b) => {
    if (b.type === "img") return `<figure class="img-ph" contenteditable="false" data-alt="${esc(b.alt || "")}">Image${b.alt ? `: ${esc(b.alt)}` : ""}</figure>`;
    if (b.type === "ul" || b.type === "ol") return `<${b.type}>${b.items.map((i) => `<li>${linkify(i, b.links)}</li>`).join("")}</${b.type}>`;
    if (b.type === "table") return `<table>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    const tag = b.level ? "h" + Math.min(b.level, 6) : b.type;
    return `<${tag}>${linkify(b.text, b.links)}</${tag}>`;
  }).join("");
}

function init() {
  const $ = (id) => document.getElementById(id);
  const editor = $("editor"), run = $("run"), notes = $("notes"), summary = $("summary"), list = $("allChecks"), err = $("error");
  let checksThisSession = 0;
  let lastResults = null;

  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    let blocks = html ? htmlToBlocks(html) : [];
    if (!blocks.length || (!blocks.some(isHeading) && /^#{1,6}\s/m.test(text))) blocks = markdownToBlocks(text);
    const sel = window.getSelection();
    if (editor.textContent.trim() && sel.rangeCount && editor.contains(sel.anchorNode)) document.execCommand("insertHTML", false, blocksToHtml(blocks));
    else editor.innerHTML = blocksToHtml(blocks);
    err.textContent = "";
  });

  function render(results, aiState) {
    const fixes = pickFixes(results);
    const fails = PRIORITY.filter((id) => results[id] && results[id].status === "fail").length;
    summary.textContent = aiState === "pending"
      ? "Rule checks done. AI checks running…"
      : fails === 0 ? "No fixes needed. This draft passes every check that applies." : `${fails} check${fails > 1 ? "s" : ""} to fix. Showing the ${Math.min(fails, MAX_FIXES)} most important first.`;

    notes.innerHTML = fixes.length ? fixes.map((r) => `
      <article class="note" data-id="${r.id}">
        <h3>${esc(CHECKS[r.id].name)}</h3>
        <p class="fix">${esc(r.fix)}</p>
        ${r.quote ? `<blockquote>${esc(r.quote)}</blockquote>` : ""}
        <p class="why">Why it matters: ${esc(CHECKS[r.id].why)}</p>
        <div class="feedback">Was this right?
          <button type="button" data-v="yes" aria-pressed="false">Yes</button>
          <button type="button" data-v="no" aria-pressed="false">No</button>
        </div>
      </article>`).join("")
      : `<p class="empty">${aiState === "pending" ? "Checking…" : "Nothing to fix. Good to publish."}</p>`;

    list.innerHTML = PRIORITY.map((id, i) => {
      const r = results[id] || { status: "pending" };
      return `<li><span>${i + 1}. ${esc(CHECKS[id].name)}</span><span class="chip ${r.status}">${STATUS_LABEL[r.status]}</span></li>`;
    }).join("");
  }

  notes.addEventListener("click", (e) => {
    const b = e.target.closest(".feedback button");
    if (!b) return;
    const note = b.closest(".note");
    note.querySelectorAll(".feedback button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    track("fix_feedback", { check_id: note.dataset.id, right: b.dataset.v === "yes" });
  });

  $("copy").addEventListener("click", async () => {
    if (!lastResults) return;
    const tsv = "Check\tTool result\n" + PRIORITY.map((id) => `${CHECKS[id].name}\t${STATUS_LABEL[lastResults[id].status]}`).join("\n");
    try { await navigator.clipboard.writeText(tsv); $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy results"), 1500); } catch (e) {}
    track("results_copied");
  });

  run.addEventListener("click", async () => {
    err.textContent = "";
    const blocks = readEditorBlocks(editor);
    if (words(blocks.map(textOf).join(" ")).length < 60) {
      err.textContent = "Paste a full draft first. The checks need at least a few paragraphs.";
      editor.focus();
      return;
    }
    const d = analyse(blocks);
    const results = ruleChecks(d);
    AI_IDS.forEach((id) => (results[id] = result(id, "pending")));
    render(results, "pending");
    run.disabled = true; run.textContent = "Checking…";

    let ai = null, aiOk = true;
    try { ai = await callAI(aiPayload(d)); }
    catch (e) {
      aiOk = false;
      err.textContent = e.message === "busy"
        ? "The AI checks are busy right now. The rule checks are below; try again in a minute for the rest."
        : `The AI checks didn't run (${e.message}). The rule checks are below; try again in a minute.`;
      track("ai_error", { reason: e.message });
    }
    Object.assign(results, aiChecks(d, ai));
    lastResults = results;
    render(results, "done");
    run.disabled = false; run.textContent = "Check again";

    track("check_run", {
      is_recheck: checksThisSession > 0,
      word_count: words(d.bodyText).length,
      fails: PRIORITY.filter((id) => results[id].status === "fail").length,
      unsure: PRIORITY.filter((id) => results[id].status === "unsure").length,
      failed_checks: PRIORITY.filter((id) => results[id].status === "fail"),
      ai_ok: aiOk
    });
    checksThisSession++;
  });
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
if (typeof module !== "undefined") module.exports = { markdownToBlocks, analyse, ruleChecks, aiChecks, aiPayload, pickFixes, gradeLevel, sentences };
