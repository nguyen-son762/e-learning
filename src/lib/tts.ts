/**
 * CLIENT-ONLY text-to-speech using the Web SpeechSynthesis API.
 * No network, no backend — reads the English `word` aloud (en-US).
 * Safely guards environments without speech support.
 */

/** True when the browser supports SpeechSynthesis. */
export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

/** Speak `word` aloud in English (en-US). No-op when unsupported. */
export function speak(word: string): void {
  if (!isTtsSupported()) return;
  const text = word.trim();
  if (!text) return;
  try {
    // Cancel any in-flight utterance so rapid clicks don't queue up.
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore: TTS is a best-effort enhancement.
  }
}
