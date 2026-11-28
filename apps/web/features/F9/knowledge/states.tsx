"use client";
// ナレッジの本文の場所に出す状態の箱（K-682 の knowledge-page.tsx から移した・K-694 の管理の面も使う）。
//   読めなかった旨と「もう一度読む」・見られないページ。文は正本の 1 件だけ（画面で文言を作らない）
import { Button, PAGE_ERROR, errorText } from "@/components/k";

/** 読めなかった旨と「もう一度読む」（正本の 1 件の文・下絵の ErrorState と同じ形。一手の読み上げは「もう一度読む」） */
export function LoadFailed({ code, onRetry }: { code: string; onRetry: () => void }) {
  const t = errorText(code);
  const danger = t.entry.severity === "critical" || t.entry.cls === "permission";
  return (
    <section
      className="k-state"
      data-state="error"
      data-code={code}
      role={danger ? "alert" : undefined}
      aria-labelledby={`k-err-${code}`}
    >
      <h2 id={`k-err-${code}`} className="k-state-title">
        {t.title}
      </h2>
      {t.body ? <p className="k-state-body">{t.body}</p> : null}
      <div className="k-state-actions">
        <Button variant="primary" onClick={onRetry} aria-label="もう一度読む">
          {t.actions[0] ?? "もう一度"}
        </Button>
      </div>
      <p className="k-state-code">番号：{t.entry.support_code}</p>
    </section>
  );
}

/** 見られないページ（正本 E-PAGE-002・下絵 kn-noaccess と同じ形。どれかを知らせない）。一手は 2 つ（代表の答え answer=21b765e5e0c8）：
 *  「マネージャーに頼む」は頼む口がまだ無いので押せない形・「戻る」は /knowledge へ */
export function PageNoAccess({ onBack }: { onBack: () => void }) {
  const code = PAGE_ERROR.forbidden;
  const t = errorText(code);
  return (
    <section className="k-state" data-state="error" data-code={code} role="alert" aria-labelledby={`k-err-${code}`}>
      <h2 id={`k-err-${code}`} className="k-state-title">
        {t.title}
      </h2>
      {t.body ? <p className="k-state-body">{t.body}</p> : null}
      <div className="k-state-actions">
        <Button variant="primary" aria-disabled>
          {t.actions[0]}
        </Button>
        <Button variant="outlined" onClick={onBack}>
          {t.actions[1]}
        </Button>
      </div>
      <p className="k-state-code">番号：{t.entry.support_code}</p>
    </section>
  );
}
