"use client";
// 段 11 の下絵の外枠：ワークスペースの管理（頭・第 2 ナビ・本文）と、自分の設定（第 2 ナビ・本文）。
//   まとめ役が作った。担当は書き換えない（足したい物はまとめ役に頼む）
import type { ReactNode } from "react";
import { MeSub, Shell, Toaster, type Crumb, type Group, type MeSubKey } from "@/components/k";
import { WsHead, WsSub } from "@/features/F10/invite/views";
import { BUILT_ROUTES } from "@/lib/built-routes";
import type { RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";

export type Viewer = "taka" | "sato" | "suzu" | "tana";
export const VIEWER: Record<Viewer, { name: string; full: string; initial: string; role: RoleId }> = {
  taka: { name: "高本", full: "高本 聖斗", initial: "高", role: "R2" },
  sato: { name: "佐藤", full: "佐藤 花子", initial: "佐", role: "R2" },
  suzu: { name: "鈴木", full: "鈴木 一郎", initial: "鈴", role: "R3" },
  tana: { name: "田中", full: "田中 美咲", initial: "田", role: "R3" },
};
const GROUPS: Group[] = [
  { code: "EG", name: "営業", href: "/tickets?scope=eg", pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", href: "/tickets?scope=jd", pending: true, tone: "plum" },
  { code: "KR", name: "経理", href: "/tickets?scope=kr", pending: true, tone: "amber" },
];
// 段 11 で作る画面は、左のメニューと第 2 ナビで押せる形にする（本番は作った画面の一覧から出る）
const BUILT = [...BUILT_ROUTES, "/members", "/workspace/rules", "/workspace/log", "/workspace/settings", "/account"];

export interface FrameProps {
  theme: Theme;
  viewer?: Viewer;
  screen: string;
  crumbs: Crumb[];
  children: ReactNode;
  dialog?: ReactNode;
}

/** 外枠だけ（左のメニュー・上の帯）。小窓は dialog に渡す */
export function Frame({ theme, viewer = "taka", screen, crumbs, children, dialog }: FrameProps) {
  const v = VIEWER[viewer];
  return (
    <Toaster>
      <Shell
        role={v.role}
        screen={screen}
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: v.name, initial: v.initial }}
        groups={GROUPS}
        bridgeConnected
        theme={theme}
        built={BUILT}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

const WS_LABEL = { members: "メンバー", log: "記録", settings: "設定" } as const;
const WS_SCREEN = { members: "members", log: "audit", settings: "company-settings" } as const;

/** ワークスペースの管理の画面：頭・第 2 ナビ・本文。tail はメンバーの 1 人の名前など、いまの場所の末尾 */
export function WsFrame({
  active,
  tail,
  children,
  ...frame
}: Omit<FrameProps, "screen" | "crumbs" | "children"> & {
  active: keyof typeof WS_LABEL;
  tail?: string;
  children: ReactNode;
}) {
  const crumbs: Crumb[] = [{ label: "ワークスペースの管理" }, { label: WS_LABEL[active] }];
  if (tail) crumbs.push({ label: tail });
  return (
    <Frame {...frame} screen={tail ? "member-detail" : WS_SCREEN[active]} crumbs={crumbs}>
      <WsHead name="ENGINE BASE" initial="E" />
      <div className="k-me-wrap">
        {/* 人数の札はメンバーの一覧だけ（下絵の 5 人＋招待中 1 人＝重ならない数・K-419）。1 人の画面・記録・設定は並びを読まないので札を出さない（K-819・K-825・K-831 の本番と同じ） */}
        <WsSub
          {...(active === "members" && !tail ? { members: 6 } : {})}
          active={active}
          enabled={["members", "rules", "log", "settings"]}
        />
        {children}
      </div>
    </Frame>
  );
}

const ME_LABEL: Record<MeSubKey, string> = {
  profile: "プロフィール",
  login: "ログインと安全",
  bridge: "PC と使った量",
  credentials: "預けたログイン情報",
  notices: "知らせ",
};

/** 自分の設定の画面：第 2 ナビ・本文 */
export function MeFrame({
  current,
  children,
  ...frame
}: Omit<FrameProps, "screen" | "crumbs" | "children"> & { current: MeSubKey; children: ReactNode }) {
  return (
    <Frame {...frame} screen="account" crumbs={[{ label: "自分の設定", disabled: true }, { label: ME_LABEL[current] }]}>
      <div className="k-me-wrap">
        <MeSub current={current} />
        {children}
      </div>
    </Frame>
  );
}
