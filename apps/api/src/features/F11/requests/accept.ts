// 依頼を受けて普通のチケットを作る口（K-894）：acceptClientRequest（POST /api/v1/client_requests/:id/accept・D-155.42〜45）。
//   判定と書き込みは 1 つの DB の関数 app.client_request_accept の 1 取引の中（関門 C2）：依頼の見える・直せる・状態・段 5 の app.ticket_create・
//   チャットの頭（依頼のやり取りを元の時刻のまま）・見せる相手（K-881 の関数・依頼を出したグループはいつも入る）・依頼を ticketed に・証跡。
//   口は体の形を確かめ（日付・前後の空白）、関数の答えと断りを番号に写すだけ。どこかが落ちれば取引ごと戻り、503・E-PAGE-003（何も残らない）。
//   上限・認証・ゲストの文脈・冪等・知らない欄・uuid の形は契約の入口（op.ts）が先に確かめる。Cache-Control: private, no-store は入口が全部の答えに付ける。
//   ログに題・本文・人の id を出さない（例外の種類だけ）。
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

const SQL = "select app.client_request_accept($1, $2::jsonb) as v";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Answer = { ok?: boolean; ticket_id?: string; number?: string; status?: number; code?: string; field?: string };

const isDate = (v: unknown): v is string =>
  typeof v === "string" && DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const badField = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});
/** 正本の番号の断り（欄・details を付けない＝在るかを漏らさない） */
const plain = (status: number, code: string): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() }; // detail（空の {}）も付けない
  delete body["detail"];
  return { status, body };
};
const forbidden = (field?: string): HookReply => ({
  status: 403,
  body: { error: "forbidden", code: "FORBIDDEN", ...(field ? { field } : {}) },
});
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const down = (e: unknown): HookReply => {
  console.error(`[client-request-accept] 受ける取引が落ちた（${kindOf(e)}）`);
  return plain(503, "E-PAGE-003");
};

/** DB の関数が投げた断り → 答え。分からない例外は 503 */
function thrown(e: unknown): HookReply {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown };
  const code = typeof x.code === "string" ? x.code : "";
  const hint = typeof x.hint === "string" ? x.hint : "";
  if (code === "42501" && hint === "E-GST-100") return plain(404, "E-GST-100");
  if (code === "42501" && hint === "E-GST-040") return plain(404, "E-GST-040");
  if (code === "22023" && hint === "E-GST-120") return plain(409, "E-GST-120");
  if (code === "22023" && hint === "E-GST-041") return plain(409, "E-GST-041");
  if (code === "42501" && hint === "") return forbidden();
  return down(e);
}

/** app.ticket_create が断った答え（何も書いていない）→ 答え。欄は field として付ける */
function refusedCreate(v: Answer): HookReply {
  const field = typeof v.field === "string" ? v.field : "body";
  if (v.status === 403) return forbidden(field);
  // 選べない担当・種別・本文の形は 422（欄つき）。番号は入口の形の誤りと同じ VALIDATION_ERROR（前に使っていた E-VAL-014 は K-437 が正本から外した）
  return {
    status: 422,
    body: {
      error: "validation_failed",
      code: "VALIDATION_ERROR",
      field,
      details: [{ field, message: "選び直してください" }],
    },
  };
}

/** 体（入口が strict と形を確かめた後）→ 関数に渡す jsonb。日付と空の題だけはここで見る */
function readBody(
  input: Record<string, unknown>,
): { ok: true; value: Record<string, unknown> } | { ok: false; reply: HookReply } {
  // 必須の欄と値域（VALUE_RANGES）は口が断る（入口の zod は欄を optional のまま・上限を置かない作り・scripts/ci/contract.mjs）
  if (typeof input["assignee_member_id"] !== "string")
    return { ok: false, reply: badField("assignee_member_id", "担当を選んでください") };
  if (!isDate(input["due_on"])) return { ok: false, reply: badField("due_on", "日付で入れてください") };
  if (typeof input["scope_id"] !== "string")
    return { ok: false, reply: badField("scope_id", "グループを選んでください") };
  const ids = input["guest_group_ids"];
  if (Array.isArray(ids) && (ids.length < 1 || ids.length > 20))
    return { ok: false, reply: badField("guest_group_ids", "1〜20 個") };
  const value: Record<string, unknown> = {
    assignee_member_id: input["assignee_member_id"],
    due_on: input["due_on"],
    scope_id: input["scope_id"],
  };
  if (input["title"] !== undefined) {
    const title = typeof input["title"] === "string" ? input["title"].trim() : "";
    if (!title) return { ok: false, reply: badField("title", "題名を入れてください") };
    if ([...title].length > 200) return { ok: false, reply: badField("title", "200 字まで") };
    value["title"] = title;
  }
  if (typeof input["body"] === "string") value["body"] = input["body"].trim();
  if (typeof input["kind_id"] === "string") value["kind_id"] = input["kind_id"];
  if (Array.isArray(input["guest_group_ids"])) value["guest_group_ids"] = [...new Set(input["guest_group_ids"])];
  return { ok: true, value };
}

export function createAcceptClientRequest(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const body = readBody(a.input);
    if (!body.ok) return body.reply;
    let v: Answer | undefined;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<{ v: Answer }>(SQL, [a.id, JSON.stringify(body.value)])).rows[0]?.v,
      );
    } catch (e) {
      return thrown(e);
    }
    if (!v) return down(new Error("no answer"));
    if (v.ok !== true) return refusedCreate(v);
    if (!v.ticket_id || !v.number) return down(new Error("unknown answer"));
    return { status: 201, body: { data: { ticket_id: v.ticket_id, number: v.number } } };
  };
}
