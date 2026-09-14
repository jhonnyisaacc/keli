import type { CapabilityResult } from "../capabilities/types.ts";
import type { NetworkPolicy } from "../execution/network-policy.ts";
import { httpFetch } from "./http.ts";
import { boundedTextArtifact } from "../execution/artifacts.ts";

export async function webFetch(
  input: { url: string },
  policy: NetworkPolicy,
): Promise<CapabilityResult> {
  const fetched = await httpFetch({ url: input.url, method: "GET" }, policy);
  if (!fetched.ok || !fetched.output) return { ...fetched, capabilityId: "web.fetch" };

  const body = (fetched.output as { body: string; contentType?: string }).body;
  const text = stripHtml(body).slice(0, 65_536);
  const artifact = boundedTextArtifact(input.url, text, "text/plain");
  return {
    capabilityId: "web.fetch",
    ok: true,
    output: {
      url: artifact.url,
      contentType: artifact.contentType,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      text: artifact.text,
    },
    artifacts: artifact.artifacts,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
