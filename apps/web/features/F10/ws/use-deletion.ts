// ワークスペースを消す手続き（K-832・行為 A75）：口 requestWorkspaceDeletion・cancelWorkspaceDeletion（K-830）を呼び、答えを画面が出し分ける形に分ける。
//   分け方は PC を外す（K-363）の remove と同じ：通った／本人確認の取り直しが要る／口の断り（409）／権限が無い／口が落ちた・網が切れた。
//   取り直しのやり直しは呼ぶ側が 1 回だけ。帯の元は設定の読み（getWorkspaceSettings の deletion）
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import type { SettingsAnswer } from "./settings-shape";
import { SCREEN } from "./use-settings";

/** 名前が合っていない（口の最後の砦）・14 日を過ぎた・すでに手続き中・すでに取り消された */
export const NAME_MISMATCH = "E-WS-030";
export const ALREADY_DELETING = "E-WS-031";
export const PAST_DEADLINE = "E-WS-032";
export const ALREADY_CANCELLED = "E-WS-033";

/** 取り直しの理由の字（仮） */
export const START_STEP_UP_REASON = "ワークスペースを消す手続きを始める前に、本人か確かめます";
export const CANCEL_STEP_UP_REASON = "消す手続きを取り消す前に、本人か確かめます";

export type DeletionOutcome =
  | { kind: "ok" }
  | { kind: "step_up" }
  | { kind: "conflict"; code: string; text: string }
  | { kind: "invalid"; text: string }
  | { kind: "forbidden" }
  | { kind: "signed_out" }
  | { kind: "down"; text: string };

/** 口が落ちた・網が切れたときの字（正本の E-PAGE-003） */
export const downText = (): string => CATALOG[PAGE_ERROR.down]?.message ?? "";
const textOf = (r: CallErr): string => r.message ?? CATALOG[r.code]?.message ?? downText();

function outcomeOf(r: CallErr): DeletionOutcome {
  if (r.kind === "step_up") return { kind: "step_up" };
  if (r.kind === "forbidden") return { kind: "forbidden" };
  if (r.kind === "unauthenticated") return { kind: "signed_out" }; // call が入り直しへ送る
  if (r.kind === "conflict") return { kind: "conflict", code: r.code, text: textOf(r) };
  if (r.kind === "invalid") return { kind: "invalid", text: r.fields["confirm_name"] ?? textOf(r) };
  return { kind: "down", text: downText() };
}

async function settle(run: () => Promise<{ ok: true } | CallErr>): Promise<DeletionOutcome> {
  try {
    const r = await run();
    return r.ok ? { kind: "ok" } : outcomeOf(r);
  } catch {
    return { kind: "down", text: downText() }; // 網が切れた（口に届かない）
  }
}

/** 消す手続きを始める（打った名前をそのまま送る。比べ方は口と同じ完全一致） */
export const startDeletion = (confirmName: string): Promise<DeletionOutcome> =>
  settle(() => call("requestWorkspaceDeletion", { body: { confirm_name: confirmName }, screenId: SCREEN }));

/** 消す手続きを取り消す */
export const cancelDeletion = (): Promise<DeletionOutcome> =>
  settle(() => call("cancelWorkspaceDeletion", { screenId: SCREEN }));

/** 本人確認の取り直しの小窓に渡す値（getMySecurity を 1 回読む。パスキーだけの人はパスキー） */
export async function stepUpKind(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
  const sec = s.ok ? s.data : {};
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}

/** 日本時間の MM/DD HH:mm */
export function jstText(iso: string): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

/** 帯の値（手続き中でなければ undefined）。始めた人が分からなければ by は null */
export interface DeletingView {
  daysLeft: number;
  by: string | null;
  at: string | null;
}
export function deletingOf(answer: Pick<SettingsAnswer, "deletion">): DeletingView | undefined {
  const d = answer.deletion;
  if (d.days_left === null) return undefined;
  return {
    daysLeft: d.days_left,
    by: d.requested_by?.name ?? null,
    at: d.requested_at ? jstText(d.requested_at) : null,
  };
}
