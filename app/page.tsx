"use client";

import { useState } from "react";

interface GenerateResponse {
  summary: string;
  style: string;
  promptUsed: string;
  images: string[];
}

// ── インラインSVGアイコン（容量低減のため外部ライブラリ不使用）──
const IconSparkle = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
      fill="currentColor"
    />
    <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill="currentColor" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 12.5l4.5 4.5L19 7"
      stroke="#04121f"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconReroll = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 12a9 9 0 0114.5-7M21 5v5h-5M21 12a9 9 0 01-14.5 7M3 19v-5h5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const IconWarn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Home() {
  const [title, setTitle] = useState("");
  // 「実在の人物・物を使用しない」= デフォルトON（= 許可しない が初期状態）
  const [blockReal, setBlockReal] = useState(true);
  const [allowedNote, setAllowedNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  async function generate() {
    if (!title.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSelected(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          // UI上は「使用しない」を保持。APIは allowRealEntities で受ける。
          allowRealEntities: !blockReal,
          allowedNote: !blockReal ? allowedNote : "",
        }),
      });
      const data = (await res.json()) as GenerateResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "生成に失敗しました。");
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function download(dataUrl: string, index: number) {
    const a = document.createElement("a");
    a.href = dataUrl;
    const safe = title.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "eyecatch";
    // data URL の MIME から拡張子を決定（png / jpg など中身と一致させる）
    const mime = dataUrl.match(/^data:image\/(\w+);/)?.[1] ?? "png";
    const ext = mime === "jpeg" ? "jpg" : mime;
    a.download = `${safe}_${index + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <main className="shell">
      <header>
        <div className="masthead">
          <div className="logo-badge">
            <IconSparkle size={24} />
          </div>
          <h1 className="brand">
            Eyecatch <span className="accent">Studio</span>
          </h1>
        </div>
        <p className="tagline">
          記事タイトルを入力すると、Claude がプロンプトを組み立て、Gemini が
          16:9 のアイキャッチ画像を 3 案生成します。気に入った案を選んでダウンロード、
          納得いくまで再生成できます。
        </p>
      </header>

      {/* ── 入力パネル ── */}
      <section className="panel">
        <label className="field-label" htmlFor="title">
          記事タイトル
        </label>
        <input
          id="title"
          className="title-input"
          type="text"
          placeholder="例: 初心者でもわかる！生成AIではじめる副業入門"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generate();
          }}
        />

        {/* ── 権利保護スイッチ ── */}
        <div className="rights">
          <div
            className="rights-row"
            data-on={blockReal}
            role="checkbox"
            aria-checked={blockReal}
            tabIndex={0}
            onClick={() => setBlockReal((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setBlockReal((v) => !v);
              }
            }}
          >
            <span className="checkbox">
              <IconCheck />
            </span>
            <span className="rights-text">
              <strong>
                <IconLock /> 実在の人物・物を使用しない（推奨）
              </strong>
              <span>
                ONのままだと、実在の有名人・ブランドロゴ・商標・著作物・特定の建造物を避け、
                架空・抽象的な表現で生成します（肖像権・著作権保護のためデフォルトON）。
              </span>
            </span>
          </div>

          {!blockReal && (
            <>
              <div className="rights-warn">
                <IconWarn />
                <span>
                  実在の人物・物の使用を許可しました。
                  <b>事前に権利処理（許諾取得）が済んでいる対象のみ</b>
                  に使用してください。権利確認の責任は利用者にあります。
                </span>
              </div>
              <input
                className="allowed-input"
                type="text"
                placeholder="許可済みの対象をメモ（例: 自社ロゴ「○○」、許諾済みの商品Aなど）"
                value={allowedNote}
                maxLength={200}
                onChange={(e) => setAllowedNote(e.target.value)}
              />
            </>
          )}
        </div>

        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <>
              <span className="spinner" /> 生成中…
            </>
          ) : (
            <>
              <IconSparkle /> アイキャッチを生成
            </>
          )}
        </button>
      </section>

      {/* ── ローディング ── */}
      {loading && (
        <div className="results">
          <div className="status-line">
            <span className="spinner" />
            Claude がプロンプトを組み立て、Gemini が 3 案を描いています…
          </div>
          <div className="loading-grid">
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        </div>
      )}

      {/* ── エラー ── */}
      {error && !loading && (
        <div className="error-box">
          <IconWarn />
          <div>
            <div>{error}</div>
            <button className="btn btn-ghost" onClick={generate}>
              <IconReroll /> もう一度試す
            </button>
          </div>
        </div>
      )}

      {/* ── 結果 ── */}
      {result && !loading && (
        <section className="results">
          <div className="results-head">
            <h2>生成結果（3案）</h2>
            <button className="btn btn-ghost" onClick={generate} disabled={loading}>
              <IconReroll /> 再生成（リロール）
            </button>
          </div>

          <div className="summary-card">
            <b>生成イメージ：</b>
            {result.summary}
            {result.style ? `（スタイル: ${result.style}）` : ""}
          </div>

          <div className="grid">
            {result.images.map((src, i) => (
              <div className="shot" key={i} data-selected={selected === i}>
                <div
                  className="shot-img-wrap"
                  onClick={() => setSelected(selected === i ? null : i)}
                >
                  <span className="shot-pick">
                    {selected === i ? (
                      <>
                        <IconCheck /> 選択中
                      </>
                    ) : (
                      `案 ${i + 1}`
                    )}
                  </span>
                  {/* 生成画像はbase64 data URL。next/imageは不要。 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`アイキャッチ案 ${i + 1}`} />
                </div>
                <div className="shot-foot">
                  <button
                    className="btn btn-download"
                    onClick={() => download(src, i)}
                  >
                    <IconDownload /> ダウンロード
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="footnote">
        生成画像の最終的な商用利用可否・権利確認は利用者の責任で行ってください。
        実在の人物・物の使用は、事前に許諾を得た対象に限ります。
        <br />
        Powered by Claude (Anthropic) ＋ Gemini / Imagen (Google) ・ Next.js
      </footer>
    </main>
  );
}
