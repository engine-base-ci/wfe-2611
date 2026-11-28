// 保存した検索条件の直す・消す口で、書く所の DB が落ちたときの答え（K-476・控え帳 2026-11-22 18:30：DB の失敗は 503 E-PAGE-003）。
//   1 つの取引なので何も残らない。止める側に倒し、ログは場所と例外の種類だけ（名前・条件・例外の文は出さない）
import { kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

export function writeDown(where: string, e: unknown): HookReply {
  console.error(
    `[saved-views] ${where}：書けなかった（${(e as { code?: unknown; name?: unknown } | null)?.code ?? (e as Error)?.name ?? "Error"}）`,
  );
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}
