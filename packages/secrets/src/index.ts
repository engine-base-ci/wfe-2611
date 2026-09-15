// 関門 C8 秘密の読み出し：secrets.resolve(ref, ctx) だけ。Infisical SDK と業務ロジックからの process.env はこのパッケージの外では使えない（CI G23。起動設定は例外 X-002）。
// 関門の中で 1 回だけ：テナントごとの鍵分離と復号 → AI には一切渡さない（参照 ID だけ）→ ログへの露出防止（マスク）→ 失効の即時反映 → 全アクセスの証跡。D-017・D-042。
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { uuidv7 } from "@kaname/db/id";

export interface SecretRef {
  ref: string;
} // AI・画面・ログに出してよいのはこれだけ
export interface StoredSecret {
  tenantId: string;
  iv: string;
  tag: string;
  data: string;
  kind: string;
  revokedAt: string | null;
}
/** 保管の実体（本番 Infisical／開発はメモリ・ファイル）。復号の鍵は持たない（暗号文だけを預かる） */
export interface Vault {
  put(ref: string, s: StoredSecret): Promise<void>;
  get(ref: string): Promise<StoredSecret | null>;
  revoke(ref: string): Promise<boolean>;
  revokeTenant(tenantId: string): Promise<number>;
}
export class MemoryVault implements Vault {
  private readonly m = new Map<string, StoredSecret>();
  async put(ref: string, s: StoredSecret) {
    this.m.set(ref, s);
  }
  async get(ref: string) {
    return this.m.get(ref) ?? null;
  }
  async revoke(ref: string) {
    const s = this.m.get(ref);
    if (!s || s.revokedAt) return false;
    s.revokedAt = new Date().toISOString();
    return true;
  }
  async revokeTenant(t: string) {
    let n = 0;
    for (const s of this.m.values())
      if (s.tenantId === t && !s.revokedAt) {
        s.revokedAt = new Date().toISOString();
        n++;
      }
    return n;
  }
}
export type Outcome =
  | { status: "done"; value: string; auditId?: string }
  | { status: "denied" | "failed"; reason: string; handoff: string; auditId?: string };

/** ログ・スクリーンショット向け：先頭 2 文字だけ残して隠す */
export function mask(value: string): string {
  if (!value) return "";
  return value.length <= 4
    ? "*".repeat(value.length)
    : value.slice(0, 2) + "*".repeat(Math.min(value.length - 2, 12)) + "…";
}

export class SecretsGateway {
  constructor(
    private readonly repo: Repository,
    private readonly vault: Vault,
    private readonly masterKey: Buffer,
  ) {
    if (masterKey.length < 32) throw new Error("鍵は 32 バイト以上");
  }
  /** テナントごとの鍵（HKDF で分離。マスターが 1 つでも会社をまたいで復号できない） */
  private keyFor(tenantId: string): Buffer {
    return Buffer.from(hkdfSync("sha256", this.masterKey, Buffer.from(tenantId), Buffer.from("kaname.secrets.v1"), 32));
  }
  /** 預ける：平文は関門の中でだけ扱い、返すのは参照 ID */
  async store(
    ctx: TenantContext,
    kind: string,
    plaintext: string,
  ): Promise<{ status: "done"; value: SecretRef; auditId?: string } | Outcome> {
    if (!ctx.tenantId || !ctx.userId) return { status: "denied", reason: "文脈が無い", handoff: "ログインし直す" };
    const ref = `sec_${uuidv7()}`;
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.keyFor(ctx.tenantId), iv);
    const data = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
    await this.vault.put(ref, {
      tenantId: ctx.tenantId,
      iv: iv.toString("base64"),
      tag: c.getAuthTag().toString("base64"),
      data: data.toString("base64"),
      kind,
      revokedAt: null,
    });
    const auditId = await this.repo.audit(ctx, "secret.store", "secret", ref, "C8", { kind, length: plaintext.length }); // 値は書かない
    return { status: "done", value: { ref }, auditId };
  }
  /** 取り出す：実行器（Bridge の入力器）だけが呼ぶ。AI の文脈（role が ai）は拒否 */
  async resolve(ref: string, ctx: TenantContext & { caller?: "executor" | "ai" | "screen" }): Promise<Outcome> {
    if (!ctx.tenantId) return { status: "denied", reason: "文脈が無い", handoff: "ログインし直す" };
    if (ctx.caller && ctx.caller !== "executor")
      return this.finish(ctx, ref, {
        status: "denied",
        reason: "AI や画面には秘密の実体を渡さない（参照 ID だけ）",
        handoff: "実行器から呼ぶ",
      });
    const s = await this.vault.get(ref);
    if (!s || s.tenantId !== ctx.tenantId)
      return this.finish(ctx, ref, { status: "denied", reason: "この参照は見られない", handoff: "預け直す" });
    if (s.revokedAt)
      return this.finish(ctx, ref, {
        status: "denied",
        reason: "アカウントの状態が変わったので、ログインし直してください（失効済み）",
        handoff: "預け直す",
      });
    try {
      const d = createDecipheriv("aes-256-gcm", this.keyFor(ctx.tenantId), Buffer.from(s.iv, "base64"));
      d.setAuthTag(Buffer.from(s.tag, "base64"));
      const value = Buffer.concat([d.update(Buffer.from(s.data, "base64")), d.final()]).toString("utf8");
      return this.finish(ctx, ref, { status: "done", value });
    } catch {
      return this.finish(ctx, ref, {
        status: "failed",
        reason: "預かった情報が読めません。安全のため、もう一度預け直してください",
        handoff: "預け直す",
      });
    }
  }
  /** 失効（退会・停止・権限変更・鍵の失効）：即時 */
  async revoke(ctx: TenantContext, ref: string): Promise<boolean> {
    const s = await this.vault.get(ref);
    if (!s || s.tenantId !== ctx.tenantId) return false;
    const ok = await this.vault.revoke(ref);
    await this.repo.audit(ctx, "secret.revoke", "secret", ref, "C8", { ok });
    return ok;
  }
  async revokeAll(ctx: TenantContext): Promise<number> {
    if (!ctx.tenantId) return 0;
    const n = await this.vault.revokeTenant(ctx.tenantId);
    await this.repo.audit(ctx, "secret.revoke_all", "secret", null, "C8", { count: n });
    return n;
  }
  private async finish(ctx: TenantContext, ref: string, o: Outcome): Promise<Outcome> {
    o.auditId = await this.repo.audit(
      ctx,
      `secret.${o.status === "done" ? "resolve" : o.status}`,
      "secret",
      ref,
      "C8",
      { reason: "reason" in o ? o.reason : null },
    ); // 値は書かない
    return o;
  }
}
