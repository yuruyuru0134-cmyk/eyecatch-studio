// Gemini / Imagen による 16:9 画像生成。
// 主: Imagen (16:9・高解像度を確実に出力) / 副: gemini-2.5-flash-image フォールバック。

import { GoogleGenAI } from "@google/genai";

export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

const IMAGE_COUNT = 3;
const MIME = "image/jpeg";

function toDataUrl(b64: string): string {
  return `data:${MIME};base64,${b64}`;
}

/** Imagen で 16:9 を numberOfImages 枚まとめて生成。 */
async function generateWithImagen(
  ai: GoogleGenAI,
  prompt: string
): Promise<string[]> {
  const res = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: {
      numberOfImages: IMAGE_COUNT,
      aspectRatio: "16:9",
      outputMimeType: MIME,
    },
  });

  const imgs = (res.generatedImages ?? [])
    .map((g) => g.image?.imageBytes)
    .filter((b): b is string => Boolean(b))
    .map(toDataUrl);

  if (imgs.length === 0) {
    throw new Error("Imagen returned no images.");
  }
  return imgs;
}

/** フォールバック: gemini-2.5-flash-image を並列に呼んで 3 枚生成。 */
async function generateWithFlash(
  ai: GoogleGenAI,
  prompt: string
): Promise<string[]> {
  const wide = `${prompt}\n\nOutput a 16:9 widescreen image (at least 1280x720), landscape orientation.`;

  const one = async (): Promise<string | null> => {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: wide,
      config: { responseModalities: ["IMAGE"] },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const data = (p as { inlineData?: { data?: string } }).inlineData?.data;
      if (data) return toDataUrl(data);
    }
    return null;
  };

  const settled = await Promise.allSettled(
    Array.from({ length: IMAGE_COUNT }, () => one())
  );
  const imgs = settled
    .filter(
      (r): r is PromiseFulfilledResult<string | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((v): v is string => Boolean(v));

  if (imgs.length === 0) {
    throw new Error("Flash image model returned no images.");
  }
  return imgs;
}

/**
 * 16:9 画像を最大3枚生成して data URL 配列で返す。
 * Imagen を試し、失敗（権限不足等）なら flash-image にフォールバック。
 */
export async function generateEyecatchImages(
  apiKey: string,
  prompt: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    return await generateWithImagen(ai, prompt);
  } catch (err) {
    // Imagen が使えない環境（無料枠等）向けのフォールバック
    console.warn(
      "[images] Imagen failed, falling back to flash-image:",
      err instanceof Error ? err.message : err
    );
    return await generateWithFlash(ai, prompt);
  }
}
