// Gemini / Imagen による 16:9 画像生成。
//  - imagen-*           : 高品質・16:9を確実に出力（有料枠が必要な場合あり）
//  - gemini-*-flash-image : 無料枠で動く省コストモード（16:9はaspectRatioで指定）

import { GoogleGenAI } from "@google/genai";

export const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

const FLASH_FALLBACK_MODEL = "gemini-2.5-flash-image";
const IMAGE_COUNT = 3;
const REQUEST_MIME = "image/jpeg"; // Imagen への出力フォーマット要求

function toDataUrl(b64: string, mime = "image/png"): string {
  return `data:${mime};base64,${b64}`;
}

// 1画像あたりの上限時間。1件が詰まっても全体を止めない（成功分だけ返す）。
const PER_IMAGE_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("image generation timeout")), ms)
    ),
  ]);
}

/** Imagen で 16:9 を numberOfImages 枚まとめて生成。 */
async function generateWithImagen(
  ai: GoogleGenAI,
  model: string,
  prompt: string
): Promise<string[]> {
  const res = await ai.models.generateImages({
    model,
    prompt,
    config: {
      numberOfImages: IMAGE_COUNT,
      aspectRatio: "16:9",
      outputMimeType: REQUEST_MIME,
    },
  });

  const imgs = (res.generatedImages ?? [])
    .map((g) => g.image)
    .filter((img): img is NonNullable<typeof img> => Boolean(img?.imageBytes))
    .map((img) => toDataUrl(img.imageBytes as string, img.mimeType ?? REQUEST_MIME));

  if (imgs.length === 0) {
    throw new Error("Imagen returned no images.");
  }
  return imgs;
}

/** flash 系画像モデルを並列に呼んで 3 枚生成（16:9 指定・無料枠向け）。 */
async function generateWithFlash(
  ai: GoogleGenAI,
  model: string,
  prompt: string
): Promise<string[]> {
  const wide = `${prompt}\n\n16:9 widescreen, landscape orientation, at least 1280x720.`;

  const one = async (): Promise<string | null> => {
    const res = await ai.models.generateContent({
      model,
      contents: wide,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9" },
      },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const inline = (
        p as { inlineData?: { data?: string; mimeType?: string } }
      ).inlineData;
      if (inline?.data) return toDataUrl(inline.data, inline.mimeType);
    }
    return null;
  };

  const settled = await Promise.allSettled(
    Array.from({ length: IMAGE_COUNT }, () =>
      withTimeout(one(), PER_IMAGE_TIMEOUT_MS)
    )
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
 * モデル名で経路を判定。Imagen 失敗時は無料の flash-image にフォールバック。
 */
export async function generateEyecatchImages(
  apiKey: string,
  prompt: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });

  if (IMAGE_MODEL.startsWith("imagen")) {
    try {
      return await generateWithImagen(ai, IMAGE_MODEL, prompt);
    } catch (err) {
      console.warn(
        "[images] Imagen failed, falling back to flash-image:",
        err instanceof Error ? err.message : err
      );
      return await generateWithFlash(ai, FLASH_FALLBACK_MODEL, prompt);
    }
  }

  // flash 系（無料枠）を直接指定された場合
  return await generateWithFlash(ai, IMAGE_MODEL, prompt);
}
