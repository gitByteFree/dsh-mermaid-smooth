# dsh-mermaid-smooth

English | [中文](README.zh.md)

Render mermaid code fences in DeepSeek Harness (dsh) web chat as diagrams by
default, with smooth zoom and pan, a per-fence diagram/code toggle at each
card's top-right, a persisted per-fence preference, dark-mode follow, and a
fully bundled offline engine (zero CDN).

- **Default diagram** — fences in assistant messages render as SVG diagrams
  the moment they are complete; non-mermaid code blocks are untouched.
- **Smooth interaction** — cursor-anchored wheel zoom over one composed
  transform (with a short ease-out), direct pointer drag, double-click to
  fit. Reduced-motion preferences disable all easing.
- **Toggle at top-right** — every diagram card has a 图/文案 (diagram/code)
  switch; several fences in one message toggle independently.
- **Per-fence memory** — the toggle state persists in localStorage keyed by
  the fence source, so it survives page reloads and reconnects.
- **Dark-mode follow** — diagrams re-render with the GUI theme.
- **Safe and offline** — mermaid runs at securityLevel 'strict' (built-in
  sanitization, no click handlers), the engine is bundled into the plugin
  (zero CDN), and a failed fence keeps its original code with an inline
  error banner. Uninstalling restores the conversation verbatim.

## Screenshots

![1](docs/1.png)

![2](docs/2.png)

![3](docs/3.png)

## Install

Four ways — pick one, then restart DSH Web (the current session ends, but DSH
sessions are persisted on disk and can be resumed after restart).

**1. npm package (recommended, simplest)**

```sh
dsh plugin --profile web add dsh-mermaid-smooth
```

Verified working: the tarball ships the prebuilt `lib/client.js`, so nothing
is compiled at install time. pnpm may auto-add the package to
`minimumReleaseAgeExclude` in the profile's `pnpm-workspace.yaml` (because the
package was just published) — that is expected and harmless.

**2. From GitHub (pinned to a commit)**

```sh
dsh plugin --profile web add 'github:gitByteFree/dsh-mermaid-smooth#<full-commit-sha>'
```

Pin to the commit you want (e.g. the `main` HEAD shown on the repo's commit
history page); later changes on `main` will not silently alter installed code.
The source is installed and built at install time (`prepare` runs the esbuild
bundle), so git and Node.js ≥ 20 are required.

**3. From a release tarball (offline / where git is inconvenient)**

Download `dsh-mermaid-smooth-<version>.tgz` from this repo's
[Releases](https://github.com/gitByteFree/dsh-mermaid-smooth/releases) (it
contains the prebuilt `lib/client.js`, so no `prepare` script runs at install
time), then:

```sh
dsh plugin --profile web add ./dsh-mermaid-smooth-<version>.tgz
```

**4. Local clone (for development)**

```sh
git clone git@github.com:gitByteFree/dsh-mermaid-smooth.git
cd dsh-mermaid-smooth
dsh plugin --profile web add .
```

Restart the web app (`dsh web`, or your `dsh-web` service) so the new bundle
layer is composed.

## License

MIT
