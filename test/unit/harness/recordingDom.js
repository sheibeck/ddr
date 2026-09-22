// test/unit/harness/recordingDom.js
//
// Phase 47 (SHELL-01/02/03), Plan 01 — the DOM-snapshot recording document.
// createRecordingDocument() returns a fake `document` whose elements RECORD
// every write mazeworld.html's paint()/renderCarriedList()/renderEncounter()
// make (id, class, attributes, dataset, style, hidden/disabled, innerHTML/
// textContent, children) and a serializeElements(ids) function that turns a
// set of root ids into one deterministic string — the BEFORE/AFTER fixture
// text Plan 01's shell-tab-snapshots.test.js compares byte-for-byte.
//
// Why ids are roots: mazeworld.html has no HTML parser to run against here
// (unlike test/parity/harness/sandboxPrototype.js, which never needed to
// serialize a subtree) — `document.getElementById(id)` auto-creates and
// memoises a fresh element the first time any id is asked for, exactly like
// sandboxPrototype.js's own getElementById Map trick. Every id the shell
// touches therefore becomes its own recorded root, and serializeElements
// walks outward from those roots.
//
// Per 01-RESEARCH.md Assumption A4 (mirrored by sandboxPrototype.js's own
// header comment): start with the minimal element surface and add a method/
// field only where the sandbox actually throws on a missing one, with a
// comment naming the shell call that needed it. test/unit/shellSandbox.js
// (Task 2) is where that iteration happens for mazeworld.html's classic
// script; this file only needs to stay generic.
//
// node --test sweeps every .js file under a directory named `test` as a test
// file — this module declares zero `test(...)` calls so it imports cleanly
// under a bare `node --test` run (see the Task 1 acceptance criteria).

/**
 * parseSelector(sel) — the four selector shapes recordingDom supports:
 * `#id`, `.class`, a bare tag name, and `:scope > tag` (direct children
 * only). Anything else throws — an unsupported selector must be loud, never
 * a silently-empty result (mirrors A4's "add a stub only where it throws"
 * discipline in reverse: an unsupported query is a signal the harness needs
 * a new capability, not a signal to return nothing).
 */
function parseSelector(sel) {
  if (typeof sel !== "string" || !sel) {
    throw new Error(`recordingDom: empty or non-string selector ${JSON.stringify(sel)}`);
  }
  if (sel.startsWith("#")) return { type: "id", value: sel.slice(1) };
  if (sel.startsWith(".")) return { type: "class", value: sel.slice(1) };
  const scopeMatch = /^:scope\s*>\s*([a-zA-Z][a-zA-Z0-9-]*)$/.exec(sel);
  if (scopeMatch) return { type: "scopeChild", value: scopeMatch[1].toLowerCase() };
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(sel)) return { type: "tag", value: sel.toLowerCase() };
  throw new Error(`recordingDom: unsupported selector ${JSON.stringify(sel)} (supported: #id, .class, tag, :scope > tag)`);
}

function elementMatches(el, parsed) {
  if (parsed.type === "id") return el.id === parsed.value;
  if (parsed.type === "class") return (el.className || "").split(/\s+/).filter(Boolean).includes(parsed.value);
  if (parsed.type === "tag") return el.tagName === parsed.value;
  return false;
}

function collectDescendants(root, parsed, out) {
  for (const child of root.children) {
    if (child.nodeType === 3) continue; // text nodes never match an element selector
    if (elementMatches(child, parsed)) out.push(child);
    collectDescendants(child, parsed, out);
  }
  return out;
}

// Phase 58 (MOTION-03), Plan 06 — a scoped, best-effort innerHTML->element
// fallback for `querySelector`/`querySelectorAll` ONLY. recordingDom's own
// `innerHTML` setter (below) deliberately never parses markup into real
// `.children` (see its own doc comment: ids are recorded roots, not
// nested-by-parse) — a pattern like mazeworld.html's renderCombatHeader
// (`el.innerHTML = "<span class=\"cb-head-label\"></span>..."; el
// .querySelector(".cb-head-label").textContent = vm.label;`) previously
// threw here (`querySelector` returning null on a genuinely empty
// `.children`), the first time any Phase 58 test drove the real combat
// body through this harness. This parser is ADDITIVE ONLY: it NEVER
// mutates `root.children` (a real appended child always wins first, and
// serializeElements/serializeNode — the shell-tab-snapshots.test.js pinned
// fixtures — read ONLY `.children`, so every pre-existing fixture stays
// byte-identical), it only widens what querySelector/querySelectorAll can
// FIND inside an element whose content was set via `.innerHTML = "..."`.
// VOID_TAGS never push a stack frame (no matching close tag exists in the
// shell's own innerHTML literals — img/br are never used this way, listed
// here only for correctness against a real HTML void-element set).
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);
function parseHtmlFragment(html, makeElement) {
  const root = { children: [] };
  const stack = [root];
  let i = 0;
  const n = html.length;
  while (i < n) {
    if (html[i] === "<") {
      if (html[i + 1] === "/") {
        const close = html.indexOf(">", i);
        if (close === -1) break;
        if (stack.length > 1) stack.pop();
        i = close + 1;
        continue;
      }
      const close = html.indexOf(">", i);
      if (close === -1) break;
      const tagSrc = html.slice(i + 1, close);
      const selfClosing = /\/\s*$/.test(tagSrc);
      const cleanTagSrc = selfClosing ? tagSrc.slice(0, tagSrc.lastIndexOf("/")) : tagSrc;
      const spaceIdx = cleanTagSrc.search(/\s/);
      const tagName = (spaceIdx === -1 ? cleanTagSrc : cleanTagSrc.slice(0, spaceIdx)).toLowerCase();
      const attrsStr = spaceIdx === -1 ? "" : cleanTagSrc.slice(spaceIdx);
      const el = makeElement(tagName);
      const attrRe = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:="([^"]*)")?/g;
      let am;
      while ((am = attrRe.exec(attrsStr))) {
        const name = am[1];
        const value = am[2] ?? "";
        if (!name) continue;
        if (name === "class") el.className = value;
        else if (name === "id") el.id = value;
        else el.setAttribute(name, value);
      }
      stack[stack.length - 1].children.push(el);
      if (!selfClosing && !VOID_TAGS.has(tagName)) stack.push(el);
      i = close + 1;
      continue;
    }
    const next = html.indexOf("<", i);
    const textEnd = next === -1 ? n : next;
    const text = html.slice(i, textEnd);
    if (text) stack[stack.length - 1].children.push({ nodeType: 3, textContent: text });
    i = textEnd;
  }
  return root.children;
}

/** getParsedHtmlChildren(root, makeElement) — memoised per `root`, keyed on
 * the exact `content.value` string last parsed (a fresh `.innerHTML =`
 * write invalidates the cache automatically since the keyed value differs). */
function getParsedHtmlChildren(root, makeElement) {
  const src = root._content.value;
  if (root._parsedHtmlCache && root._parsedHtmlCache.src === src) {
    return root._parsedHtmlCache.children;
  }
  const children = parseHtmlFragment(src, makeElement);
  root._parsedHtmlCache = { src, children };
  return children;
}

function queryAll(root, sel, makeElement) {
  const parsed = parseSelector(sel);
  if (parsed.type === "scopeChild") {
    return root.children.filter((c) => c.nodeType !== 3 && c.tagName === parsed.value);
  }
  const real = collectDescendants(root, parsed, []);
  if (real.length || !root._content || root._content.kind !== "html" || !root._content.value) {
    return real;
  }
  const parsedChildren = getParsedHtmlChildren(root, makeElement);
  const out = [];
  for (const child of parsedChildren) {
    if (child.nodeType === 3) continue;
    if (elementMatches(child, parsed)) out.push(child);
    collectDescendants(child, parsed, out);
  }
  return out;
}

/**
 * makeFakeCanvasContext() — a no-op 2D canvas context, same method list as
 * test/parity/harness/sandboxPrototype.js's own makeFakeCanvasContext (the
 * three snapshot surfaces never draw on a canvas themselves, but paint()'s
 * own draw() call is stubbed at the shellSandbox layer — this exists only so
 * `cv.getContext("2d")` at classic-script top level never throws).
 */
function makeFakeCanvasContext() {
  return {
    setTransform() {},
    fillRect() {},
    clearRect() {},
    fillText() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
  };
}

/**
 * createRecordingDocument() — returns { document, elementsById, serializeElements }.
 */
export function createRecordingDocument() {
  const elementsById = new Map();

  function makeElement(tag) {
    const el = {
      nodeType: 1,
      tagName: String(tag || "div").toLowerCase(),
      children: [],
      parentNode: null,
      ownerDocument: null, // filled in by the returned `document` below
      isConnected: true,
      scrollTop: 0,
      clientWidth: 0,
      clientHeight: 0,
      offsetWidth: 0,
      dataset: {},
      style: {},
      hidden: false,
      disabled: false,
      title: "",
      type: "",
      value: "",
      onclick: null,
      attributes: new Map(),
    };

    // ── id (settable; also registers the element in elementsById, mirroring
    // getElementById's own auto-create-and-memoise trick for any element
    // that picks up an id after creation, e.g. via direct assignment) ──────
    let _id = "";
    Object.defineProperty(el, "id", {
      get() {
        return _id;
      },
      set(v) {
        _id = String(v ?? "");
        if (_id) elementsById.set(_id, el);
      },
      enumerable: true,
    });

    // ── className / classList (className is the source of truth; classList
    // always reads/writes through it, per the Task 1 spec) ─────────────────
    let _className = "";
    Object.defineProperty(el, "className", {
      get() {
        return _className;
      },
      set(v) {
        _className = String(v ?? "");
      },
      enumerable: true,
    });
    const tokensOf = () => _className.split(/\s+/).filter(Boolean);
    el.classList = {
      add(...names) {
        const set = new Set(tokensOf());
        for (const n of names) set.add(n);
        _className = [...set].join(" ");
      },
      remove(...names) {
        const set = new Set(tokensOf());
        for (const n of names) set.delete(n);
        _className = [...set].join(" ");
      },
      toggle(name, force) {
        const has = tokensOf().includes(name);
        const want = force === undefined ? !has : !!force;
        if (want) el.classList.add(name);
        else el.classList.remove(name);
        return want;
      },
      contains(name) {
        return tokensOf().includes(name);
      },
    };

    // ── content: innerHTML / textContent — opaque, order-sensitive record
    // of the LAST write, per the Task 1 spec (kind: "html" | "text" | null).
    // Setting either clears `children` (mirrors a real DOM assignment
    // wiping existing children before any fresh appendChild calls). ────────
    const content = { kind: null, value: "" };
    Object.defineProperty(el, "innerHTML", {
      get() {
        return content.kind === "html" ? content.value : "";
      },
      set(v) {
        content.kind = "html";
        content.value = String(v ?? "");
        el.children = [];
        // recordingDom never parses `content.value` into real child elements
        // (per this file's own head comment — ids are recorded roots, not
        // nested-by-parse), so an id the shell writes INSIDE a template
        // string (e.g. mazeworld.html's renderEncounter store branch:
        // `body.innerHTML += "...<div id='shelf'>...";` immediately followed
        // by `document.getElementById("shelf")`) must still behave like a
        // real DOM's re-parse: the id-bearing markup being written here
        // describes a BRAND NEW element, not whatever getElementById
        // previously memoised for that id. Without this invalidation, a
        // second renderEncounter() call on the same document would find the
        // STALE #shelf/#sell-list root (never re-created, never cleared) and
        // keep appending onto it forever — the exact SHELL-03 idempotency
        // bug this line exists to prevent. A plain regex id scan is enough:
        // every id attribute in the shell's own markup is a literal
        // double-quoted string, never interpolated from item data.
        const idPattern = /\sid="([^"]+)"/g;
        let m;
        while ((m = idPattern.exec(content.value))) {
          elementsById.delete(m[1]);
        }
      },
      enumerable: true,
    });
    Object.defineProperty(el, "textContent", {
      get() {
        if (content.kind === "text") return content.value;
        // concatenated textContent of children (real-DOM fallback reading)
        return el.children.map((c) => (c.nodeType === 3 ? c.textContent : c.textContent || "")).join("");
      },
      set(v) {
        content.kind = "text";
        content.value = String(v ?? "");
        el.children = [];
      },
      enumerable: true,
    });
    el._content = content;

    // ── attributes (setAttribute/getAttribute/hasAttribute/removeAttribute) ─
    el.setAttribute = (name, value) => {
      el.attributes.set(String(name), String(value));
    };
    el.getAttribute = (name) => (el.attributes.has(name) ? el.attributes.get(name) : null);
    el.hasAttribute = (name) => el.attributes.has(name);
    el.removeAttribute = (name) => {
      el.attributes.delete(name);
    };

    // ── tree mutation ───────────────────────────────────────────────────
    // A real DOM node can only ever have one parent: appendChild/
    // insertBefore FIRST detach `child` from wherever it currently lives
    // (mazeworld.html's renderCarriedList gearRow block relies on exactly
    // this — it re-parents already-appended `<button>`s from `li` straight
    // into a new `.mw-gear-actions` row div via `row.appendChild(b)`; without
    // this detach step the button would wrongly serialize under BOTH
    // parents).
    const detach = (child) => {
      if (child.parentNode && Array.isArray(child.parentNode.children)) {
        const idx = child.parentNode.children.indexOf(child);
        if (idx !== -1) child.parentNode.children.splice(idx, 1);
      }
    };
    el.appendChild = (child) => {
      detach(child);
      child.parentNode = el;
      el.children.push(child);
      return child;
    };
    el.insertBefore = (child, ref) => {
      detach(child);
      child.parentNode = el;
      const idx = ref ? el.children.indexOf(ref) : -1;
      if (idx === -1) el.children.push(child);
      else el.children.splice(idx, 0, child);
      return child;
    };
    el.removeChild = (child) => {
      const idx = el.children.indexOf(child);
      if (idx !== -1) el.children.splice(idx, 1);
      child.parentNode = null;
      return child;
    };
    el.remove = () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
    el.replaceChildren = (...nodes) => {
      for (const c of el.children) c.parentNode = null;
      el.children = [];
      content.kind = null;
      content.value = "";
      for (const n of nodes) el.appendChild(n);
    };
    el.replaceWith = (node) => {
      const parent = el.parentNode;
      if (!parent) return; // a detached element is a no-op, per the Task 1 spec
      const idx = parent.children.indexOf(el);
      if (idx === -1) return;
      parent.children.splice(idx, 1, node);
      node.parentNode = parent;
      el.parentNode = null;
    };
    el.contains = (node) => {
      let n = node;
      while (n) {
        if (n === el) return true;
        n = n.parentNode;
      }
      return false;
    };

    // ── firstChild / lastChild (derived, always fresh) ──────────────────
    Object.defineProperty(el, "firstChild", {
      get() {
        return el.children[0] || null;
      },
    });
    Object.defineProperty(el, "lastChild", {
      get() {
        return el.children[el.children.length - 1] || null;
      },
    });

    // ── query ────────────────────────────────────────────────────────────
    el.querySelectorAll = (sel) => queryAll(el, sel, makeElement);
    el.querySelector = (sel) => queryAll(el, sel, makeElement)[0] || null;

    // ── misc no-ops / defensive stubs (A4: added because a shell function
    // this harness's callers exercise reaches for them) ────────────────────
    el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
    el.getContext = () => makeFakeCanvasContext();
    el.focus = () => {};
    el.blur = () => {};
    el.click = () => {};
    el.scrollIntoView = () => {};
    el.setPointerCapture = () => {};
    el.insertAdjacentHTML = () => {};
    el.closest = () => null;
    el.addEventListener = () => {};
    el.removeEventListener = () => {};

    return el;
  }

  function createTextNode(text) {
    return { nodeType: 3, textContent: String(text ?? "") };
  }

  function getElementById(id) {
    if (elementsById.has(id)) return elementsById.get(id);
    const el = makeElement("div");
    el.ownerDocument = document; // eslint-disable-line no-use-before-define
    el.id = id;
    return el;
  }

  const bodyEl = makeElement("body");
  const documentElementEl = makeElement("html");

  const document = {
    getElementById,
    createElement(tag) {
      const el = makeElement(tag);
      el.ownerDocument = document;
      return el;
    },
    createTextNode,
    querySelector(sel) {
      if (typeof sel !== "string" || !sel.startsWith("#")) {
        throw new Error(`recordingDom: document.querySelector only supports "#id", got ${JSON.stringify(sel)}`);
      }
      const id = sel.slice(1);
      return elementsById.has(id) ? elementsById.get(id) : null;
    },
    querySelectorAll() {
      // The classic script's only document-level querySelectorAll callers
      // in the Gear/Hero/Store surfaces (the .mw-tab tab-init scan, the
      // arm-delay aria-disabled sweep) run inside either a top-level IIFE
      // whose result this harness never inspects, or a setTimeout callback
      // the harness's stubbed setTimeout never fires — an empty NodeList
      // is always a safe, harmless answer for both.
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
    body: bodyEl,
    documentElement: documentElementEl,
  };
  bodyEl.ownerDocument = document;
  documentElementEl.ownerDocument = document;

  // ─── serializer ─────────────────────────────────────────────────────────
  function serializeNode(node, depth, lines) {
    const indent = "  ".repeat(depth);
    if (node.nodeType === 3) {
      lines.push(`${indent}#text ${JSON.stringify(node.textContent)}`);
      return;
    }
    let line = `${indent}<${node.tagName}`;
    if (node.id) line += ` id=${JSON.stringify(node.id)}`;
    if (node.className) line += ` class=${JSON.stringify(node.className)}`;
    for (const name of [...node.attributes.keys()].sort()) {
      line += ` ${name}=${JSON.stringify(node.attributes.get(name))}`;
    }
    for (const k of Object.keys(node.dataset).sort()) {
      line += ` data-${k}=${JSON.stringify(String(node.dataset[k]))}`;
    }
    const styleKeys = Object.keys(node.style).sort();
    if (styleKeys.length) {
      const styleStr = styleKeys.map((k) => `${k}:${node.style[k]};`).join("");
      line += ` style=${JSON.stringify(styleStr)}`;
    }
    if (node.hidden) line += " hidden";
    if (node.disabled) line += " disabled";
    if (node.title) line += ` title=${JSON.stringify(node.title)}`;
    if (node.type) line += ` type=${JSON.stringify(node.type)}`;
    if (node.value) line += ` value=${JSON.stringify(node.value)}`;
    if (typeof node.onclick === "function") line += " onclick";
    line += ">";
    lines.push(line);
    if (node._content.kind === "html") {
      lines.push(`${indent}  html=${JSON.stringify(node._content.value)}`);
    } else if (node._content.kind === "text") {
      lines.push(`${indent}  text=${JSON.stringify(node._content.value)}`);
    }
    for (const child of node.children) serializeNode(child, depth + 1, lines);
  }

  function serializeElements(ids) {
    const lines = [];
    for (const id of ids) {
      lines.push(`## #${id}`);
      const el = elementsById.has(id) ? elementsById.get(id) : getElementById(id);
      serializeNode(el, 0, lines);
    }
    return lines.join("\n");
  }

  return { document, elementsById, serializeElements };
}
