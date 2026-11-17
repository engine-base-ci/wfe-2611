// 詳細の帯の箱（K-227・正本 components.band-*・キャンバス TicketDetail の main article [role="status"]）。
//   箱 1 つの中に、1 行目に 題（h3）・要約（12px）・中の 1 行や注意（children）の塊、次の行に右寄せのボタンの並び（キャンバスどおり）。
//   tone は帯の色：approval（承認待ち）のほか、作る段・実行・止まった・完了の帯（K-228）が wait・info・danger・ok・plain を使う。
//   口の失敗の知らせは NoticeBox（帯の region の中の赤い箱・role=alert は 1 つだけ。中に別の alert を入れない）
import type { ReactNode } from "react";

export type BandTone = "approval" | "wait" | "info" | "danger" | "ok" | "plain";

export interface BandProps {
  tone: BandTone;
  /** 読み上げ：ふつうは status。止まった・失敗を知らせる帯だけ alert */
  role?: "status" | "alert";
  title: ReactNode;
  /** 題の下の 12px の要約（札にしない） */
  sub?: ReactNode;
  /** 右寄せのボタンの並び（主ボタンは 1 つ） */
  acts?: ReactNode;
  /** 要約の下の行（取り消せない注意・聞き直しの文など） */
  children?: ReactNode;
}

export function Band({ tone, role = "status", title, sub, acts, children }: BandProps) {
  return (
    <div className="k-band" data-tone={tone} role={role}>
      <div className="k-band-main">
        <h3 className="k-band-title">{title}</h3>
        {sub ? <div className="k-band-sub">{sub}</div> : null}
        {children}
      </div>
      {acts ? <div className="k-band-acts">{acts}</div> : null}
    </div>
  );
}

/** 帯の中の 1 行（12px・箱の字の色） */
export function BandLine({ children }: { children: ReactNode }) {
  return <div className="k-band-line">{children}</div>;
}

/** 取り消せない注意の赤い箱（帯の箱の中・小窓の注意と同じ色） */
export function BandCaution({ children }: { children: ReactNode }) {
  return <div className="k-band-caution">{children}</div>;
}

/** 口が断ったときの知らせ（帯の region の中・赤い箱）。role=alert はこの 1 つだけ */
export function NoticeBox({ children }: { children: ReactNode }) {
  return (
    <div className="k-band-notice" data-tone="danger" role="alert">
      {children}
    </div>
  );
}
