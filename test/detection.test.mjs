import test from "node:test";
import assert from "node:assert/strict";
import {
  hasMermaidLanguage,
  isMermaidSource,
  fenceSourceOf,
  isFenceComplete,
  exceedsLimits,
} from "../src/detection.js";

test("hasMermaidLanguage: language-mermaid/mmd class", () => {
  assert.equal(hasMermaidLanguage(["language-mermaid"]), true);
  assert.equal(hasMermaidLanguage(["language-mmd"]), true);
  assert.equal(hasMermaidLanguage(["language-js", "highlight"]), false);
  assert.equal(hasMermaidLanguage([]), false);
});

test("hasMermaidLanguage: infostring text match", () => {
  assert.equal(hasMermaidLanguage("mermaid"), true);
  assert.equal(hasMermaidLanguage("mmd title=x"), true);
  assert.equal(hasMermaidLanguage("js"), false);
  assert.equal(hasMermaidLanguage(""), false);
});

test("isMermaidSource: starting-keyword heuristic", () => {
  assert.equal(isMermaidSource("flowchart LR\n  a-->b"), true);
  assert.equal(isMermaidSource("graph TD\n  a-->b"), true);
  assert.equal(isMermaidSource("sequenceDiagram\n  a->>b: hi"), true);
  assert.equal(isMermaidSource("stateDiagram-v2\n  [*]-->s1"), true);
  assert.equal(isMermaidSource("erDiagram\n  a||--o{b: has"), true);
  assert.equal(isMermaidSource("mindmap\n  root"), true);
  assert.equal(isMermaidSource("pie title x\n  \"a\": 1"), true);
  assert.equal(isMermaidSource("gantt\n  task :a1, 2026-01-01, 1d"), true);
  assert.equal(isMermaidSource("journey\n  a: 5: me"), true);
  assert.equal(isMermaidSource("classDiagram\n  a<|--b"), true);
  assert.equal(isMermaidSource("quadrantChart\n  a: 1,2"), true);
  assert.equal(isMermaidSource("gitGraph\n  commit"), true);
  assert.equal(isMermaidSource("const x = 1"), false);
  assert.equal(isMermaidSource("flowcharts are fun"), false);
  assert.equal(isMermaidSource(""), false);
});

test("isMermaidSource: leading blank lines tolerated", () => {
  assert.equal(isMermaidSource("\n\n flowchart LR\n a-->b"), true);
});

test("fenceSourceOf: extracts code text from a md-code-block element", () => {
  const code = fenceSourceOf({
    querySelector: () => ({ textContent: "flowchart LR\n  a-->b" }),
  });
  assert.equal(code, "flowchart LR\n  a-->b");
  assert.equal(fenceSourceOf({ querySelector: () => null }), "");
});

test("isFenceComplete: rejects incomplete streaming fences", () => {
  // No starting keyword yet — wait for the next DOM notification.
  assert.equal(isFenceComplete("flo"), false);
  // Complete diagram source.
  assert.equal(isFenceComplete("flowchart LR\n  a-->b"), true);
  // Keyword present is enough even mid-line (renderer streams whole blocks).
  assert.equal(isFenceComplete("flowchart LR\n  a--"), true);
});

test("exceedsLimits: char/line caps", () => {
  assert.equal(exceedsLimits("a".repeat(50_001)), true);
  assert.equal(exceedsLimits("a".repeat(50_000)), false);
  // "x\n".repeat(n) holds n+1 lines per split("\n") (trailing empty line).
  assert.equal(exceedsLimits("x\n".repeat(2_000)), true);
  assert.equal(exceedsLimits(("x\n").repeat(1_999) + "x"), false);
});
