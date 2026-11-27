// 共有を頼む・やめる・取り下げる口（K-689・契約の口 setKnowledgeShares・PUT /api/v1/knowledge/shares）。体は送った後の選びの全部（group_ids）。
//   1 つの取引の中で DB の関数 app.kn_share_set を呼ぶ（中で物の錠・確かめ・頼み・共有・お知らせ。断る前に何も書かない）：
//   not_found／no_group → 404・denied → 403・draft → 409 E-KNW-010・pending → 409 E-KNW-011・own_group → 409 E-KNW-120・
//   not_group_shelf → 409 E-KNW-121・no_approver → 409 E-KNW-122。証跡は増えた物 1 つにつき 1 行（題名を入れない）。
//   読み直して読む口と同じ形で答える。部分一意（23505）は何もしない扱い。ほかの DB の失敗は 503 E-PAGE-003。ログに題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { conflict, forbidden, invalid, notFound, unavailable } from "./reply.js";
import { readShareView, viewReply } from "./shares-get.js";

const SET_SQL = "select app.kn_share_set($1, $2, $3::uuid[], $4) as r";
const AUDIT_SQL = "select app.record_audit($1, $2, $3, 'C2', '{}'::jsonb)";

const MESSAGE_MAX = 1000;
/** 1 回に選べるグループの数（契約 group_ids の maxItems・05_flow/screen_api.d/K-689.py） */
const GROUPS_MAX = 50;
const MESSAGE = "入力内容を確認してください";

type Reason =
  "not_found" | "denied" | "draft" | "pending" | "own_group" | "no_group" | "not_group_shelf" | "no_approver";
interface SetResult {
  readonly ok: boolean;
  readonly reason?: Reason;
  readonly request_ids?: readonly string[];
  readonly shared_ids?: readonly string[];
  readonly ended_ids?: readonly string[];
  readonly withdrawn_ids?: readonly string[];
}
interface SharesInput {
  readonly page: string | null;
  readonly folder: string | null;
  readonly groups: readonly string[];
  readonly message: string | null;
}

const REFUSAL: Readonly<Record<Reason, () => HookReply>> = {
  not_found: notFound,
  no_group: notFound,
  denied: forbidden,
  draft: () => conflict("E-KNW-010"),
  pending: () => conflict("E-KNW-011"),
  own_group: () => conflict("E-KNW-120"),
  not_group_shelf: () => conflict("E-KNW-121"),
  no_approver: () => conflict("E-KNW-122"),
};

/** 増えた物の種類 → 証跡の名前と対象の表 */
const AUDITS: readonly (readonly [keyof SetResult, string, string])[] = [
  ["request_ids", "knowledge.share.request", "knowledge_requests"],
  ["withdrawn_ids", "knowledge.share.withdraw", "knowledge_requests"],
  ["shared_ids", "knowledge.share.apply", "knowledge_shares"],
  ["ended_ids", "knowledge.share.end", "knowledge_shares"],
];

const kindOf = (e: unknown): string => (e instanceof Error ? e.name : typeof e);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** 入口の形の確かめ（契約）に重ねて、契約の zod が持たない決まり（page_id と folder_id のどちらか 1 つ・group_ids は要る並びで 50 個まで）と、
 *  ひとことの NUL と長さを見る。前後の空白は落とし、空は null */
function readInput(input: Readonly<Record<string, unknown>>): SharesInput | HookReply {
  if ((str(input["page_id"]) === null) === (str(input["folder_id"]) === null)) return invalid("page_id", MESSAGE);
  const g = input["group_ids"];
  if (!Array.isArray(g) || g.length > GROUPS_MAX) return invalid("group_ids", MESSAGE);
  const m = input["message"];
  if (m !== undefined && m !== null && (typeof m !== "string" || [...m].length > MESSAGE_MAX || m.includes("\u0000")))
    return invalid("message", MESSAGE);
  const trimmed = typeof m === "string" ? m.trim() : "";
  const groups = Array.isArray(input["group_ids"])
    ? (input["group_ids"] as unknown[]).filter((g) => typeof g === "string")
    : [];
  return {
    page: str(input["page_id"]),
    folder: str(input["folder_id"]),
    groups: groups as string[],
    message: trimmed === "" ? null : trimmed,
  };
}

async function run(cl: pg.PoolClient, x: SharesInput): Promise<HookReply> {
  const r = (await cl.query<{ r: SetResult }>(SET_SQL, [x.page, x.folder, x.groups, x.message])).rows[0]!.r;
  if (!r.ok) return (REFUSAL[r.reason ?? "denied"] ?? forbidden)();
  for (const [key, action, table] of AUDITS)
    for (const id of (r[key] as readonly string[] | undefined) ?? []) await cl.query(AUDIT_SQL, [action, table, id]);
  const view = await readShareView(cl, x.page, x.folder);
  // 共有を受けている側のマネージャーが自分のグループの分を止めると、もう中身（題名・ほかのグループ）は見えない。
  //   止めた人の画面には「止めました」と残す（決める人の答え answer=2b578da80a62）：200・題名は空・groups は止めたグループの行だけ（checked false・state ended）
  if (!view.ok && (r.ended_ids?.length ?? 0) > 0) return stoppedReply(cl, x, r.ended_ids!);
  return viewReply(view);
}

const ENDED_GROUPS_SQL = `select s.id as group_id, s.name from knowledge_shares k join scopes s on s.id = k.group_id
 where k.id = any($1::uuid[]) and k.tenant_id = app.tenant_id() order by s.name collate "C", s.id`;

/** 受け側が止めた後の答え（中身なし・止めたグループだけ） */
async function stoppedReply(cl: pg.PoolClient, x: SharesInput, ended: readonly string[]): Promise<HookReply> {
  const rows = (await cl.query<{ group_id: string; name: string }>(ENDED_GROUPS_SQL, [ended])).rows;
  return {
    status: 200,
    body: {
      data: {
        target: { page_id: x.page, folder_id: x.folder, title: "" },
        from_group_name: "",
        groups: rows.map((g) => ({
          group_id: g.group_id,
          name: g.name,
          manager_name: "",
          checked: false,
          state: "ended",
        })),
      },
    },
  };
}

export function createSetKnowledgeShares(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const x = readInput(a.input);
    if ("status" in x) return x;
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl, x));
    } catch (e) {
      console.error(`[knowledge] 共有を決められなかった（${kindOf(e)}）`);
      return unavailable();
    }
  };
}
