// 関門 C7 決済・課金：billing.<op>(input, ctx) だけ。stripe SDK はこのパッケージの外では使えない（CI G22）。段階 1 は請求書払い（D-002・D-075.4）。
// 関門の中で 1 回だけ：認可（誰が課金操作できるか）→ 冪等性キー（二重課金の防止）→ プラン上限との整合 → 実行 → 証跡。Webhook は署名検証（段階 2 のカード決済で使う）。
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export type Op = "issueInvoice" | "recordPayment" | "changePlan" | "cancel";
export interface BillingInput {
  idempotencyKey: string; // 呼ぶ側が持つ。同じ鍵の 2 回目は最初の結果を返す（副作用なし）
  amount?: number;
  invoiceId?: string;
  planKey?: string;
  note?: string;
}
export type Outcome<T = Record<string, unknown>> =
  | { status: "done"; value: T; replayed: boolean; auditId?: string }
  | { status: "denied" | "failed"; reason: string; handoff: string; auditId?: string };
export interface BillingHooks {
  authorize?: (op: Op, ctx: TenantContext) => Promise<boolean>;
  /** プラン上限との整合（例：下げる先のプランに収まるか） */
  planAllows?: (op: Op, input: BillingInput, ctx: TenantContext) => Promise<{ ok: boolean; reason?: string }>;
  /** 冪等性の記憶（本番は DB の表）。既定はメモリ */
  idempotency?: {
    get(key: string): Promise<Record<string, unknown> | null>;
    put(key: string, value: Record<string, unknown>): Promise<void>;
  };
  /** 実体（段階 1：請求書の発行・入金の記録。段階 2：決済プロバイダ） */
  execute: (op: Op, input: BillingInput, ctx: TenantContext) => Promise<Record<string, unknown>>;
}
export class MemoryIdempotency {
  private readonly m = new Map<string, Record<string, unknown>>();
  async get(k: string) {
    return this.m.get(k) ?? null;
  }
  async put(k: string, v: Record<string, unknown>) {
    this.m.set(k, v);
  }
}
export class BillingGateway {
  private readonly idem: NonNullable<BillingHooks["idempotency"]>;
  constructor(
    private readonly repo: Repository,
    private readonly hooks: BillingHooks,
    private readonly webhookSecret?: string,
  ) {
    this.idem = hooks.idempotency ?? new MemoryIdempotency();
  }
  async run(op: Op, input: BillingInput, ctx: TenantContext): Promise<Outcome> {
    if (!ctx.tenantId) return { status: "denied", reason: "文脈が無い", handoff: "ログインし直す" };
    if (!input.idempotencyKey)
      return this.finish(ctx, op, input, {
        status: "denied",
        reason: "冪等性キーが無い（二重課金の防止）",
        handoff: "呼ぶ側で鍵を付ける",
      });
    if (this.hooks.authorize && !(await this.hooks.authorize(op, ctx)))
      return this.finish(ctx, op, input, {
        status: "denied",
        reason: "課金の操作は許されていない",
        handoff: "代表か運営に頼む",
      });
    const key = `${ctx.tenantId}:${op}:${input.idempotencyKey}`;
    const prev = await this.idem.get(key);
    if (prev) return this.finish(ctx, op, input, { status: "done", value: prev, replayed: true });
    if (this.hooks.planAllows) {
      const p = await this.hooks.planAllows(op, input, ctx);
      if (!p.ok)
        return this.finish(ctx, op, input, {
          status: "denied",
          reason: p.reason ?? "プランの上限に合わない",
          handoff: "プランと請求を開いて確かめる",
        });
    }
    if (
      (op === "issueInvoice" || op === "recordPayment") &&
      !(typeof input.amount === "number" && input.amount > 0 && Number.isFinite(input.amount))
    )
      return this.finish(ctx, op, input, { status: "denied", reason: "金額が正の数でない", handoff: "金額を確かめる" });
    try {
      const value = await this.hooks.execute(op, input, ctx);
      await this.idem.put(key, value);
      return this.finish(ctx, op, input, { status: "done", value, replayed: false });
    } catch (e) {
      return this.finish(ctx, op, input, {
        status: "failed",
        reason: e instanceof Error ? e.message : String(e),
        handoff: "少し待ってやり直す。続くなら運営に問い合わせる",
      });
    }
  }
  /** Webhook（段階 2）：署名が合わないものは受けない。timestamp で再送攻撃を切る */
  verifyWebhook(rawBody: string, signature: string, timestamp: number, now = Date.now(), toleranceSec = 300): boolean {
    if (!this.webhookSecret) return false;
    if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > toleranceSec) return false;
    const want = Buffer.from(createHmac("sha256", this.webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex"));
    const got = Buffer.from(signature);
    return want.length === got.length && timingSafeEqual(want, got);
  }
  signWebhook(rawBody: string, timestamp: number): string {
    return createHmac("sha256", this.webhookSecret ?? "")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
  }
  private async finish(ctx: TenantContext, op: Op, input: BillingInput, o: Outcome): Promise<Outcome> {
    o.auditId = await this.repo.audit(ctx, `billing.${o.status}:${op}`, "billing", input.invoiceId ?? null, "C7", {
      idempotencyKey: input.idempotencyKey,
      amount: input.amount ?? null,
      replayed: o.status === "done" ? o.replayed : null,
      reason: "reason" in o ? o.reason : null,
    });
    return o;
  }
}
