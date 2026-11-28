"use client";
// 段 11 の下絵の 1 つの状態を描く（束ごとの描き手に順に聞く。誰も持っていない id は「まだありません」）
import type { ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { renderAccount } from "./render-account";
import { renderMember } from "./render-member";
import { renderMembers } from "./render-members";
import { renderWs } from "./render-ws";

export function MockView({ id, theme }: { id: string; theme: Theme }): ReactNode {
  return (
    renderMembers(id, theme) ??
    renderMember(id, theme) ??
    renderWs(id, theme) ??
    renderAccount(id, theme) ?? <p>この状態はまだありません：{id}</p>
  );
}
