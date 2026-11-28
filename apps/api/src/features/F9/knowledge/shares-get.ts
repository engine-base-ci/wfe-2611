// 共有の選びを読む口（K-689・契約の口 getKnowledgeShares・GET /api/v1/knowledge/shares?page_id=&folder_id=）。
//   1 つの取引の中で DB の関数 app.kn_share_view を呼ぶ：ページかフォルダのどちらか 1 つを指さない（無い・両方）→ 404・
//   見えない・無い・消した・別の会社 → 404・見えるが共有を決められない → 403。DB の失敗は 503 E-PAGE-003。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { forbidden, notFound, unavailable } from "./reply.js";

const VIEW_SQL = "select app.kn_share_view($1, $2) as r";

export interface ShareView {
  readonly ok: boolean;
  readonly reason?: "not_found" | "denied";
  readonly target?: unknown;
  readonly from_group_name?: string;
  readonly groups?: unknown;
}

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

/** 関数の答えを口の答えにする（書く口の読み直しも使う） */
export function viewReply(v: ShareView): HookReply {
  if (!v.ok) return v.reason === "denied" ? forbidden() : notFound();
  return { status: 200, body: { data: { target: v.target, from_group_name: v.from_group_name, groups: v.groups } } };
}

export async function readShareView(cl: pg.PoolClient, page: string | null, folder: string | null): Promise<ShareView> {
  return (await cl.query<{ r: ShareView }>(VIEW_SQL, [page, folder])).rows[0]!.r;
}

const pick = (v: string | undefined): string | null => (v === undefined || v === "" ? null : v);

export function createGetKnowledgeShares(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const page = pick(a.c.req.query("page_id"));
    const folder = pick(a.c.req.query("folder_id"));
    if ((page === null) === (folder === null)) return notFound();
    try {
      return await withTenant(appPool, a.ctx, async (cl) => viewReply(await readShareView(cl, page, folder)));
    } catch (e) {
      console.error(`[knowledge] 共有の選びを読めなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
