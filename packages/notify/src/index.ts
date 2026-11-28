// 関門 C6 通知送出：notify(event, audience, ctx) だけ。メール／チャット／プッシュの SDK はこのパッケージの外では使えない（CI G21）。
// 関門の中で 1 回だけ：宛先解決（人間／AI社員／自分のAI で規則が違う）→ 購読設定 → 重複抑止（dedupe_key）→ 送出 → 失敗時の再送 → 証跡。
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";

export type Channel = "email" | "push" | "chat" | "inapp";
export interface NotifyEvent {
  kind: string; // 例 "approval.requested" "goal.overdue"
  payload: Record<string, unknown>;
  dedupeKey?: string; // 同じ出来事を二度送らない鍵（無ければ kind＋宛先＋payload から作る）
}
export type Audience = { memberIds: string[] } | { role: "owner" | "all" | "layer_heads"; scopeId?: string | null };
export interface Recipient {
  memberId: string;
  kind: "human" | "ai_employee" | "clone";
  address: string | null; // email 等。人間だけ
}
export interface Delivery {
  memberId: string;
  channel: Channel;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  attempts: number;
}
export interface Transport {
  send(channel: Channel, address: string | null, memberId: string, event: NotifyEvent): Promise<void>;
}
export interface NotifyHooks {
  /** 宛先解決：audience → 受け手（人間・AI社員・自分のAI）。AI社員への通知は自分のAI経由の申し送りになる（address 無し） */
  resolve: (audience: Audience, ctx: TenantContext) => Promise<Recipient[]>;
  /** 購読設定（notification_preferences）：この人がこの出来事をこの経路で受けるか */
  prefers?: (memberId: string, kind: string, channel: Channel, ctx: TenantContext) => Promise<boolean>;
  /** 重複抑止の記憶（notifications.dedupe_key）。true＝もう送った */
  seen?: (dedupeKey: string, ctx: TenantContext) => Promise<boolean>;
  remember?: (dedupeKey: string, ctx: TenantContext) => Promise<void>;
}
export interface NotifyOptions {
  maxAttempts?: number; // 既定 3
  backoffMs?: number; // 既定 50（テスト向け。本番は数秒）
  channelsOf?: (r: Recipient) => Channel[]; // 既定：人間＝inapp＋email、AI＝inapp（申し送り）
}

export class NotifyGateway {
  private readonly seenLocal = new Set<string>();
  constructor(
    private readonly repo: Repository,
    private readonly transport: Transport,
    private readonly hooks: NotifyHooks,
    private readonly o: NotifyOptions = {},
  ) {}

  async notify(
    event: NotifyEvent,
    audience: Audience,
    ctx: TenantContext,
  ): Promise<{ deliveries: Delivery[]; auditId?: string }> {
    if (!ctx.tenantId) throw new Error("文脈が無い");
    const recipients = await this.hooks.resolve(audience, ctx);
    const deliveries: Delivery[] = [];
    for (const r of recipients) {
      const channels =
        this.o.channelsOf?.(r) ?? (r.kind === "human" ? (["inapp", "email"] as Channel[]) : (["inapp"] as Channel[]));
      for (const ch of channels) {
        if (this.hooks.prefers && !(await this.hooks.prefers(r.memberId, event.kind, ch, ctx))) {
          deliveries.push({
            memberId: r.memberId,
            channel: ch,
            status: "skipped",
            reason: "受け取らない設定",
            attempts: 0,
          });
          continue;
        }
        const key = `${ctx.tenantId}:${r.memberId}:${ch}:${event.dedupeKey ?? event.kind + ":" + JSON.stringify(event.payload)}`;
        if (this.seenLocal.has(key) || (this.hooks.seen && (await this.hooks.seen(key, ctx)))) {
          deliveries.push({ memberId: r.memberId, channel: ch, status: "skipped", reason: "重複", attempts: 0 });
          continue;
        }
        if (ch === "email" && !r.address) {
          deliveries.push({ memberId: r.memberId, channel: ch, status: "skipped", reason: "宛先が無い", attempts: 0 });
          continue;
        }
        const max = this.o.maxAttempts ?? 3;
        let attempts = 0;
        let lastErr = "";
        while (attempts < max) {
          attempts++;
          try {
            await this.transport.send(ch, r.address, r.memberId, event);
            lastErr = "";
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : String(e);
            if (attempts < max) await new Promise((res) => setTimeout(res, (this.o.backoffMs ?? 50) * attempts));
          }
        }
        if (lastErr)
          deliveries.push({
            memberId: r.memberId,
            channel: ch,
            status: "failed",
            reason: `送信が相手先の都合で失敗しました。書いたものは残っています（${lastErr}）`,
            attempts,
          });
        else {
          this.seenLocal.add(key);
          await this.hooks.remember?.(key, ctx);
          deliveries.push({ memberId: r.memberId, channel: ch, status: "sent", attempts });
        }
      }
    }
    const auditId = await this.repo.audit(ctx, "notify", "notification", event.kind, "C6", {
      sent: deliveries.filter((d) => d.status === "sent").length,
      skipped: deliveries.filter((d) => d.status === "skipped").length,
      failed: deliveries.filter((d) => d.status === "failed").length,
      recipients: recipients.length,
    });
    return { deliveries, auditId };
  }
}

export { resendMail, resendTransport, type MailLike } from "./resend.js";
export { mailSignature, withSignature, signedMail, type Operator } from "./signature.js";
