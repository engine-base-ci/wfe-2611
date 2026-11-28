// 段 2（F1 の残り）の入口の部品（枝 c/段2・部品先行のモック）。キャンバス AuthRecover・AuthReset・MeTotp・MeBackup・op の障害の帯。
//   見た目は auth-parts.css（正本の auth-choice・auth-icon・auth-note-box・auth-ok-box・auth-bad-box・status-strip・auth-qr・auth-secret・
//   backup-codes・backup-code の --k-c-* だけを読む）。動き（口・押した後）は持たない：押したときの関数は呼ぶ側が渡す
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import "./auth-parts.css";

/** 絵の印（lucide の絵を渡す）。tone：淡い紺（既定）・solid＝紺の地に白（済の ✓）・赤（止め） */
export function AuthIcon({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "solid" | "danger";
}) {
  return (
    <span className="k-auth-icon" data-tone={tone} aria-hidden="true">
      {children}
    </span>
  );
}

/** 選ぶカード（端末をなくしたとき）。押すと onPick。disabled は出すが押せない（D-145.9） */
export function ChoiceCard({
  icon,
  title,
  desc,
  onPick,
  href,
  disabled = false,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  desc: ReactNode;
  onPick?: () => void;
  /** 行き先（在れば押すと移る。onPick より先） */
  href?: string;
  disabled?: boolean;
  /** カードの下に開く中身（バックアップコードの欄など） */
  children?: ReactNode;
}) {
  const inner = (
    <>
      <AuthIcon>{icon}</AuthIcon>
      <span className="k-auth-choice-main">
        <b>{title}</b>
        <span>{desc}</span>
      </span>
      <ChevronRight aria-hidden="true" size={16} className="k-auth-choice-go" />
    </>
  );
  return (
    <div className="k-auth-choice-wrap">
      {href && !disabled ? (
        <a className="k-auth-choice" href={href}>
          {inner}
        </a>
      ) : (
        <button
          type="button"
          className="k-auth-choice"
          onClick={onPick}
          disabled={disabled}
          aria-disabled={disabled || undefined}
        >
          {inner}
        </button>
      )}
      {children}
    </div>
  );
}

/** 灰の案内の箱 */
export function NoteBox({ children }: { children: ReactNode }) {
  return <div className="k-auth-note-box">{children}</div>;
}

/** 済んだ知らせ（緑）・使えない知らせ（赤）の箱。role は済＝status・使えない＝alert */
export function ResultBox({ tone, children }: { tone: "ok" | "bad"; children: ReactNode }) {
  return (
    <div className="k-auth-result" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
      <span className="k-auth-result-icon" aria-hidden="true">
        {tone === "ok" ? "✓" : "!"}
      </span>
      <span className="k-auth-result-text">{children}</span>
    </div>
  );
}

export interface ServiceIncident {
  kind: "incident" | "maintenance";
  title: string;
  /** 画面に出す時刻の文（「11/18 10:20 から」「11/20 2:00〜3:00」） */
  when: string;
}

/** いまの様子の帯（障害は淡い赤・メンテナンスは淡い橙）。画面のいちばん上に横いっぱいで置く。無ければ何も出さない */
export function StatusStrip({ items }: { items: readonly ServiceIncident[] }) {
  if (items.length === 0) return null;
  return (
    <div className="k-status-strips">
      {items.map((it) => (
        <p key={`${it.kind}-${it.title}`} className="k-status-strip" data-kind={it.kind} role="status">
          <b>{it.kind === "incident" ? "障害" : "メンテナンス"}</b>
          <span>{it.title}</span>
          <span className="k-status-strip-when">{it.when}</span>
        </p>
      ))}
    </div>
  );
}

/** QR の箱（SVG の文字列は呼ぶ側が作る・qrcode の toString）。label は読み上げの名前 */
export function QrBox({ svg, label }: { svg: string; label: string }) {
  return <span className="k-auth-qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** 読み取れないときに手で入れる鍵の文字 */
export function SecretText({ children }: { children: string }) {
  return <code className="k-auth-secret">{children}</code>;
}

/** バックアップコード 10 個（2 列）と、写す・保存・印刷のボタン（ボタンは呼ぶ側が渡す） */
export function BackupCodes({ codes, actions }: { codes: readonly string[]; actions?: ReactNode }) {
  return (
    <div className="k-backup">
      <ul className="k-backup-codes" aria-label="バックアップコード">
        {codes.map((c) => (
          <li key={c}>
            <code className="k-backup-code">{c}</code>
          </li>
        ))}
      </ul>
      {actions ? <div className="k-backup-acts">{actions}</div> : null}
    </div>
  );
}
