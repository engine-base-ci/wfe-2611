// 会社の側のひな形の新しい版の口（K-993：listKindTemplateUpdates・applyKindTemplateUpdate・D-156.20・D-156.56・D-125.72・関門 C2）。
//   口は「withTenant の 1 つの取引で DB の関数を呼ぶ → 断りの言葉を番号に → 答えの形」だけ。
//   差の作り方（手を付けていない所だけ）・当て方・選んだ印・記録は DB の関数（20261128013300_kind_template_updates.sql）が持つ。
//   入口（op.ts）が先に確かめる：ログイン（401）・管理者か（403）・上限（429）・体の形（choice は change／keep・知らない欄・:id が uuid でない＝422）。
//   関数の頭でも会社の管理者かを確かめる（2 層目・42501 → 403）。
//   断る：ほかの会社・無い行 404（欄なし）／もう選んだ・届いていない 409 E-OPS-025（欄なし）／想定外 503 E-PAGE-003（何も変えない）。
//   ログは口の名前と SQLSTATE だけ（中身の名前は出さない）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";

export interface TemplateUpdatesDeps {
  appPool: pg.Pool;
}

type Body = Record<string, unknown>;

/** DB の関数の断りの言葉 → 409 の番号 */
const CONFLICTS: Readonly<Record<string, string>> = {
  chosen: "E-OPS-025",
};

/** 正本のエラー（field・details・detail を付けない） */
const bare = (code: string, status: number): HookReply => {
  const body: Body = { ...kanameError(code).toJSON() };
  delete body["field"];
  delete body["details"];
  delete body["detail"];
  return { status, body };
};

const sqlState = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : "unknown";
};

/** DB の例外 → 答え。分からない例外は 503（同じ取引なので何も残らない） */
function failed(e: unknown, op: string): HookReply {
  const code = sqlState(e);
  if (code === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (code === "P0002") return { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
  console.error(`[template-updates] ${op} の DB が失敗した（${code}）`);
  return bare("E-PAGE-003", 503);
}

/** 関数の答え { data } か { error } → 口の答え。知らない言葉は止める側（503） */
function answer(r: Body | undefined, op: string, ok: (data: unknown) => HookReply): HookReply {
  if (r && r["error"] !== undefined) {
    const word = String(r["error"]);
    const code = CONFLICTS[word];
    if (code) return bare(code, 409);
    console.error(`[template-updates] ${op} の DB が失敗した（知らない答え ${word}）`);
    return bare("E-PAGE-003", 503);
  }
  return ok(r?.["data"]);
}

async function call(d: TemplateUpdatesDeps, a: HookArgs, sql: string, params: unknown[]): Promise<Body | undefined> {
  return withTenant(d.appPool, a.ctx, async (cl) => (await cl.query<{ r: Body }>(sql, params)).rows[0]?.r);
}

export function createListKindTemplateUpdates(d: TemplateUpdatesDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const op = "listKindTemplateUpdates";
    let r: Body | undefined;
    try {
      r = await call(d, a, "select app.kind_template_updates() as r", []);
    } catch (e) {
      return failed(e, op);
    }
    return answer(r, op, (data) => ({ status: 200, body: { data: Array.isArray(data) ? data : [] } }));
  };
}

export function createApplyKindTemplateUpdate(d: TemplateUpdatesDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const op = "applyKindTemplateUpdate";
    // 体の形：choice は change か keep だけ（契約の enum。zod は欄の候補を見ないので口が断る・何も変えない）
    const choice = a.input["choice"];
    if (choice !== "change" && choice !== "keep")
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: "choice", message: "change か keep" }],
        },
      };
    let r: Body | undefined;
    try {
      r = await call(d, a, "select app.kind_template_apply($1::uuid, $2) as r", [a.id, choice]);
    } catch (e) {
      return failed(e, op);
    }
    return answer(r, op, (data) => ({ status: 200, body: { data: data ?? null } }));
  };
}

export function createTemplateUpdateHooks(d: TemplateUpdatesDeps): Record<string, Hook> {
  return {
    listKindTemplateUpdates: { before: createListKindTemplateUpdates(d) },
    applyKindTemplateUpdate: { before: createApplyKindTemplateUpdate(d) },
  };
}
