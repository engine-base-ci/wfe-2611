"use client";
// 会社の側のチケットの詳細の下絵の描き手（ゲストに見せる）。値は features/F11/share/ の部品へ渡すだけ。
//   チケットは普通のチケット。違いは右のパネルの「ゲストに見せる」とやり取りの印だけ（2026-11-23 代表の決め answer=6ba09f587792）
import type { ReactNode } from "react";
import { TicketFrame, type FrameProps } from "@/features/F11/share/frame";
import { ChatPanel, SharePanel, ShareDialog, UnshareConfirm } from "@/features/F11/share/views";
import type { Theme } from "@/lib/theme";

const SEIKO = "セイコー株式会社（ゲスト）";

export function renderTk(id: string, theme: Theme): ReactNode | null {
  const T = (p: Partial<Omit<FrameProps, "theme" | "ps">> = {}) => <TicketFrame theme={theme} ps="PS2" {...p} />;
  const shown = (extra: Partial<Omit<FrameProps, "theme" | "ps">> = {}, canChange = true) =>
    T({
      panelExtra: (
        <>
          <SharePanel shown={[SEIKO]} canChange={canChange} />
          <ChatPanel shared />
        </>
      ),
      ...extra,
    });
  const priv = (dialog?: ReactNode) =>
    T({
      panelExtra: (
        <>
          <SharePanel />
          <ChatPanel />
        </>
      ),
      ...(dialog ? { dialog } : {}),
    });
  switch (id) {
    case "tk-private":
      return priv();
    case "tk-share":
      return priv(<ShareDialog />);
    case "tk-share-empty":
      return priv(<ShareDialog phase="none" picked={[]} />);
    case "tk-share-saving":
      return priv(<ShareDialog phase="saving" />);
    case "tk-share-failed":
      return priv(<ShareDialog phase="failed" />);
    case "tk-shown":
      return shown();
    case "tk-shown-readonly":
      return shown({}, false);
    case "tk-unshare":
      return shown({ dialog: <UnshareConfirm /> });
    case "tk-from-request":
      return T({
        title: "セイコー様 11 月分の請求書を作って送る",
        panelExtra: (
          <>
            <SharePanel shown={[SEIKO]} />
            <ChatPanel shared fromRequest />
          </>
        ),
      });
    default:
      return null;
  }
}
