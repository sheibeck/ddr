// src/browser/patchNotes.js
//
// Phase 79.3, NOTES-02 — D-20 (the pure Markdown-subset parser and DOM
// renderer for the in-game PATCH NOTES sheet) and D-21 (the once-per-update
// auto-show decision and its durable-storage reader). Wired by 79.3-07; this
// plan (79.3-03) ships the pure pieces only.
//
// This module is PURE: DOM is built only through host.ownerDocument (never
// window/document globals), and storage is reached only through an injected
// `{ getItem, setItem }` surface (the shell passes window.mzStorage) — never
// raw localStorage. No innerHTML write, no fetch, no timer.
//
// The notes body itself (docs/patch-notes/<versionName>.md, bundled as
// src/browser/patchNotesData.js) is release content, not ledgered UI copy
// (the addendum's Copy note) — only PATCH_NOTES_COPY below is a voice-corpus
// bank (tools/lib/voice-corpus.mjs#BANK_REGISTRY).

/** NOTES_SEEN_KEY — the durable-storage key for the last version the player
 * has seen the notes sheet for (D-21). */
export const NOTES_SEEN_KEY = "ddr.notes.seen.v1";

/** NOTES_PRIOR_DATA_KEYS — durable-storage keys that prove an existing
 * install: a save, graveyard, bests or settings record. Any one holding a
 * non-empty string means this device ran a build before the notes existed
 * (D-21's upgrade refinement). */
export const NOTES_PRIOR_DATA_KEYS = Object.freeze([
  "ddr.delve.v1",
  "ddr.graveyard.v1",
  "ddr.bests.v1",
  "ddr.settings.v1",
]);

/** PATCH_NOTES_RELEASES_URL — the "Past versions" link target: the public
 * patch-notes page on the Delve, Die, Repeat website (260928-web). Every
 * release's notes land there via `node tools/patch-notes.mjs --site <dir>`
 * against the website repo, deployed at release time. */
export const PATCH_NOTES_RELEASES_URL = "https://darktierstudios.com/delve-die-repeat/patch-notes";

/**
 * PATCH_NOTES_COPY — every word this module adds of its own (the sheet's
 * title, its past-versions link text, and the fallback line when a build
 * ships without its notes file). The fact first, then the joke (D-15
 * voice). British spelling ("organised"). No BANNED safety-wordlist term,
 * no "wp" or "WP".
 */
export const PATCH_NOTES_COPY = Object.freeze({
  title: "PATCH NOTES",
  pastLink: "Past versions",
  missing:
    "This build shipped without its patch notes. Every version's notes are on GitHub, which is better organised than the dungeon.",
});

// ---------------------------------------------------------------------------
// parsePatchNotes — a minimal, dependency-free Markdown subset: h1-h3,
// bullets, paragraphs, **bold** and [text](https://...) links.
// ---------------------------------------------------------------------------

/**
 * parseInlines(text) — a single line of inline Markdown (bold + https links)
 * into a frozen array of frozen inline nodes. A link whose URL is not https
 * degrades to plain text of its label. An unclosed `**` stays literal. Every
 * other character, including Unicode, passes through byte-identical.
 */
function parseInlines(text) {
  const src = typeof text === "string" ? text : "";
  const out = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push(Object.freeze({ type: "text", text: buffer }));
    buffer = "";
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    if (src[i] === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end === -1) {
        // Unclosed `**` — stays literal text, not a bold marker.
        buffer += "**";
        i += 2;
        continue;
      }
      flush();
      out.push(Object.freeze({ type: "b", text: src.slice(i + 2, end) }));
      i = end + 2;
      continue;
    }
    if (src[i] === "[") {
      const closeBracket = src.indexOf("]", i + 1);
      if (closeBracket !== -1 && src[closeBracket + 1] === "(") {
        const closeParen = src.indexOf(")", closeBracket + 2);
        if (closeParen !== -1) {
          const label = src.slice(i + 1, closeBracket);
          const href = src.slice(closeBracket + 2, closeParen);
          flush();
          if (/^https:\/\//.test(href)) {
            out.push(Object.freeze({ type: "a", text: label, href }));
          } else {
            out.push(Object.freeze({ type: "text", text: label }));
          }
          i = closeParen + 1;
          continue;
        }
      }
      buffer += src[i];
      i++;
      continue;
    }
    buffer += src[i];
    i++;
  }
  flush();
  return Object.freeze(out);
}

const HEADING_RE = Object.freeze({
  h3: /^###\s+(.*)$/,
  h2: /^##\s+(.*)$/,
  h1: /^#\s+(.*)$/,
});
const BULLET_RE = /^[-*]\s+(.*)$/;

/**
 * parsePatchNotes(md) — a Markdown-subset string into a frozen array of
 * frozen blocks: `{ type: "h1"|"h2"|"h3", inlines }`, `{ type: "p", inlines }`
 * and `{ type: "ul", items: [inlines, ...] }`. Blank lines separate blocks.
 * CRLF and a leading BOM are tolerated. An empty or non-string input gives [].
 */
export function parsePatchNotes(md) {
  if (typeof md !== "string" || md.length === 0) return Object.freeze([]);
  const text = md.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const blocks = [];
  let paraBuf = [];
  let ulBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      blocks.push(Object.freeze({ type: "p", inlines: parseInlines(paraBuf.join(" ")) }));
      paraBuf = [];
    }
  };
  const flushUl = () => {
    if (ulBuf.length) {
      blocks.push(Object.freeze({ type: "ul", items: Object.freeze(ulBuf.map((t) => parseInlines(t))) }));
      ulBuf = [];
    }
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flushPara();
      flushUl();
      continue;
    }
    const h3m = HEADING_RE.h3.exec(line);
    const h2m = !h3m && HEADING_RE.h2.exec(line);
    const h1m = !h3m && !h2m && HEADING_RE.h1.exec(line);
    if (h3m || h2m || h1m) {
      flushPara();
      flushUl();
      const type = h3m ? "h3" : h2m ? "h2" : "h1";
      const heading = h3m || h2m || h1m;
      blocks.push(Object.freeze({ type, inlines: parseInlines(heading[1]) }));
      continue;
    }
    const bm = BULLET_RE.exec(line);
    if (bm) {
      flushPara();
      ulBuf.push(bm[1]);
      continue;
    }
    flushUl();
    paraBuf.push(line.trim());
  }
  flushPara();
  flushUl();
  return Object.freeze(blocks);
}

// ---------------------------------------------------------------------------
// renderPatchNotes — the parsed blocks into DOM, through host.ownerDocument
// only. No innerHTML, no button, no handler.
// ---------------------------------------------------------------------------

function el(doc, tag, cls) {
  const node = doc.createElement(tag);
  node.className = cls;
  return node;
}

function appendInlines(doc, parent, inlines) {
  for (const inline of inlines || []) {
    if (!inline || typeof inline !== "object") continue;
    if (inline.type === "b") {
      const strong = el(doc, "strong", "mw-pn-b");
      strong.appendChild(doc.createTextNode(inline.text));
      parent.appendChild(strong);
    } else if (inline.type === "a") {
      const a = el(doc, "a", "mw-pn-a");
      a.setAttribute("href", inline.href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noreferrer");
      a.appendChild(doc.createTextNode(inline.text));
      parent.appendChild(a);
    } else {
      parent.appendChild(doc.createTextNode(inline.text));
    }
  }
}

function headingEl(doc, tag, cls, inlines) {
  const node = el(doc, tag, cls);
  appendInlines(doc, node, inlines);
  return node;
}

/**
 * renderPatchNotes(host, blocks) — draws parsePatchNotes' blocks into `host`
 * (its old children are replaced): h1->h3.mw-pn-h1, h2->h4.mw-pn-h2,
 * h3->h5.mw-pn-h3, p->p.mw-pn-p, ul->ul.mw-pn-ul with li.mw-pn-li; bold
 * becomes strong.mw-pn-b, a link becomes a.mw-pn-a (https-only, opens
 * target="_blank" rel="noreferrer"), and text becomes text nodes.
 */
export function renderPatchNotes(host, blocks) {
  const doc = host.ownerDocument;
  const root = el(doc, "div", "mw-pn");
  const list = Array.isArray(blocks) ? blocks : [];
  for (const block of list) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "h1") root.appendChild(headingEl(doc, "h3", "mw-pn-h1", block.inlines));
    else if (block.type === "h2") root.appendChild(headingEl(doc, "h4", "mw-pn-h2", block.inlines));
    else if (block.type === "h3") root.appendChild(headingEl(doc, "h5", "mw-pn-h3", block.inlines));
    else if (block.type === "p") root.appendChild(headingEl(doc, "p", "mw-pn-p", block.inlines));
    else if (block.type === "ul") {
      const ul = el(doc, "ul", "mw-pn-ul");
      for (const items of block.items || []) {
        const li = el(doc, "li", "mw-pn-li");
        appendInlines(doc, li, items);
        ul.appendChild(li);
      }
      root.appendChild(ul);
    }
  }
  host.replaceChildren(root);
  return root;
}

// ---------------------------------------------------------------------------
// notesLaunchDecision / readNotesLaunch / markNotesSeen — D-21's
// once-per-update auto-show decision and its durable-storage reader/writer.
// ---------------------------------------------------------------------------

const VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * notesLaunchDecision({ bundledVersion, seenVersion, hadPriorData }) — "none"
 * (same version already seen, or a malformed bundledVersion), "show" (a
 * different seen version, or no seen version but prior app data — an upgrade
 * from a build before the notes existed), or "mark" (a genuinely fresh
 * install: mark the version seen without showing anything). Never throws.
 */
export function notesLaunchDecision(input) {
  try {
    const bundledVersion = input && typeof input === "object" ? input.bundledVersion : undefined;
    if (typeof bundledVersion !== "string" || !VERSION_RE.test(bundledVersion)) return "none";
    const seenVersion = input.seenVersion;
    if (typeof seenVersion === "string" && seenVersion.length > 0) {
      return seenVersion === bundledVersion ? "none" : "show";
    }
    return input.hadPriorData ? "show" : "mark";
  } catch {
    return "none";
  }
}

/**
 * readNotesLaunch(storage, bundledVersion) — reads NOTES_SEEN_KEY and every
 * NOTES_PRIOR_DATA_KEYS key from the injected async `{ getItem }` storage
 * (any non-empty string counts as prior data), then returns
 * notesLaunchDecision's verdict. A missing storage, or one whose getItem
 * throws or rejects, gives "none" and this function never rejects.
 */
export async function readNotesLaunch(storage, bundledVersion) {
  if (!storage || typeof storage.getItem !== "function") return "none";
  try {
    const seenVersion = await storage.getItem(NOTES_SEEN_KEY);
    let hadPriorData = false;
    for (const key of NOTES_PRIOR_DATA_KEYS) {
      const value = await storage.getItem(key);
      if (typeof value === "string" && value.length > 0) hadPriorData = true;
    }
    return notesLaunchDecision({
      bundledVersion,
      seenVersion: typeof seenVersion === "string" ? seenVersion : null,
      hadPriorData,
    });
  } catch {
    return "none";
  }
}

/**
 * markNotesSeen(storage, version) — writes NOTES_SEEN_KEY through the
 * injected async `{ setItem }` storage. Swallows a missing storage or a
 * throwing/rejecting setItem; never throws.
 */
export async function markNotesSeen(storage, version) {
  try {
    if (!storage || typeof storage.setItem !== "function") return;
    await storage.setItem(NOTES_SEEN_KEY, version);
  } catch {
    // fail-safe: a write that can't land must never crash the caller.
  }
}
