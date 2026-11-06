// 会話が変わったら画面に知らせる流れ（D-113）。画面は 1.2 秒ごとに見に行っていたのを、変わった瞬間に読み直す形にする。
//   流すのは「変わった」の合図だけ。中身はいつもの /agent/state で読む（見える範囲の決まりは 1 か所のまま）。
//   知らせの接続が無い・落ちたら 503／down を返し、画面は見に行く形に戻る（黙って止まらない・G-15）。
//   ログインが切れたら流れを閉じる（G-14）。1 本の流れは 50 秒で区切り、画面がつなぎ直す（Vercel の関数の上限 60 秒より短く・build-vercel.mjs）
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { MemberHub } from "@kaname/db/listen";
import type { createSessionResolver } from "@kaname/auth/resolver";

type Resolve = ReturnType<typeof createSessionResolver>;

export interface AgentStreamDeps {
  resolve: Resolve;
  /** 流しっぱなしの間の解き直し（G-14）。同じ要求の中で覚えた結果を使わず、毎回新しく解く。無ければ resolve */
  fresh?: Resolve;
  hub: MemberHub | null;
  /** 生きている合図とログインの確かめの間隔（既定 25 秒）・1 本の長さ（既定 50 秒）・知らせをまとめる間（既定 60ms） */
  keepaliveMs?: number;
  lifetimeMs?: number;
  settleMs?: number;
}

const unavailable = (c: { json: (b: unknown, s: number) => Response }) =>
  c.json(
    {
      error: "stream_unavailable",
      code: "STREAM_UNAVAILABLE",
      message: "いまは変わった知らせを送れません。画面が見に行きます",
    },
    503,
  );

export function agentStreamRoutes(d: AgentStreamDeps): Hono {
  const app = new Hono();
  const keepaliveMs = d.keepaliveMs ?? 25_000;
  const lifetimeMs = d.lifetimeMs ?? 50_000;
  const settleMs = d.settleMs ?? 60;

  app.get("/agent/stream", async (c) => {
    const ses = await d.resolve(c.req.raw.headers);
    if (!ses?.ctx.tenantId || !ses.ctx.userId)
      return c.json({ error: "unauthenticated", code: "UNAUTHENTICATED", message: "ログインしてください" }, 401);
    if (!d.hub) return unavailable(c);
    const headers = c.req.raw.headers;
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
      unsub = await d.hub.subscribe(ses.ctx.userId, {
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
      console.error("[agent stream] 知らせの接続につながりません:", (e as Error).message);
      return unavailable(c);
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
          const now = Date.now();
          const wait = Math.max(0, Math.min(until, nextKeep) - now);
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
            const still = await (d.fresh ?? d.resolve)(headers).catch(() => null);
            if (!still?.ctx.userId || still.ctx.userId !== ses.ctx.userId) {
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
  });
  return app;
}
