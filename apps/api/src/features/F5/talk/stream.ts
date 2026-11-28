// 本人の会話が変わったら合図を流す流れの本体（K-759・D-113）。前の道すじ /api/auth-ext/agent/stream（auth/agent-stream.ts）と
//   契約の口 streamConversation（hooks/talk-stream.ts）の両方がこれを呼ぶ（同じ輪を 2 つ持たない・L-021）。
//   流すのは合図の名前だけ：ready（つながった・画面はここで読み直す）・change（変わった・同じ瞬間の分は 1 回）・down（知らせの接続が落ちた）・
//   end（reconnect＝1 本の長さを過ぎた／unauthenticated＝ログインが切れた・別の人に替わった）・コメント行 ": alive"。会話の字は流さない。
//   1 本の長さは 50 秒（置き場の関数の上限 60 秒より短く）。生きている合図とログインの解き直しは 25 秒ごと（G-14）。
//   流れの間は DB の接続を持たない。受け手は流れが閉じたら必ず外す
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { MemberHub } from "@kaname/db/listen";

/** 生きている合図とログインの確かめの間隔・1 本の長さ・知らせをまとめる間 */
export interface StreamTiming {
  keepaliveMs?: number;
  lifetimeMs?: number;
  settleMs?: number;
}
export const TIMING = { keepaliveMs: 25_000, lifetimeMs: 50_000, settleMs: 60 } as const;

/** 流しっぱなしの間の解き直し。毎回新しく解く（同じ要求の中で覚えた結果を使わない） */
export type FreshSession = (headers: Headers) => Promise<{ ctx: { userId?: string | null } } | null>;

export interface ChangeStreamOptions {
  hub: MemberHub;
  userId: string;
  headers: Headers;
  fresh: FreshSession;
  timing?: StreamTiming;
}

const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 流れを開く。受け取りを作れない（知らせの接続につながらない）なら null（呼ぶ側が 503 にする） */
export async function openChangeStream(c: Context, o: ChangeStreamOptions): Promise<Response | null> {
  const keepaliveMs = o.timing?.keepaliveMs ?? TIMING.keepaliveMs;
  const lifetimeMs = o.timing?.lifetimeMs ?? TIMING.lifetimeMs;
  const settleMs = o.timing?.settleMs ?? TIMING.settleMs;
  // 起こす合図（知らせ・落ちた・閉じた）。流れの中の 1 本の輪がこれを待つ
  let dirty = false;
  let down = false;
  let wake: (() => void) | null = null;
  const poke = () => {
    const w = wake;
    wake = null;
    w?.();
  };
  let unsub: () => void;
  try {
    unsub = await o.hub.subscribe(o.userId, {
      change: () => {
        dirty = true;
        poke();
      },
      down: () => {
        down = true;
        poke();
      },
    });
  } catch (e) {
    // ログには場所と例外の種類だけ（会話の id・人の id を出さない）
    console.error(`[talk stream] 知らせの接続につながりません（${kindOf(e)}）`);
    return null;
  }
  c.header("x-accel-buffering", "no");
  return streamSSE(c, async (s) => {
    let closed = false;
    s.onAbort(() => {
      closed = true;
      poke();
    });
    const until = Date.now() + lifetimeMs;
    let nextKeep = Date.now() + keepaliveMs;
    try {
      await s.writeSSE({ event: "ready", data: "" });
      while (!closed) {
        const wait = Math.max(0, Math.min(until, nextKeep) - Date.now());
        if (!dirty && !down) {
          await new Promise<void>((r) => {
            wake = r;
            setTimeout(() => poke(), wait);
          });
        }
        if (closed) break;
        if (down) {
          await s.writeSSE({ event: "down", data: "" });
          break;
        }
        if (dirty) {
          // 同じ瞬間の書き込み（途中経過が続けて来る等）を 1 回の合図にまとめる
          await s.sleep(settleMs);
          dirty = false;
          await s.writeSSE({ event: "change", data: "" });
        }
        if (Date.now() >= until) {
          await s.writeSSE({ event: "end", data: "reconnect" });
          break;
        }
        if (Date.now() >= nextKeep) {
          nextKeep = Date.now() + keepaliveMs;
          const still = await o.fresh(o.headers).catch(() => null);
          if (!still?.ctx.userId || still.ctx.userId !== o.userId) {
            await s.writeSSE({ event: "end", data: "unauthenticated" });
            break;
          }
          await s.write(": alive\n\n");
        }
      }
    } finally {
      unsub();
    }
  });
}
