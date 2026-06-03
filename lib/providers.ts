// プロンプト組み立てプロバイダ。
//  - Claude (Anthropic): 案件要件・デフォルト。高品質。
//  - Gemini (Google):    無料枠で動かせる省コストモード。

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import {
  ANTHROPIC_MODEL,
  GEMINI_TEXT_MODEL,
  buildSystemPrompt,
  OUTPUT_SCHEMA,
  supportsEffort,
  type AspectRatio,
  type PromptResult,
} from "@/lib/prompt";

const USER_INSTRUCTION = (title: string, aspectRatio: AspectRatio) =>
  `記事タイトル: 「${title}」\n\nこの記事の${aspectRatio}アイキャッチ画像を生成するためのプロンプトを作成してください（アスペクト比 ${aspectRatio} に合った構図にすること）。`;

/** 応答テキストから JSON 部分を安全に取り出してパースする。 */
function parsePromptResult(text: string): PromptResult {
  let raw = text.trim();
  // 万一コードフェンスが付いた場合に除去
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const obj = JSON.parse(raw) as PromptResult;
  if (!obj.image_prompt) {
    throw new Error("プロンプト生成結果が不正です（image_prompt がありません）。");
  }
  return obj;
}

/** Claude でプロンプトを組み立てる。 */
export async function buildPromptWithClaude(
  apiKey: string,
  title: string,
  allowRealEntities: boolean,
  allowedNote: string,
  aspectRatio: AspectRatio
): Promise<PromptResult> {
  const client = new Anthropic({ apiKey });

  // 構造化出力は全モデル対応。effort は対応モデルのみ付与（Haiku 4.5 では送るとエラー）。
  const output_config: {
    format: { type: "json_schema"; schema: Record<string, unknown> };
    effort?: "low";
  } = {
    format: {
      type: "json_schema",
      schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    },
  };
  if (supportsEffort(ANTHROPIC_MODEL)) {
    output_config.effort = "low";
  }

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    output_config,
    system: buildSystemPrompt(allowRealEntities, allowedNote, aspectRatio),
    messages: [{ role: "user", content: USER_INSTRUCTION(title, aspectRatio) }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Claude から有効な応答が得られませんでした。");
  }
  return parsePromptResult(text.text);
}

/** Gemini（無料枠）でプロンプトを組み立てる。 */
export async function buildPromptWithGemini(
  apiKey: string,
  title: string,
  allowRealEntities: boolean,
  allowedNote: string,
  aspectRatio: AspectRatio
): Promise<PromptResult> {
  const ai = new GoogleGenAI({ apiKey });

  const system =
    buildSystemPrompt(allowRealEntities, allowedNote, aspectRatio) +
    `\n\nReturn ONLY a JSON object with exactly these keys: ` +
    `"image_prompt" (string), "style" (string), "japanese_summary" (string). ` +
    `No markdown, no code fences.`;

  const res = await ai.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: USER_INSTRUCTION(title, aspectRatio),
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      temperature: 0.8,
    },
  });

  const text = res.text ?? "";
  if (!text) {
    throw new Error("Gemini から有効な応答が得られませんでした。");
  }
  return parsePromptResult(text);
}
