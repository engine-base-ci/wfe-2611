// 頼みを承認する口・断る口（K-688・契約の口 approveKnowledgeRequest〔POST /api/v1/knowledge/requests/:id/approve〕・
//   declineKnowledgeRequest〔POST /api/v1/knowledge/requests/:id/decline・体 { reason }〕）。入口は頼みの行を読まない（row_rules.mjs の ROW_EXEMPT）。
//   1 つの取引の中で：頼みが見えない（app.kn_request_visible）→ 404 → app.kn_request_decide の断り（not_found 404・forbidden 403・
//   decided 409 E-KNW-110・requester_gone 409 E-KNW-111・reason_required 422 欄 reason）→ 証跡（knowledge.request.approve／decline）→
//   200 { id, kind, state, page_id, folder_id }。確かめで断る前に何も書かない。引き金の KNW_FOLDER_SHELF は 409 E-KNW-103、
//   ほかの DB の失敗は 503 E-PAGE-003（取引ごと戻る）。ログに題名・理由を出さない（例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, forbidden, invalid, notFound, unavailable } from "./reply.js";

type Action = "approve" | "decline";
type Reason = "not_found" | "forbidden" | "decided" | "requester_gone" | "reason_required";
interface DecideResult {
  readonly ok: boolean;
  readonly reason?: Reason;
  readonly state?: string;
  readonly kind?: string;
  readonly page_id?: string | null;
  readonly folder_id?: string | null;
}

const VISIBLE_SQL = "select app.kn_request_visible($1) as ok";
const DECIDE_SQL = "select app.kn_request_decide($1, $2, $3) as r";
const AUDIT_SQL = "select app.record_audit($1, 'knowledge_requests', $2, 'C2', '{}'::jsonb)";
const REASON_MESSAGE = "断る理由を書いてください";

const REFUSAL: Readonly<Record<Reason, () => HookReply>> = {
  not_found: notFound,
  forbidden,
  decided: () => conflict("E-KNW-110"),
  requester_gone: () => conflict("E-KNW-111"),
  reason_required: () => invalid("reason", REASON_MESSAGE),
};
const AUDIT: Readonly<Record<Action, string>> = {
  approve: "knowledge.request.approve",
  decline: "knowledge.request.decline",
};

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);

async function run(cl: pg.PoolClient, id: string, action: Action, reason: string | null): Promise<HookReply> {
  const seen = (await cl.query<{ ok: boolean }>(VISIBLE_SQL, [id])).rows[0];
  if (seen?.ok !== true) return notFound();
  const r = (await cl.query<{ r: DecideResult }>(DECIDE_SQL, [id, action, reason])).rows[0]!.r;
  if (!r.ok) return (REFUSAL[r.reason ?? "not_found"] ?? notFound)();
  await cl.query(AUDIT_SQL, [AUDIT[action], id]);
  return {
    status: 200,
    body: { data: { id, kind: r.kind, state: r.state, page_id: r.page_id ?? null, folder_id: r.folder_id ?? null } },
  };
}

/** 断る理由：入口の契約（文字・1,000 字まで・空白だけでない）に重ねて、前後の空白を落とす。空なら 422 */
function reasonOf(input: Record<string, unknown> | undefined): string | HookReply {
  const v = input?.["reason"];
  if (typeof v !== "string" || v.trim() === "") return invalid("reason", REASON_MESSAGE);
  return v.trim();
}

/** DB の失敗の言葉 → 番号（頼んだあとにフォルダが別の棚に付け替わった）。ほかは null（503） */
function dbRefusal(e: unknown): HookReply | null {
  if (e instanceof Error && e.message.startsWith("KNW_FOLDER_SHELF")) return conflict("E-KNW-103");
  return null;
}

function createDecide(appPool: pg.Pool, action: Action): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const id = a.id;
    if (!id || !isUuid(id)) return notFound();
    let reason: string | null = null;
    if (action === "decline") {
      const x = reasonOf(a.input);
      if (typeof x !== "string") return x;
      reason = x;
    }
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, id, action, reason));
    } catch (e) {
      const known = dbRefusal(e);
      if (known) return known;
      console.error(`[knowledge] 頼みを決められなかった（${action}・${kindOf(e)}）`);
      return unavailable();
    }
  };
}

export const createApproveKnowledgeRequest = (appPool: pg.Pool): ((a: HookArgs) => Promise<HookReply>) =>
  createDecide(appPool, "approve");
export const createDeclineKnowledgeRequest = (appPool: pg.Pool): ((a: HookArgs) => Promise<HookReply>) =>
  createDecide(appPool, "decline");
