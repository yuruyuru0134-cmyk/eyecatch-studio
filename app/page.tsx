"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createZipBlob, dataUrlToBytes } from "@/lib/zip";

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

interface GenerateResponse {
  summary: string;
  style: string;
  promptUsed: string;
  aspectRatio: string;
  images: string[];
}

// 選択可能なアスペクト比（ラベル付き）
const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9", hint: "横長・記事/OGP" },
  { value: "1:1", label: "1:1", hint: "正方形・SNS" },
  { value: "4:3", label: "4:3", hint: "横長・標準" },
  { value: "3:4", label: "3:4", hint: "縦長・標準" },
  { value: "9:16", label: "9:16", hint: "縦長・ストーリー" },
] as const;

// "16:9" → "16 / 9"（CSS の aspect-ratio 用）
function cssRatio(r: string): string {
  return r.replace(":", " / ");
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

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconWarn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconZoom = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4-4M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconZoomIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4-4M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconZoomOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4-4M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IconFit = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconChevron = ({ dir = "left" }: { dir?: "left" | "right" }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Home() {
  const [title, setTitle] = useState("");
  // 「実在の人物・物を使用しない」= デフォルトON（= 許可しない が初期状態）
  const [blockReal, setBlockReal] = useState(true);
  const [allowedNote, setAllowedNote] = useState("");

  // アスペクト比（デフォルト 16:9）
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // 拡大表示（ライトボックス）で表示中の画像インデックス
  const [lightbox, setLightbox] = useState<number | null>(null);
  // ライトボックス内のズーム倍率・パン位置
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const zoomRef = useRef(1);
  const viewerRef = useRef<HTMLDivElement>(null);
  // 一括保存(ZIP)済みなら閉じる前の警告を出さない
  const [savedAll, setSavedAll] = useState(false);
  // 「閉じる」確認モーダルの表示
  const [showClose, setShowClose] = useState(false);
  const [closed, setClosed] = useState(false);

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

  // ライトボックスの開閉・前後移動
  function closeLightbox() {
    setLightbox(null);
  }
  function moveLightbox(delta: number) {
    if (lightbox === null || !result) return;
    const n = result.images.length;
    setLightbox((lightbox + delta + n) % n);
  }

  // ── ズーム制御 ──
  function zoomTo(next: number) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 100) / 100));
    setZoom(z);
    if (z <= 1) setPan({ x: 0, y: 0 }); // 等倍に戻したらパンもリセット
  }
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // 画像を切り替えた / 開いた / 閉じたらズームをリセット
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [lightbox]);

  // ライトボックス表示中のキー操作（Esc=閉じる, ←→=移動, +/-/0=ズーム）
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") moveLightbox(-1);
      else if (e.key === "ArrowRight") moveLightbox(1);
      else if (e.key === "+" || e.key === "=") zoomTo(zoomRef.current + ZOOM_STEP);
      else if (e.key === "-" || e.key === "_") zoomTo(zoomRef.current - ZOOM_STEP);
      else if (e.key === "0") zoomTo(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, result]);

  // マウスホイールでズーム（ページスクロールを抑止するため非passiveで登録）
  useEffect(() => {
    if (lightbox === null) return;
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      zoomTo(zoomRef.current + dir * ZOOM_STEP);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox]);

  // ドラッグでパン（ズーム時のみ）
  function onImageMouseDown(e: ReactMouseEvent) {
    if (zoom <= 1) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const startX = pan.x;
    const startY = pan.y;
    setDragging(true);
    const onMove = (ev: MouseEvent) => {
      setPan({ x: startX + (ev.clientX - sx), y: startY + (ev.clientY - sy) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
          aspectRatio,
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

  // 「閉じる」ボタン：未保存なら確認モーダル、保存済みならそのまま閉じる
  function requestClose() {
    if (result && !savedAll) {
      setShowClose(true);
    } else {
      performClose(false);
    }
  }

  // モーダルの選択を実行。withDownload=true なら先にZIP保存してから閉じる。
  function performClose(withDownload: boolean) {
    if (withDownload) downloadAll();
    setSavedAll(true);
    setShowClose(false);
    // DL開始に少し猶予を持たせてから閉じる試行＋画面クリア
    const delay = withDownload ? 700 : 50;
    window.setTimeout(() => {
      setResult(null);
      setSelected(null);
      setClosed(true);
      // スクリプトで開いたウィンドウなら閉じる。通常タブは閉じられないため画面をクリア表示。
      window.close();
    }, delay);
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
          お好みのアスペクト比でアイキャッチ画像を 3 案生成します。クリックで拡大表示、
          気に入った案をダウンロード、納得いくまで再生成できます。
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

        {/* ── アスペクト比 選択 ── */}
        <div className="ratio-block">
          <span className="field-label">アスペクト比</span>
          <div className="ratio-group" role="radiogroup" aria-label="アスペクト比">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={aspectRatio === opt.value}
                className="ratio-btn"
                data-on={aspectRatio === opt.value}
                onClick={() => setAspectRatio(opt.value)}
              >
                <span
                  className="ratio-icon"
                  style={{ aspectRatio: cssRatio(opt.value) }}
                />
                <span className="ratio-label">{opt.label}</span>
                <span className="ratio-hint">{opt.hint}</span>
              </button>
            ))}
          </div>
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
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="skeleton"
                style={{ aspectRatio: cssRatio(aspectRatio) }}
              />
            ))}
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
              <button className="btn btn-ghost" onClick={requestClose}>
                <IconClose /> 閉じる
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
                  style={{ aspectRatio: cssRatio(result.aspectRatio) }}
                  onClick={() => setLightbox(i)}
                  title="クリックで拡大表示"
                >
                  {/* 選択トグル（バッジ）。拡大とは独立して動かす */}
                  <button
                    className="shot-pick"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(selected === i ? null : i);
                    }}
                  >
                    {selected === i ? (
                      <>
                        <IconCheck /> 選択中
                      </>
                    ) : (
                      `案 ${i + 1}`
                    )}
                  </button>
                  <span className="shot-zoom">
                    <IconZoom /> 拡大
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

      {/* 拡大表示（ライトボックス） */}
      {lightbox !== null && result && (
        <div
          className="lightbox-overlay"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="画像の拡大表示"
        >
          <button
            className="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            aria-label="閉じる"
          >
            <IconClose />
          </button>

          {result.images.length > 1 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => {
                e.stopPropagation();
                moveLightbox(-1);
              }}
              aria-label="前の画像"
            >
              <IconChevron dir="left" />
            </button>
          )}

          <figure
            className="lightbox-figure"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lightbox-viewer" ref={viewerRef}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.images[lightbox]}
                alt={`アイキャッチ案 ${lightbox + 1}（拡大）`}
                draggable={false}
                onMouseDown={onImageMouseDown}
                onDoubleClick={() => zoomTo(zoom > 1 ? 1 : 2)}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  cursor:
                    zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
                  transition: dragging ? "none" : "transform 0.12s ease-out",
                }}
              />
            </div>

            <figcaption className="lightbox-bar">
              <span>
                案 {lightbox + 1} / {result.images.length}　（{result.aspectRatio}）
              </span>

              {/* ズーム操作 */}
              <div className="zoom-controls">
                <button
                  className="zoom-btn"
                  onClick={() => zoomTo(zoom - ZOOM_STEP)}
                  disabled={zoom <= ZOOM_MIN}
                  aria-label="ズームアウト"
                >
                  <IconZoomOut />
                </button>
                <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
                <button
                  className="zoom-btn"
                  onClick={() => zoomTo(zoom + ZOOM_STEP)}
                  disabled={zoom >= ZOOM_MAX}
                  aria-label="ズームイン"
                >
                  <IconZoomIn />
                </button>
                <button
                  className="zoom-btn"
                  onClick={() => zoomTo(1)}
                  disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                  aria-label="フィット（等倍に戻す）"
                  title="フィット"
                >
                  <IconFit />
                </button>
              </div>

              <button
                className="btn btn-download"
                style={{ width: "auto", padding: "9px 16px" }}
                onClick={() => download(result.images[lightbox], lightbox)}
              >
                <IconDownload /> ダウンロード
              </button>
            </figcaption>
          </figure>

          {result.images.length > 1 && (
            <button
              className="lightbox-nav next"
              onClick={(e) => {
                e.stopPropagation();
                moveLightbox(1);
              }}
              aria-label="次の画像"
            >
              <IconChevron dir="right" />
            </button>
          )}
        </div>
      )}

      {/* 閉じる前の確認モーダル */}
      {showClose && (
        <div
          className="modal-overlay"
          onClick={() => setShowClose(false)}
          role="presentation"
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="close-title">
              <IconWarn /> 閉じる前に保存しますか？
            </h3>
            <p>
              生成した画像はまだ保存されていません。閉じると消えます。
              一括ダウンロード（ZIP）してから閉じますか？
            </p>
            <div className="modal-actions">
              <button className="btn btn-zip" onClick={() => performClose(true)}>
                <IconArchive /> はい：ZIP保存して閉じる
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => performClose(false)}
              >
                いいえ：そのまま閉じる
              </button>
              <button className="btn btn-text" onClick={() => setShowClose(false)}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 閉じた後の表示（通常タブはJSで閉じられないため案内を出す） */}
      {closed && (
        <div className="closed-note">
          閉じました。画像は破棄されました。タブはこのまま閉じて構いません。
          <button
            className="btn btn-ghost"
            onClick={() => setClosed(false)}
            style={{ marginLeft: 12 }}
          >
            <IconSparkle size={15} /> 新しく作る
          </button>
        </div>
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
