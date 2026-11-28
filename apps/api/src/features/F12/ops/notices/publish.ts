// 運営がお知らせを出す（publishOpsNotice・POST /api/v1/ops/notices/:id/publish）と、1 社にお知らせを送る
//   （sendWorkspaceNotice・POST /api/v1/ops/workspaces/:id/notices）（K-978・関門 C2・C6・D-156.33・D-156.28・D-128.108・D-128.109）。
//   振る舞いの本体は DB の関数 app.ops_notice_publish・app.ops_workspace_notice_send（20261128011800_ops_notices_publish.sql）。
//   上限・認証・お知らせ（ops:notice）を持つ運営の人だけ・入力の形は契約の入口（op.ts）が先に確かめる。ここでは opsTx の 1 取引で関数を 1 回呼び、
//   関数の断りを 409 の番号に直す。メンテのメールは取引の後に関門 C6 で（送れなくても出したまま 201）。DB の断りは opsErrorReply（K-947）
import type pg from "pg";
import type { Repository } from "@kaname/db/repository";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import type { HookMailer } from "../../../../hooks/registry.js";
import { opsErrorReply, opsTx } from "../db.js";
import { sendMaintenanceMail } from "./mail.js";
import { toOpsNoticeDetail } from "./shape.js";

/** 関数の断り（{ error }）→ 409 の番号（欄なし） */
const CONFLICTS: Readonly<Record<string, string>> = {
  already_published: "E-OPS-011",
  maintenance_missing: "E-OPS-010",
};

type FnAnswer = {
  data?: unknown;
  error?: string;
  mail_to?: unknown;
  mail?: { title?: unknown; body?: unknown; from?: unknown; to?: unknown } | null;
};

const conflict = (j: FnAnswer): HookReply => {
  const code = CONFLICTS[j.error ?? ""];
  if (code === undefined) throw new Error("お知らせを出す関数が知らない断りを返した");
  return { status: 409, body: { error: "conflict", code } };
};
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const emails = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];

export interface PublishDeps {
  appPool: pg.Pool;
  repo: Repository;
  mailer?: HookMailer;
}

export function createPublishOpsNotice(d: PublishDeps): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    let j: FnAnswer;
    let opsTenant: string | null;
    let data: Record<string, unknown>;
    try {
      const r = await opsTx(d.appPool, a.ctx, (cl) =>
        cl.query<{ j: FnAnswer; ops: string | null }>(
          "select app.ops_notice_publish($1) as j, app.ops_tenant_id()::text as ops",
          [a.id],
        ),
      );
      j = r.rows[0]!.j;
      opsTenant = r.rows[0]!.ops;
      if (j.error !== undefined) return conflict(j); // 知らない断りは投げて 503 に倒す（ふつうを返さない）
      data = toOpsNoticeDetail(j.data); // 16 欄にそろえる（鍵が欠けた答えは投げて 503・K-977）
    } catch (e) {
      return opsErrorReply(e, "notices");
    }
    const to = emails(j.mail_to);
    if (to.length > 0 && j.mail) {
      // 関門 C6 の記録は運営の会社の文脈で書く（運営の文脈は会社が無いため）
      await sendMaintenanceMail(d, { ...a.ctx, tenantId: opsTenant }, to, {
        noticeId: String(a.id),
        title: str(j.mail.title) ?? "",
        body: str(j.mail.body) ?? "",
        from: str(j.mail.from),
        to: str(j.mail.to),
      });
    }
    return { status: 201, body: { data } };
  };
}

export function createSendWorkspaceNotice(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const j = await opsTx(appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ j: FnAnswer }>("select app.ops_workspace_notice_send($1, $2::jsonb) as j", [
          a.id,
          JSON.stringify(a.input),
        ]);
        return r.rows[0]!.j;
      });
      if (j.error !== undefined) return conflict(j);
      return { status: 201, body: { data: toOpsNoticeDetail(j.data) } }; // 16 欄（鍵が欠けたら投げて 503・K-977）
    } catch (e) {
      return opsErrorReply(e, "notices");
    }
  };
}
