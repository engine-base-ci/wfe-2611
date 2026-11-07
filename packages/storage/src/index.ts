// 関門 C4 ファイル／オブジェクト：objectStore.<op>(ref, ctx) だけ。fs／S3 SDK はこのパッケージの外では使えない（CI G19。Bridge の作業フォルダは例外 X-001）。
// 関門の中で 1 回だけ：権限（テナント・スコープ）→ サイズ・形式（何でも受け取る・D-029。上限だけ）→ 保持期間 → 署名 URL の発行と検証 → 証跡。
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { uuidv7 } from "@kaname/db/id";

export interface ObjectMeta {
  size: number;
  contentType: string;
  expiresAt?: Date | null; // 保持期間（無ければ残す）
}
/** 実体の置き場（S3 互換／ローカル）。ドライバは関門の中だけで使う */
export interface StorageDriver {
  put(key: string, body: Uint8Array, meta: ObjectMeta): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; meta: ObjectMeta } | null>;
  delete(key: string): Promise<boolean>;
}
export interface StoreOptions {
  maxBytes?: number; // 既定 50MB（E-LIM-002）
  signingSecret: string;
  defaultRetentionDays?: number | null;
}
export type Outcome<T> =
  | { status: "done"; value: T; auditId?: string | undefined }
  | { status: "denied" | "failed"; reason: string; handoff: string; auditId?: string | undefined };
export const MAX_BYTES_DEFAULT = 50 * 1024 * 1024;
/** 外の置き場の署名 URL の既定の期限（5 分・D-128.153） */
export const EXTERNAL_TTL_SEC = 300;
const EXTERNAL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/** 参照は必ずテナントの名前空間の中（tenants/<tenant_id>/<uuid>）。文字列連結で他社の鍵を作れない */
export function refOf(tenantId: string, id: string): string {
  return `tenants/${tenantId}/${id}`;
}
const REF = /^tenants\/([0-9a-f-]{36})\/([0-9a-z-]+)$/i;

export class ObjectStore {
  constructor(
    private readonly repo: Repository,
    private readonly driver: StorageDriver,
    private readonly o: StoreOptions,
  ) {}
  private allowed(ref: string, ctx: TenantContext): boolean {
    const m = REF.exec(ref);
    return !!m && !!ctx.tenantId && m[1] === ctx.tenantId;
  }
  private async audit(
    ctx: TenantContext,
    action: string,
    ref: string | null,
    payload: Record<string, unknown> = {},
  ): Promise<string | undefined> {
    return ctx.tenantId ? this.repo.audit(ctx, `object.${action}`, "object", ref, "C4", payload) : undefined;
  }

  async put(
    ctx: TenantContext,
    body: Uint8Array,
    meta: { contentType?: string; retentionDays?: number | null },
  ): Promise<Outcome<{ ref: string; size: number }>> {
    if (!ctx.tenantId) return { status: "denied", reason: "文脈が無い", handoff: "ログインし直す" };
    const max = this.o.maxBytes ?? MAX_BYTES_DEFAULT;
    if (body.byteLength > max)
      return {
        status: "denied",
        reason: `このファイルは大きすぎます（${Math.round(max / 1024 / 1024)}MB まで）。分けるか、圧縮してください`,
        handoff: "分けるか圧縮して上げ直す",
        auditId: await this.audit(ctx, "denied", null, { size: body.byteLength, reason: "too_large" }),
      };
    const ref = refOf(ctx.tenantId, uuidv7());
    const days = meta.retentionDays === undefined ? (this.o.defaultRetentionDays ?? null) : meta.retentionDays;
    const m: ObjectMeta = {
      size: body.byteLength,
      contentType: meta.contentType ?? "application/octet-stream",
      expiresAt: days ? new Date(Date.now() + days * 86400e3) : null,
    };
    try {
      await this.driver.put(ref, body, m);
    } catch (e) {
      return {
        status: "failed",
        reason: "保存先に書けませんでした",
        handoff: "少し待ってやり直す。続くなら運営に問い合わせる",
        auditId: await this.audit(ctx, "failed", ref, { reason: String(e) }),
      };
    }
    return {
      status: "done",
      value: { ref, size: m.size },
      auditId: await this.audit(ctx, "put", ref, { size: m.size, contentType: m.contentType, expiresAt: m.expiresAt }),
    };
  }

  async get(ctx: TenantContext, ref: string): Promise<Outcome<{ body: Uint8Array; meta: ObjectMeta }>> {
    if (!this.allowed(ref, ctx))
      return {
        status: "denied",
        reason: "このファイルは見られません",
        handoff: "共有した人に頼む",
        auditId: await this.audit(ctx, "denied", ref, { reason: "cross_tenant_or_bad_ref" }),
      };
    const r = await this.driver.get(ref);
    if (!r) return { status: "failed", reason: "ファイルが無い（消えたか、保持期間を過ぎた）", handoff: "上げ直す" };
    if (r.meta.expiresAt && r.meta.expiresAt.getTime() < Date.now())
      return {
        status: "failed",
        reason: "保持期間を過ぎています",
        handoff: "上げ直す",
        auditId: await this.audit(ctx, "expired", ref),
      };
    await this.audit(ctx, "get", ref, { size: r.meta.size });
    return { status: "done", value: r };
  }

  async delete(ctx: TenantContext, ref: string): Promise<Outcome<boolean>> {
    if (!this.allowed(ref, ctx))
      return {
        status: "denied",
        reason: "このファイルは消せません",
        handoff: "権限のある人に頼む",
        auditId: await this.audit(ctx, "denied", ref, { reason: "cross_tenant_or_bad_ref" }),
      };
    const ok = await this.driver.delete(ref);
    return { status: "done", value: ok, auditId: await this.audit(ctx, "delete", ref, { ok }) };
  }

  /** 署名 URL：期限つき。誰に出したかを証跡に残す。検証は verifySigned */
  async signUrl(ctx: TenantContext, ref: string, ttlSeconds = 600): Promise<Outcome<{ url: string; expiresAt: Date }>> {
    if (!this.allowed(ref, ctx))
      return {
        status: "denied",
        reason: "このファイルは共有できません",
        handoff: "権限のある人に頼む",
        auditId: await this.audit(ctx, "denied", ref, { reason: "cross_tenant_or_bad_ref" }),
      };
    const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 10), 86400);
    const sig = this.sign(ref, exp);
    const url = `/files/${encodeURIComponent(ref)}?exp=${exp}&sig=${sig}`;
    return {
      status: "done",
      value: { url, expiresAt: new Date(exp * 1000) },
      auditId: await this.audit(ctx, "sign", ref, { exp }),
    };
  }
  /** 外の置き場（運営の配布物・BRIDGE_RELEASE_BASE）のファイルへの短い期限の署名 URL（D-128.153）。
   *  名前は目録に載ったものだけを呼び手が渡す（英数と . _ - だけ）。誰に出したかを証跡に残す */
  async signExternal(
    ctx: TenantContext,
    base: string,
    name: string,
    ttlSeconds = EXTERNAL_TTL_SEC,
  ): Promise<Outcome<{ url: string; expiresAt: Date }>> {
    if (!base || !EXTERNAL_NAME.test(name) || name.includes(".."))
      return { status: "denied", reason: "このファイルは渡せません", handoff: "運営に問い合わせる" };
    const exp = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttlSeconds, 10), 3600);
    const key = `external:${base.replace(/\/$/, "")}/${name}`;
    const url = `${base.replace(/\/$/, "")}/${encodeURIComponent(name)}?exp=${exp}&sig=${this.sign(key, exp)}`;
    return {
      status: "done",
      value: { url, expiresAt: new Date(exp * 1000) },
      auditId: await this.audit(ctx, "sign_external", null, { name, exp }),
    };
  }
  private sign(ref: string, exp: number): string {
    return createHmac("sha256", this.o.signingSecret).update(`${ref}\n${exp}`).digest("base64url");
  }
  /** 署名の検証（URL を受け取った側＝ダウンロードの入口） */
  verifySigned(ref: string, exp: number, sig: string, now = Date.now()): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < now) return false;
    const want = Buffer.from(this.sign(ref, exp));
    const got = Buffer.from(sig);
    return want.length === got.length && timingSafeEqual(want, got);
  }
}

export { s3Client, s3Driver, ensureBucket, type S3Settings, type S3Like } from "./s3.js";
