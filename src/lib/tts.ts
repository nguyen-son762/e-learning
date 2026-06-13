/**
 * CLIENT-ONLY text-to-speech using the Web SpeechSynthesis API.
 * No network, no backend. Reads a word/sentence aloud.
 * v6 — supports multiple BCP-47 locales (en-US, zh-CN).
 */
import type { Language } from "@/lib/types";

/** True when the browser supports SpeechSynthesis. */
export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

/** Map our wire-level Language enum to a BCP-47 SpeechSynthesis locale. */
export function ttsLocale(language: Language): string {
  return language === "zh" ? "zh-CN" : "en-US";
}

/**
 * Speak `text` aloud. `language` selects the BCP-47 locale (default "en").
 * No-op when speech synthesis is unsupported or text is blank.
 */
export function speak(text: string, language: Language = "en"): void {
  if (!isTtsSupported()) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    // Cancel any in-flight utterance so rapid clicks don't queue up.
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(trimmed);
    utter.lang = ttsLocale(language);
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore: TTS is a best-effort enhancement.
  }
}
