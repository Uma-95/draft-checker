/* Draft Check
   Input (draft) -> 10 checks from my checklist -> top fixes out.
   Checks 1-2 use AI (via /api/check). Checks 3-10 are plain rules in this file. */

/* ---------- Settings you can change ---------- */

// Order = priority. The top failing checks (up to MAX_FIXES) become the fixes shown.
const PRIORITY = [
  "answer_first", "section_answers", "h2_questions", "definition", "vs_table",
  "howto_steps", "faq", "paragraphs", "keyword", "takeaways"
];
const MAX_FIXES = 5;
const ANSWER_WORDS = 70;          // main answer must appear within this many words
const KEYWORD_WORDS = 100;        // keyword must appear within this many words
const DEFINITION_WORDS = 150;     // look for a definition within this many words
const MAX_SENTENCES = 4;          // paragraphs longer than this get flagged
const H2_QUESTION_SHARE = 0.5;    // at least this share of H2s should be questions
const MAX_AI_SECTIONS = 12;

const CHECKS = {
  answer_first: {
    name: "Main question answered in the first 50–70 words",
    why: "AI answers and featured snippets lift the opening lines. If the answer comes after an intro, they skip your page."
  },
  section_answers: {
    name: "Each section opens with its own direct answer",
    why: "AI tools quote sections, not whole posts. A section that opens with its answer can be lifted on its own."
  },
  h2_questions: {
    name: "H2s written as questions",
    why: "Question headings match how people ask Google and AI tools, including the 'People also ask' box."
  },
  definition: {
    name: "A one-sentence definition near the top",
    why: "A clean 'X is…' sentence is the easiest thing for an AI tool to quote."
  },
  vs_table: {
    name: "Comparison table for an 'X vs Y' topic",
    why: "Comparison questions are answered best with a table, and tables are easy for AI tools to lift."
  },
  howto_steps: {
    name: "Numbered steps for a how-to",
    why: "How-to questions are answered with steps. Numbered steps are easy to follow and to quote."
  },
  faq: {
    name: "FAQ section",
    why: "An FAQ answers follow-up questions in short, quotable chunks."
  },
  paragraphs: {
    name: "Paragraphs of 2–4 sentences",
    why: "Short paragraphs are easier to read and easier for AI tools to lift as a clean answer."
  },
  keyword: {
    name: "Keyword in the first 100 words",
    why: "Search engines read the opening to understand what the page is about."
  },
  takeaways: {
    name: "Key takeaways box near the top",
    why: "A short summary up front helps readers skim and gives AI tools a ready-made answer."
  }
};

/* ---------- Text helpers ---------- */

const words = (t) => (t || "").trim().split(/\s+/).filter(Boolean);
const firstWords = (t, n) => words(t).slice(0, n).join(" ");
const sentences = (t) => (t || "").trim().split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/).filter((s) => s.trim());
const isQuestion = (t) => /\?\s*$/.test(t.trim());
const UTILITY_HEADING = /^(faqs?|frequently asked|common questions|key takeaways|takeaways|tl;?dr|summary|conclusion|final thoughts|references|sources|related|table of contents|contents)\b/i;
const joinText = (parts) => parts.filter(Boolean).map((t) => (/[.!?:]["'”)]?$/.test(t.trim()) ? t.trim() : t.trim() + ".")).join(" ");
const short = (t, n = 14) => { const w = words(t); return w.slice(0, n).join(" ") + (w.length > n ? "…" : ""); };

/* ---------- Turning a paste into clean blocks ---------- */
// Block: { type: "h1"|"h2"|"h3"|"p"|"ul"|"ol"|"table", text, items?, rows? }

function markdownToBlocks(text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ").trim() }); para = []; } };
  const pushItem = (type, item) => {
    const last = blocks[blocks.length - 1];
    if (last && last.type === type) last.items.push(item);
    else blocks.push({ type, items: [item] });
  };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    let m;
    if (!line) { flush(); continue; }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flush(); const lvl = Math.min(m[1].length, 3); blocks.push({ type: "h" + lvl, text: m[2].trim() }); continue; }
    if ((m = line.match(/^[-*+•]\s+(.*)$/))) { flush(); pushItem("ul", m[1].trim()); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flush(); pushItem("ol", m[1].trim()); continue; }
    if (/^\|.*\|$/.test(line)) {
      flush();
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // separator row
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      const last = blocks[blocks.length - 1];
      if (last && last.type === "table") last.rows.push(cells); else blocks.push({ type: "table", rows: [cells] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const SEL = "h1,h2,h3,h4,h5,h6,p,li,table";
  const nodes = [...doc.body.querySelectorAll(SEL)].filter((n) => !n.parentElement.closest(SEL));
  const blocks = [];
  for (const n of nodes) {
    const tag = n.tagName.toLowerCase();
    const text = n.textContent.replace(/\s+/g, " ").trim();
    if (tag === "table") {
      const rows = [...n.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim()));
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }
    if (!text) continue;
    if (tag === "li") {
      const type = n.closest("ol") ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      if (last && last.type === type) last.items.push(text); else blocks.push({ type, items: [text] });
      continue;
    }
    if (/^h[1-6]$/.test(tag)) { blocks.push({ type: "h" + Math.min(+tag[1], 3), text }); continue; }
    blocks.push({ type: "p", text });
  }
  return blocks;
}

function readEditorBlocks(editor) {
  const blocks = [];
  for (const el of editor.children) {
    const tag = el.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = [...el.querySelectorAll("li")].map((li) => li.textContent.trim()).filter(Boolean);
      if (items.length) blocks.push({ type: tag, items });
    } else if (tag === "table") {
      const rows = [...el.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
      if (rows.length) blocks.push({ type: "table", rows });
    } else {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      blocks.push({ type: /^h[1-3]$/.test(tag) ? tag : "p", text });
    }
  }
  // Text typed straight into the box (no wrapping elements)
  if (!blocks.length && editor.textContent.trim()) return markdownToBlocks(editor.innerText);
  return blocks;
}

/* ---------- Structure of a draft ---------- */

function analyse(blocks, question, keyword) {
  const h1Index = blocks.findIndex((b) => b.type === "h1");
  const title = h1Index >= 0 ? blocks[h1Index].text : (blocks[0] && (blocks[0].text || "")) || "";
  const body = h1Index >= 0 ? blocks.slice(h1Index + 1) : blocks.slice(1);
  const textOf = (b) => b.text || (b.items || []).join(". ") || (b.rows || []).map((r) => r.join(" ")).join(". ");
  const bodyText = joinText(body.filter((b) => !/^h[1-3]$/.test(b.type)).map(textOf));

  // Sections: each H2/H3 with the text under it
  const sections = [];
  body.forEach((b, i) => {
    if (b.type !== "h2" && b.type !== "h3") return;
    const parts = [];
    for (let j = i + 1; j < body.length && !/^h[1-3]$/.test(body[j].type); j++) parts.push(textOf(body[j]));
    sections.push({ level: b.type, heading: b.text, text: joinText(parts) });
  });

  return { blocks, title, body, bodyText, sections, question: (question || "").trim() || title, keyword: (keyword || "").trim() };
}

/* ---------- The rule checks (3-10) ---------- */

const result = (id, status, fix = "", quote = "") => ({ id, status, fix, quote });

function ruleChecks(d) {
  const out = {};
  const topic = (d.title + " " + d.question).toLowerCase();

  // 3. H2s as questions
  const h2s = d.sections.filter((s) => s.level === "h2" && !UTILITY_HEADING.test(s.heading.trim()));
  if (!h2s.length) out.h2_questions = result("h2_questions", "fail", "Add H2 sections, and write their headings as the questions readers ask.");
  else {
    const notQ = h2s.filter((s) => !isQuestion(s.heading));
    const share = (h2s.length - notQ.length) / h2s.length;
    out.h2_questions = share >= H2_QUESTION_SHARE
      ? result("h2_questions", "pass")
      : result("h2_questions", "fail", `${notQ.length} of ${h2s.length} H2s aren't questions. Rewrite them the way a reader would ask, e.g. "${notQ[0].heading}" → "What is…?" or "How does…?"`, notQ.slice(0, 3).map((s) => s.heading).join(" · "));
  }

  // 4. Definition near the top
  const opening = firstWords(d.bodyText, DEFINITION_WORDS);
  const def = sentences(opening).find((s) => words(s).length <= 40 && /\b(is|are|refers to|means|is defined as)\b\s+(a|an|the|when|how|any)\b/i.test(s));
  out.definition = def
    ? result("definition", "pass", "", def)
    : result("definition", "fail", `Add one clean sentence near the top that defines the topic, e.g. "${short(d.question.replace(/\?$/, ""), 8)} is …".`);

  // 5. Table for comparison topics
  if (!/\b(vs\.?|versus|compared to|comparison|compare)\b/i.test(topic)) out.vs_table = result("vs_table", "na");
  else out.vs_table = d.body.some((b) => b.type === "table")
    ? result("vs_table", "pass")
    : result("vs_table", "fail", "This is a comparison post but has no table. Add a table comparing the options side by side.");

  // 6. Numbered steps for how-tos
  if (!/^(how to|how do|how can|how should)\b/i.test(d.title.trim()) && !/^(how to|how do|how can|how should)\b/i.test(d.question) && !/step[- ]by[- ]step/i.test(topic)) out.howto_steps = result("howto_steps", "na");
  else {
    const hasList = d.body.some((b) => b.type === "ol" && b.items.length >= 3);
    const stepBlocks = d.body.filter((b) => /^step\s*\d+/i.test(b.text || "")).length;
    out.howto_steps = hasList || stepBlocks >= 3
      ? result("howto_steps", "pass")
      : result("howto_steps", "fail", "This is a how-to but the steps aren't numbered. Turn the process into a numbered list.");
  }

  // 7. FAQ section
  out.faq = d.sections.some((s) => /\b(faqs?|frequently asked|common questions)\b/i.test(s.heading))
    ? result("faq", "pass")
    : result("faq", "fail", "Add an FAQ section near the end with 3–5 real follow-up questions and short answers.");

  // 8. Paragraph length
  const longParas = d.body.filter((b) => b.type === "p" && sentences(b.text).length > MAX_SENTENCES);
  out.paragraphs = !longParas.length
    ? result("paragraphs", "pass")
    : result("paragraphs", "fail", `${longParas.length} paragraph${longParas.length > 1 ? "s have" : " has"} more than ${MAX_SENTENCES} sentences. Split ${longParas.length > 1 ? "them" : "it"} into 2–4 sentence paragraphs.`, short(longParas[0].text));

  // 9. Keyword in the first 100 words
  if (!d.keyword) out.keyword = result("keyword", "na");
  else out.keyword = firstWords(d.bodyText, KEYWORD_WORDS).toLowerCase().includes(d.keyword.toLowerCase())
    ? result("keyword", "pass")
    : result("keyword", "fail", `"${d.keyword}" doesn't appear in the first ${KEYWORD_WORDS} words. Use it naturally in the opening paragraph.`);

  // 10. Key takeaways near the top (before the second H2)
  const TAKE = /^(key takeaways|takeaways|tl;?dr|summary|in short|at a glance|quick answer)\b/i;
  const idx = d.body.findIndex((b) => TAKE.test((b.text || "").trim()));
  const secondH2 = d.body.findIndex((b, i) => b.type === "h2" && d.body.slice(0, i).some((x) => x.type === "h2"));
  if (idx === -1) out.takeaways = result("takeaways", "fail", "Add a short 'Key takeaways' box near the top with 3–4 bullet points.");
  else if (secondH2 !== -1 && idx > secondH2) out.takeaways = result("takeaways", "fail", "Your takeaways box is too far down. Move it near the top, before the main sections.");
  else out.takeaways = result("takeaways", "pass");

  return out;
}

/* ---------- The AI checks (1-2) ---------- */

// Every content section is checked; FAQ, takeaways, conclusion and empty sections are skipped
const answerSections = (d) => d.sections.filter((s) => !UTILITY_HEADING.test(s.heading.trim()) && words(s.text).length >= 5);

function aiPayload(d) {
  return {
    mainQuestion: d.question.slice(0, 300),
    intro: firstWords(d.bodyText, 150),
    sections: answerSections(d).slice(0, MAX_AI_SECTIONS)
      .map((s) => ({ heading: s.heading.slice(0, 300), text: firstWords(s.text, 120) }))
  };
}

function aiChecks(d, ai) {
  const out = {};
  const qSections = answerSections(d);
  if (!ai) {
    out.answer_first = result("answer_first", "error", "The answer check couldn't run. Try again in a minute.");
    out.section_answers = qSections.length ? result("section_answers", "error", "The answer check couldn't run. Try again in a minute.") : result("section_answers", "na");
    return out;
  }
  const m = ai.main || {};
  if (m.status === "answers_directly") out.answer_first = result("answer_first", "pass", "", m.answer_sentence || "");
  else if (m.status === "buried") out.answer_first = result("answer_first", "fail", `The answer to "${d.question}" comes too late. Move this sentence into your first ${ANSWER_WORDS} words. ${m.note || ""}`.trim(), m.answer_sentence || "");
  else if (m.status === "not_answered") out.answer_first = result("answer_first", "fail", `The opening doesn't answer "${d.question}". Start with a 1–2 sentence direct answer, then explain. ${m.note || ""}`.trim());
  else out.answer_first = result("answer_first", "unsure", "Not sure. Check manually that your first 70 words answer the main question.");

  if (!qSections.length) { out.section_answers = result("section_answers", "na"); return out; }
  const secs = ai.sections || [];
  const bad = secs.filter((s) => s.status === "buried" || s.status === "not_answered");
  const unsure = secs.filter((s) => s.status === "not_sure");
  if (bad.length) {
    const first = bad[0];
    const how = first.status === "buried" ? "Move the answer to the first line" : "Open with a 1–2 sentence answer";
    out.section_answers = result("section_answers", "fail",
      `${bad.length} section${bad.length > 1 ? "s don't" : " doesn't"} open with a direct answer: ${bad.slice(0, 3).map((s) => `"${s.heading}"`).join(", ")}. ${how} of "${first.heading}".`,
      first.answer_sentence || "");
  } else if (unsure.length === secs.length) {
    out.section_answers = result("section_answers", "unsure", "Not sure. Check manually that each question heading is answered in its first sentence.");
  } else out.section_answers = result("section_answers", "pass");
  return out;
}

async function callAI(payload) {
  const res = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(res.status === 429 ? "busy" : "failed");
  return res.json();
}

/* ---------- Picking the fixes ---------- */

function pickFixes(results) {
  return PRIORITY.map((id) => results[id]).filter((r) => r && r.status === "fail").slice(0, MAX_FIXES);
}

/* ---------- Page wiring ---------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STATUS_LABEL = { pass: "Pass", fail: "Fix", na: "Not relevant", unsure: "Not sure", error: "Didn't run", pending: "Checking…" };
const track = (event, props) => { try { if (window.posthog && window.posthog.capture) window.posthog.capture(event, props); } catch (e) {} };

function blocksToHtml(blocks) {
  return blocks.map((b) => {
    if (b.type === "ul" || b.type === "ol") return `<${b.type}>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${b.type}>`;
    if (b.type === "table") return `<table>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    return `<${b.type}>${esc(b.text)}</${b.type}>`;
  }).join("");
}

function init() {
  const $ = (id) => document.getElementById(id);
  const editor = $("editor"), run = $("run"), notes = $("notes"), summary = $("summary"), list = $("allChecks"), err = $("error");
  let checksThisSession = 0;
  let lastResults = null;

  // Clean every paste into headings, paragraphs, lists and tables
  editor.addEventListener("paste", (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    let blocks = html ? htmlToBlocks(html) : [];
    if (!blocks.length || (!blocks.some((b) => /^h[1-3]$/.test(b.type)) && /^#{1,6}\s/m.test(text))) blocks = markdownToBlocks(text);
    const sel = window.getSelection();
    if (editor.textContent.trim() && sel.rangeCount && editor.contains(sel.anchorNode)) {
      document.execCommand("insertHTML", false, blocksToHtml(blocks));
    } else {
      editor.innerHTML = blocksToHtml(blocks);
    }
    err.textContent = "";
  });

  function render(results, d, aiState) {
    const fixes = pickFixes(results);
    const fails = PRIORITY.filter((id) => results[id] && results[id].status === "fail").length;
    if (aiState === "pending") summary.textContent = "Rule checks done. Answer checks running…";
    else summary.textContent = fails === 0 ? "No fixes needed. This draft passes every check that applies." : `${fails} check${fails > 1 ? "s" : ""} to fix. Showing the ${Math.min(fails, MAX_FIXES)} most important first.`;

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
    if (words(blocks.map((b) => b.text || (b.items || []).join(" ")).join(" ")).length < 60) {
      err.textContent = "Paste a full draft first. The checks need at least a few paragraphs.";
      editor.focus();
      return;
    }
    const d = analyse(blocks, $("question").value, $("keyword").value);
    const results = { ...ruleChecks(d), answer_first: result("answer_first", "pending"), section_answers: result("section_answers", "pending") };
    render(results, d, "pending");
    run.disabled = true; run.textContent = "Checking…";

    let ai = null, aiOk = true;
    try { ai = await callAI(aiPayload(d)); }
    catch (e) {
      aiOk = false;
      err.textContent = e.message === "busy" ? "The answer checks are busy right now. The rule checks are below; try again in a minute for the rest." : "The answer checks didn't run. The rule checks are below; try again in a minute.";
      track("ai_error", { reason: e.message });
    }
    Object.assign(results, aiChecks(d, ai));
    lastResults = results;
    render(results, d, "done");
    run.disabled = false; run.textContent = "Check again";

    track("check_run", {
      is_recheck: checksThisSession > 0,
      word_count: words(d.bodyText).length,
      h2_count: d.sections.filter((s) => s.level === "h2").length,
      fails: PRIORITY.filter((id) => results[id].status === "fail").length,
      unsure: PRIORITY.filter((id) => results[id].status === "unsure").length,
      failed_checks: PRIORITY.filter((id) => results[id].status === "fail"),
      ai_ok: aiOk
    });
    checksThisSession++;
  });
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", init);
if (typeof module !== "undefined") module.exports = { markdownToBlocks, analyse, ruleChecks, aiChecks, aiPayload, pickFixes, sentences, isQuestion };
