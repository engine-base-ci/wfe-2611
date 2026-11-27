// 入っている端末の口（K-836）：listMySessions・revokeMySession・revokeOtherSessions（D-125.150・D-128.156・D-154.79）。
//   入口（op.ts）が先に確かめる：ログイン（本人だけ）・上限・同意し直し・道の id の形・NUL・切る 2 口は本人確認の取り直し（直前 15 分）。
//   口は今のログインの印（部品のセッションの id と利用者の id）を入口と同じ `auth.api.getSession` で引く（K-312）。解けなければ 401。
//   端末の 1 行＝sessions の 1 行。同じログインの全部のワークスペースの行を並べる・切る（DB の関数が app.user_id() から引く）。
//   切ったあと、認証の側のその端末のセッションの期限を今にする（K-312 と同じ後片付け）。Kaname の sessions が失効の正なので、
//   後片付けが落ちても 200／201 のまま（ログに 1 行・部品の印は出さない）。DB の失敗は 503・E-PAGE-003（何も切れない・後片付けもしない）
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface SessionsDeps {
  appPool: pg.Pool;
  auth: Auth;
}

const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const unavailable = (): HookReply => ({ status: 503, body: kanameError("E-PAGE-003").toJSON() });
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

interface Who {
  /** 部品のセッションの id（今の端末）。無ければ空 */
  sid: string;
  /** 部品の利用者の id（同じログイン） */
  userId: string;
}

/** 今のログインの印。部品が解けなければ null */
async function whoAmI(auth: Auth, a: HookArgs): Promise<Who | null> {
  const s = await auth.api.getSession({ headers: a.c.req.raw.headers });
  if (!s) return null;
  return { sid: s.session.id ?? "", userId: s.user.id ?? "" };
}

/** 認証の側の、切った端末のセッションの期限を今にする（落ちたらログに 1 行・部品の印は出さない） */
async function expireAuthSessions(auth: Auth, userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0 || userId === "") return;
  try {
    const ctx = await auth.$context;
    const want = new Set(ids);
    const now = new Date();
    for (const x of await ctx.internalAdapter.listSessions(userId)) {
      if (want.has(x.id) || want.has(x.token)) await ctx.internalAdapter.updateSession(x.token, { expiresAt: now });
    }
  } catch (e) {
    console.error(`[me-sessions] 認証の側の片付けに失敗（${kindOf(e)}）`);
  }
}

export function createListMySessions(d: SessionsDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      const who = await whoAmI(d.auth, a);
      if (!who) return unauthenticated;
      const data = await withTenant(d.appPool, a.ctx, async (cl) => {
        const s = await cl.query<{ v: unknown }>("select app.me_sessions_list($1) as v", [who.sid]);
        const e = await cl.query<{ v: unknown }>("select app.me_security_events() as v");
        return { sessions: s.rows[0]!.v, events: e.rows[0]!.v };
      });
      return { status: 200, body: { data } };
    } catch (e) {
      console.error(`[me-sessions] 端末の一覧を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}

export function createRevokeMySession(d: SessionsDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let who: Who | null;
    let v: { ok?: boolean; error?: string; auth_session_id?: string | null };
    try {
      who = await whoAmI(d.auth, a);
      if (!who || who.sid === "") return unauthenticated;
      const sid = who.sid;
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: typeof v }>("select app.me_session_revoke($1, $2) as v", [a.id, sid]);
        return r.rows[0]!.v;
      });
    } catch (e) {
      console.error(`[me-sessions] 端末を切れなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if (v.error === "not_found") return NOT_FOUND;
    if (v.error === "current") return { status: 409, body: kanameError("E-ME-030").toJSON() };
    if (v.auth_session_id) await expireAuthSessions(d.auth, who.userId, [v.auth_session_id]);
    return { status: 200, body: { data: { revoked: true } } };
  };
}

export function createRevokeOtherSessions(d: SessionsDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let who: Who | null;
    let v: { revoked: number; auth_session_ids: string[] };
    try {
      who = await whoAmI(d.auth, a);
      if (!who || who.sid === "" || who.userId === "") return unauthenticated;
      const { sid, userId } = who;
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: typeof v }>("select app.me_sessions_revoke_others($1, $2) as v", [userId, sid]);
        return r.rows[0]!.v;
      });
    } catch (e) {
      console.error(`[me-sessions] ほかの端末を切れなかった（${kindOf(e)}）`);
      return unavailable();
    }
    await expireAuthSessions(d.auth, who.userId, v.auth_session_ids ?? []);
    return { status: 201, body: { data: { revoked: Number(v.revoked ?? 0) } } };
  };
}
