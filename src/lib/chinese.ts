/**
 * v6 — parsing helpers for the Chinese flashcard storage convention.
 *
 * Per design-spec §3.5b, Chinese flashcards store:
 *   - `back`    = "<pinyin> — <Vietnamese meaning>"
 *   - `example` = "<Chinese sentence> (<pinyin>) — <Vietnamese gloss>"
 *
 * Both fields are split on " — " (em-dash with spaces). Example also extracts
 * the parenthetical pinyin. When parsing fails on legacy/malformed cards, we
 * return null so the caller can fall back to rendering the raw string.
 */

const SEPARATOR = " — ";

export interface ChineseBack {
  pinyin: string;
  meaning: string;
}

export interface ChineseExample {
  hanzi: string;
  pinyin: string | null;
  gloss: string;
}

/**
 * Split `back` into { pinyin, meaning }. Returns null if the field does not
 * contain the expected separator or either half is empty.
 */
export function parseChineseCardBack(back: string): ChineseBack | null {
  const i = back.indexOf(SEPARATOR);
  if (i < 0) return null;
  const pinyin = back.slice(0, i).trim();
  const meaning = back.slice(i + SEPARATOR.length).trim();
  if (!pinyin || !meaning) return null;
  return { pinyin, meaning };
}

/**
 * Split `example` into { hanzi, pinyin, gloss }. The pinyin is optional (inside
 * parens after the hanzi); if absent we still return the hanzi + gloss split.
 * Returns null if the field is empty or lacks the separator.
 */
export function parseChineseCardExample(
  example: string | null,
): ChineseExample | null {
  if (!example) return null;
  const i = example.indexOf(SEPARATOR);
  if (i < 0) return null;
  const left = example.slice(0, i).trim();
  const gloss = example.slice(i + SEPARATOR.length).trim();
  if (!left || !gloss) return null;

  const paren = left.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (paren) {
    const [, hanzi, pinyin] = paren;
    return { hanzi: hanzi.trim(), pinyin: pinyin.trim(), gloss };
  }
  return { hanzi: left, pinyin: null, gloss };
}
