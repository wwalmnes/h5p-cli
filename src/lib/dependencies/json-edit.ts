/**
 * Minimal location-aware JSON helpers.
 *
 * We edit library.json and semantics.json as raw text rather than
 * JSON.parse/stringify round-tripping them, because these files are
 * hand-maintained and their formatting (key order, indentation, blank lines)
 * is part of the source. A stringify would reflow the whole file and bury the
 * one-line change we actually made in an unreviewable diff.
 */

export type KeyToken = {
  key: string;
  /** Nesting depth of the object holding the key; top-level keys are 1. */
  depth: number;
  keyStart: number;
  /** Offset of the first non-whitespace character after the colon. */
  valueStart: number;
};

const WHITESPACE = /\s/;

/** Offset of the closing quote of the string literal starting at `start`. */
function endOfString(raw: string, start: number): number {
  let i = start + 1;
  while (i < raw.length) {
    if (raw[i] === '\\') {
      i += 2;
      continue;
    }
    if (raw[i] === '"') return i;
    i++;
  }
  return raw.length;
}

function skipWhitespace(raw: string, from: number): number {
  let i = from;
  while (i < raw.length && WHITESPACE.test(raw[i]!)) i++;
  return i;
}

/**
 * Every `"key":` in the document, with the depth it sits at. Strings are
 * skipped as units so a colon or brace inside a label cannot shift the depth.
 */
export function scanKeys(raw: string): KeyToken[] {
  const tokens: KeyToken[] = [];
  let depth = 0;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i]!;

    if (ch === '"') {
      const keyStart = i;
      const keyEnd = endOfString(raw, i);
      i = keyEnd + 1;

      const afterKey = skipWhitespace(raw, i);
      if (raw[afterKey] === ':') {
        tokens.push({
          key: raw.slice(keyStart + 1, keyEnd),
          depth,
          keyStart,
          valueStart: skipWhitespace(raw, afterKey + 1),
        });
      }
      continue;
    }

    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    i++;
  }

  return tokens;
}

export type NumberValue = {
  token: KeyToken;
  value: number;
  valueEnd: number;
};

function readNumber(raw: string, token: KeyToken): NumberValue | undefined {
  let end = token.valueStart;
  while (end < raw.length && /[-\d.eE+]/.test(raw[end]!)) end++;
  const text = raw.slice(token.valueStart, end);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return undefined;
  return { token, value: Number(text), valueEnd: end };
}

/** A numeric top-level key, e.g. `minorVersion` in a library.json. */
export function findTopLevelNumber(raw: string, key: string): NumberValue | undefined {
  const token = scanKeys(raw).find((candidate) => candidate.depth === 1 && candidate.key === key);
  return token ? readNumber(raw, token) : undefined;
}

/**
 * A numeric key inside the dependency object that declares `machineName`.
 *
 * Dependency entries are flat `{ machineName, majorVersion, minorVersion }`
 * objects, so the first matching key after the machineName belongs to the same
 * entry. We still bound the search to the enclosing object to be safe.
 */
export function findDependencyNumber(
  raw: string,
  machineName: string,
  key: string,
): NumberValue | undefined {
  const tokens = scanKeys(raw);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.key !== 'machineName') continue;
    if (raw[token.valueStart] !== '"') continue;
    const nameEnd = endOfString(raw, token.valueStart);
    if (raw.slice(token.valueStart + 1, nameEnd) !== machineName) continue;

    for (let j = i + 1; j < tokens.length; j++) {
      const next = tokens[j]!;
      if (next.depth < token.depth) break; // left the dependency object
      if (next.depth === token.depth && next.key === key) return readNumber(raw, next);
    }
  }

  return undefined;
}

/**
 * Offset of every `"machineName"` key belonging to a dependency entry, by name,
 * in document order.
 *
 * The depth filter is what excludes the library's own top-level `machineName`,
 * which a plain token search cannot tell apart from a dependency naming that
 * same library — the exact case a library that lists itself runs into.
 */
export function dependencyNameOffsets(raw: string): Map<string, number[]> {
  const offsets = new Map<string, number[]>();

  for (const token of scanKeys(raw)) {
    if (token.key !== 'machineName' || token.depth < 2) continue;
    if (raw[token.valueStart] !== '"') continue;

    const name = raw.slice(token.valueStart + 1, endOfString(raw, token.valueStart));
    const found = offsets.get(name);
    if (found) found.push(token.keyStart);
    else offsets.set(name, [token.keyStart]);
  }

  return offsets;
}

export function replaceSpan(raw: string, start: number, end: number, text: string): string {
  return raw.slice(0, start) + text + raw.slice(end);
}

/** 1-indexed line number containing `offset`. */
export function lineOf(raw: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < raw.length; i++) {
    if (raw[i] === '\n') line++;
  }
  return line;
}

/** Offsets of every occurrence of a literal string token. */
export function findTokenOffsets(raw: string, token: string): number[] {
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const at = raw.indexOf(token, from);
    if (at === -1) return offsets;
    offsets.push(at);
    from = at + token.length;
  }
}
