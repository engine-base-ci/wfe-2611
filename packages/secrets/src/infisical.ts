// 資格情報の預かり先（D-101）：Infisical（クラウドの無料枠）。関門 C8 の中だけで使う。
// 預けるのは SecretsGateway が会社ごとの鍵で暗号化した中身だけ（Infisical 側も平文を持たない＝二重）。
// 会社ごとに置き場（secretPath = /tenants/<会社>）を分け、読む・失効させるときも会社の置き場しか見ない。
// 宛先は設定の siteUrl だけ（関門 C1 の例外 X-005：秘密の置き場への通信は C8 の中の作業）。
// API：POST /api/v1/auth/universal-auth/login → Bearer。/api/v4/secrets/{name}（GET・POST・PATCH）／GET /api/v4/secrets（一覧）
// 上限（D-102.4・公式 2026-09-27）：無料は秘密の操作が毎分 120 回。当たると 429「… try again in 42 seconds」。
// 8 割（毎分 96 回）に来たら onNearLimit で運営に知らせ（D-102.5）、当たったら RateLimited を投げる（預かったことにしない）。
import type { StoredSecret, Vault } from "./index.js";

/** 秘密の操作の上限に当たった（429）。待つ秒数つき（E-SEC-003） */
export class RateLimited extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Infisical の上限に当たった（${retryAfterSec} 秒待つ）`);
  }
}
/** 無料の秘密の操作の上限（毎分）と、知らせる割合 */
export const INFISICAL_FREE_SECRET_PER_MIN = 120;
export const INFISICAL_ALERT_RATIO = 0.8;

export interface InfisicalOptions {
  /** https://us.infisical.com か https://eu.infisical.com（アカウントを作った地域） */
  siteUrl: string;
  /** Machine Identity（Universal Auth）の client id／secret。値は Vercel の環境変数にだけ置く */
  clientId: string;
  clientSecret: string;
  projectId: string;
  /** 環境の slug（staging／prod） */
  environment: string;
  /** 通信（テストで差し替える） */
  http?: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
  /** 秘密の操作の上限（毎分・既定は無料の 120）。Pro にしたら 300 */
  secretPerMinute?: number;
  /** 直近 1 分の秘密の操作が上限の 8 割に来た（1 分に 1 回まで呼ぶ）。運営に知らせる */
  onNearLimit?: (u: { perMinute: number; limit: number }) => void;
}

/** 名前に使えない文字を避ける（sec_<uuidv7> の - を _ に） */
const keyOf = (ref: string): string => ref.replace(/[^A-Za-z0-9_]/g, "_");
const pathOf = (tenantId: string): string => `/tenants/${tenantId.replace(/[^A-Za-z0-9-]/g, "")}`;

export class InfisicalVault implements Vault {
  readonly durable = true;
  private token: { value: string; until: number } | null = null;
  private readonly http: (url: string, init: RequestInit) => Promise<Response>;
  private readonly now: () => number;
  private readonly calls: number[] = []; // 直近 1 分の秘密の操作の時刻
  private alertedAt = 0;
  constructor(private readonly o: InfisicalOptions) {
    if (!o.siteUrl || !o.clientId || !o.clientSecret || !o.projectId || !o.environment)
      throw new Error("Infisical の設定が足りない（INFISICAL_*）");
    this.http = o.http ?? ((url, init) => fetch(url, init));
    this.now = o.now ?? Date.now;
  }

  /** 届くか・入れるか（起動時の存在確認 G-11）。入れなければ例外 */
  async ping(): Promise<true> {
    await this.bearer();
    return true;
  }

  async put(ref: string, s: StoredSecret): Promise<void> {
    const body = {
      projectId: this.o.projectId,
      environment: this.o.environment,
      secretPath: pathOf(s.tenantId),
      secretValue: JSON.stringify(s),
      type: "shared",
    };
    let r = await this.call("POST", `/api/v4/secrets/${keyOf(ref)}`, body);
    // 初めての会社は置き場のフォルダ（/tenants/<会社>）が無く 404 になる。作ってから 1 回だけ預け直す（2026-09-29 本物で実測）
    if (r.status === 404) {
      await this.ensureFolder(s.tenantId);
      r = await this.call("POST", `/api/v4/secrets/${keyOf(ref)}`, body);
    }
    await this.ok(r, "預ける");
  }

  /** 会社ごとの置き場のフォルダを作る。既にあれば（400 already exists）そのまま使う */
  private async ensureFolder(tenantId: string): Promise<void> {
    const dir = pathOf(tenantId).split("/").pop()!;
    for (const [name, path] of [
      ["tenants", "/"],
      [dir, "/tenants"],
    ] as const) {
      // フォルダの口は projectId ではなく workspaceId を求める（本物で実測）
      const r = await this.call("POST", "/api/v1/folders", {
        workspaceId: this.o.projectId,
        environment: this.o.environment,
        name,
        path,
      });
      if (r.ok) continue;
      if (r.status === 400 && /already exists/i.test(await r.text().catch(() => ""))) continue;
      await this.ok(r, "置き場のフォルダを作る");
    }
  }

  async get(ref: string, tenantId: string): Promise<StoredSecret | null> {
    const q = new URLSearchParams({
      projectId: this.o.projectId,
      environment: this.o.environment,
      secretPath: pathOf(tenantId),
      expandSecretReferences: "false",
      includeImports: "false",
    });
    const r = await this.call("GET", `/api/v4/secrets/${keyOf(ref)}?${q}`);
    if (r.status === 404) return null;
    await this.ok(r, "読む");
    const j = (await r.json()) as { secret?: { secretValue?: string } };
    return parse(j.secret?.secretValue);
  }

  async revoke(ref: string, tenantId: string): Promise<boolean> {
    const s = await this.get(ref, tenantId);
    if (!s || s.revokedAt) return false;
    await this.write(ref, { ...s, revokedAt: new Date(this.now()).toISOString() });
    return true;
  }

  async revokeTenant(tenantId: string): Promise<number> {
    const q = new URLSearchParams({
      projectId: this.o.projectId,
      environment: this.o.environment,
      secretPath: pathOf(tenantId),
      expandSecretReferences: "false",
      includeImports: "false",
    });
    const r = await this.call("GET", `/api/v4/secrets?${q}`);
    if (r.status === 404) return 0; // その会社はまだ何も預けていない
    await this.ok(r, "一覧を読む");
    const j = (await r.json()) as { secrets?: { secretKey?: string; secretValue?: string }[] };
    let n = 0;
    for (const x of j.secrets ?? []) {
      const s = parse(x.secretValue);
      if (!s || s.revokedAt || s.tenantId !== tenantId || !x.secretKey) continue;
      await this.write(x.secretKey, { ...s, revokedAt: new Date(this.now()).toISOString() });
      n++;
    }
    return n;
  }

  private async write(ref: string, s: StoredSecret): Promise<void> {
    const r = await this.call("PATCH", `/api/v4/secrets/${keyOf(ref)}`, {
      projectId: this.o.projectId,
      environment: this.o.environment,
      secretPath: pathOf(s.tenantId),
      secretValue: JSON.stringify(s),
      type: "shared",
    });
    await this.ok(r, "書き換える");
  }

  /** 入るための鍵（期限の 60 秒前に取り直す） */
  private async bearer(): Promise<string> {
    if (this.token && this.token.until > this.now()) return this.token.value;
    const r = await this.http(`${this.o.siteUrl}/api/v1/auth/universal-auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: this.o.clientId, clientSecret: this.o.clientSecret }),
    });
    await this.ok(r, "入る");
    const j = (await r.json()) as { accessToken?: string; expiresIn?: number };
    if (!j.accessToken) throw new Error("Infisical に入れない（鍵が返らない）");
    this.token = { value: j.accessToken, until: this.now() + Math.max(0, (j.expiresIn ?? 300) - 60) * 1000 };
    return j.accessToken;
  }

  /** 直近 1 分の秘密の操作を数え、8 割に来たら知らせる（D-102.5） */
  private count(): void {
    const t = this.now();
    this.calls.push(t);
    while (this.calls.length && this.calls[0]! <= t - 60_000) this.calls.shift();
    const limit = this.o.secretPerMinute ?? INFISICAL_FREE_SECRET_PER_MIN;
    if (this.calls.length >= Math.ceil(limit * INFISICAL_ALERT_RATIO) && t - this.alertedAt >= 60_000) {
      this.alertedAt = t;
      this.o.onNearLimit?.({ perMinute: this.calls.length, limit });
    }
  }
  /** 直近 1 分の秘密の操作の数（運営の画面・テスト用） */
  perMinute(): number {
    const t = this.now();
    return this.calls.filter((x) => x > t - 60_000).length;
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    this.count();
    const send = async (): Promise<Response> =>
      this.http(`${this.o.siteUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${await this.bearer()}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const r = await send();
    if (r.status !== 401) return r;
    this.token = null; // 鍵が途中で切れた。1 回だけ入り直す
    return send();
  }

  /** 失敗は理由（状態の番号）だけを投げる。送った中身・返ってきた中身は入れない */
  private async ok(r: Response, what: string): Promise<void> {
    if (r.ok) return;
    if (r.status === 429) {
      // 「… try again in 42 seconds」から待つ秒数を取る（取れなければ 60 秒）
      const m = /(\d+)\s*seconds?/i.exec(await r.text().catch(() => ""));
      throw new RateLimited(m ? Number(m[1]) : 60);
    }
    throw new Error(`Infisical で${what}ことができない（${r.status}）`);
  }
}

function parse(v: string | undefined): StoredSecret | null {
  if (!v) return null;
  try {
    const s = JSON.parse(v) as StoredSecret;
    return s && typeof s.tenantId === "string" && typeof s.data === "string" ? s : null;
  } catch {
    return null;
  }
}
