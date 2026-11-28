// 会話が変わったら画面に知らせる流れ（D-113）。画面は 1.2 秒ごとに見に行っていたのを、変わった瞬間に読み直す形にする。
//   流すのは「変わった」の合図だけ。中身はいつもの /agent/state で読む（見える範囲の決まりは 1 か所のまま）。
//   知らせの接続が無い・落ちたら 503／down を返し、画面は見に行く形に戻る（黙って止まらない・G-15）。
//   ログインが切れたら流れを閉じる（G-14）。1 本の流れは 50 秒で区切り、画面がつなぎ直す（Vercel の関数の上限 60 秒より短く・build-vercel.mjs）
import { Hono } from "hono";
import type { MemberHub } from "@kaname/db/listen";
import type { createSessionResolver } from "@kaname/auth/resolver";
import { openChangeStream } from "../features/F5/talk/stream.js";

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
    // 流しの輪は契約の口 streamConversation と同じ本体（features/F5/talk/stream.ts・K-759）
    const res = await openChangeStream(c, {
      hub: d.hub,
      userId: ses.ctx.userId,
      headers: c.req.raw.headers,
      fresh: d.fresh ?? d.resolve,
      timing: { keepaliveMs, lifetimeMs, settleMs },
    });
    return res ?? unavailable(c);
  });
  return app;
}
