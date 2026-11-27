// 運営がお知らせを作る・直す（createOpsNotice・POST /api/v1/ops/notices／updateOpsNotice・PATCH /api/v1/ops/notices/:id）（K-1014・関門 C2・
//   D-156.3・D-156.12・D-156.17・D-156.28・D-156.33・D-156.64）。振る舞いの本体は DB の関数 app.ops_notice_create・app.ops_notice_update
//   （20261128015400_ops_notices_write.sql）。上限・認証・notice を持つ運営の人だけ（ops:notice）・体の形と欄をまたぐ決まり（INPUT_RULES）・NUL・:id の形は
//   契約の入口（op.ts）が先に確かめる。ここは体をそのまま jsonb にし、opsTx の 1 取引で関数を 1 回呼ぶ（行と運営の記録を一緒に・落ちれば両方戻る）。
//   断りの言葉 → 番号：maintenance_order → 409 E-OPS-014／published_locked → 409 E-OPS-009（どちらも欄なし）。DB の断りは opsErrorReply（K-947）。
//   関数を呼ぶ権限が無い（落ちている）は 503（運営の確かめ app.ops_require の断りは 403 のまま・K-973 と同じ見分け方）。
//   作る・直すは届けない（鈴・メールを出さない・D-156.28）。ログは場所と SQLSTATE だけ（題・本文を出さない）
import type pg from "pg";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";
import { toOpsNoticeDetail } from "./shape.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WHERE = "notices";

/** 関数が返す断りの言葉 → 口の答え（欄・details を付けない） */
const REFUSALS: Readonly<Record<string, HookReply>> = {
  maintenance_order: { status: 409, body: { error: "conflict", code: "E-OPS-014" } },
  published_locked: { status: 409, body: { error: "conflict", code: "E-OPS-009" } },
};

/** DB の断りを答えにする。関数の実行の許可が外れている（aclcheck_error）は落ちているとみなして 503 */
function writeErrorReply(e: unknown): HookReply {
  const err = e as { code?: unknown; routine?: unknown } | null;
  if (err?.code === "42501" && err.routine === "aclcheck_error") {
    console.error(`[${WHERE}] 運営のお知らせを書けなかった（42501）`);
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
  }
  return opsErrorReply(e, WHERE);
}

/** 関数の答え { data } か { error } を口の答えにする */
function toReply(out: unknown, okStatus: number): HookReply {
  const o = (out ?? {}) as { data?: unknown; error?: unknown };
  if (typeof o.error === "string") {
    const refusal = REFUSALS[o.error];
    if (refusal) return refusal;
    console.error(`[${WHERE}] 運営のお知らせを書けなかった（知らない断り）`);
    return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
  }
  return { status: okStatus, body: { data: toOpsNoticeDetail(o.data) } };
}

async function callFn(
  appPool: pg.Pool,
  a: HookArgs,
  sql: string,
  params: readonly unknown[],
  okStatus: number,
): Promise<HookReply> {
  try {
    const out = await opsTx(appPool, a.ctx, async (cl) => {
      const r = await cl.query<{ j: unknown }>(sql, [...params]);
      return r.rows[0]?.j;
    });
    return toReply(out, okStatus);
  } catch (e) {
    return writeErrorReply(e);
  }
}

/** 作る（下書き）：201 { data }（OpsNoticeDetail の 16 欄） */
export function createCreateOpsNotice(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return (a) => callFn(appPool, a, "select app.ops_notice_create($1::jsonb) as j", [JSON.stringify(a.input)], 201);
}

/** 直す（送った欄だけ）：200 { data }。:id の形は入口が確かめ済み・ここでも見る（2 層目） */
export function createUpdateOpsNotice(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = a.id ?? "";
    if (!UUID.test(id))
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: "id", message: "uuid の形" }],
        },
      };
    return callFn(
      appPool,
      a,
      "select app.ops_notice_update($1::uuid, $2::jsonb) as j",
      [id, JSON.stringify(a.input)],
      200,
    );
  };
}
