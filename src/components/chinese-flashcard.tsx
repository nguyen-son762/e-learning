"use client";

import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HanziText } from "@/components/hanzi-text";
import { PinyinText } from "@/components/pinyin-text";
import {
  parseChineseCardBack,
  parseChineseCardExample,
} from "@/lib/chinese";
import { speak, isTtsSupported } from "@/lib/tts";

/**
 * v6 — Chinese flashcard FRONT face: large Hán tự + TTS button.
 *
 * Per design-spec §3.5b: Hanzi 64px (56 on mobile), centered, with a 🔊 button
 * top-right that fires `SpeechSynthesisUtterance` with `lang="zh-CN"`. Clicking
 * the speaker MUST NOT flip the card — caller's flip target is the surrounding
 * surface; we stop event propagation here.
 */
export function ChineseFlashcardFront({ hanzi }: { hanzi: string }) {
  const ttsOk = isTtsSupported();
  return (
    <>
      {ttsOk && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10"
          aria-label="Phát âm tiếng Trung"
          onClick={(e) => {
            e.stopPropagation();
            speak(hanzi, "zh");
          }}
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      )}
      <HanziText large className="text-center">
        {hanzi}
      </HanziText>
      <span className="mt-4 text-sm text-[var(--muted-foreground)]">
        (Nhấn để lật)
      </span>
    </>
  );
}

/**
 * v6 — Chinese flashcard BACK face. Renders:
 *   - pinyin (flashcard-pinyin token, bold-ish)
 *   - Vietnamese meaning
 *   - optional bilingual example: Hán tự, pinyin (italic muted), Vietnamese gloss
 *
 * Parses `back` as `"<pinyin> — <meaning>"` and `example` as
 * `"<Chinese> (<pinyin>) — <Vietnamese>"`. Falls back to the raw strings with
 * an inline Alert hint if parsing fails (legacy/admin-malformed cards).
 */
export function ChineseFlashcardBack({
  back,
  example,
}: {
  back: string;
  example: string | null;
}) {
  const parsed = parseChineseCardBack(back);
  const parsedExample = parseChineseCardExample(example);
  const ttsOk = isTtsSupported();

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 text-center">
      {parsed ? (
        <>
          <PinyinText size="lg" className="font-semibold">
            {parsed.pinyin}
          </PinyinText>
          <p className="text-lg font-semibold text-[var(--foreground)]">
            {parsed.meaning}
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">{back}</p>
          <Alert variant="default" className="w-full text-left">
            <AlertDescription>Định dạng thẻ không chuẩn.</AlertDescription>
          </Alert>
        </>
      )}

      {parsedExample && (
        <>
          <div className="my-1 h-px w-32 bg-[var(--border)]" aria-hidden />
          <div className="flex w-full flex-col items-center gap-1">
            <div className="flex items-center justify-center gap-2">
              <HanziText large={false} className="text-xl font-medium">
                {parsedExample.hanzi}
              </HanziText>
              {ttsOk && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Phát âm ví dụ tiếng Trung"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(parsedExample.hanzi, "zh");
                  }}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {parsedExample.pinyin && (
              <PinyinText size="sm">{parsedExample.pinyin}</PinyinText>
            )}
            <p className="text-sm text-[var(--muted-foreground)]">
              {parsedExample.gloss}
            </p>
          </div>
        </>
      )}

      {/* Legacy example fallback: raw string when parsing fails. */}
      {example && !parsedExample && (
        <p className="mt-2 max-w-md text-center text-sm italic text-[var(--muted-foreground)]">
          “{example}”
        </p>
      )}
    </div>
  );
}
