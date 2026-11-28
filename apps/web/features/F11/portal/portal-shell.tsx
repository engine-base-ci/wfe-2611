"use client";
// ゲストの場所の外枠（K-911）。社内の Shell は使わない。ホームの読み（usePortalHome）の値で帯を埋め、会社の名前を文脈に入れる。
//   ログインの確かめはホームの読みが兼ねる（401 は各画面が期限切れの形を出す・403 は見られない）。値が分からない間は帯の名前を出さない
import type { ReactNode } from "react";
import { PortalCompanyContext, PortalFrame } from "./frame";
import { usePortalHome } from "./use-portal-home";

export function PortalShell({ children }: { children: ReactNode }) {
  const q = usePortalHome();
  const home = q.data?.ok ? q.data.data : null;
  const company = home?.tenant_name ?? "";
  return (
    <PortalCompanyContext.Provider value={company}>
      <PortalFrame
        groupName={home?.group_name ?? ""}
        {...(home?.me.name ? { user: { label: `${home.me.name} 様`, initial: home.me.initial } } : {})}
      >
        {children}
      </PortalFrame>
    </PortalCompanyContext.Provider>
  );
}
