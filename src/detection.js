/**
 * dsh-mermaid-smooth — fence detection (pure functions).
 *
 * The dsh markdown renderer emits `div.md-code-block` for every fence with
 * the fence infostring in a banner and the source under `pre > code`. A
 * block is enhanced only when the language names mermaid (or mmd) or — for
 * fences with no infostring — the source itself starts with a mermaid
 * keyword. Incomplete (streaming) sources are left for the next DOM
 * notification.
 */

/** Fence infostring ids accepted as mermaid. */
const LANGUAGES = new Set(["mermaid", "mmd"]);

/**
 * Starting keyword admitting the source heuristic. Long-form suffixes like
 * `stateDiagram-v2` are matched through their letters-only keyword prefix.
 */
const SOURCE_KEYWORDS = new Set([
  "graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram",
  "erDiagram", "journey", "gantt", "pie", "mindmap", "timeline", "quadrantChart",
  "gitGraph", "sankey", "xychart", "block", "packet", "kanban", "architecture",
]);

/** Enhancement caps: sources beyond these stay code blocks. */
const MAX_SOURCE_CHARS = 50_000;
const MAX_SOURCE_LINES = 2_000;

/**
 * Whether the block names mermaid: a `language-<id>` class on the code
 * element, or the infostring text (the banner shows it verbatim).
 * @param classesOrInfostring - classList array of the code element, or the infostring text.
 * @returns true when the fence declares mermaid.
 */
export function hasMermaidLanguage(classesOrInfostring) {
  if (Array.isArray(classesOrInfostring)) {
    return classesOrInfostring.some((cls) => {
      const match = /^language-([\w-]+)$/.exec(cls);
      return match !== null && LANGUAGES.has(match[1]);
    });
  }
  const text = String(classesOrInfostring ?? "").trim();
  const first = /^[\w-]*/.exec(text)?.[0] ?? "";
  return LANGUAGES.has(first);
}

/**
 * Whether an (infostring-less) source starts with a mermaid keyword.
 * @param source - fence source.
 * @returns true when the first line starts with a mermaid keyword.
 */
export function isMermaidSource(source) {
  const firstLine = source.replace(/^\s+/, "").split("\n", 1)[0] ?? "";
  // Letters-only run: `stateDiagram-v2` extracts as `stateDiagram`.
  const keyword = /^[A-Za-z]+/.exec(firstLine)?.[0] ?? "";
  if (!SOURCE_KEYWORDS.has(keyword)) return false;
  // A keyword that prefixes another word (`flowcharts are fun`) is not mermaid.
  const rest = firstLine.slice(keyword.length);
  return rest === "" || /^[\s\-:]/.test(rest);
}

/**
 * Read the fence source from a code-block DOM element.
 * @param codeBlock - the `div.md-code-block` element.
 * @returns the code text, or "" when missing.
 */
export function fenceSourceOf(codeBlock) {
  const code = codeBlock.querySelector("pre code");
  return code?.textContent ?? "";
}

/**
 * Whether the fence source admits a render attempt: a mermaid keyword must
 * be present (incomplete streaming tails wait for the next notification).
 * @param source - the fence source.
 * @returns true when the source is complete enough to render.
 */
export function isFenceComplete(source) {
  return isMermaidSource(source);
}

/**
 * Whether a source exceeds the enhancement caps.
 * @param source - the fence source.
 * @returns true when the source is too large to enhance.
 */
export function exceedsLimits(source) {
  if (source.length > MAX_SOURCE_CHARS) return true;
  return source.split("\n").length > MAX_SOURCE_LINES;
}
