import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_MODEL,
  buildSystemPrompt,
  OUTPUT_SCHEMA,
  type PromptResult,
} from "@/lib/prompt";
import { generateEyecatchImages } from "@/lib/images";

// SDK は Node ランタイムが必要。画像3案生成のため余裕を持たせる。
export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  title?: string;
  allowRealEntities?: boolean;
  allowedNote?: string;
}

/** Claude でタイトルから画像生成プロンプトを組み立てる。 */
async function buildPrompt(
  client: Anthropic,
  title: string,
  allowRealEntities: boolean,
  allowedNote: string
): Promise<PromptResult> {
  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    // 速度優先: プロンプト組み立ては軽量タスクなので effort=low。
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    system: buildSystemPrompt(allowRealEntities, allowedNote),
    messages: [
      {
        role: "user",
        content: `記事タイトル: 「${title}」\n\nこの記事の16:9アイキャッチ画像を生成するためのプロンプトを作成してください。`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Claude から有効な応答が得られませんでした。");
  }
  return JSON.parse(text.text) as PromptResult;
}

export async function POST(req: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!anthropicKey || !geminiKey) {
    return NextResponse.json(
      {
        error:
          "API キーが未設定です。.env.local に ANTHROPIC_API_KEY と GEMINI_API_KEY を設定してください。",
      },
      { status: 500 }
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 }
    );
  }

  const title = (body.title ?? "").trim();
  const allowRealEntities = Boolean(body.allowRealEntities);
  const allowedNote = body.allowedNote ?? "";

  if (!title) {
    return NextResponse.json(
      { error: "記事タイトルを入力してください。" },
      { status: 400 }
    );
  }
  if (title.length > 200) {
    return NextResponse.json(
      { error: "記事タイトルが長すぎます（200文字以内）。" },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  try {
    const prompt = await buildPrompt(
      client,
      title,
      allowRealEntities,
      allowedNote
    );
    const images = await generateEyecatchImages(geminiKey, prompt.image_prompt);

    return NextResponse.json({
      summary: prompt.japanese_summary,
      style: prompt.style,
      promptUsed: prompt.image_prompt,
      images,
    });
  } catch (err) {
    console.error("[generate] failed:", err);
    const message =
      err instanceof Error ? err.message : "画像生成に失敗しました。";
    return NextResponse.json(
      { error: `生成に失敗しました: ${message}` },
      { status: 502 }
    );
  }
}
