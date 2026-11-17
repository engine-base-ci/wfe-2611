// K-313「再設定のメールを頼む口」の単体の試験（口・本物の DB・本物の Better Auth）。テストの名前の頭の行 ID（K313-API-…）は 11_tickets/K-313.md の表と 1 対 1。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。
//
// 組み立ては本番と同じ bootApi（apps/api/src/server.ts）。外に出るものは関門の差し込み口だけを差し替える（K-51・K-52 と同じ）:
//   ・mail          … 関門 C6 の送出先。届いたメールを全部ここに貯める。遅らせる・断るを試験ごとに決められる
//   ・outboundFetch … 関門 C1。この口は外に出ないので、呼ばれたら落とす
// 試験が決める口の形（契約の口 requestPasswordReset・POST /api/v1/auth/password/forgot・誰でも呼べる）:
//   要求の体 { email: string }
//   201 { data: { accepted: true } } … 登録の有無・送れたか・60 秒の内か に関わらず同じ（D-042）。送るのは背景で、答えは待たない
//   422 VALIDATION_ERROR（欄 email・E-VAL-004）／429 retry_after_sec
// 試験が決める実装の形:
//   apps/api/src/features/F1/password-reset/index.ts が resetWorkIdle() を出す（それまでに始めた背景の仕事が全部終わったら解ける）。
//     「送らなかった」を決めた秒数で待たずに確かめるため
//   DB の関数 app.record_security_event_for_auth_user（このチケットの migration）が、その人の全部のワークスペースに security_events を 1 行ずつ書く
// 時刻は眠らずに、DB の行の時刻を DB の now() からずらして進める（D-128.130）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import pg from "pg";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { mailTag, signUp } from "@kaname/auth/signup";
import { putPending } from "@kaname/auth/pending";
import { createPool } from "@kaname/db/pool";
import { CATALOG } from "@kaname/errors";
import type { Config } from "@kaname/config";
import type { MailLike } from "@kaname/notify";
import { bootApi, type BootOptions } from "../../../src/server.js";
import { resetWorkIdle } from "../../../src/features/F1/password-reset/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const DB_PKG = join(ROOT, "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const OPS_EMAIL = "ops-k313@example.com";
const RUN = `k313-${Date.now().toString(36)}`; // この回が作るものの印（終わったら消す・G-10）
const PW = "correct-horse-battery-1";
const FORGOT = "/api/v1/auth/password/forgot";
const WEB = "http://127.0.0.1:3123";
const SUBJECT = "Kaname のパスワードを再設定する";

type Seams = BootOptions & { mail: MailLike; outboundFetch: typeof fetch };

// ---- 関門 C6 の偽の送出先（遅らせる・断るを試験ごとに決める） ----
interface SentMail {
  to: string;
  subject: string;
  text: string;
}
const mails: SentMail[] = [];
const mailDelayMs = { v: 0 };
const failMailTo = new Set<string>();
const fakeMail: MailLike = {
  send: async (m) => {
    if (mailDelayMs.v > 0) await new Promise((r) => setTimeout(r, mailDelayMs.v));
    if (failMailTo.has(m.to)) return { error: { message: "daily quota exceeded" } };
    mails.push({ to: m.to, subject: m.subject, text: m.text });
    return { error: null };
  },
};
const fakeFetch: typeof fetch = async (input) => {
  throw new Error(`K-313 の口は外に出ない: ${String(input)}`);
};
const resetMailsTo = (e: string) => mails.filter((m) => m.to === e && m.subject === SUBJECT);
const tokenOf = (m: SentMail) => {
  const u = /https?:\/\/\S+\/password-reset\?token=([^\s&]+)/.exec(m.text);
  if (!u) throw new Error(`再設定のリンクが本文に無い: ${m.text}`);
  return decodeURIComponent(u[1]!);
};

const config = {
  env: "test",
  databaseUrl: APP_URL,
  authDatabaseUrl: AUTH_URL,
  authSecret: "test-secret-k313-0123456789-abcdefghij",
  baseUrl: "http://127.0.0.1:3001",
  webBaseUrl: WEB,
  webOrigins: [],
  storage: {
    endpoint: "http://127.0.0.1:9000",
    region: "ap-northeast-1",
    bucket: "kaname-dev",
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    forcePathStyle: true,
  },
  secretsMasterKey: Buffer.alloc(32, 7).toString("base64"),
  resendApiKey: null,
  mailFrom: "Kaname <noreply@example.com>",
  opsEmail: OPS_EMAIL,
  mailReplyTo: OPS_EMAIL,
  operator: { service: "Kaname", company: "試験", representative: "試験", email: OPS_EMAIL, phone: "", address: null },
  mailSuppressPrefix: "",
  bridgeReleaseBase: "",
  bridgeReleaseDir: "",
  infisical: null,
  listenDatabaseUrl: null,
  port: 0,
} as Config;

let app: Awaited<ReturnType<typeof bootApi>>;
let admin: pg.Pool;
let fixturePool: pg.Pool;
let authFixture: ReturnType<typeof createAuth>;
let ipSeq = 0;
const nextIp = () => `198.51.100.${(ipSeq = (ipSeq % 250) + 1)}`;
const email = (tag: string) => `${RUN}-${tag}@example.com`;
const forgot = (body: unknown, ip = nextIp(), extra: Record<string, string> = {}) =>
  app.app.request(`http://localhost${FORGOT}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...extra },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { data?: Record<string, unknown> };
const msg = (code: string) => CATALOG[code]?.message ?? `（errors.json に ${code} が無い）`;

/** 確定した本人を作る（会社も 1 つできる）。本人の id を返す */
const registered = async (tag: string) => {
  const r = await signUp(authFixture.auth, {
    email: email(tag),
    password: PW,
    name: "再設定 太郎",
    companyName: `${RUN} 社`,
  });
  await admin.query('update kaname_auth."user" set "emailVerified" = true where id = $1', [r.userId]);
  return r.userId;
};
/** 同じ人を 2 つめのワークスペースにも入れる（同じログインの人・D-125.150）。members.auth_user_id は一意なので、
 *  2 社目の人の行は所属の行（tenant_memberships.auth_user_id）でログインに結ぶ（0089 の引き方と同じ） */
const alsoInAnother = async (userId: string) => {
  const t = (
    await admin.query<{ id: string }>(
      "insert into tenants (id, tenant_id, name) select u, u, $1 from gen_random_uuid() u returning id",
      [`${RUN} 2 社目`],
    )
  ).rows[0]!.id;
  const s = (
    await admin.query<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, $2, '') returning id",
      [t, "全体"],
    )
  ).rows[0]!.id;
  const m = (
    await admin.query<{ id: string }>(
      "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'human', '再設定 太郎') returning id",
      [t, s],
    )
  ).rows[0]!.id;
  await admin.query(
    "insert into tenant_memberships (tenant_id, member_id, auth_user_id, role, status) values ($1, $2, $3, 'member', 'active')",
    [t, m, userId],
  );
  return t;
};
/** 手がかりの DB の形（K-313 の決め：頭を残した sha256 の base64url） */
const keyOf = (token: string) => createHash("sha256").update(token, "utf8").digest("base64url");
/** 出したリンクの印（reset-password-seen:・24 時間） */
const seenRows = async (userId: string) =>
  (
    await admin.query<{ identifier: string; left_sec: number }>(
      `select identifier, extract(epoch from "expiresAt" - now())::int as left_sec from kaname_auth.verification where value = $1 and identifier like 'reset-password-seen:%'`,
      [userId],
    )
  ).rows;
const resetRows = async (userId: string) =>
  (
    await admin.query<{ identifier: string; value: string; expires_at: Date; created_at: Date; left_sec: number }>(
      `select identifier, value, "expiresAt" as expires_at, "createdAt" as created_at, extract(epoch from "expiresAt" - now())::int as left_sec from kaname_auth.verification where value = $1 and identifier like 'reset-password:%'`,
      [userId],
    )
  ).rows;
const events = async (userId: string, kind = "password_reset_requested") =>
  (
    await admin.query<{ tenant_id: string; detail: Record<string, unknown> }>(
      `select e.tenant_id, e.detail from security_events e join members m on m.id = e.member_id
        where (m.auth_user_id = $1 or exists (select 1 from tenant_memberships tm where tm.member_id = m.id and tm.auth_user_id = $1))
          and e.kind_id = $2`,
      [userId, kind],
    )
  ).rows;
/** console の全部の出口を見張る（何を出したかを文字で返す） */
const watchConsole = () => {
  const spies = (["log", "warn", "error", "info"] as const).map((k) =>
    vi.spyOn(console, k).mockImplementation(() => undefined),
  );
  return {
    text: () => spies.flatMap((s) => s.mock.calls.map((a) => a.map(String).join(" "))).join("\n"),
    restore: () => spies.forEach((s) => s.mockRestore()),
  };
};

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 3 });
  const seams: Seams = { bucketExists: async () => true, mail: fakeMail, outboundFetch: fakeFetch };
  app = await bootApi(config, seams);
  fixturePool = createPool({ databaseUrl: APP_URL, max: 2 });
  authFixture = createAuth({
    authDatabaseUrl: AUTH_URL,
    appPool: fixturePool,
    secret: config.authSecret,
    baseURL: config.baseUrl,
  });
}, 60_000);

afterAll(async () => {
  await admin?.query("delete from kaname_auth.pending_signup where email like $1", [`${RUN}-%`]);
  await app?.close();
  await authFixture?.pool.end();
  await fixturePool?.end();
  await admin?.end();
});

describe("K-313 再設定のメールを頼む：登録の状態 × 頼み方", () => {
  it("K313-API-001 登録済みの人が頼む：201・accepted。答えの後に 1 通（本人宛て・件名・リンクと 30 分）。リンクの行が 1 つ（30 分・頭を残したハッシュ）と印の行が 1 つ（24 時間）", async () => {
    const e = email("ok");
    const uid = await registered("ok");
    const r = await forgot({ email: e });
    expect(r.status).toBe(201);
    expect(await json(r)).toEqual({ data: { accepted: true } });
    await resetWorkIdle();
    const got = resetMailsTo(e);
    expect(got).toHaveLength(1);
    expect(got[0]!.text).toContain(`${WEB}/password-reset?token=`);
    expect(got[0]!.text).toContain("30 分");
    expect(tokenOf(got[0]!).length).toBeGreaterThan(10);
    const rows = await resetRows(uid);
    expect(rows).toHaveLength(1);
    expect(Math.abs(rows[0]!.left_sec - 1800), "期限は DB の now() から 30 分").toBeLessThanOrEqual(5);
    const key = keyOf(tokenOf(got[0]!));
    expect(rows[0]!.identifier).toBe(`reset-password:${key}`);
    const seen = await seenRows(uid);
    expect(seen.map((x) => x.identifier)).toEqual([`reset-password-seen:${key}`]);
    expect(Math.abs(seen[0]!.left_sec - 86_400), "印は 24 時間").toBeLessThanOrEqual(5);
  });

  it("K313-API-002 登録していないメール：同じ 201 と体。メールも verification の行も security_events も残さない", async () => {
    const e = email("nobody");
    const r = await forgot({ email: e });
    expect(r.status).toBe(201);
    expect(await json(r)).toEqual({ data: { accepted: true } });
    await resetWorkIdle();
    expect(mails.filter((m) => m.to === e)).toHaveLength(0);
    const v = await admin.query("select 1 from kaname_auth.verification where value = $1 or identifier like $2", [
      e,
      `%${e}%`,
    ]);
    expect(v.rowCount).toBe(0);
    const ev = await admin.query("select 1 from security_events where detail::text like $1", [`%${e}%`]);
    expect(ev.rowCount).toBe(0);
  });

  it("K313-API-003 確認していない申し込みだけの人：同じ 201 と体。再設定のメールは送らず、本人も作らない", async () => {
    const e = email("pending");
    await putPending(authFixture.pool, config.secretsMasterKey, {
      email: e,
      name: "申し込み 中",
      companyName: "申し込み社",
      password: PW,
    });
    const before = mails.length;
    const r = await forgot({ email: e });
    expect(r.status).toBe(201);
    expect(await json(r)).toEqual({ data: { accepted: true } });
    await resetWorkIdle();
    expect(mails.slice(before).filter((m) => m.to === e)).toHaveLength(0);
    expect((await admin.query('select 1 from kaname_auth."user" where email = $1', [e])).rowCount).toBe(0);
  });

  it("K313-API-004 送出先が 1.5 秒かかる：登録済みも登録していないも、答えは 800 ミリ秒未満（送るのを待たない）。登録済みの 1 通は後から届く", async () => {
    const e = email("slow");
    await registered("slow");
    mailDelayMs.v = 1500;
    try {
      const t0 = performance.now();
      const a = await forgot({ email: e });
      const t1 = performance.now();
      const b = await forgot({ email: email("slow-nobody") });
      const t2 = performance.now();
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(t1 - t0, "登録済み").toBeLessThan(800);
      expect(t2 - t1, "登録していない").toBeLessThan(800);
      await resetWorkIdle();
      expect(resetMailsTo(e)).toHaveLength(1);
    } finally {
      mailDelayMs.v = 0;
    }
  });

  it("K313-API-005 メールの大文字・前後と途中の空白・全角：正規化して同じ本人に 1 通（宛先は登録したメール）", async () => {
    const e = email("norm");
    await registered("norm");
    const wide = e.toUpperCase().replace("@", "＠").replace(/\./g, "．");
    // eslint-disable-next-line no-irregular-whitespace -- 全角の空白を意図して入れる
    const r = await forgot({ email: `　 ${wide.slice(0, 4)} ${wide.slice(4)}\t` });
    expect(r.status).toBe(201);
    await resetWorkIdle();
    expect(resetMailsTo(e)).toHaveLength(1);
  });

  it("K313-API-006 メールが空・形が違う・欄が無い：422・欄 email（空と形違いは E-VAL-004 の文）。送らない", async () => {
    const before = mails.length;
    for (const body of [{ email: "" }, { email: "abc@" }, { email: "   " }]) {
      const r = await forgot(body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      const j = await json(r);
      expect(JSON.stringify(j)).toContain("email");
      expect(JSON.stringify(j)).toContain(msg("E-VAL-004"));
    }
    const none = await forgot({});
    expect(none.status).toBe(422);
    expect(JSON.stringify(await json(none))).toContain("email");
    await resetWorkIdle();
    expect(mails.length).toBe(before);
  });

  it("K313-API-007 60 秒の内に 2 回頼む：2 回とも同じ 201。送るのは 1 通のまま。verification の行は 1 つで、1 通目のリンクの行が残る", async () => {
    const e = email("twice");
    const uid = await registered("twice");
    const a = await forgot({ email: e });
    await resetWorkIdle();
    const first = await resetRows(uid);
    const b = await forgot({ email: e });
    await resetWorkIdle();
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await json(b)).toEqual({ data: { accepted: true } });
    expect(resetMailsTo(e)).toHaveLength(1);
    const after = await resetRows(uid);
    expect(after).toHaveLength(1);
    expect(after[0]!.identifier).toBe(first[0]!.identifier);
  });

  it("K313-API-008 1 回目の行を 61 秒前にしてから 2 回目：2 通目を送る。リンクの行は 1 つ（1 通目の行は消えた）。印の行は 2 つ（1 通目の印も残る）", async () => {
    const e = email("after60");
    const uid = await registered("after60");
    await forgot({ email: e });
    await resetWorkIdle();
    const first = await resetRows(uid);
    await admin.query(
      `update kaname_auth.verification set "createdAt" = "createdAt" - interval '61 seconds', "updatedAt" = "updatedAt" - interval '61 seconds' where value = $1 and identifier like 'reset-password:%'`,
      [uid],
    );
    const r = await forgot({ email: e });
    expect(r.status).toBe(201);
    await resetWorkIdle();
    expect(resetMailsTo(e)).toHaveLength(2);
    const after = await resetRows(uid);
    expect(after).toHaveLength(1);
    expect(after[0]!.identifier).not.toBe(first[0]!.identifier);
    expect(await seenRows(uid)).toHaveLength(2);
  });
});

describe("K-313 失敗と守り", () => {
  it("K313-API-009 送出先が断る：同じ 201。ログに「送れなかった → 宛先#…」が出て「送った」は出ない・メールは出ない。記録の detail.sent は false", async () => {
    const e = email("refused");
    const uid = await registered("refused");
    failMailTo.add(e);
    const c = watchConsole();
    try {
      const r = await forgot({ email: e });
      expect(r.status).toBe(201);
      expect(await json(r)).toEqual({ data: { accepted: true } });
      await resetWorkIdle();
      const out = c.text();
      expect(out).toContain(`[mail] 送れなかった → ${mailTag(e)}`);
      expect(out).not.toContain(`[mail] 送った → ${mailTag(e)}`);
      expect(out).not.toContain(e);
    } finally {
      c.restore();
      failMailTo.delete(e);
    }
    const ev = await events(uid);
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev.every((x) => x.detail["sent"] === false)).toBe(true);
  });

  it("K313-API-010 背景で DB が落ちた（その人の verification への書き込みが失敗）：同じ 201。送らない。console.error に宛先の印・メールは出ない", async () => {
    const e = email("dbdown");
    const uid = await registered("dbdown");
    await admin.query(`create or replace function kaname_auth.k313_down() returns trigger language plpgsql as $$
      begin if new.value = '${uid}' then raise exception 'K-313 の試験：DB が落ちた'; end if; return new; end $$`);
    await admin.query(
      "create trigger k313_down before insert on kaname_auth.verification for each row execute function kaname_auth.k313_down()",
    );
    const c = watchConsole();
    try {
      const r = await forgot({ email: e });
      expect(r.status).toBe(201);
      expect(await json(r)).toEqual({ data: { accepted: true } });
      await resetWorkIdle();
      expect(resetMailsTo(e)).toHaveLength(0);
      const errs = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((a) =>
        a.map(String).join(" "),
      );
      expect(
        errs.some((l) => l.includes(mailTag(e))),
        "落ちたことを宛先の印で残す",
      ).toBe(true);
      expect(c.text()).not.toContain(e);
    } finally {
      c.restore();
      await admin.query("drop trigger if exists k313_down on kaname_auth.verification");
      await admin.query("drop function if exists kaname_auth.k313_down()");
    }
  });

  it("K313-API-011 同じ IP から 1 分に 11 回：11 回目は 429・retry_after_sec は 1〜60 の整数", async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      const r = await forgot({ email: email(`rl-${i}`) }, ip);
      expect(r.status, `${i + 1} 回目は通る`).toBe(201);
    }
    const r = await forgot({ email: email("rl-10") }, ip);
    expect(r.status).toBe(429);
    const sec = Number((await json(r))["retry_after_sec"]);
    expect(Number.isInteger(sec)).toBe(true);
    expect(sec).toBeGreaterThanOrEqual(1);
    expect(sec).toBeLessThanOrEqual(60);
    await resetWorkIdle();
  });

  it("K313-API-012 記録（関門 C2）：その人が今いる全部のワークスペース（2 社）に password_reset_requested が 1 行ずつ。detail にメールと手がかりが無い", async () => {
    const e = email("two-ws");
    const uid = await registered("two-ws");
    const second = await alsoInAnother(uid);
    await forgot({ email: e });
    await resetWorkIdle();
    const ev = await events(uid);
    const tenants = new Set(ev.map((x) => x.tenant_id));
    expect(tenants.size).toBe(2);
    expect(tenants.has(second)).toBe(true);
    expect(ev).toHaveLength(2);
    const token = tokenOf(resetMailsTo(e)[0]!);
    for (const x of ev) {
      expect(JSON.stringify(x.detail)).not.toContain(e);
      expect(JSON.stringify(x.detail)).not.toContain(token);
    }
  });

  it("K313-API-013 DB の中の手がかり：リンクの手がかり（平文）が verification の identifier・value のどこにも無い（storeIdentifier hashed）", async () => {
    const e = email("hashed");
    const uid = await registered("hashed");
    await forgot({ email: e });
    await resetWorkIdle();
    const token = tokenOf(resetMailsTo(e)[0]!);
    const hit = await admin.query(
      "select 1 from kaname_auth.verification where position($1 in identifier) > 0 or position($1 in value) > 0",
      [token],
    );
    expect(hit.rowCount).toBe(0);
    expect(await resetRows(uid)).toHaveLength(1);
  });

  it("K313-API-014 ログ（D-128.146）：送れた・送れない・送出先が無い の 3 つの道で、console にメールアドレスが出ない。宛先は「宛先#」の印", async () => {
    const ok = email("log-ok");
    const ng = email("log-ng");
    const none = email("log-none");
    await registered("log-ok");
    await registered("log-ng");
    await registered("log-none");
    failMailTo.add(ng);
    const noMail = createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool: fixturePool,
      secret: config.authSecret,
      baseURL: config.baseUrl,
      webBaseURL: WEB,
    });
    const c = watchConsole();
    try {
      await forgot({ email: ok });
      await forgot({ email: ng });
      await resetWorkIdle();
      await noMail.auth.api.requestPasswordReset({ body: { email: none } }); // 送出先が無い道（packages/auth の包み）
      const out = c.text();
      for (const e of [ok, ng, none]) expect(out, e).not.toContain(e);
      expect(out).toContain(mailTag(ok));
      expect(out).toContain(mailTag(ng));
      expect(out).toContain(mailTag(none));
    } finally {
      c.restore();
      failMailTo.delete(ng);
      await noMail.pool.end();
    }
  });

  it("K313-API-015 ログの書き方の検査（ソース）：packages/auth/src と apps/api/src/features/F1/password-reset の console の行に、メールアドレスを埋め込む形が 0 か所", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.ts$/.test(n)) files.push(p);
      }
    };
    walk(join(ROOT, "packages", "auth", "src"));
    walk(join(ROOT, "apps", "api", "src", "features", "F1", "password-reset"));
    expect(files.length).toBeGreaterThan(3);
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (
            /console\.(log|warn|error|info)/.test(line) &&
            /\$\{\s*(m\.to|email|user\.email|p\.email|to)\s*\}/.test(line)
          )
            bad.push(`${f}:${i + 1}`);
        });
    }
    expect(bad).toEqual([]);
  });

  it("K313-API-016 本文の秘密（TP-MAIL-03）：本文にパスワード・ほかの人の名前やメールが入らない。リンクは 1 つだけ", async () => {
    const e = email("body");
    await registered("body");
    const other = email("body-other");
    await registered("body-other");
    await forgot({ email: e });
    await resetWorkIdle();
    const m = resetMailsTo(e)[0]!;
    expect(m.text).not.toContain(PW);
    expect(m.text).not.toContain(other);
    expect(m.text.match(/https?:\/\/\S+\/password-reset\?token=/g)).toHaveLength(1);
  });

  it("K313-API-018 答えの頭に Server-Timing が無い：登録済み・登録していないメール のどちらも、ログインしていなくてもログイン中（Bearer）で呼んでも、201 で頭に server-timing が出ない（流した文の数で登録の有無を漏らさない・K237-API-005 から移した。ログイン中の場合が、頭を付ける条件の誤りを見つける）", async () => {
    await registered("timing");
    const me = await signUp(authFixture.auth, {
      email: email("timing-me"),
      password: PW,
      name: "再設定 花子",
      companyName: `${RUN} 社`,
    });
    await admin.query('update kaname_auth."user" set "emailVerified" = true where id = $1', [me.userId]);
    expect(me.token).toBeTruthy();
    const seen: string[] = [];
    for (const bearer of [false, true])
      for (const who of [email("timing"), email("timing-none")]) {
        const r = await forgot({ email: who }, nextIp(), bearer ? { authorization: `Bearer ${me.token}` } : {});
        expect(r.status, await r.clone().text()).toBe(201);
        seen.push(`${who}${bearer ? "（ログイン中）" : ""}：${r.headers.get("server-timing")}`);
      }
    await resetWorkIdle();
    expect(
      seen.filter((x) => !x.endsWith("：null")),
      seen.join("\n"),
    ).toEqual([]);
  });

  it("K313-API-017 抜けた会社（所属 left）と今の会社がある人が頼む：記録 password_reset_requested は今の会社に 1 行だけ。抜けた会社には 0 行", async () => {
    const e = email("left-ws");
    const uid = await registered("left-ws");
    const leftWs = await alsoInAnother(uid);
    await admin.query("update tenant_memberships set status = 'left' where tenant_id = $1 and auth_user_id = $2", [
      leftWs,
      uid,
    ]);
    await forgot({ email: e });
    await resetWorkIdle();
    const ev = await events(uid);
    expect(ev).toHaveLength(1);
    expect(ev.some((x) => x.tenant_id === leftWs)).toBe(false);
  });
});
