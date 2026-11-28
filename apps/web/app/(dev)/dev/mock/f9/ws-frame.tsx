"use client";
// 段 10 の下絵の外枠のうち、ワークスペースの管理の骨組み（頭・第 2 ナビ・本文）。段 9 の K-420 の WsHead・WsSub を読むので K-672 が持つ
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { WsHead, WsSub } from "@/features/F10/invite/views";
import { Frame, type FrameProps } from "./frame";

/** 下絵の第 2 ナビだけ「チケットの設定」にする（製品の既定の WS_ITEMS は変えない。本番は K-710 が既定を替える） */
const WS_SUB_ITEMS = { rules: { label: "チケットの設定", icon: SlidersHorizontal } } as const;

/** ワークスペースの管理の画面：頭・第 2 ナビ・本文（メンバー／チケットの設定） */
export function WsFrame({
  active,
  children,
  ...frame
}: Omit<FrameProps, "screen" | "crumbs" | "children" | "viewer"> & {
  active: "members" | "rules";
  children: ReactNode;
}) {
  const label = active === "members" ? "メンバー" : "チケットの設定";
  return (
    <Frame
      {...frame}
      viewer="taka"
      screen={active === "members" ? "members" : "masters"}
      crumbs={[{ label: "ワークスペースの管理" }, { label }]}
    >
      <WsHead name="ENGINE BASE" initial="E" />
      <div className="k-me-wrap">
        <WsSub members={9} active={active} enabled={["members", "rules"]} items={WS_SUB_ITEMS} />
        {children}
      </div>
    </Frame>
  );
}
