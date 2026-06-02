import { NextResponse } from "next/server";
import { PROMPT_PROVIDER } from "@/lib/prompt";
import {
  buildPromptWithClaude,
  buildPromptWithGemini,
} from "@/lib/providers";
import { generateEyecatchImages } from "@/lib/images";

// SDK は Node ランタイムが必要。画像3案生成のため余裕を持たせる。
export const runtime = "nodejs";
export const maxDuration = 60;

interface GenerateBody {
  title?: string;
  allowRealEntities?: boolean;
  allowedNote?: string;
}

export async function POST(req: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const useGemini = PROMPT_PROVIDER === "gemini";

  // 画像生成は常に Gemini を使うため GEMINI_API_KEY は必須。
  if (!geminiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY が未設定です。.env.local に設定してください（無料キー: https://aistudio.google.com/apikey）。",
      },
      { status: 500 }
    );
  }
  // プロンプト組み立てに Claude を使う場合のみ ANTHROPIC_API_KEY が必要。
  if (!useGemini && !anthropicKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY が未設定です。設定するか、無料モード（.env.local に PROMPT_PROVIDER=gemini）に切り替えてください。",
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

  try {
    const prompt = useGemini
      ? await buildPromptWithGemini(
          geminiKey,
          title,
          allowRealEntities,
          allowedNote
        )
      : await buildPromptWithClaude(
          anthropicKey as string,
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
