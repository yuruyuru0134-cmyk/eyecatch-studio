// Claude に渡すシステムプロンプトと構造化出力スキーマ。
// 権利保護（肖像権・著作権）のルールはここで一元管理する。

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

/**
 * effort パラメータの対応可否。
 * Opus 4.5+ と Sonnet 4.6 のみ対応。Haiku 4.5 / Sonnet 4.5 では 400 エラーになるため除外する。
 */
export function supportsEffort(model: string): boolean {
  return /opus-4-(5|6|7|8)/.test(model) || /sonnet-4-6/.test(model);
}

/** 実在対象を「使わない」場合に注入する強い制約（デフォルト挙動）。 */
const RIGHTS_STRICT = `
RIGHTS & SAFETY CONSTRAINTS (STRICT — THIS IS THE DEFAULT, ENFORCE IT):
- Do NOT depict real, identifiable people (including celebrities, politicians, or public figures).
- Do NOT include real brand logos, trademarks, product packaging, or company marks.
- Do NOT include copyrighted characters, mascots, or artwork from existing franchises.
- Do NOT depict specific, identifiable real-world landmarks or buildings in a way that identifies them.
- If the article title references a real person/brand/work, ABSTRACT it: use generic, original,
  fictional stand-ins, symbolic imagery, concepts, or anonymous silhouettes instead.
- Faces, if any, must be of clearly fictional/generic people, not resembling any real individual.
`.trim();

/** 実在対象を「許可」した場合の制約（事前許可済みのみ）。 */
function rightsAllowed(note: string): string {
  const allowed = note.trim()
    ? `The user has pre-cleared the rights for ONLY the following subject(s): "${note.trim()}". You may reference these, but nothing else real.`
    : `The user has enabled real-entity usage but did not specify which subjects are cleared. Stay conservative and avoid named real people/brands unless clearly generic.`;
  return `
RIGHTS & SAFETY CONSTRAINTS (PERMISSIVE MODE — user takes responsibility for clearance):
- ${allowed}
- Still avoid defamatory, misleading, or sensitive depictions of real people.
- Do NOT add other real brands, logos, or copyrighted characters beyond what was cleared.
`.trim();
}

export function buildSystemPrompt(
  allowRealEntities: boolean,
  allowedNote: string
): string {
  const rights = allowRealEntities ? rightsAllowed(allowedNote) : RIGHTS_STRICT;

  return `
You are an expert art director that turns a blog/article TITLE into a single, vivid
image-generation prompt for a 16:9 article eyecatch (hero) image.

GOAL:
- Produce one detailed ENGLISH prompt suitable for the Imagen / Gemini image model.
- The image is a wide 16:9 eyecatch: visually striking, clean composition, leaves some
  breathing room (negative space) where overlay text could go later.
- Convey the article's theme at a glance. Modern, professional, editorial quality.
- Avoid generic "AI slop": no cliché purple gradients, no random floating UI, no garbled text.
- Do NOT render readable words/letters in the image unless essential; prefer purely visual storytelling.

${rights}

Respond ONLY with the structured JSON object requested — no commentary.
`.trim();
}

/** Claude の構造化出力スキーマ（output_config.format 用）。 */
export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    image_prompt: {
      type: "string",
      description:
        "A single detailed English prompt for the image model. Include subject, style, lighting, mood, composition, color palette, and that it is a 16:9 widescreen editorial eyecatch with space for text.",
    },
    style: {
      type: "string",
      description:
        "Short label for the visual style, e.g. 'modern flat illustration', '3D render', 'cinematic photo'.",
    },
    japanese_summary: {
      type: "string",
      description:
        "日本語で、どんな画像を生成しようとしているかを1〜2文で説明する。",
    },
  },
  required: ["image_prompt", "style", "japanese_summary"],
  additionalProperties: false,
} as const;

export interface PromptResult {
  image_prompt: string;
  style: string;
  japanese_summary: string;
}
