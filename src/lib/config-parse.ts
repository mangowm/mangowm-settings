import type { ConfigData, ConfigLine, ParsedConfig } from "./config-types";

/**
 * Parses the mango flat key=value config format.
 * Lines starting with # are comments. Blank lines are preserved.
 * Lines without = are preserved as comments to avoid data loss.
 */
export function parseConfig(text: string): ParsedConfig {
  const data: ConfigData = {};
  const lines: ConfigLine[] = [];

  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();

    if (!trimmed) {
      lines.push({ type: "blank", raw });
      continue;
    }

    if (trimmed.startsWith("#")) {
      lines.push({ type: "comment", text: trimmed, raw });
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      lines.push({ type: "comment", text: trimmed, raw });
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();

    lines.push({ type: "entry", key, value, raw });

    if (!data[key]) data[key] = [];
    data[key].push(value);
  }

  return { data, lines };
}

/**
 * Serializes back to text, preserving original line order.
 *
 * Walks the original lines; for each entry line, emits the next
 * unconsumed value from data[key] via a per-key cursor.
 * Entries whose key no longer exists in data are silently dropped
 * (their line is omitted).
 * Remaining values (new entries added via addEntry that have no
 * corresponding original line) are appended at the end.
 *
 * This function is idempotent — calling it multiple times with the
 * same (data, lines) produces identical output because it never
 * mutates its inputs.
 */
export function serializeConfig({ data, lines }: ParsedConfig): string {
  const consumed = new Map<string, number>();
  const out: string[] = [];

  // First pass: walk original lines, populating each from its
  // data[key] slot in declaration order.
  for (const line of lines) {
    if (line.type !== "entry") {
      out.push(line.raw);
      continue;
    }

    const values = data[line.key];
    const c = consumed.get(line.key) ?? 0;
    if (values && c < values.length) {
      out.push(`${line.key} = ${values[c]}`);
      consumed.set(line.key, c + 1);
    }
    // else: entry was removed from data — drop the line silently
  }

  // Second pass: append any values that were added via addEntry /
  // setValue / setValues and have no corresponding original line.
  for (const [key, values] of Object.entries(data)) {
    const c = consumed.get(key) ?? 0;
    for (let i = c; i < values.length; i++) {
      out.push(`${key} = ${values[i]}`);
    }
  }

  return out.join("\n");
}
