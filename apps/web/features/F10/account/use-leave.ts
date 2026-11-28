"use client";
// ワークスペースから抜ける（K-841・行為 A74）：口 leaveWorkspace（K-838・体なし・会社単位）と切り替えの口 switchWorkspace（K-851）を呼び、
//   答えを小窓が使う形に分ける。抜けたあと・会社が無いときの知らせは、プロフィールの入れ物（profile-screen.tsx）の LeaveNotice に出す
import { useSyncExternalStore } from "react";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { ME_SCREEN } from "./use-me";

/** 抜ける口の答え（K-363 の remove と同じ形） */
export type LeaveReply =
  | { kind: "ok" }
  | { kind: "step_up" }
  | { kind: "assigned" }
  | { kind: "last_admin" }
  | { kind: "gone" }
  | { kind: "down"; message: string }
  | { kind: "signed_out" };
/** 切り替えの口の答え */
export type SwitchReply =
  { kind: "ok" } | { kind: "gone" } | { kind: "down"; message: string } | { kind: "signed_out" };

/** 調子が悪い（503・網の切れ）の字 */
export const downText = (): string => errorText(PAGE_ERROR.down).entry.message;
/** もう無い（404）の字 */
export const goneText = (): string => errorText(PAGE_ERROR.notFound).entry.message;
/** 切り替えが断られた（仮・K-844 と同じ字） */
export const SWITCH_GONE = "そのワークスペースには入れません";
/** 取り直しの理由（仮） */
export const stepUpReason = (name: string): string => `${name} から抜ける前に、本人か確かめます`;
/** 抜けたあとの知らせ（仮） */
export const leftText = (name: string): string =>
  `${name} から抜けました。30 日のあいだは、同じメールで招かれるとグループと役割が戻ります`;

const refusal = (r: CallErr): string =>
  r.status === 503 ? downText() : (r.message ?? errorText(errorCodeOf(r)).entry.message);

/** 抜ける（体は空・グループ・役割の鍵は送らない・D-154.15） */
export async function leaveWorkspace(tenantId: string): Promise<LeaveReply> {
  let r;
  try {
    r = await call("leaveWorkspace", { params: { id: tenantId }, screenId: ME_SCREEN });
  } catch {
    return { kind: "down", message: downText() }; // 網が切れた
  }
  if (r.ok) return { kind: "ok" };
  if (r.kind === "unauthenticated") return { kind: "signed_out" }; // call が入り直しへ送る
  if (r.kind === "step_up") return { kind: "step_up" };
  if (r.code === "E-ME-050") return { kind: "assigned" };
  if (r.code === "E-ME-051") return { kind: "last_admin" };
  if (r.kind === "not_found") return { kind: "gone" };
  return { kind: "down", message: refusal(r) };
}

/** 別の会社に切り替える（体は空・D-154.81） */
export async function switchWorkspace(tenantId: string): Promise<SwitchReply> {
  let r;
  try {
    r = await call("switchWorkspace", { params: { id: tenantId }, body: {}, screenId: ME_SCREEN });
  } catch {
    return { kind: "down", message: downText() };
  }
  if (r.ok) return { kind: "ok" };
  if (r.kind === "unauthenticated") return { kind: "signed_out" };
  if (r.kind === "not_found") return { kind: "gone" };
  return { kind: "down", message: refusal(r) };
}

/** 本人確認の取り直しの材料（2 段階・パスキーだけ） */
export async function stepUpNeeds(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  try {
    const s = await call("getMySecurity", { screenId: ME_SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
  } catch {
    return { withCode: false, withPasskey: false };
  }
}

// ---------------------------------------------------------------- 入れ物に出す知らせ（小窓が閉じた後も残る）
export interface LeaveNote {
  tone: "info" | "danger";
  text: string;
}
let note: LeaveNote | null = null;
const listeners = new Set<() => void>();

/** 知らせを出す（null で消す） */
export function setLeaveNote(next: LeaveNote | null): void {
  note = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useLeaveNote(): LeaveNote | null {
  return useSyncExternalStore(
    subscribe,
    () => note,
    () => null,
  );
}
