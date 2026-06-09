/**
 * CLIENT-ONLY dictionary auto-fill.
 * Calls the free dictionaryapi.dev directly from the browser (no key, CORS-OK)
 * and parses the result into form-fillable fields. This NEVER goes through the
 * Express backend and is intentionally absent from api-contract.md — no Bearer
 * token is attached.
 *
 * GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>
 */

const DICTIONARY_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";

/** Subset of fields we extract from the dictionary response, to pre-fill the form. */
export interface DictionaryFill {
  pronunciation?: string;
  partOfSpeech?: string;
  meaning?: string;
  exampleSentence?: string;
  synonyms: string[];
  antonyms: string[];
}

/** Thrown when the word is not found (HTTP 404 from dictionaryapi.dev). */
export class DictionaryNotFoundError extends Error {
  constructor(word: string) {
    super(`Không tìm thấy "${word}" trong từ điển.`);
    this.name = "DictionaryNotFoundError";
  }
}

// --- Loose shapes of the third-party API (we read defensively, never trust it). ---
interface RawPhonetic {
  text?: string;
}
interface RawDefinition {
  definition?: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}
interface RawMeaning {
  partOfSpeech?: string;
  definitions?: RawDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}
interface RawEntry {
  phonetic?: string;
  phonetics?: RawPhonetic[];
  meanings?: RawMeaning[];
}

function firstPhonetic(entries: RawEntry[]): string | undefined {
  for (const e of entries) {
    if (e.phonetic && e.phonetic.trim()) return e.phonetic.trim();
    for (const p of e.phonetics ?? []) {
      if (p.text && p.text.trim()) return p.text.trim();
    }
  }
  return undefined;
}

function uniqStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/**
 * Look up `word` and return a partial fill object.
 * Throws DictionaryNotFoundError on 404, generic Error on network/other failures.
 */
export async function lookupWord(word: string): Promise<DictionaryFill> {
  const trimmed = word.trim();
  if (!trimmed) throw new DictionaryNotFoundError(word);

  let res: Response;
  try {
    res = await fetch(`${DICTIONARY_BASE}/${encodeURIComponent(trimmed)}`);
  } catch {
    throw new Error("Không kết nối được tới từ điển. Vui lòng thử lại.");
  }

  if (res.status === 404) throw new DictionaryNotFoundError(trimmed);
  if (!res.ok) throw new Error("Tra từ điển thất bại. Vui lòng thử lại.");

  let entries: RawEntry[];
  try {
    const json = (await res.json()) as unknown;
    entries = Array.isArray(json) ? (json as RawEntry[]) : [];
  } catch {
    throw new Error("Không đọc được dữ liệu từ điển.");
  }
  if (entries.length === 0) throw new DictionaryNotFoundError(trimmed);

  const firstMeaning = entries
    .flatMap((e) => e.meanings ?? [])
    .find((m) => (m.definitions ?? []).length > 0);
  const firstDef = (firstMeaning?.definitions ?? [])[0];

  const synonyms = uniqStrings([
    ...(firstMeaning?.synonyms ?? []),
    ...(firstDef?.synonyms ?? []),
  ]).slice(0, 8);
  const antonyms = uniqStrings([
    ...(firstMeaning?.antonyms ?? []),
    ...(firstDef?.antonyms ?? []),
  ]).slice(0, 8);

  return {
    pronunciation: firstPhonetic(entries),
    partOfSpeech: firstMeaning?.partOfSpeech?.trim() || undefined,
    meaning: firstDef?.definition?.trim() || undefined,
    exampleSentence: firstDef?.example?.trim() || undefined,
    synonyms,
    antonyms,
  };
}
