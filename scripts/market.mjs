/**
 * dsh-mermaid-smooth — plugin market index writer.
 *
 * Regenerates `market/index.json` (DSH plugin market index format 1) from the
 * npm registry and the package manifest, and copies the package icon beside
 * it. Run it after `npm publish` so the new version is listed with its real
 * publish time:
 *
 *     npm run market
 *
 * A version is listed only when its published manifest declares both
 * `dsh.bundle.patch` and a non-blank `engines.dsh` range, which is what the
 * market requires of every listed version.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const NAME = "dsh-mermaid-smooth";
const REGISTRY = "https://registry.npmjs.org/";
const REPOSITORY_URL = "https://github.com/gitByteFree/dsh-mermaid-smooth";

/** Market-level display metadata (the index publishes its own title/labels). */
const MARKET = {
	title: { en: "Mermaid Smooth plugins", zh: "Mermaid 丝滑图表插件" },
	description: {
		en: "Offline Mermaid diagrams for DSH Web and Desktop chat, with smooth zoom and a per-fence diagram/code switch.",
		zh: "为 DSH Web 与桌面版对话提供离线 Mermaid 图表：丝滑缩放拖拽，按围栏切换图/源码。",
	},
	category: { id: "diagrams", title: { en: "Diagrams", zh: "图表" } },
	labels: {
		mermaid: { en: "Mermaid", zh: "Mermaid" },
		offline: { en: "Offline", zh: "离线" },
	},
};

const here = (path) => new URL(`../${path}`, import.meta.url);

const pkg = JSON.parse(await readFile(here("package.json"), "utf8"));
const response = await fetch(`${REGISTRY}${NAME}`);
if (!response.ok) throw new Error(`registry ${response.status} ${response.statusText} for ${NAME}`);
const packument = await response.json();

const eligible = Object.values(packument.versions)
	.filter((manifest) => {
		if (manifest.private === true) return false;
		const patch = manifest.dsh?.bundle?.patch;
		if (patch === undefined) return false;
		if (Array.isArray(patch) ? patch.length === 0 : typeof patch !== "string" || patch.trim() === "") return false;
		const range = manifest.engines?.dsh;
		return typeof range === "string" && range.trim() !== "";
	})
	.map((manifest) => ({
		version: manifest.version,
		publishTimestamp: Math.floor(Date.parse(packument.time[manifest.version]) / 1000),
		source: { type: "npm" },
		engines: { dsh: manifest.engines.dsh.trim() },
	}))
	.sort((a, b) => b.publishTimestamp - a.publishTimestamp);

if (eligible.length === 0) throw new Error("no published version declares dsh.bundle.patch and engines.dsh — publish first");
const latest = eligible[0].version;
if (!eligible.some((entry) => entry.version === pkg.version)) {
	throw new Error(`local version ${pkg.version} is not an eligible published version (latest eligible: ${latest}) — publish it first`);
}

const localeMeta = async (language) => {
	const file = JSON.parse(await readFile(here(`locale/${language}.json`), "utf8"));
	return file.meta;
};
const en = await localeMeta("en");
const zh = await localeMeta("zh");
const localized = (field) => {
	const value = { en: en[field], zh: zh[field] };
	if (typeof value.en !== "string" || typeof value.zh !== "string") throw new Error(`locale/${field} must be a string in en.json and zh.json`);
	return value;
};

const labels = Object.fromEntries(
	Object.entries(MARKET.labels).map(([id, title]) => [id, { title }]),
);

const index = {
	format: 1,
	title: MARKET.title,
	description: MARKET.description,
	metadata: {
		categories: { [MARKET.category.id]: { title: MARKET.category.title } },
		labels,
	},
	plugins: [
		{
			name: NAME,
			title: localized("title"),
			description: localized("description"),
			icon: "icons/icon.svg",
			author: pkg.author,
			homepage: pkg.homepage,
			repository: { url: REPOSITORY_URL },
			metadata: {
				category: MARKET.category.id,
				labels: ["mermaid", "offline"],
				keywords: pkg.keywords,
			},
			"dist-tags": { latest },
			versions: eligible,
		},
	],
};

await mkdir(here("market/icons"), { recursive: true });
await copyFile(here("icon.svg"), here("market/icons/icon.svg"));
await writeFile(here("market/index.json"), `${JSON.stringify(index, null, 2)}\n`);

console.log(`market/index.json: ${NAME} ${eligible.map((entry) => entry.version).join(", ")} (latest ${latest})`);
