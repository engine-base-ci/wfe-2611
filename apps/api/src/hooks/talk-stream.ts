// 書きながらの返事を流す口（K-759・streamConversation）の登録（K-326）。流しの輪の本体は apps/api/src/features/F5/talk/stream.ts。
//   開く前に：材料（知らせの接続・ログインの解き直し）が無ければ 503 E-TALK-020／会話の持ち主を DB の関数 app.conversation_messages（K-757）で 1 回確かめ、
//   null なら入口と同じ体の 404（在るかを漏らさない）・DB が落ちたら 503 E-PAGE-003。流れの間は DB の接続を持たない。
//   server.ts・fuzz の的の口の一覧には書かない（作り手 scripts/ci/gen_ts_registries.py が一覧 all.generated.ts に入れる）
import { kanameError } from "@kaname/errors";
import type { Hook, HookReply } from "../contract/deps.js";
import { openChangeStream } from "../features/F5/talk/stream.js";
import { defineHooks, type HookDeps } from "./registry.js";

const notFound = (): HookReply => ({ status: 404, body: { error: "not_found", code: "NOT_FOUND" } });
const unavailable = (code: "E-TALK-020" | "E-PAGE-003"): HookReply => ({
  status: 503,
  body: kanameError(code).toJSON(),
});
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export function talkStreamHooks(d: HookDeps): Record<string, Hook> {
  return {
    streamConversation: {
      before: async (a) => {
        const { hub, freshSession } = d;
        if (!hub || !freshSession) return unavailable("E-TALK-020");
        const userId = a.ctx.userId!;
        let v: unknown;
        try {
          v = (
            await d.appPool.query<{ v: unknown }>("select app.conversation_messages($1, $2, null, null, 1) as v", [
              userId,
              a.id,
            ])
          ).rows[0]?.v;
        } catch (e) {
          // ログには場所と例外の種類だけ（会話の id を出さない）
          console.error(`[talk stream] 会話の持ち主の確かめで例外：止めた（${kindOf(e)}）`);
          return unavailable("E-PAGE-003");
        }
        if (!v) return notFound();
        const raw = await openChangeStream(a.c, {
          hub,
          userId,
          headers: a.c.req.raw.headers,
          fresh: freshSession,
          ...(d.talkStream ? { timing: d.talkStream } : {}),
        });
        if (!raw) return unavailable("E-TALK-020");
        // streamSSE が付ける no-cache を、認証の要る答えの形（private, no-store）に置き換える
        raw.headers.set("cache-control", "private, no-store");
        return { status: 200, body: null, raw };
      },
    },
  };
}

export const register = defineHooks({
  name: "talkStreamHooks",
  make: (d) => talkStreamHooks(d),
  fuzz: "same",
});
