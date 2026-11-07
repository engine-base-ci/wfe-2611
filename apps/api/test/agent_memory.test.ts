// 記憶（D-105・T-B-21・T-B-22）を本物の Postgres（RLS あり）で通す。
//   「覚えて」はその場で個人の記憶に入り、会話に「覚えました」が出る（記憶に残さない会話では入れない）
//   毎朝のまとめ：溜まった日数と会話 → 押すと Bridge に会話の無い仕事 → 答え（JSON）で 覚えた／まとめた／上げる候補／捨てた → その場で戻す・拾い直す
//   上の層へ：本人が送る → 確認者（層で承認できる人・いなければ上・最後は代表）→ OK で上の層の記憶に・食い違いは束で片方を差し戻す
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
import { agreeCurrentTerms, keepAuth, verifiedUser } from "./_pending.js";
import { createInvitation } from "@kaname/auth/invitations";
import { pairForTest, pairMemberForTest } from "./bridge_pair.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
const X = "/api/auth-ext";
const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(`http://localhost${X}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const post = (path: string, body: unknown, h: Record<string, string> = {}) => req("POST", path, body, h);
const json = async <T>(r: Response | Promise<Response>) => ((await (await r).json()) as { data: T }).data;
const uniq = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

beforeAll(async () => {
  await migrate(ADMIN, DB_PKG);
  await migrateAuth(ADMIN);
  admin = new pg.Pool({ connectionString: ADMIN, max: 2 });
  const appPool = createPool({ databaseUrl: APP_URL, max: 3 });
  const repo = await createRepository(appPool);
  const { auth } = keepAuth(
    createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3001",
      webBaseURL: "http://localhost:3123",
      mailer: async () => undefined,
    }),
  );
  const secrets = new SecretsGateway(repo, new MemoryVault(), Buffer.alloc(32, 9));
  const objects = new ObjectStore(repo, localDriver(mkdtempSync(join(tmpdir(), "kaname-obj-"))), {
    signingSecret: "test-files",
    maxBytes: 1024 * 1024,
  });
  app = createApp({
    repo,
    auth,
    resolve: createSessionResolver(auth, appPool),
    authExt: authExt({
      auth,
      appPool,
      authPool: new pg.Pool({ connectionString: AUTH_URL, max: 2 }),
      repo,
      secrets,
      objects,
      mailer: async (m) => void sent.push({ to: m.to, url: m.url, kind: m.kind }),
      config: {
        secretsMasterKey: "test-master",
        baseUrl: "http://localhost:3001",
        webBaseUrl: "http://localhost:3123",
        opsEmail: "ops@example.com",
        env: "test" as const,
      },
    }),
  });
}, 60_000);

/** 登録（確認メールを通す）→ Bridge をつなぐ */
async function ready() {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  const bp = await pairForTest(admin, email);
  const B = { "x-bridge-session": bp.token };
  const member = (await admin.query("select member_id from sessions where id = $1", [bp.sid])).rows[0]
    .member_id as string;
  return { H, B, member };
}
async function pairBridge(member: string) {
  const bp = await pairMemberForTest(admin, member);
  return { "x-bridge-session": bp.token };
}
/** 同じ会社に担当者を 1 人招く（招待を受ける → ログインの鍵） */
async function invite(bossMember: string) {
  const t = (await admin.query("select tenant_id from members where id = $1", [bossMember])).rows[0]
    .tenant_id as string;
  const repo = await createRepository(createPool({ databaseUrl: APP_URL, max: 1 }));
  const inv = await createInvitation(
    repo,
    { tenantId: t, userId: bossMember, role: "member" },
    { email: `${uniq()}@example.com`, roleId: "staff" },
  );
  const ac = await json<{ token: string; member_id: string }>(
    post(`/invitations/${inv.token}/accept`, { name: `担当 ${uniq().slice(-4)}`, password: PW }),
  );
  // 招待で入った人の同意は K-55。それまでは今の版に同意済みにする（K-53 の同意し直しの 403 で止まらないように）
  await agreeCurrentTerms(
    (await admin.query("select auth_user_id from members where id = $1", [ac.member_id])).rows[0]
      .auth_user_id as string,
  );
  const H = { authorization: `Bearer ${ac.token}` };
  return { H, B: await pairBridge(ac.member_id), member: ac.member_id };
}
/** 会話を 1 本作り、昨日のことにする（まとめは昨日までを読む） */
async function talkedYesterday(H: Record<string, string>, B: Record<string, string>, text: string, reply: string) {
  const s = await json<{ conversation_id: string; job_id: string }>(post("/agent/say", { text }, H));
  await post("/bridge/take", { protocol: 4 }, B);
  await post("/bridge/finish", { job_id: s.job_id, state: "done", result: reply }, B);
  await admin.query("update messages set created_at = created_at - interval '1 day' where conversation_id = $1", [
    s.conversation_id,
  ]);
  return s.conversation_id;
}
type Digest = {
  pending: { days: number; conversations: number } | null;
  running: { id: string } | null;
  last: {
    id: string;
    result: {
      remembered: { memory_id: string; title: string }[];
      merged: { memory_id: string; before: { id: string }[] }[];
      propose: { proposal_id: string; target_scope_id: string }[];
      discarded: { text: string }[];
      reason?: string;
    };
  } | null;
  upper: { title: string; scope: string }[];
  solo: boolean;
  proposals: { proposal_id: string; state: string; reviewer: string | null }[];
};
const fence = (o: unknown) => `整理しました。\n\n\`\`\`json\n${JSON.stringify(o)}\n\`\`\``;
async function runDigest(H: Record<string, string>, B: Record<string, string>, answer: string) {
  const st = await json<{ digest_id: string }>(post("/agent/memory/digest", {}, H));
  const t = await json<{ job_id: string; prompt: string; conversation_id: string | null } | null>(
    post("/bridge/take", { protocol: 4 }, B),
  );
  expect(t?.conversation_id, "会話の画面には出さない仕事").toBeNull();
  await post("/bridge/finish", { job_id: t!.job_id, state: "done", result: answer }, B);
  return { digest: st.digest_id, prompt: t!.prompt };
}

describe("「覚えて」はその場で（D-105.1）", () => {
  it("印は返事から消え、個人の記憶に入り、会話に「覚えました」が出る。記憶に残さない会話では入れない", async () => {
    const { H, B, member } = await ready();
    const s = await json<{ conversation_id: string; job_id: string }>(
      post("/agent/say", { text: "請求書は税込を先に書くって覚えて" }, H),
    );
    await post("/bridge/take", { protocol: 4 }, B);
    await post(
      "/bridge/finish",
      { job_id: s.job_id, state: "done", result: "わかりました。\n\n[[覚える: 請求書は税込を先に書く]]" },
      B,
    );
    const st = await json<{ messages: { who: string; text: string; memory_id?: string }[] }>(
      req("GET", `/agent/state?conversation_id=${s.conversation_id}`, undefined, H),
    );
    expect(st.messages.map((m) => [m.who, m.text])).toEqual([
      ["me", "請求書は税込を先に書くって覚えて"],
      ["ai", "わかりました。"],
      ["memo", "請求書は税込を先に書く"],
    ]);
    expect(st.messages.at(-1)!.memory_id).toMatch(/^[0-9a-f-]{36}$/);
    const mem = await admin.query("select owner_member_id, body from memories where id = $1", [
      st.messages.at(-1)!.memory_id,
    ]);
    expect(mem.rows[0]).toEqual({ owner_member_id: member, body: "請求書は税込を先に書く" });
    const inc = await json<{ conversation_id: string }>(post("/agent/conversations", { incognito: true }, H));
    const s2 = await json<{ job_id: string }>(
      post("/agent/say", { text: "これは覚えないで", conversation_id: inc.conversation_id }, H),
    );
    await post("/bridge/take", { protocol: 4 }, B);
    await post("/bridge/finish", { job_id: s2.job_id, state: "done", result: "はい。[[覚える: 残さない会話の話]]" }, B);
    expect(
      (await admin.query("select count(*)::int as n from memories where body = '残さない会話の話'")).rows[0].n,
    ).toBe(0);
  });
});

describe("毎朝のまとめ（D-105.2〜D-105.5）", () => {
  it("溜まった分を出し、押すと会話の無い仕事になる。答えで 覚えた／まとめた／捨てた が入り、戻す・拾い直すができる。一人の会社には上げる候補を出さない", async () => {
    const { H, B, member } = await ready();
    const empty = await json<Digest>(req("GET", "/agent/memory/digest", undefined, H));
    expect(empty.pending).toBeNull();
    expect((await post("/agent/memory/digest", {}, H)).status, "まとめる会話が無ければ 409").toBe(409);
    await talkedYesterday(H, B, "京蟻の窓口は鈴木さん", "承知しました");
    const incog = await json<{ conversation_id: string }>(post("/agent/conversations", { incognito: true }, H));
    const x = await json<{ job_id: string }>(
      post("/agent/say", { text: "社外秘の話", conversation_id: incog.conversation_id }, H),
    );
    await post("/bridge/take", { protocol: 4 }, B);
    await post("/bridge/finish", { job_id: x.job_id, state: "done", result: "了解" }, B);
    await admin.query("update messages set created_at = created_at - interval '1 day' where conversation_id = $1", [
      incog.conversation_id,
    ]);
    const old = (
      await admin.query(
        "insert into memories (tenant_id, scope_id, kind_id, owner_member_id, title, body) select tenant_id, scope_id, 'preference', id, '単価', '1 人日 55,000 円' from members where id = $1 returning id",
        [member],
      )
    ).rows[0].id as string;
    const st = await json<Digest>(req("GET", "/agent/memory/digest", undefined, H));
    expect(st.pending).toMatchObject({ days: 1, conversations: 1 }); // 記憶に残さない会話は数えない
    expect(st.solo).toBe(true);
    const { digest, prompt } = await runDigest(
      H,
      B,
      fence({
        remembered: [{ title: "京蟻の窓口", body: "京蟻の窓口は経理の鈴木さん", kind: "preference", source: "京蟻" }],
        merged: [{ memory_ids: [old], title: "単価", body: "1 人日 60,000 円（9 月から）", kind: "preference" }],
        propose: [
          {
            title: "着手金",
            body: "着手金は契約時に 3 割",
            kind: "rule",
            target_scope_id: "00000000-0000-0000-0000-000000000000",
          },
        ],
        discarded: [{ text: "明日 10 時に電話", why: "予定" }],
      }),
    );
    expect(prompt).toContain("京蟻の窓口は鈴木さん");
    expect(prompt).not.toContain("社外秘の話");
    expect(prompt).toContain(old);
    const done = await json<Digest>(req("GET", "/agent/memory/digest", undefined, H));
    expect(done.pending).toBeNull();
    expect(done.last?.result.remembered.map((r) => r.title)).toEqual(["京蟻の窓口"]);
    expect(done.last?.result.merged[0]!.before.map((b) => b.id)).toEqual([old]);
    expect(done.last?.result.propose, "一人の会社には上げる候補を出さない").toEqual([]);
    expect(done.last?.result.discarded.map((d) => d.text)).toEqual(["明日 10 時に電話"]);
    expect(
      (await admin.query("select superseded_by is not null as s from memories where id = $1", [old])).rows[0].s,
    ).toBe(true);
    // まとめを戻す → 前の記憶が戻る
    expect(
      (await post(`/agent/memory/digest/${digest}/undo`, { memory_id: done.last!.result.merged[0]!.memory_id }, H))
        .status,
    ).toBe(200);
    expect(
      (await admin.query("select superseded_by from memories where id = $1", [old])).rows[0].superseded_by,
    ).toBeNull();
    // 捨てたものを拾い直す
    expect((await post(`/agent/memory/digest/${digest}/pick`, { index: 0 }, H)).status).toBe(201);
    expect(
      (
        await admin.query(
          "select count(*)::int as n from memories where owner_member_id = $1 and body = '明日 10 時に電話' and deleted_at is null",
          [member],
        )
      ).rows[0].n,
    ).toBe(1);
    // 直す・消す（自分の記憶だけ）
    const rid = done.last!.result.remembered[0]!.memory_id;
    expect((await req("PATCH", `/agent/memory/${rid}`, { body: "京蟻の窓口は経理の鈴木様" }, H)).status).toBe(200);
    const other = await ready();
    expect(
      (await req("PATCH", `/agent/memory/${rid}`, { body: "乗っ取り" }, other.H)).status,
      "他人の記憶は直せない",
    ).toBe(404);
    expect((await req("DELETE", `/agent/memory/${rid}`, undefined, H)).status).toBe(200);
  });
  it("PC が閉じていたら始めたことにせず、溜まっている量も減らさない（E-MEM-001）", async () => {
    const { H, B } = await ready();
    await talkedYesterday(H, B, "何か", "はい");
    await admin.query(
      "update sessions set last_seen_at = now() - interval '10 minutes', issued_at = now() - interval '10 minutes' where device_token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')",
      [B["x-bridge-session"]],
    );
    const r = await post("/agent/memory/digest", {}, H);
    expect(r.status).toBe(409);
    expect((await r.json()) as { code: string; message: string }).toMatchObject({
      code: "E-MEM-001",
      message: expect.stringContaining("PC が閉じている"),
    });
    expect((await json<Digest>(req("GET", "/agent/memory/digest", undefined, H))).pending).toMatchObject({
      days: 1,
      conversations: 1,
    });
  });
  it("答えが決まった形でなければ「うまくいかなかった」にし、理由を残す（黙って空にしない）", async () => {
    const { H, B } = await ready();
    await talkedYesterday(H, B, "何か", "はい");
    await runDigest(H, B, "JSON を書き忘れました");
    const st = await json<Digest>(req("GET", "/agent/memory/digest", undefined, H));
    expect(st.last).toBeNull();
    const row = (
      await admin.query(
        "select state_id, result->>'reason' as reason from memory_digests order by created_at desc limit 1",
      )
    ).rows[0];
    expect(row.state_id).toBe("failed");
    expect(row.reason).toContain("決まった形");
    expect(st.pending, "失敗したら溜まった分はそのまま").not.toBeNull();
  });
});

describe("上の層へ上げる候補と確認待ち（D-105.6・D-105.9）", () => {
  it("担当者が送る → 代表が確認者 → OK で会社の記憶になり、送った人の個人の記憶は置き換わる。食い違いは束で、片方を選ぶと他は差し戻し", async () => {
    const boss = await ready();
    const root = (await admin.query("select scope_id from members where id = $1", [boss.member])).rows[0]
      .scope_id as string;
    const a = await invite(boss.member);
    const b = await invite(boss.member);
    for (const [who, body] of [
      [a, "月末締め"],
      [b, "20 日締め"],
    ] as const) {
      await talkedYesterday(who.H, who.B, "請求の締め日", "はい");
      await runDigest(
        who.H,
        who.B,
        fence({
          remembered: [],
          merged: [],
          discarded: [],
          propose: [{ title: "請求の締め日", body, kind: "rule", target_scope_id: root, why: "会社の決まり" }],
        }),
      );
      const st = await json<Digest>(req("GET", "/agent/memory/digest", undefined, who.H));
      expect(st.solo).toBe(false);
      const p = st.last!.result.propose[0]!;
      expect(p.target_scope_id).toBe(root);
      const sent = await json<{ reviewer_member_id: string }>(
        post(`/agent/memory/proposals/${p.proposal_id}/send`, {}, who.H),
      );
      expect(sent.reviewer_member_id, "確認者は会社の層で承認できる人（代表）").toBe(boss.member);
    }
    expect((await post(`/agent/memory/proposals/00000000-0000-0000-0000-000000000000/send`, {}, a.H)).status).toBe(404);
    const reviews = await json<
      { proposal_id: string; body: string; conflict_group_id: string | null; proposer: string }[]
    >(req("GET", "/agent/memory/reviews", undefined, boss.H));
    expect(reviews.map((r) => r.body).sort()).toEqual(["20 日締め", "月末締め"]);
    expect(new Set(reviews.map((r) => r.conflict_group_id)).size, "食い違いは 1 つの束").toBe(1);
    expect(reviews[0]!.conflict_group_id).not.toBeNull();
    expect(
      (await json<unknown[]>(req("GET", "/agent/memory/reviews", undefined, a.H))).length,
      "確認者でない人には出ない",
    ).toBe(0);
    const pick = reviews.find((r) => r.body === "月末締め")!;
    expect(
      (await post(`/agent/memory/proposals/${pick.proposal_id}/decide`, { accept: true }, a.H)).status,
      "確認者でない人は決められない",
    ).toBe(404);
    expect((await post(`/agent/memory/proposals/${pick.proposal_id}/decide`, { accept: true }, boss.H)).status).toBe(
      200,
    );
    const up = await admin.query(
      "select owner_member_id, scope_id, body, approved_by from memories where source_type_id = 'proposal' and source_ref_id = $1",
      [pick.proposal_id],
    );
    expect(up.rows[0]).toEqual({ owner_member_id: null, scope_id: root, body: "月末締め", approved_by: boss.member });
    const mineA = await json<Digest>(req("GET", "/agent/memory/digest", undefined, a.H));
    expect(mineA.proposals[0]).toMatchObject({ state: "accepted" });
    const mineB = await json<Digest>(req("GET", "/agent/memory/digest", undefined, b.H));
    expect(mineB.proposals[0], "束の他方は差し戻し（個人の記憶のまま）").toMatchObject({ state: "returned" });
    expect(
      mineB.upper.map((u) => u.title),
      "上の層で変わったこととして見える",
    ).toContain("請求の締め日");
    expect(await json<unknown[]>(req("GET", "/agent/memory/reviews", undefined, boss.H))).toEqual([]);
    // 効く（D-105.7・D-105.8）：会話の仕事を取ると、上の層の決まりが本人の記憶より先に、強い順で渡る
    await post("/agent/say", { text: "締め日はいつ？" }, b.H);
    const t = await json<{ memories: { kind: string; scope: string; personal: boolean; body: string }[] }>(
      post("/bridge/take", { protocol: 4 }, b.B),
    );
    const bodies = t.memories.map((m) => `${m.personal ? "本人" : "上"}:${m.body}`);
    expect(bodies[0], "上の層の決まりがいちばん強い").toBe("上:月末締め");
    expect(bodies, "差し戻された本人の案は本人の記憶として残る").toContain("本人:20 日締め");
  });
});
