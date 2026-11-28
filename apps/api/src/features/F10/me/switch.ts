// ワークスペースを切り替える・自分に届いた招待を読む口（K-851）：switchWorkspace・listMyInvitations（D-125.150・D-154.55・D-154.81・関門 C2）。
//   入口（op.ts）が先に確かめる：ログイン（本人だけ）・上限・同意し直し・道の id の形・strict の体・NUL。本人確認の取り直しは要らない。
//   口は今のログインの印（部品のセッションの id と利用者の id）を入口と同じ `auth.api.getSession` で引く（K-312・K-836）。解けなければ 401。
//   切り替え：DB の関数 app.me_switch_workspace が、今の端末の sessions の行を行き先の会社の同じログインの人に結び直す（1 取引・行を増やさない）。
//     入れない会社は全部同じ 404（欄・details を付けない）。記録・安全の記録・受け箱は作らない（D-154.55）
//   届いた招待：DB の関数 app.me_invitations が、確かめ済みのログインのメールに届いた待っている・期限内の招待を期限の近い順に 20 件と全部の数で返す。
//     止められた人は 403。招待の印・宛ては返さない。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける
//   DB の失敗は 503・E-PAGE-003（何も変わらない。ログは場所と例外の種類だけ）
import type pg from "pg";
import type { Auth } from "@kaname/auth";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

export interface SwitchDeps {
  appPool: pg.Pool;
  auth: Auth;
}

const unauthenticated: HookReply = { status: 401, body: { error: "unauthenticated", code: "UNAUTHENTICATED" } };
const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
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

type SwitchAnswer = { tenant_id: string; switched: boolean } | { error: string };

export function createSwitchWorkspace(d: SwitchDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    let v: SwitchAnswer;
    try {
      const who = await whoAmI(d.auth, a);
      if (!who || who.sid === "") return unauthenticated;
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: SwitchAnswer }>("select app.me_switch_workspace($1::uuid, $2) as v", [
          a.id,
          who.sid,
        ]);
        return r.rows[0]!.v;
      });
    } catch (e) {
      console.error(`[me-switch] ワークスペースを切り替えられなかった（${kindOf(e)}）`);
      return unavailable();
    }
    if ("error" in v) return v.error === "not_found" ? NOT_FOUND : unauthenticated;
    return { status: 200, body: { data: { tenant_id: v.tenant_id, switched: v.switched } } };
  };
}

export function createListMyInvitations(d: SwitchDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      const who = await whoAmI(d.auth, a);
      if (!who) return unauthenticated;
      const v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: { invitations: unknown[]; total: number } | { error: string } }>(
          "select app.me_invitations($1) as v",
          [who.userId],
        );
        return r.rows[0]!.v;
      });
      if ("error" in v) return FORBIDDEN;
      return { status: 200, body: { data: { invitations: v.invitations, total: v.total } } };
    } catch (e) {
      console.error(`[me-switch] 届いた招待を読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
