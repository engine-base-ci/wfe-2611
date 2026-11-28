"use client";
// メールを変える口を呼んで、答えを画面の形に分ける（K-840・口 K-835）。
//   requestChange：requestEmailChange { email } を 1 回。答えを ok／取り直し／使われている／同じ／形／送りすぎ／送れなかった／落ちた に分ける。
//   verify：verifyEmailChange { token } を 1 回。変わった／期限切れ／もう使った／使えない に分け、落ちた（503・網の切れ）は投げる（画面は「もう一度読む」）。
//   401 は call が入り直しへ送る（auth を返して画面は何もしない）
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { ME_SCREEN } from "./use-me";

/** 口 K-835 の形と同じ字（前後の空白を削り NFKC でそろえてから当てる） */
const MAIL_FORM = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const BAD_FORM = "メールの形が違います。「名前@会社.example」のように入れてください";
export const TAKEN = "このメールは、もう別のアカウントで使われています。別のメールを入れてください";
// 下絵に無い字（仮）
export const SAME = "今のメールと同じです";
export const TOO_MANY = "メールを送りすぎです。しばらくしてからやり直してください";
export const SEND_FAILED = "確かめのメールを送れませんでした。少し待ってやり直してください";
export const RESENT = "確かめのメールを送り直しました";
export const STEP_UP_REASON = "メールを変える前に、本人か確かめます";

const textOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 調子が悪い（503・網の切れ）の字 */
export const downText = (): string => textOf(PAGE_ERROR.down);

/** 打った字をそろえる（全角→半角・前後の空白を削る） */
export const cleanEmail = (text: string): string => text.normalize("NFKC").trim();
/** そろえた字の形の誤り（空は誤りにしない：送らないだけ） */
export const emailProblem = (clean: string): string | undefined =>
  clean === "" || MAIL_FORM.test(clean) ? undefined : BAD_FORM;

export type ChangeResult =
  | { kind: "ok"; pending: string }
  | { kind: "step_up" }
  | { kind: "taken" }
  | { kind: "same" }
  | { kind: "invalid"; message: string }
  | { kind: "rate" }
  | { kind: "send_failed" }
  | { kind: "auth" }
  | { kind: "refused"; message: string }
  | { kind: "down" };

function changeOf(r: CallErr): ChangeResult {
  if (r.kind === "unauthenticated") return { kind: "auth" };
  if (r.kind === "step_up") return { kind: "step_up" };
  if (r.code === "E-ME-021") return { kind: "taken" };
  if (r.code === "E-ME-026") return { kind: "same" };
  if (r.code === "E-ME-020" || r.kind === "invalid") return { kind: "invalid", message: r.fields["email"] ?? BAD_FORM };
  if (r.code === "E-ME-024" || r.kind === "rate_limited") return { kind: "rate" };
  if (r.code === "E-ME-025" || r.status === 502) return { kind: "send_failed" };
  if (r.status === 503 || r.status >= 500) return { kind: "down" };
  return { kind: "refused", message: r.message || textOf(r.code) || downText() };
}

/** 確かめのメールを送る（送り直しも同じ口・宛ては待っている宛て） */
export async function requestChange(email: string): Promise<ChangeResult> {
  try {
    const r = await call("requestEmailChange", { body: { email }, screenId: ME_SCREEN });
    if (r.ok) return { kind: "ok", pending: (r.data as { pending_email?: string }).pending_email ?? email };
    return changeOf(r);
  } catch {
    return { kind: "down" }; // 網が切れた
  }
}

/** 取り直しの小窓の形（パスワードの人は 6 けたも・パスキーだけの人はパスキー） */
export interface StepUpNeeds {
  withCode: boolean;
  withPasskey: boolean;
}
export async function readStepUpNeeds(): Promise<StepUpNeeds> {
  try {
    const s = await call("getMySecurity", { screenId: ME_SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
  } catch {
    return { withCode: false, withPasskey: false };
  }
}

export type VerifyKind = "changed" | "expired" | "used" | "unusable";
export type VerifyResult = { kind: VerifyKind } | { kind: "auth" };

/** 落ちた（印は使われていない・確かめ直せる） */
export class VerifyDown extends Error {
  constructor(readonly err: CallErr | null) {
    super(err?.code ?? "network");
  }
}

/** 確かめのリンクの印で 1 回だけ確かめる */
export async function verify(token: string): Promise<VerifyResult> {
  let r;
  try {
    r = await call("verifyEmailChange", { body: { token }, screenId: ME_SCREEN });
  } catch {
    throw new VerifyDown(null);
  }
  if (r.ok) return { kind: "changed" };
  if (r.kind === "unauthenticated") return { kind: "auth" };
  if (r.code === "E-ME-022") return { kind: "expired" };
  if (r.code === "E-ME-023") return { kind: "used" };
  if (r.code === PAGE_ERROR.linkExpired || r.status === 409 || r.status === 404 || r.status === 422) {
    return { kind: "unusable" };
  }
  throw new VerifyDown(r);
}
