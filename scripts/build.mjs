/**
 * dsh-mermaid-smooth — build.
 *
 * Bundles the browser half into lib/client.js as a CJS factory registered
 * through window.__ModuleLoader__.load (the dsh client-modules shape), with
 * the mermaid engine inlined (the dynamic import becomes a bundled lazy
 * require — zero CDN). Copies the host half verbatim.
 */
import { build } from "esbuild";
import { copyFile, mkdir, readFile } from "node:fs/promises";

const ID = "dsh-mermaid-smooth";

await mkdir("lib", { recursive: true });

await build({
  entryPoints: ["src/client.js"],
  outfile: "lib/client.js",
  bundle: true,
  minify: true,
  platform: "browser",
  format: "cjs",
  target: ["chrome120"],
  legalComments: "external",
  banner: {
    js: `window.__ModuleLoader__.load({id:"${ID}",factory:(require)=>{var module={exports:{}};var exports=module.exports;`,
  },
  footer: {
    js: "return module.exports;}});",
  },
});

const clientBundle = await readFile("lib/client.js", "utf8");
if (!clientBundle.startsWith(`window.__ModuleLoader__.load({id:"${ID}"`)) {
  throw new Error("client bundle does not register the dsh-mermaid-smooth ModuleLoader ID");
}

await copyFile("src/index.js", "lib/index.js");
console.log(`lib/client.js ${(clientBundle.length / 1024 / 1024).toFixed(2)} MiB; lib/index.js copied.`);
