/**
 * dsh-mermaid-smooth — Host half.
 *
 * Placeholder carrier: this plugin is browser-only (all work happens in the
 * client bundle enhancing the conversation DOM), but dsh bundle composition
 * requires a main entry that mounts as a plain Cordis plugin. No host
 * services are registered.
 */
export const name = "dsh-mermaid-smooth";
export const inject = [];

export function apply(ctx) {
  ctx.effect(() => () => {}, "dsh-mermaid-smooth: carrier");
}
