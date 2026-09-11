#!/usr/bin/env bun
/** Playwright navigate helper for Keli browser backend conformance. */
export {};
const url = process.argv[2];
if (!url) {
  console.error("usage: playwright-navigate.ts <url>");
  process.exit(2);
}

try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const payload = {
    url: page.url(),
    title: await page.title(),
    content: await page.content(),
  };
  await browser.close();
  console.log(JSON.stringify(payload));
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
