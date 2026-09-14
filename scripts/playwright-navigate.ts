#!/usr/bin/env bun
/** Playwright navigate/screenshot/download helper for Keli browser backends. */
import { createHash } from "node:crypto";

const url = process.argv[2];
const mode = process.argv[3] ?? "navigate";
if (!url) {
  console.error("usage: playwright-navigate.ts <url> [navigate|screenshot|download]");
  process.exit(2);
}

try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (mode === "screenshot") {
    const buffer = await page.screenshot({ type: "png" });
    const bodyBase64 = buffer.toString("base64");
    console.log(JSON.stringify({
      url: page.url(),
      kind: "screenshot",
      title: await page.title(),
      contentType: "image/png",
      bytes: buffer.byteLength,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      bodyBase64,
    }));
  } else if (mode === "download") {
    const body = Buffer.from((await response?.body()) ?? Buffer.alloc(0));
    const contentType = response?.headers()["content-type"] ?? "application/octet-stream";
    console.log(JSON.stringify({
      url: page.url(),
      kind: "download",
      title: await page.title(),
      contentType,
      bytes: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
      bodyBase64: body.toString("base64"),
    }));
  } else {
    console.log(JSON.stringify({
      url: page.url(),
      title: await page.title(),
      content: await page.content(),
    }));
  }
  await browser.close();
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
