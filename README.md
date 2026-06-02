# Eyecatch Studio — AIアイキャッチ画像生成ツール

記事タイトルを入力すると、**Claude** がプロンプトを組み立て、**Gemini / Imagen** が
**16:9 のアイキャッチ画像を3案**生成します。気に入った案を選んでダウンロード、
納得いくまで再生成（リロール）できます。

> 想定案件: CrowdWorks「Claude + 画像生成で半自動アイキャッチ作成」系

## ✨ 主な機能

- 記事タイトル → Claude がプロンプト自動組み立て（構造化出力）
- Gemini で **16:9・3案**を同時生成（実寸 1280×720 以上 / Imagen 4 = 1408×768）
- 3案から選択 → **個別ダウンロード**
- **再生成（リロール）** ボタン
- 失敗時の**リトライ**（サーバー側でも Imagen→flash へ自動フォールバック）
- **肖像権・著作権の保護スイッチ**（チェックボックスON/OFF、デフォルトは「使用しない」）

## 🔒 権利保護について

- 実在の人物・ブランドロゴ・商標・著作物・特定建造物は **デフォルトで生成しません**。
- 「実在の人物・物を使用しない」チェックは**初期状態でON（=許可しない）**。
- 許可する場合のみOFFにし、**事前に権利処理が済んだ対象のみ**を使用してください
  （権利確認の責任は利用者にあります）。

## 🛠 技術スタック

Next.js (App Router) ／ Claude API (`claude-opus-4-8`) ／ Gemini API (`imagen-4.0-generate-001`)
／ TypeScript ／ Vercel デプロイ想定

## 🚀 セットアップ

```bash
# 1. 依存をインストール
npm install

# 2. 環境変数を設定
cp .env.example .env.local
#   .env.local を編集し、APIキーを設定:
#   ANTHROPIC_API_KEY=...   https://console.anthropic.com/
#   GEMINI_API_KEY=...      https://aistudio.google.com/apikey

# 3. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

### 本番ビルド

```bash
npm run build
npm start
```

## ☁️ Vercel へのデプロイ

1. GitHub にリポジトリを push
2. Vercel で Import
3. 環境変数 `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` を設定
4. Deploy

## 📁 構成

```
app/
  layout.tsx           ルートレイアウト（フォント読み込み）
  page.tsx             メインUI（入力・3案表示・選択・DL・リロール）
  globals.css          スタイル（ダークUI・SVGアイコン前提）
  api/generate/route.ts  生成API（Claude→Gemini）
lib/
  prompt.ts            Claudeのシステムプロンプト＋権利保護ルール＋出力スキーマ
  images.ts            Gemini/Imagen画像生成（フォールバック付き）
要件定義書.md           要件定義書
```

## ⚠️ 注意

- API キーは `.env.local` に保存し、**Git にコミットしないでください**（`.gitignore` 設定済み）。
- Imagen は API キーに利用権限（有料枠）が必要な場合があります。利用不可時は
  `gemini-2.5-flash-image` に自動フォールバックします（16:9 はベストエフォート）。
- 生成画像の商用利用可否・権利確認は利用者の責任で行ってください。
