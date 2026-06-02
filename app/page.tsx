"use client";

import { useEffect, useState } from "react";
import { createZipBlob, dataUrlToBytes } from "@/lib/zip";

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

const IconArchive = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" stroke="currentColor" strokeWidth="2" />
    <path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  // 一括保存(ZIP)済みなら閉じる前の警告を出さない
  const [savedAll, setSavedAll] = useState(false);

  // 未保存の画像がある状態で閉じる/再読込しようとしたら警告（ブラウザ標準ダイアログ）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (result && !savedAll) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [result, savedAll]);

  function safeBase() {
    return (
      title.trim().replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "eyecatch"
    );
  }

  async function generate() {
    if (!title.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setSavedAll(false);

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

  // 単発ダウンロード
  function download(dataUrl: string, index: number) {
    const { ext } = dataUrlToBytes(dataUrl);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeBase()}_${index + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 一括ダウンロード（ZIP）
  function downloadAll() {
    if (!result) return;
    const base = safeBase();
    const files = result.images.map((src, i) => {
      const { bytes, ext } = dataUrlToBytes(src);
      return { name: `${base}_${i + 1}.${ext}`, data: bytes };
    });
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSavedAll(true); // 一括保存済み → 閉じる前の警告を解除
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
            <h2>生成結果（{result.images.length}案）</h2>
            <div className="results-actions">
              <button className="btn btn-zip" onClick={downloadAll}>
                <IconArchive /> 一括ダウンロード（ZIP）
              </button>
              <button
                className="btn btn-ghost"
                onClick={generate}
                disabled={loading}
              >
                <IconReroll /> 再生成（リロール）
              </button>
            </div>
          </div>

          {!savedAll && (
            <div className="save-hint">
              <IconWarn />
              <span>
                画像は保存されていません。タブを閉じる・再読込すると消えます。
                残したい場合は各案を<b>単発ダウンロード</b>、または
                <b>一括ダウンロード（ZIP）</b>で保存してください。
              </span>
            </div>
          )}

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
