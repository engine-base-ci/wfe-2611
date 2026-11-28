// 運営が 1 社の中を見る口（K-969・関門 C2・D-156.50・D-125.128・D-128.68・D-128.108）：
//   openPeek（POST /api/v1/ops/workspaces/:id/peeks）… 許可を作る。201 { data: OpsPeek }
//   closePeek（DELETE /api/v1/ops/peeks/:id）… 自分が開いた許可を閉じる。200 { data: OpsPeek }
//   振る舞いの本体は DB の関数 app.ops_peek_open・app.ops_peek_close（20261128010900_ops_peek.sql）。
//   上限・認証・運営の人だけ（ops:peek）・本人確認の取り直し（step_up always）・入力の形は契約の入口（op.ts）が先に確かめる。
//   ここでも道の id・理由（前後の空白を落として 1 字以上）・分（1〜60 の整数）を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で関数を 1 回呼ぶ。
//   関数の断り：already_open → 409 E-OPS-001・not_open → 409 E-OPS-002（欄なし）。DB の断りは opsErrorReply（K-947）：
//   できることが無い 403・会社／問い合わせ／許可が無い・見えない 404（欄なし）・ほか 503 E-PAGE-003（ログに理由の字を出さない）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

const REASON_MAX = 200;
const MINUTES_MIN = 1;
const MINUTES_MAX = 60;

const invalid = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

const conflict = (code: "E-OPS-001" | "E-OPS-002"): HookReply => ({
  status: 409,
  body: { error: "conflict", code },
});

/** 関数の答え（{ data } か { error }）を口の答えに直す */
function toReply(j: { data?: unknown; error?: string }, ok: number): HookReply {
  if (j.error === "already_open") return conflict("E-OPS-001");
  if (j.error === "not_open") return conflict("E-OPS-002");
  return { status: ok, body: { data: j.data } };
}

interface OpenInput {
  readonly reason: string;
  readonly minutes: number;
  readonly inquiryId: string | null;
}

/** 入口の後の 2 層目：理由は前後の空白を落として 1〜200 字・分は 1〜60 の整数・問い合わせは uuid か無し */
function readOpen(input: Record<string, unknown>): OpenInput | HookReply {
  const reason = typeof input["reason"] === "string" ? input["reason"].trim() : "";
  if (reason.length === 0 || reason.length > REASON_MAX) return invalid("reason", "1〜200 字");
  const minutes = input["minutes"];
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < MINUTES_MIN || minutes > MINUTES_MAX) {
    return invalid("minutes", "1〜60 の整数");
  }
  const inq = input["inquiry_id"];
  if (inq !== undefined && inq !== null && (typeof inq !== "string" || !isUuid(inq))) {
    return invalid("inquiry_id", "uuid");
  }
  return { reason, minutes, inquiryId: typeof inq === "string" ? inq : null };
}

const pathId = (a: HookArgs): string => a.id ?? a.c.req.param("id") ?? "";

export function createOpenPeek(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = pathId(a);
    if (!isUuid(id)) return invalid("id", "uuid");
    const read = readOpen(a.input);
    if ("status" in read) return read;
    try {
      const j = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: { data?: unknown; error?: string } }>(
          "select app.ops_peek_open($1::uuid, $2, $3::integer, $4::uuid) as j",
          [id, read.reason, read.minutes, read.inquiryId],
        );
        return r.rows[0]!.j;
      });
      return toReply(j, 201);
    } catch (e) {
      return opsErrorReply(e, "peek");
    }
  };
}

export function createClosePeek(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const id = pathId(a);
    if (!isUuid(id)) return invalid("id", "uuid");
    try {
      const j = await opsTx(appPool, a.ctx, async (cl: pg.PoolClient) => {
        const r = await cl.query<{ j: { data?: unknown; error?: string } }>(
          "select app.ops_peek_close($1::uuid) as j",
          [id],
        );
        return r.rows[0]!.j;
      });
      return toReply(j, 200);
    } catch (e) {
      return opsErrorReply(e, "peek");
    }
  };
}
