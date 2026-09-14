import { $ } from "bun";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const tsc = await $`bunx tsc --noEmit`.quiet().nothrow();
if (tsc.exitCode !== 0) {
  console.error(tsc.stderr.toString());
  process.exit(1);
}

const coreFiles = [...new Bun.Glob("src/core/**/*.ts").scanSync("."), ...new Bun.Glob("src/state/**/*.ts").scanSync(".")];
for (const file of coreFiles) {
  const text = await Bun.file(file).text();
  if (/from ['"]\.{1,2}\/adapters/.test(text)) {
    console.error(`Boundary check failed: ${file} imports adapters`);
    process.exit(1);
  }
  if (/from ['"].*integrations\/profiles/.test(text)) {
    console.error(`Boundary check failed: ${file} imports integration profiles`);
    process.exit(1);
  }
}

const trackedGlobs = [
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "PRD.md",
  "PRODUCT_RESEARCH.md",
  "README.md",
  "REPO_GOVERNANCE.md",
  "docs/**/*.{md,json,jsonl,txt,log}",
  "plans/**/*.md",
  "experiments/**/*.{md,ts,py,json}",
  "scripts/**/*.ts",
  "src/**/*.ts",
  "tests/**/*.ts",
];
const homePath = /(?:^|[\s`"'(=\[]|file:\/\/)(\/(?:home|Users)\/[A-Za-z0-9._-]+)/;
const skipLink = /^(https?:|mailto:|#|\$)/;
const markdownFiles: string[] = [];
for (const pattern of trackedGlobs) {
  for (const file of new Bun.Glob(pattern).scanSync(".")) {
    if (file.startsWith("node_modules/") || file.includes("/.git/")) continue;
    const text = await Bun.file(file).text();
    const match = homePath.exec(text);
    if (match) {
      console.error(`Portability check failed: ${file} embeds personal-home path ${match[1]}`);
      process.exit(1);
    }
    if (file.endsWith(".md")) markdownFiles.push(file);
  }
}

const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
const broken: string[] = [];
for (const file of markdownFiles) {
  const text = await Bun.file(file).text();
  const dir = dirname(file);
  for (const match of text.matchAll(linkRe)) {
    const raw = match[1]!.split(/\s+/)[0]!.replace(/\\/g, "");
    const href = raw.replace(/#.*$/, "");
    if (!href || skipLink.test(href)) continue;
    const target = resolve(dir, href);
    if (!existsSync(target) && !existsSync(join(target, "README.md"))) {
      broken.push(`${file}: ${href}`);
    }
  }
}
if (broken.length) {
  console.error(`Broken documentation links (${broken.length}):`);
  for (const item of broken) console.error(`  ${item}`);
  process.exit(1);
}

console.log("check: types, boundaries, and portable docs ok");
