// 決定を足す・改める・取り消す口の失敗を、画面の扱いの種類に分ける（K-397・K-398 が同じ分け方を使う）。
//   401＝入り直し（共通の扱いに任せる）／422＝欄の下の断り（無ければ小窓の知らせ）／403・404＝閉じて区画の頭の知らせ／
//   409＝同時にほかの人が改めた・取り消した（文は口の番号の正本）／ほかは開いたまま小窓の知らせ（字は残す）
import { PAGE_ERROR } from "@/components/k/error-of";
import { catalogMessage, messageOf } from "@/features/F5/approve-complete/message";
import type { CallErr } from "@/lib/api/call";

export type Failure =
  | { kind: "login" }
  | { kind: "fields"; text?: string; by?: string; reason?: string }
  | { kind: "gone"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "notice"; message: string };

export function failureOf(r: CallErr): Failure {
  if (r.status === 401) return { kind: "login" };
  if (r.status === 422) {
    const text = r.fields["text"];
    const by = r.fields["decided_by_member_id"];
    const reason = r.fields["reason"];
    if (text || by || reason) {
      return { kind: "fields", ...(text ? { text } : {}), ...(by ? { by } : {}), ...(reason ? { reason } : {}) };
    }
    return { kind: "notice", message: r.message ?? messageOf(r) };
  }
  if (r.status === 403 || r.status === 404) return { kind: "gone", message: messageOf(r) };
  if (r.status === 409) {
    return { kind: "conflict", message: catalogMessage(r.code === "E-CONF-033" ? "E-CONF-033" : "E-CONF-031") };
  }
  return { kind: "notice", message: messageOf(r) };
}

/** 網の切れ（答えが来なかった） */
export const networkNotice = (): string => catalogMessage(PAGE_ERROR.loadFailed);
