// 自分のAI の会話は本人の PC の Claude Code の記録が正本（D-112）。Bridge が文を記録と同じ id で写す口を本物の Postgres で通す。
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "@kaname/db/migrate";
import { migrateAuth } from "@kaname/auth/migrate";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { MemoryVault, SecretsGateway } from "@kaname/secrets";
import { ObjectStore } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, { method, headers: { "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = createAuth({
    authDatabaseUrl: AUTH_URL, appPool, secret: "test-secret-0123456789-abcdefghijklmnop",
    baseURL: "http://localhost:3001", webBaseURL: "http://localhost:3123", mailer: async () => undefined,
  });
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), { signingSecret: "test-files", maxBytes: 1024 * 1024 });
  app = createApp({
    repo, auth, resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth, appPool, authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }), repo, secrets, objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: { secretsMasterKey: "test-master", baseUrl: "http://localhost:3001", webBaseUrl: "http://localhost:3123", opsEmail: "ops@example.com", env: "test" as const },
    }),
  });
}, 60_000);

/** 登録（確認メールを通す）→ Bridge をつなぐ */
async function ready() {
  const email = `${uniq()}@example.com`;
  expect((await post("/sign-up", { email, password: PW, company_name: "K" })).status).toBe(201);
  const mail = sent.filter((m) => m.to === email && m.kind === "verify").at(-1)!;
  const ver = await json<{ token: string }>(post("/verify-signup", { token: new URL(mail.url).searchParams.get("token") }));
  const H = { authorization: `Bearer ${ver.token}` };
  const pair = await json<{ code: string }>(post("/bridge/pair", {}, H));
  const claim = await json<{ session_id: string }>(post("/bridge/claim", { code: pair.code, device_label: "QA の PC" }));
  const B = { "x-bridge-session": claim.session_id };
  const member = (await admin.query("select member_id from sessions where id = $1", [claim.session_id])).rows[0].member_id as string;
  return { H, B, member };
}

const U = (n: number) => `5d984925-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Msg = { who: string; text: string; work: { ops: number; ms: number } | null };
async function running() {
  const r = await ready();
  const a = await json<{ job_id: string; conversation_id: string }>(post("/agent/say", { text: "会社のことを聞いて" }, r.H));
  await post("/bridge/take", { protocol: 4 }, r.B);
  const msgs = async () =>
    (await json<{ messages: Msg[] }>(req("GET", `/agent/state?conversation_id=${a.conversation_id}`, undefined, r.H))).messages.filter((m) => m.who === "ai");
  return { ...r, a, msgs };
}

describe("自分のAI の文を記録と同じ id で写す（D-112）", () => {
  it("CHT-31-001 流れながら写した文は吹き出しになり、仕事の結末で答えを重ねて足さない。作業の記録は最後の文に付く", async () => {
    const { B, a, msgs } = await running();
    const e1 = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(1), text: "まず今のたたき台を確認します。" }] }, B));
    expect(e1.inserted).toBe(1);
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(2), text: "たたき台を置きました。" }] }, B);
    expect((await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "たたき台を置きました。" }, B)).status).toBe(200);
    const m = await msgs();
    expect(m.map((x) => x.text)).toEqual(["まず今のたたき台を確認します。", "たたき台を置きました。"]);
    expect(m[0]!.work).toBeNull();
    expect(m[1]!.work).toMatchObject({ ops: 0 });
  });
  it("CHT-31-003 同じ id の文は二度入らない（流れながら送った文を、記録から取り戻しても重ならない）", async () => {
    const { B, a, msgs } = await running();
    const one = { uuid: U(3), text: "わかりました。", at: "2026-09-28T08:07:57.000Z" };
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [one] }, B);
    const again = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: a.conversation_id, entries: [one, { uuid: U(4), text: "漏れていた文" }] }, B));
    expect(again.inserted).toBe(1);
    expect((await msgs()).map((x) => x.text)).toEqual(["わかりました。", "漏れていた文"]);
  });
  it("CHT-31-003 途中で止まった仕事の文も、記録から取り戻せば会話に出る（取り戻す先に会話と session が並ぶ）", async () => {
    const { B, a, msgs } = await running();
    await post("/bridge/progress", { job_id: a.job_id, seq: 1, kind: "init", agent_session_id: "386d5cb2-fc77-4cb1-a91f-6ecb032a2a57" }, B);
    await post("/bridge/take", { protocol: 4, idle: true }, B); // Bridge が止まって戻ってきた → 仕事は止まる
    const t = await json<{ conversation_id: string; agent_session_id: string }[]>(post("/bridge/mirror-targets", {}, B));
    expect(t).toContainEqual({ conversation_id: a.conversation_id, agent_session_id: "386d5cb2-fc77-4cb1-a91f-6ecb032a2a57" });
    await post("/bridge/entries", { conversation_id: a.conversation_id, entries: [{ uuid: U(5), text: "わかりました。カードで 4 問うかがいます。", at: "2026-09-28T08:07:57.000Z" }] }, B);
    expect((await msgs()).map((x) => x.text)).toContain("わかりました。カードで 4 問うかがいます。");
  });
  it("CHT-31-004 別の人の会話には写せない。id の形が違う・空の文は入れない", async () => {
    const mine = await running();
    const other = await running();
    const r = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: other.a.conversation_id, entries: [{ uuid: U(6), text: "乗っ取り" }] }, mine.B));
    expect(r.inserted).toBe(0);
    const bad = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: mine.a.conversation_id, entries: [{ uuid: "../x", text: "a" }, { uuid: U(7), text: "  " }] }, mine.B));
    expect(bad.inserted).toBe(0);
    expect((await other.msgs()).map((x) => x.text)).not.toContain("乗っ取り");
  });
  it("CHT-31-003 写す前からある答え（id を持たない）と同じ文は、重ねずにその吹き出しに id を付ける（履歴を二重にしない）", async () => {
    const { B, a, msgs } = await running();
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "前の Bridge の答え" }, B); // id を持たない答え
    const r = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: a.conversation_id, entries: [{ uuid: U(8), text: "途中の文" }, { uuid: U(9), text: "前の Bridge の答え" }] }, B));
    expect(r.inserted).toBe(1);
    expect((await msgs()).map((x) => x.text).sort()).toEqual(["前の Bridge の答え", "途中の文"]);
    const again = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: a.conversation_id, entries: [{ uuid: U(9), text: "前の Bridge の答え" }] }, B));
    expect(again.inserted).toBe(0);
  });
  it("CHT-31-005 古い Bridge（文を写さない）は、今までどおり結末で答えが 1 つ入る", async () => {
    const { B, a, msgs } = await running();
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "古い Bridge の答え" }, B);
    expect((await msgs()).map((x) => x.text)).toEqual(["古い Bridge の答え"]);
  });
});
describe("同じ返答の文は 1 つの吹き出しに（D-115）", () => {
  it("CHT-35-002 同じ id で、前の文の続きになった文が届いたら、吹き出しの中身をその続きに書き換える（新しい吹き出しを足さない）", async () => {
    const { B, a, msgs } = await running();
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(21), text: "いい形です。" }] }, B);
    const r = await json<{ inserted: number }>(post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(21), text: "いい形です。\n\nそこに寄せますね。" }] }, B));
    expect(r.inserted).toBe(1);
    expect((await msgs()).map((x) => x.text)).toEqual(["いい形です。\n\nそこに寄せますね。"]);
  });
  it("CHT-35-002 同じ id でも、短い文・前の文から始まらない文では上書きしない（写しを壊さない）", async () => {
    const { B, a, msgs } = await running();
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(22), text: "いい形です。そこに寄せますね。" }] }, B);
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(22), text: "いい形です。" }] }, B);
    await post("/bridge/entries", { conversation_id: a.conversation_id, job_id: a.job_id, entries: [{ uuid: U(22), text: "まったく別の、もっと長い文がここに入ってきた場合" }] }, B);
    expect((await msgs()).map((x) => x.text)).toEqual(["いい形です。そこに寄せますね。"]);
  });
});

describe("はじめの設定の聞き取り（D-114）", () => {
  it("CHT-34-004 はじめの設定から言ったときだけ、自分のAI への依頼に「聞かずに覚える」の 1 行が添えられる（会話の吹き出しには出ない）", async () => {
    const r = await ready();
    const onb = await json<{ job_id: string }>(post("/agent/say", { text: "受託開発です", context: { screen: "onboard-interview", screen_name: "はじめの設定：会社のことを話す" } }, r.H));
    const p1 = (await admin.query("select prompt from bridge_jobs where id = $1", [onb.job_id])).rows[0].prompt as string;
    expect(p1).toContain("はじめの設定の聞き取り中です");
    expect(p1).toContain("本人に聞かずに");
    const other = await json<{ job_id: string }>(post("/agent/say", { text: "今日の予定は？", context: { screen: "clone-chat", screen_name: "自分のAIと話す" } }, r.H));
    const p2 = (await admin.query("select prompt from bridge_jobs where id = $1", [other.job_id])).rows[0].prompt as string;
    expect(p2).not.toContain("はじめの設定の聞き取り中です");
  });
});

describe("区切りに間に合わなかった一言を捨てない（D-112）", () => {
  it("CHT-31-006 仕事が区切りの一言を取りに行った後、結末の前に届いた一言は、送ったときのモードで次の仕事として並ぶ。本人が止めた仕事では並べない", async () => {
    const { H, B, a } = await running();
    await json(post("/bridge/steers", { job_id: a.job_id, reply: "" }, B)); // 区切りの一言を取りに行った（まだ無い）
    expect((await post("/agent/steer", { job_id: a.job_id, text: "全部やって", permission_mode: "bypassPermissions" }, H)).status).toBe(201);
    await post("/bridge/finish", { job_id: a.job_id, state: "done", result: "済" }, B);
    const jobs = await admin.query("select prompt, state_id, permission_mode from bridge_jobs where conversation_id = $1 order by created_at", [a.conversation_id]);
    expect(jobs.rows.map((r) => [r.state_id, r.permission_mode])).toEqual([["done", "manual"], ["queued", "bypassPermissions"]]);
    expect(jobs.rows[1].prompt).toContain("全部やって");
    // 本人が止めた仕事では並べない
    const b2 = await json<{ job_id: string }>(post("/bridge/take", { protocol: 4 }, B));
    await post("/agent/steer", { job_id: b2.job_id, text: "やっぱりこれも" }, H);
    await post("/bridge/finish", { job_id: b2.job_id, state: "stopped", reason: "あなたが止めました" }, B);
    const after = await admin.query("select count(*)::int n from bridge_jobs where conversation_id = $1", [a.conversation_id]);
    expect(after.rows[0].n).toBe(2);
  });
});
