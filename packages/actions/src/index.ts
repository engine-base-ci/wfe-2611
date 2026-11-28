// 関門 C1 ネットワーク：外に出る操作は executeAction(actionRef, input, ctx) だけ。生の fetch はこのパッケージの中でしか呼べない（CI G16 が静的に検出）。
// 関門の中で 1 回だけ：認可 → ポリシー判定（auto／approve／off）→ 承認箱 → サービス台帳の判定 → 宛先の許可 → レート制限 → 実行 → 証跡 → 失敗時の人へのハンドオフ。副作用は必ず認可の後。
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export type Policy = "auto" | "approve" | "off";
export interface ActionRequest {
  actionRef: string; // 例 "http.request" "mail.send"（登録された行為の名前）
  input: Record<string, unknown>;
  destination?: string; // 宛先（host など）。許可判定に使う
}
export interface ActionOutcome<T = unknown> {
  status: "done" | "pending_approval" | "denied" | "failed";
  output?: T;
  reason?: string;
  handoff?: string; // 失敗時に人へ渡す一手（黙って止まるを作らない）
  auditId?: string;
}
export interface ActionHandler<T = unknown> {
  (input: Record<string, unknown>, tools: { fetch: typeof fetch; signal: AbortSignal }): Promise<T>;
}
export interface Hooks {
  /** 認可：この文脈がこの行為を実行できるか */
  authorize?: (req: ActionRequest, ctx: TenantContext) => Promise<boolean>;
  /** ポリシー：auto（そのまま）／approve（承認箱へ）／off（禁止） */
  policy?: (req: ActionRequest, ctx: TenantContext) => Promise<Policy>;
  /** 承認箱に入れて待つ。approve のときだけ呼ばれる。true＝承認済みで続行、false＝待機（pending） */
  approval?: (req: ActionRequest, ctx: TenantContext) => Promise<boolean>;
  /** サービス台帳：自動操作が許されるサービスか（規約で禁止なら false） */
  serviceAllowed?: (req: ActionRequest, ctx: TenantContext) => Promise<boolean>;
  /** 宛先の許可：テナントに紐づく宛先か */
  destinationAllowed?: (req: ActionRequest, ctx: TenantContext) => Promise<boolean>;
  /** 課金計測 */
  meter?: (req: ActionRequest, ctx: TenantContext, ms: number) => Promise<void>;
}

/** テナント×宛先ごとのレート制限（人間らしい速度。1 分あたりの上限） */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly perMinute = 30) {}
  take(key: string, now = Date.now()): boolean {
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (arr.length >= this.perMinute) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}

export class ActionGateway {
  private readonly handlers = new Map<string, ActionHandler>();
  constructor(
    private readonly repo: Repository,
    private readonly hooks: Hooks = {},
    private readonly limiter = new RateLimiter(),
    private readonly timeoutMs = 30_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** 行為の登録（接続の器を 1 回作れば設定で増える・D-013） */
  register<T>(actionRef: string, handler: ActionHandler<T>): void {
    this.handlers.set(actionRef, handler as ActionHandler);
  }

  async executeAction<T = unknown>(req: ActionRequest, ctx: TenantContext): Promise<ActionOutcome<T>> {
    const handler = this.handlers.get(req.actionRef);
    if (!handler) return this.deny(req, ctx, "未登録の行為", "行為を登録するか、名前を確かめる");
    // 1 認可（副作用より前）
    if (this.hooks.authorize && !(await this.hooks.authorize(req, ctx)))
      return this.deny(req, ctx, "権限が無い", "権限のある人に頼む");
    // 2 ポリシー
    const policy = (await this.hooks.policy?.(req, ctx)) ?? "approve";
    if (policy === "off")
      return this.deny(req, ctx, "この行為は会社のルールで止められている", "ルールを変えられる人に相談する");
    // 3 サービス台帳・宛先
    if (this.hooks.serviceAllowed && !(await this.hooks.serviceAllowed(req, ctx)))
      return this.deny(req, ctx, "自動操作が許されていないサービス", "人が手で行う");
    if (this.hooks.destinationAllowed && !(await this.hooks.destinationAllowed(req, ctx)))
      return this.deny(req, ctx, "許可されていない宛先", "宛先を会社の一覧に足す");
    // 4 承認
    if (policy === "approve") {
      const ok = await this.hooks.approval?.(req, ctx);
      if (!ok) {
        const auditId = await this.repo.audit(ctx, `action.pending:${req.actionRef}`, "action", null, "C1", {
          destination: req.destination ?? null,
        });
        return { status: "pending_approval", reason: "承認待ち", auditId };
      }
    }
    // 5 レート制限（テナント×宛先）
    if (!this.limiter.take(`${ctx.tenantId}:${req.destination ?? req.actionRef}`))
      return this.deny(req, ctx, "速すぎる（レート制限）", "少し待ってからもう一度");
    // 6 実行（タイムアウト付き。完了信号が来ない外部を成功にしない・G-15）
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    const t0 = Date.now();
    try {
      const output = (await handler(req.input, { fetch: this.fetchImpl, signal: ac.signal })) as T;
      const ms = Date.now() - t0;
      await this.hooks.meter?.(req, ctx, ms);
      const auditId = await this.repo.audit(ctx, `action.done:${req.actionRef}`, "action", null, "C1", {
        destination: req.destination ?? null,
        ms,
      });
      return { status: "done", output, auditId };
    } catch (e) {
      const reason = ac.signal.aborted ? "外部が時間内に応えなかった" : e instanceof Error ? e.message : String(e);
      const auditId = await this.repo.audit(ctx, `action.failed:${req.actionRef}`, "action", null, "C1", {
        destination: req.destination ?? null,
        reason,
      });
      return { status: "failed", reason, handoff: "人が確認して、やり直すか手で行う", auditId };
    } finally {
      clearTimeout(timer);
    }
  }

  private async deny<T>(
    req: ActionRequest,
    ctx: TenantContext,
    reason: string,
    handoff: string,
  ): Promise<ActionOutcome<T>> {
    const auditId = await this.repo.audit(ctx, `action.denied:${req.actionRef}`, "action", null, "C1", {
      reason,
      destination: req.destination ?? null,
    });
    return { status: "denied", reason, handoff, auditId };
  }
}
