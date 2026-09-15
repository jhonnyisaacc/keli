import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { documentsExtract, ocrExtract, extractUncompressedPdfText } from "../../src/adapters/documents.ts";
import { speechSynthesize, speechTranscribe } from "../../src/adapters/speech.ts";
import { defaultConfig } from "../../src/state/config.ts";
import { addNote } from "../../src/memory/notes.ts";
import { createTestEnv } from "../helpers/setup.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { dispatchCapability } from "../../src/execution/dispatch.ts";
import { defaultNetworkPolicy } from "../../src/execution/dispatch-context.ts";
import "../../src/integrations/load.ts";

async function tempDir(prefix: string): Promise<string> {
  const dir = join(tmpdir(), `${prefix}-${crypto.randomUUID()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function textPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf (${text}) Tj ET\n`;
  return Buffer.from(
    `%PDF-1.1\n1 0 obj<<>>endobj\nstream\n${stream}endstream\ntrailer<<>>\n%%EOF\n`,
    "latin1",
  );
}

describe("modality providers", () => {
  test("extracts text files and uncompressed PDFs with source hashes", async () => {
    const dir = await tempDir("keli-mod");
    const txt = join(dir, "note.txt");
    const pdf = join(dir, "note.pdf");
    await writeFile(txt, "plain document body");
    await writeFile(pdf, textPdf("Hello from PDF"));
    const policy = { readableRoots: [dir], writableRoots: [] };

    const textResult = await documentsExtract({ path: txt }, policy);
    expect(textResult.ok).toBe(true);
    const textOut = textResult.output as { text: string; sha256: string; pages: unknown[] };
    expect(textOut.text).toContain("plain document body");
    expect(textOut.sha256).toHaveLength(64);
    expect(textResult.artifacts?.[0]?.hash).toBe(textOut.sha256);

    const pdfResult = await documentsExtract({ path: pdf }, policy);
    expect(pdfResult.ok).toBe(true);
    expect((pdfResult.output as { text: string }).text).toContain("Hello from PDF");
    expect(extractUncompressedPdfText((await Bun.file(pdf).text()))).toContain("Hello from PDF");
  });

  test("missing Tesseract is typed unavailable and does not write notes", async () => {
    const env = await createTestEnv();
    const dir = join(env.stateDir, "ocr");
    await mkdir(dir, { recursive: true });
    const image = join(dir, "page.png");
    await writeFile(image, "not-an-image");
    const before = (env.db.query("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
    const result = await ocrExtract(
      { path: image },
      { readableRoots: [dir], writableRoots: [] },
      {
        config: {
          ...defaultConfig(),
          integrations: { "ocr-tesseract": { enabled: true, settings: { bin: join(dir, "no-tesseract-bin") } } },
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("capability_unavailable");
    expect((env.db.query("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n).toBe(before);
    env.close();
  });

  test("OCR fixture returns text and confidence without leaking secrets", async () => {
    const dir = await tempDir("keli-ocr");
    const image = join(dir, "page.png");
    await writeFile(image, "png-bytes");
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        if (new URL(req.url).pathname.endsWith("/extract")) {
          return Response.json({ text: "recognized line", confidence: 0.91, pages: [{ page: 1, text: "recognized line" }] });
        }
        return new Response("no", { status: 404 });
      },
    });
    const result = await ocrExtract(
      { path: image },
      { readableRoots: [dir], writableRoots: [] },
      { fixtureUrl: `http://127.0.0.1:${server.port}` },
    );
    expect(result.ok).toBe(true);
    const output = result.output as { text: string; confidence: number };
    expect(output.text).toBe("recognized line");
    expect(output.confidence).toBe(0.91);
    expect(JSON.stringify(result)).not.toContain("secret");
    server.stop(true);
  });

  test("speech fixture transcribes, synthesizes, and types malformed JSON", async () => {
    const dir = await tempDir("keli-speech");
    const wav = join(dir, "clip.wav");
    await writeFile(wav, "RIFF....");
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const path = new URL(req.url).pathname;
        const auth = req.headers.get("authorization");
        if (auth && auth !== "Bearer secret-token") return new Response("no", { status: 401 });
        if (path.endsWith("/audio/transcriptions")) {
          const url = new URL(req.url);
          if (url.searchParams.get("bad") === "1") return new Response("not-json");
          return Response.json({ text: "hello audio", duration: 1.2, segments: [{ start: 0, end: 1.2, text: "hello audio" }] });
        }
        if (path.endsWith("/audio/speech")) {
          return new Response(Buffer.from("fake-mp3"), { headers: { "content-type": "audio/mpeg" } });
        }
        return new Response("no", { status: 404 });
      },
    });
    const base = `http://127.0.0.1:${server.port}`;
    const policy = { readableRoots: [dir], writableRoots: [] };
    const ok = await speechTranscribe({ path: wav }, policy, { fixtureUrl: base, credential: "secret-token" });
    expect(ok.ok).toBe(true);
    expect((ok.output as { text: string }).text).toBe("hello audio");
    expect(JSON.stringify(ok)).not.toContain("secret-token");

    const badServer = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return new Response("not-json");
      },
    });
    const bad = await speechTranscribe({ path: wav }, policy, { fixtureUrl: `http://127.0.0.1:${badServer.port}` });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("invalid_request");
    badServer.stop(true);

    const spoken = await speechSynthesize({ text: "hi" }, { fixtureUrl: base, credential: "secret-token" });
    expect(spoken.ok).toBe(true);
    expect((spoken.output as { bodyBase64: string }).bodyBase64).toBe(Buffer.from("fake-mp3").toString("base64"));
    expect(JSON.stringify(spoken)).not.toContain("secret-token");
    server.stop(true);
  });

  test("speech without an endpoint is missing access; cancel is typed", async () => {
    const prev = process.env.KELI_FIXTURE_SPEECH;
    delete process.env.KELI_FIXTURE_SPEECH;
    delete process.env.KELI_SPEECH_FIXTURE_URL;
    const missing = await speechSynthesize({ text: "hi" }, { config: defaultConfig() });
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("missing_access");
    const dir = await tempDir("keli-cancel");
    const wav = join(dir, "clip.wav");
    await writeFile(wav, "x");
    const signal = AbortSignal.abort();
    const cancelled = await speechTranscribe({ path: wav }, { readableRoots: [dir], writableRoots: [] }, { signal, fixtureUrl: "http://127.0.0.1:1" });
    expect(cancelled.ok).toBe(false);
    expect(cancelled.error?.code).toBe("cancelled");
    if (prev !== undefined) process.env.KELI_FIXTURE_SPEECH = prev;
  });

  test("extraction does not import notes on its own", async () => {
    const env = await createTestEnv();
    addNote(env.db, { id: crypto.randomUUID(), scope: "project:x", title: "keep", body: "existing" });
    const dir = join(env.stateDir, "docs");
    await mkdir(dir, { recursive: true });
    const txt = join(dir, "a.txt");
    await writeFile(txt, "extract me");
    const result = await documentsExtract({ path: txt }, { readableRoots: [dir], writableRoots: [] });
    expect(result.ok).toBe(true);
    expect((env.db.query("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n).toBe(1);
    env.close();
  });

  test("gate dispatch uses modality fixture URLs without adapter env knobs", async () => {
    const prevOcr = process.env.KELI_FIXTURE_OCR;
    const prevSpeech = process.env.KELI_FIXTURE_SPEECH;
    delete process.env.KELI_FIXTURE_OCR;
    delete process.env.KELI_FIXTURE_SPEECH;
    delete process.env.KELI_OCR_FIXTURE_URL;
    delete process.env.KELI_SPEECH_FIXTURE_URL;
    const dir = await tempDir("keli-dispatch-mod");
    const image = join(dir, "page.png");
    const wav = join(dir, "clip.wav");
    const txt = join(dir, "note.txt");
    await writeFile(image, "png-bytes");
    await writeFile(wav, "RIFF....");
    await writeFile(txt, "dispatched body");
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path.endsWith("/extract")) {
          return Response.json({ text: "from-dispatch", confidence: 0.8 });
        }
        if (path.endsWith("/audio/transcriptions")) {
          return Response.json({ text: "spoken-via-gate" });
        }
        return new Response("no", { status: 404 });
      },
    });
    const fixtures = { ocr: `http://127.0.0.1:${server.port}`, speech: `http://127.0.0.1:${server.port}` };
    const ctx = {
      policy: { readableRoots: [dir], writableRoots: [] },
      network: defaultNetworkPolicy(),
      fixtures,
    };
    const text = await dispatchCapability(defaultRegistry, { capabilityId: "documents.extract", input: { path: txt }, resources: [dir] }, ctx);
    expect(text.ok).toBe(true);
    expect((text.output as { text: string }).text).toContain("dispatched body");
    const ocr = await dispatchCapability(defaultRegistry, { capabilityId: "ocr.extract", input: { path: image }, resources: [dir] }, ctx);
    expect(ocr.ok).toBe(true);
    expect((ocr.output as { text: string }).text).toBe("from-dispatch");
    const spoken = await dispatchCapability(defaultRegistry, { capabilityId: "speech.transcribe", input: { path: wav }, resources: [dir] }, ctx);
    expect(spoken.ok).toBe(true);
    expect((spoken.output as { text: string }).text).toBe("spoken-via-gate");
    server.stop(true);
    if (prevOcr !== undefined) process.env.KELI_FIXTURE_OCR = prevOcr;
    if (prevSpeech !== undefined) process.env.KELI_FIXTURE_SPEECH = prevSpeech;
  });
});
