/**
 * dsh-mermaid-smooth — browser half.
 *
 * Watches the conversation for mermaid fences (div.md-code-block with a
 * mermaid/mmd infostring) and replaces each with a diagram card: smooth
 * wheel zoom + pointer pan over one composed transform, a "</>" diagram/code
 * toggle and a fullscreen button (diagram view only) at the card's top-right,
 * a per-fence (source-hash) persisted preference in localStorage, dark-mode
 * follow via body[data-ds-dark-theme], strict sanitization (mermaid
 * securityLevel 'strict'), and full DOM restore on dispose. The engine is
 * bundled in — zero CDN. On any enhancement failure the original code block
 * is left untouched.
 */
import { hasMermaidLanguage, isMermaidSource, isFenceComplete, fenceSourceOf, exceedsLimits } from "./detection.js";

const TAG_ID = "dsh-mermaid-smooth/css";
const NS = "dsh-mermaid-smooth";

/** Card labels follow the GUI language (dsh's locale service is React-side). */
const isZh = (navigator.language ?? "en").toLowerCase().startsWith("zh");
const LABELS = isZh
  ? { toggle: "</>", showCodeTitle: "查看文案", showDiagramTitle: "查看图", fullscreen: "⛶", exitFullscreen: "⤡", loading: "渲染中…", loadFailed: "离线渲染引擎不可用" }
  : { toggle: "</>", showCodeTitle: "View code", showDiagramTitle: "View diagram", fullscreen: "⛶", exitFullscreen: "⤡", loading: "Rendering…", loadFailed: "Bundled render engine unavailable" };

const CSS = `
.dsh-mms{margin:8px 0 10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:10px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06));overflow:hidden}
.dsh-mms-bar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));background:var(--dsw-alias-bg-layer-1,transparent)}
.dsh-mms-badge{font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-tertiary,#888);padding:0 6px}
.dsh-mms-actions{margin-left:auto;display:flex;align-items:center;gap:4px}
.dsh-mms-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#666);border-radius:5px;font:12px/20px inherit;padding:0 10px;cursor:pointer}
.dsh-mms-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}
.dsh-mms-btn[aria-pressed='true']{border-color:var(--dsw-alias-button-primary-fill,#4c6ef5);color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgba(76,110,245,.12))}
.dsh-mms-btn:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4c6ef5);outline-offset:1px}
.dsh-mms-viewport{position:relative;height:340px;overflow:hidden;cursor:grab;touch-action:none;user-select:none}
.dsh-mms-viewport[data-dragging='true']{cursor:grabbing}
.dsh-mms-stage{position:absolute;left:50%;top:50%;transform-origin:center;will-change:transform;transition:transform 120ms ease-out}
.dsh-mms-viewport[data-dragging='true'] .dsh-mms-stage{transition:none}
.dsh-mms-stage svg{display:block;max-width:none;height:auto}
.dsh-mms-viewport[data-state='loading']{display:flex;align-items:center;justify-content:center;font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-tertiary,#888);white-space:pre-wrap;padding:12px}
.dsh-mms-viewport[data-state='error']{display:block;color:var(--dsw-alias-label-primary,#e6e6e6);cursor:default;padding:0}
.dsh-mms-error{padding:10px 14px;font:12px/20px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-state-error-primary,#d33);white-space:pre-wrap;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.dsh-mms-code{display:none;margin:0;padding:12px 14px;overflow:auto;max-height:340px;font:13px/1.7 var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);color:var(--dsw-alias-label-primary,#e6e6e6);white-space:pre;tab-size:4}
.dsh-mms[data-view='code'] .dsh-mms-viewport{display:none}
.dsh-mms[data-view='code'] .dsh-mms-code{display:block}
.dsh-mms[data-view='diagram'][data-state='error'] .dsh-mms-code{display:block}
/* Fullscreen: the wrapper becomes the fixed layer; the card fills the screen. */
.dsh-mms[data-fullscreen='true']{position:fixed;inset:0;z-index:2147483000;margin:0;border:none;border-radius:0}
.dsh-mms[data-fullscreen='true'] .dsh-mms-viewport{height:100%}
.dsh-mms[data-fullscreen='true'] .dsh-mms-stage{transition:none}
.dsh-mms[data-fullscreen='true'] .dsh-mms-code{max-height:none}
/* Enhanced fences hide their original renderer block (the source lives in
   the card's code pane); the class is removed on dispose to restore. */
.md-code-block.dsh-mms-src{display:none}
.dsh-mms code{font:inherit}
@media (prefers-reduced-motion:reduce){.dsh-mms-stage{transition:none!important}}
`;

function injectCss() {
  if (document.getElementById(TAG_ID) !== null) return;
  const style = document.createElement("style");
  style.id = TAG_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const inject = [];

/** Fence-entry registry: md-code-block element -> entry. */
const entries = new WeakMap();
/** Live card wrappers (iterable registry for GC/dispose sweeps). */
const wrappers = new Set();
/** Render queue: one mermaid render at a time so many fences never block. */
const renderQueue = [];
let renderQueueActive = false;
let renderCounter = 0;

/** Source hash (FNV-1a, hex) — the per-fence preference key. */
function sourceHash(source) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

const STORAGE_PREFIX = `${NS}:view:`;

/** Persisted diagram/code view for one fence (default diagram). */
function preferredView(source) {
  try {
    return localStorage.getItem(STORAGE_PREFIX + sourceHash(source)) === "code" ? "code" : "diagram";
  } catch {
    return "diagram";
  }
}

function rememberView(source, view) {
  try {
    localStorage.setItem(STORAGE_PREFIX + sourceHash(source), view);
  } catch {
    // Storage unavailable (quota/permission): preference is session-local.
  }
}

function isDark() {
  return document.body?.hasAttribute("data-ds-dark-theme") ?? false;
}

const MERMAID_INIT = {
  startOnLoad: false,
  securityLevel: "strict",
  // On a failed render mermaid otherwise leaves its "Syntax error in text"
  // SVG on the page (the temp mount div is only removed on the success
  // path); suppressErrorRendering makes it remove the temp elements and
  // throw cleanly. The card's own error banner shows the failure.
  suppressErrorRendering: true,
  maxTextSize: 50_000,
  maxEdges: 2_000,
};

/** Lazy engine loader: the dynamic import resolves to the bundled private copy. */
let mermaidPromise = null;
function loadMermaid() {
  if (mermaidPromise === null) {
    mermaidPromise = import("./mermaid-runtime.js").then((module) => {
      const mermaid = module.default;
      mermaid.initialize({ ...MERMAID_INIT, theme: isDark() ? "dark" : "default" });
      return mermaid;
    }).catch(() => {
      mermaidPromise = null; // allow a later retry (e.g. after HMR)
      throw new Error(LABELS.loadFailed);
    });
  }
  return mermaidPromise;
}

/**
 * Build the diagram card in place of a fence's code block. The original
 * block stays in the DOM (hidden via the dsh-mms-src class) so dispose can
 * restore it verbatim.
 * @param codeBlock - the `div.md-code-block` element.
 * @param source - the fence source.
 * @returns the entry handle.
 */
function buildCard(codeBlock, source) {
  const wrapper = document.createElement("div");
  wrapper.className = "dsh-mms";
  wrapper.dataset.view = preferredView(source);
  wrapper._codeBlock = codeBlock;

  const bar = document.createElement("div");
  bar.className = "dsh-mms-bar";
  const badge = document.createElement("div");
  badge.className = "dsh-mms-badge";
  badge.textContent = "mermaid";
  const actions = document.createElement("div");
  actions.className = "dsh-mms-actions";
  const btnToggle = document.createElement("button");
  btnToggle.type = "button";
  btnToggle.className = "dsh-mms-btn dsh-mms-btn-view";
  btnToggle.textContent = LABELS.toggle; // "</>" glyph — same button, both views
  btnToggle.title = LABELS.toggle;
  const btnFullscreen = document.createElement("button");
  btnFullscreen.type = "button";
  btnFullscreen.className = "dsh-mms-btn dsh-mms-btn-fullscreen";
  btnFullscreen.textContent = LABELS.fullscreen;
  btnFullscreen.title = LABELS.fullscreen;
  actions.append(btnToggle, btnFullscreen);
  bar.append(badge, actions);

  const viewport = document.createElement("div");
  viewport.className = "dsh-mms-viewport";
  viewport.dataset.state = "loading";
  viewport.textContent = LABELS.loading;

  const code = document.createElement("pre");
  code.className = "dsh-mms-code";
  code.textContent = source;

  wrapper.append(bar, viewport, code);
  codeBlock.before(wrapper);
  codeBlock.classList.add("dsh-mms-src");

  const entry = {
    codeBlock, wrapper, viewport, code, btnToggle, btnFullscreen, source,
    svg: null, naturalW: 0, naturalH: 0, scale: 1, tx: 0, ty: 0, baseScale: 1,
    disposed: false, queued: false, raf: 0,
  };
  entries.set(codeBlock, entry);
  wrappers.add(wrapper);

  const setPressed = () => {
    // The "</>" toggle marks the current view via aria-pressed (pressed =
    // showing code); the fullscreen button only applies to the diagram view.
    btnToggle.setAttribute("aria-pressed", String(wrapper.dataset.view === "code"));
    btnToggle.title = wrapper.dataset.view === "code"
      ? LABELS.showDiagramTitle
      : LABELS.showCodeTitle;
    btnFullscreen.style.display = wrapper.dataset.view === "diagram" ? "" : "none";
  };
  setPressed();
  const exitFullscreen = () => {
    if (wrapper.dataset.fullscreen !== "true") return;
    delete wrapper.dataset.fullscreen;
    btnFullscreen.textContent = LABELS.fullscreen;
    entry.fit();
  };
  const setView = (view) => {
    wrapper.dataset.view = view;
    if (view === "code") exitFullscreen(); // fullscreen is diagram-only
    setPressed();
    rememberView(source, view);
    // Switching back to a diagram whose render is absent re-renders.
    if (view === "diagram" && entry.svg === null) scheduleRender(entry);
  };
  btnToggle.addEventListener("click", () => {
    setView(wrapper.dataset.view === "code" ? "diagram" : "code");
  });

  // Fullscreen is a diagram-view affordance: it shows the same rendered SVG
  // in a full-screen layer — the panzoom interactions (wheel zoom anchored at
  // the pointer, drag, double-click fit) are the same handlers, just with a
  // bigger viewport. Exiting restores the normal fit.
  btnFullscreen.addEventListener("click", () => {
    if (wrapper.dataset.fullscreen === "true") {
      exitFullscreen();
    } else {
      wrapper.dataset.fullscreen = "true";
      btnFullscreen.textContent = LABELS.exitFullscreen;
      fitFullscreen();
    }
  });

  /** Fit the SVG to the fullscreen layer: contain within the larger box,
      centered. Uses the same rAF apply() path as every other transform
      change, so wheel/drag/dblclick behavior is identical up here. */
  function fitFullscreen() {
    if (entry.naturalW <= 0 || entry.naturalH <= 0) return;
    const boxW = Math.max(viewport.clientWidth - 24, 100);
    const boxH = Math.max(viewport.clientHeight - 24, 100);
    const k = Math.min(boxW / entry.naturalW, boxH / entry.naturalH, 2);
    entry.baseScale = k;
    entry.scale = k;
    entry.tx = 0;
    entry.ty = 0;
    entry.fitApply();
  }

  attachPanzoom(entry);
  scheduleRender(entry);
  return entry;
}

/**
 * Smooth wheel zoom + pointer pan over ONE composed transform on the stage:
 * `translate(calc(-50% + txpx), calc(-50% + typx)) scale(k)` — the -50%
 * centering pins the stage to the viewport center, so (tx, ty) are plain
 * offsets from center. Wheel zoom eases through the 120ms transform
 * transition (CSS retargets and interpolates from the current position —
 * that easing IS the smoothness); dragging turns the transition off for 1:1
 * directness. Cursor-anchored zoom keeps the pointer's diagram point fixed.
 * Double-click fits/resets; initial placement is fit-width.
 * @param entry - the card entry.
 */
function attachPanzoom(entry) {
  const { viewport } = entry;

  entry.stage = document.createElement("div");
  entry.stage.className = "dsh-mms-stage";

  const apply = () => {
    entry.raf = 0;
    entry.stage.style.transform =
      `translate(calc(-50% + ${entry.tx}px), calc(-50% + ${entry.ty}px)) scale(${entry.scale})`;
  };
  const schedule = () => {
    if (entry.raf === 0) entry.raf = requestAnimationFrame(apply);
  };
  entry.fitApply = apply;
  const fit = () => {
    if (entry.naturalW <= 0) return;
    const box = Math.max(viewport.clientWidth - 24, 100);
    const k = Math.min(box / entry.naturalW, 1.5);
    entry.baseScale = k;
    entry.scale = k;
    entry.tx = 0;
    entry.ty = 0;
    schedule();
  };
  entry.fit = fit;

  viewport.addEventListener("wheel", (event) => {
    if (entry.naturalW <= 0) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    const next = Math.min(Math.max(entry.scale * factor, 0.2), 8);
    // Zoom to cursor: px/py are offsets from the viewport center, matching
    // the (tx, ty) space.
    const rect = viewport.getBoundingClientRect();
    const px = event.clientX - rect.left - rect.width / 2;
    const py = event.clientY - rect.top - rect.height / 2;
    const ratio = next / entry.scale;
    entry.tx = px - (px - entry.tx) * ratio;
    entry.ty = py - (py - entry.ty) * ratio;
    entry.scale = next;
    schedule();
  }, { passive: false });

  let dragging = null;
  viewport.addEventListener("pointerdown", (event) => {
    if (entry.naturalW <= 0 || event.button !== 0) return;
    dragging = { px: event.clientX, py: event.clientY, tx: entry.tx, ty: entry.ty };
    viewport.dataset.dragging = "true";
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (dragging === null) return;
    entry.tx = dragging.tx + (event.clientX - dragging.px);
    entry.ty = dragging.ty + (event.clientY - dragging.py);
    schedule();
  });
  const endDrag = (event) => {
    if (dragging === null) return;
    dragging = null;
    delete viewport.dataset.dragging;
    try { viewport.releasePointerCapture(event.pointerId); } catch {}
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  viewport.addEventListener("dblclick", fit);
}

/** Queue one render; the queue drains one entry at a time. */
function scheduleRender(entry) {
  if (entry.queued === true || entry.disposed === true) return;
  entry.queued = true;
  renderQueue.push(entry);
  drainQueue();
}

async function drainQueue() {
  if (renderQueueActive === true) return;
  renderQueueActive = true;
  try {
    while (renderQueue.length > 0) {
      const entry = renderQueue.shift();
      entry.queued = false;
      if (entry.disposed === true) continue;
      await renderEntry(entry);
    }
  } finally {
    renderQueueActive = false;
  }
}

/**
 * Render one fence through the bundled mermaid engine into the stage.
 * @param entry - the card entry.
 */
async function renderEntry(entry) {
  const { viewport } = entry;
  if (entry.wrapper.dataset.view !== "diagram") return;
  viewport.dataset.state = "loading";
  viewport.textContent = LABELS.loading;
  try {
    const mermaid = await loadMermaid();
    // Unique id per render: mermaid mounts a temp node with this id.
    const { svg } = await mermaid.render(`dsh-mms-${sourceHash(entry.source)}-${renderCounter++}`, entry.source);
    if (entry.disposed === true) return;
    const holder = document.createElement("div");
    holder.innerHTML = svg; // mermaid 'strict' sanitizes before returning
    entry.svg = holder.firstElementChild;
    // Natural size from the viewBox (getBoundingClientRect would include scale).
    const vb = entry.svg.viewBox?.baseVal;
    entry.naturalW = vb !== undefined && vb.width > 0
      ? vb.width
      : parseFloat(entry.svg.getAttribute("width")) || 0;
    entry.naturalH = vb !== undefined && vb.height > 0
      ? vb.height
      : parseFloat(entry.svg.getAttribute("height")) || 0;
    viewport.dataset.state = "ok";
    viewport.textContent = "";
    viewport.append(entry.stage);
    entry.stage.replaceChildren(entry.svg);
    entry.fit();
  } catch (error) {
    if (entry.disposed === true) return;
    // Error banner on top; the code pane below shows the original source
    // (CSS keeps it visible in diagram view while state is 'error').
    viewport.dataset.state = "error";
    const banner = document.createElement("div");
    banner.className = "dsh-mms-error";
    banner.textContent = `${error?.message ?? error}`;
    viewport.replaceChildren(banner, entry.code);
  }
}

/**
 * Enhance a code block when it is a complete, in-limits mermaid fence. If an
 * enhanced block's source changed (the renderer re-rendered it in place),
 * the stale card is disposed and rebuilt with the new source.
 * @param codeBlock - the `div.md-code-block` element.
 * @returns true when enhanced (or already enhanced).
 */
function maybeEnhance(codeBlock) {
  const source = fenceSourceOf(codeBlock);
  if (source === "" || exceedsLimits(source)) return false;

  const existing = entries.get(codeBlock);
  if (existing !== undefined) {
    if (existing.source !== source) disposeEntry(existing);
    else return true;
  }

  const code = codeBlock.querySelector("pre code");
  const infostring = codeBlock.firstElementChild?.textContent?.trim() ?? "";
  const declared = (code !== null && hasMermaidLanguage([...code.classList])) || hasMermaidLanguage(infostring);
  if (!declared && !isMermaidSource(source)) return false;
  if (!isFenceComplete(source)) return false;

  try {
    buildCard(codeBlock, source);
    return true;
  } catch {
    return false; // fail-safe: leave the code block untouched
  }
}

/**
 * Tear one card down and restore its original code block.
 * @param entry - the card entry.
 */
function disposeEntry(entry) {
  entry.disposed = true;
  if (entry.raf !== 0) cancelAnimationFrame(entry.raf);
  entries.delete(entry.codeBlock);
  wrappers.delete(entry.wrapper);
  try { entry.wrapper.remove(); } catch {}
  try { entry.codeBlock.classList.remove("dsh-mms-src"); } catch {}
}

/**
 * Scan the DOM for mermaid fences: enhance new code blocks, re-check code
 * text that streamed in place (characterData), and drop cards whose code
 * block left the document.
 * @param mutations - MutationObserver batch.
 */
function handleMutations(mutations) {
  const seen = new Set();
  const removed = new Set();
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.(".md-code-block")) seen.add(node);
        node.querySelectorAll?.(".md-code-block").forEach((block) => seen.add(block));
      }
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.(".md-code-block")) removed.add(node);
        node.querySelectorAll?.(".md-code-block").forEach((block) => removed.add(block));
      }
    }
    // Text streamed inside an existing block, or a block's children changed.
    const target = mutation.type === "characterData" ? mutation.target.parentElement : mutation.target;
    const block = target?.closest?.(".md-code-block");
    if (block !== null && block !== undefined) seen.add(block);
  }
  for (const codeBlock of removed) {
    const entry = entries.get(codeBlock);
    if (entry !== undefined && !codeBlock.isConnected) disposeEntry(entry);
  }
  seen.forEach((codeBlock) => {
    try { maybeEnhance(codeBlock); } catch { /* fail-safe: leave untouched */ }
  });
  collectGarbage();
}

/** Dispose cards whose code block left the document. */
function collectGarbage() {
  for (const wrapper of [...wrappers]) {
    const codeBlock = wrapper._codeBlock;
    if (codeBlock !== undefined && !codeBlock.isConnected) {
      const entry = entries.get(codeBlock);
      if (entry !== undefined) disposeEntry(entry);
    }
  }
}

function apply(ctx) {
  ctx.effect(() => {
    if (typeof document === "undefined" || !document.body) return undefined;
    injectCss();

    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Dark-mode follow: flip the engine theme and re-render every card.
    const themeObserver = new MutationObserver((mutations) => {
      if (!mutations.some((mutation) => mutation.attributeName === "data-ds-dark-theme")) return;
      const theme = isDark() ? "dark" : "default";
      if (mermaidPromise !== null) {
        mermaidPromise.then((mermaid) => {
          mermaid.initialize({ ...MERMAID_INIT, theme });
        }).catch(() => {});
      }
      for (const wrapper of [...wrappers]) {
        const entry = entries.get(wrapper._codeBlock);
        if (entry === undefined || entry.svg === null) continue;
        entry.svg = null; // stale; the re-render swaps the stage content
        scheduleRender(entry);
      }
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });

    document.querySelectorAll(".md-code-block").forEach((codeBlock) => maybeEnhance(codeBlock));

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      for (const entry of [...entries.values()]) disposeEntry(entry);
      for (const wrapper of [...wrappers]) {
        const entry = entries.get(wrapper._codeBlock);
        if (entry !== undefined) disposeEntry(entry);
      }
      document.getElementById(TAG_ID)?.remove();
    };
  });
}

export { apply, inject, NS, LABELS };
