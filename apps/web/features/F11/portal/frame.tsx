"use client";
// ゲストの場所（ゲストの側）の外枠。社内の Shell は使わない（キャンバス CpHome の上の帯・中身・下の一文）。
//   役割（ゲスト）と自分の名前を出す。値は見本。ログインしていない形（user を渡さない）も作れる
import type { ReactNode } from "react";
import "./portal.css";

export const PORTAL_NOTE = "この場所で見えるのは、ENGINE BASE が見せると決めたものだけです";

export interface PortalFrameProps {
  children: ReactNode;
  /** 自分の表示（例「山田 花子 様」・所属は口が返さないので出さない）。無ければ帯の右は空 */
  user?: { label: string; initial: string };
  /** 下の一文を出さない（ログイン前の画面） */
  noFoot?: boolean;
}

export const YAMADA = { label: "山田 花子 様", initial: "山" };
export const SUZUKI = { label: "鈴木 健太 様（営業部）", initial: "鈴" };

export function PortalFrame({ children, user, noFoot }: PortalFrameProps) {
  return (
    <div className="k-root k-f11p-shell" data-portal-frame>
      <header className="k-f11p-head">
        <span className="k-f11p-mark" aria-hidden="true">
          E
        </span>
        <div className="k-f11p-who">
          <b>ENGINE BASE</b>
          <span>セイコー株式会社（ゲスト）</span>
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
      {noFoot ? null : <footer className="k-f11p-foot">{PORTAL_NOTE}</footer>}
    </div>
  );
}
