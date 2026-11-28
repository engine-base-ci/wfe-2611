"use client";
// 会社の側の下絵の外枠（メンバー・届いた依頼）：Shell ＋ 第 2 ナビ ＋ 本文。小窓は dialog に渡し、Shell の外に置く。描き手 B が書く
import type { ReactNode } from "react";
import { Shell, Toaster, type Crumb, type Group } from "@/components/k";
import { BUILT_ROUTES } from "@/lib/built-routes";
import type { Theme } from "@/lib/theme";
import type { ProductState } from "./types";

const GROUPS: Group[] = [
  { code: "EG", name: "営業", count: 18, href: "/tickets?scope=eg", pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", count: 42, href: "/tickets?scope=jd", pending: true, tone: "indigo" },
  { code: "KR", name: "経理", count: 9, href: "/tickets?scope=kr", pending: true, tone: "amber" },
];
// 段 12 で作る画面は、左のメニューで押せる形にする（本番は作った画面の一覧から出る）
const BUILT = [...BUILT_ROUTES, "/members", "/requests"];

export interface CuFrameProps {
  theme: Theme;
  ps: ProductState;
  screen: "members" | "requests";
  crumbs: Crumb[];
  children: ReactNode;
  dialog?: ReactNode;
}

export function CuFrame({ theme, ps, screen, crumbs, children, dialog }: CuFrameProps) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen={screen}
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: "高本 聖斗", initial: "高" }}
        groups={ps === "PS0" ? [] : GROUPS}
        {...(ps === "PS0" ? {} : { badges: { approvals: 2 } })}
        bridgeConnected={ps !== "PS0"}
        theme={theme}
        built={BUILT}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}
