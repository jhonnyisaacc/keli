import { $ } from "bun";

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
console.log("check: types and boundaries ok");
