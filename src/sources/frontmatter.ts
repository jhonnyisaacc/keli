/** Minimal YAML-subset frontmatter parser: scalars, quoted strings, and simple `- item` lists. */
export type Frontmatter = Record<string, string | string[]>;

export function parseFrontmatter(text: string): { meta: Frontmatter; body: string } {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };
  const block = text.slice(3, end).replace(/^\r?\n/, "");
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const meta: Frontmatter = {};
  let currentKey: string | null = null;
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && currentKey) {
      const list = Array.isArray(meta[currentKey]) ? (meta[currentKey] as string[]) : [];
      list.push(unquote(item[1]!));
      meta[currentKey] = list;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    currentKey = kv[1]!;
    const value = kv[2]!.trim();
    if (value === "" || value === "|" || value === ">") {
      meta[currentKey] = [];
      continue;
    }
    if (value.startsWith("[") && value.endsWith("]")) {
      meta[currentKey] = value
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
      continue;
    }
    meta[currentKey] = unquote(value);
  }
  for (const [k, v] of Object.entries(meta)) {
    if (Array.isArray(v) && v.length === 0) meta[k] = "";
  }
  return { meta, body };
}

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function scalar(meta: Frontmatter, key: string): string | undefined {
  const value = meta[key];
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
