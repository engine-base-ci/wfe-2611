// 運営が 1 社のメンバーに本人確認のメールを送り直す口（resendOpsVerification・POST /api/v1/ops/workspaces/:id/members/:mid/resend-verification）
//   （K-967・D-156.3・D-128.108・D-125.129）。運営ができるのは送り直すだけ（役割も中身も変えない）。
//   順番（1 つの取引・opsTx）：① 関数 app.ops_resend_verification_prepare が人を確かめ、運営の記録と会社の記録・送った記録を書き、宛先を返す
//   ② 関門 C6（@kaname/notify の NotifyGateway）の中で認証の部品の本人確認のメール（auth.api.sendVerificationEmail）を送る
//   ③ 送れなければ例外にして取引ごと戻す → 503 E-PAGE-003（送ったと言わない・G-15） ④ 送れたら commit して 201 { sent_at }。
//   宛先・題・本文・リンクは口で作らない（部品のメールのまま）。ログに宛先を出さない（印 mailTag だけ）
import type pg from "pg";
import { mailTag } from "@kaname/auth/signup";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import { NotifyGateway, type Transport } from "@kaname/notify";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

export const RESEND_KIND = "ops.verification_resend";

/** 認証の部品の本人確認のメールを送る口（packages/auth の emailVerification・リンクは 30 分） */
export interface VerificationSender {
  api: { sendVerificationEmail: (a: { body: { email: string } }) => Promise<unknown> };
}

export interface ResendVerificationDeps {
  appPool: pg.Pool;
  repo: Repository;
  auth: VerificationSender;
}

type Prepared = { email?: string; audit_id?: string; name?: string; error?: string };

/** 送れなかった（取引ごと戻すための例外）。外に出すのは宛先の印と例外の種類だけ */
class NotSent extends Error {
  constructor(readonly tag: string) {
    super("送れなかった");
    this.name = "NotSent";
  }
}

const down = (word: string): HookReply => {
  console.error(`[ops] 本人確認のメールを送れなかった（${word}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** 欄も detail も付けない 409（もう確かめた） */
const verified = (): HookReply => {
  const body: Record<string, unknown> = { ...kanameError("E-CONF-039", {}).toJSON() };
  delete body["detail"];
  return { status: 409, body };
};

/** 関門 C6 で 1 通送る。送れたら true（deliveries に sent があるときだけ） */
async function sendOne(
  d: ResendVerificationDeps,
  ctx: TenantContext,
  memberId: string,
  email: string,
  auditId: string,
): Promise<boolean> {
  const transport: Transport = {
    send: async (_ch, address) => {
      if (!address) throw new Error("宛先が無い");
      await d.auth.api.sendVerificationEmail({ body: { email: address } });
    },
  };
  const gw = new NotifyGateway(
    d.repo,
    transport,
    {
      resolve: async () => [{ memberId, kind: "human", address: email }],
      // 1 回ごとに違う鍵（同じ人に何度押しても毎回送る）。送った記録の行は関数が同じ取引で書いた（運営の文脈は行の守りを通らない）
      seen: async () => false,
      remember: async () => undefined,
    },
    { channelsOf: () => ["email"], maxAttempts: 2 },
  );
  const r = await gw.notify(
    { kind: RESEND_KIND, payload: {}, dedupeKey: `${RESEND_KIND}:${memberId}:${auditId}` },
    { memberIds: [memberId] },
    ctx,
  );
  return r.deliveries.some((x) => x.status === "sent");
}

export function resendOpsVerification(d: ResendVerificationDeps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const tenantId = a.id ?? "";
    const memberId = a.c.req.param("mid") ?? "";
    try {
      return await opsTx(d.appPool, a.ctx, async (cl) => {
        const v = (
          await cl.query<{ v: Prepared | null }>("select app.ops_resend_verification_prepare($1, $2) as v", [
            tenantId,
            memberId,
          ])
        ).rows[0]?.v;
        if (!v) throw new NotSent("empty");
        if (v.error === "verified") return verified();
        if (v.error !== undefined || !v.email || !v.audit_id) throw new NotSent(`unknown:${String(v.error)}`);
        // 関門 C6 は送り先の会社の文脈で動く（人と役割は運営の人のまま）
        const ctx: TenantContext = { ...a.ctx, tenantId };
        let sent: boolean;
        try {
          sent = await sendOne(d, ctx, memberId, v.email, v.audit_id);
        } catch (e) {
          throw new NotSent(`${mailTag(v.email)}: ${(e as Error)?.name ?? "Error"}`);
        }
        if (!sent) throw new NotSent(mailTag(v.email));
        return { status: 201, body: { data: { sent_at: new Date().toISOString() } } };
      });
    } catch (e) {
      if (e instanceof NotSent) return down(e.tag);
      return opsErrorReply(e, "resend-verification");
    }
  };
}
