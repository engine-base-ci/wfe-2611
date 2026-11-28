"use client";
// ゲストの場所（ゲストの側）の外枠。社内の Shell は使わない（キャンバス CpHome の上の帯・中身・下の一文）。
//   役割（ゲスト）と自分の名前を出す。値は見本（渡さなければ見本のまま・モックの見た目は変わらない）。ログインしていない形（user を渡さない）も作れる
//   会社の名前は 1 か所から渡す：外枠（portal-shell）が口の tenant_name を PortalCompanyContext に入れ、frame・home・work・request が同じ値を読む（K-911）
import { createContext, useContext, type ReactNode } from "react";
import "./portal.css";

/** 見本の会社の名前（文脈が無いとき・モック） */
const SAMPLE_COMPANY = "ENGINE BASE";
/** 見本のゲストのグループの名前 */
export const SAMPLE_GROUP = "セイコー株式会社（ゲスト）";

/** 会社の名前（口の tenant_name）。空の字は「まだ分からない」（読み込み中・読めない・見られない） */
export const PortalCompanyContext = createContext<string>(SAMPLE_COMPANY);
export const usePortalCompany = (): string => useContext(PortalCompanyContext);

export const portalNote = (company: string): string => `この場所で見えるのは、${company} が見せると決めたものだけです`;
export const PORTAL_NOTE = portalNote(SAMPLE_COMPANY);

export interface PortalFrameProps {
  children: ReactNode;
  /** 自分の表示（例「山田 花子 様」・所属は口が返さないので出さない）。無ければ帯の右は空 */
  user?: { label: string; initial: string };
  /** ゲストのグループの名前（口の group_name）。無ければ見本。空の字なら出さない */
  groupName?: string;
  /** 下の一文を出さない（ログイン前の画面） */
  noFoot?: boolean;
}

export const YAMADA = { label: "山田 花子 様", initial: "山" };
// 所属は Kaname が持たない（相手の会社の中の所属）ので帯に出さない（PM の決め 2026-11-28・下絵の誤り）
export const SUZUKI = { label: "鈴木 健太 様", initial: "鈴" };

export function PortalFrame({ children, user, groupName = SAMPLE_GROUP, noFoot }: PortalFrameProps) {
  const company = usePortalCompany();
  return (
    <div className="k-root k-f11p-shell" data-portal-frame>
      <header className="k-f11p-head">
        {company ? (
          <span className="k-f11p-mark" aria-hidden="true">
            {company.slice(0, 1)}
          </span>
        ) : null}
        <div className="k-f11p-who">
          {company ? <b>{company}</b> : null}
          {groupName ? <span>{groupName}</span> : null}
        </div>
        {user ? (
          <span className="k-f11p-me">
            {user.label}
            <span className="k-f11p-av" aria-hidden="true">
              {user.initial}
            </span>
          </span>
        ) : null}
      </header>
      <main className="k-f11p-main">{children}</main>
      {noFoot || !company ? null : <footer className="k-f11p-foot">{portalNote(company)}</footer>}
    </div>
  );
}
