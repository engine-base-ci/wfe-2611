// 成果物（D-106・T-B-23）を本物の Postgres（RLS あり）と置き場（関門 C4）で通す。
//   書き出す → 版 1（名前は見出しから）→ 直して保存 → 版 2（版 1 の中身はそのまま）→ 版 1 に戻す → 版 3（reverted_from=1・どの版も残る）
//   大きすぎる本文は作らない（E-ART-001）・置き場に置けなければ行を作らない（E-ART-002）・書き出した本人の物だけ
import { beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
import { createInvitation } from "@kaname/auth/invitations";
import { createApp } from "../src/app.js";
import { authExt } from "../src/auth/ext.js";
import { agreeCurrentTerms, keepAuth, verifiedUser } from "./_pending.js";
import { ARTIFACT_TEXT_MAX, titleOf } from "../src/auth/artifacts.js";

const DB_PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "db");
const ADMIN = process.env["DATABASE_URL"]!;
const APP_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = ADMIN.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const PW = "Str0ng-Passw0rd!";
const sent: { to: string; url: string; kind: string }[] = [];
let app: ReturnType<typeof createApp>;
let admin: pg.Pool;
let store = "";
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
type Art = {
  id: string;
  title: string;
  format: string;
  current_version: number;
  editable: boolean;
  viewing: number;
  text?: string | null;
  url?: string | null;
  versions: { version: number; reverted_from: number | null; note: string | null }[];
  storage_ref?: unknown;
};

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
  store = mkdtempSync(join(tmpdir(), "kaname-art-"));
  const objects = new ObjectStore(repo, localDriver(store), { signingSecret: "test-files", maxBytes: 4 * 1024 * 1024 });
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

async function signUp() {
  const email = `${uniq()}@example.com`;
  // 申し込みは直に置き、確認だけを通す（前の道すじ /sign-up は K-51 で契約の口に移した）
  const ver = await verifiedUser(AUTH_URL, { email, password: PW, companyName: "K" });
  const H = { authorization: `Bearer ${ver.token}` };
  const member = (
    await admin
      .query("select m.id from members m join auth_users u on u.id = m.auth_user_id where u.email = $1", [email])
      .catch(() => ({ rows: [] }))
  ).rows[0]?.id as string | undefined;
  return { H, member };
}
/** 自分の会話と、自分のAI の返事を 1 つ置く（返事の中身は DB に直接。書き出すのは画面の文） */
async function reply(H: Record<string, string>, body: string) {
  const conv = await json<{ conversation_id: string }>(post("/agent/conversations", {}, H));
  const t = (await admin.query("select tenant_id from conversations where id = $1", [conv.conversation_id])).rows[0]
    .tenant_id as string;
  const m = await admin.query(
    "insert into messages (tenant_id, conversation_id, body, kind) values ($1, $2, $3, 'ai') returning id",
    [t, conv.conversation_id, body],
  );
  return { conv: conv.conversation_id, message: m.rows[0].id as string };
}

describe("成果物（D-106）", () => {
  it("名前は最初の見出し、無ければ最初の行（書式の印を外す）", () => {
    expect(titleOf("前置き\n\n# 京蟻 見積の方針\n本文")).toBe("京蟻 見積の方針");
    expect(titleOf("**着手金**は 3 割")).toBe("着手金は 3 割");
    expect(titleOf("   \n")).toBe("成果物");
  });

  it("書き出す → 版 1。直して保存 → 版 2（版 1 はそのまま）。版 1 に戻す → 版 3。どの版も消さない。落とすのは今の版", async () => {
    const { H } = await signUp();
    const r = await reply(H, "# 京蟻 見積の方針\n\n1,450,000 円");
    const a = await json<Art>(
      post("/agent/artifacts", { message_id: r.message, text: "# 京蟻 見積の方針\n\n1,450,000 円" }, H),
    );
    expect(a).toMatchObject({
      title: "京蟻 見積の方針",
      format: "md",
      current_version: 1,
      editable: true,
      text: "# 京蟻 見積の方針\n\n1,450,000 円",
    });
    expect(a.storage_ref, "置き場の参照は画面に返さない").toBeUndefined();
    const list = await json<{ id: string }[]>(req("GET", `/agent/artifacts?conversation_id=${r.conv}`, undefined, H));
    expect(list.map((x) => x.id)).toEqual([a.id]);

    const v2 = await json<Art>(
      post(`/agent/artifacts/${a.id}/versions`, { text: "# 京蟻 見積の方針\n\n1,500,000 円" }, H),
    );
    expect(v2).toMatchObject({ current_version: 2, text: "# 京蟻 見積の方針\n\n1,500,000 円" });
    const old = await json<Art>(req("GET", `/agent/artifacts/${a.id}?version=1`, undefined, H));
    expect(old).toMatchObject({ viewing: 1, text: "# 京蟻 見積の方針\n\n1,450,000 円" });

    const v3 = await json<Art>(post(`/agent/artifacts/${a.id}/revert`, { version: 1 }, H));
    expect(v3).toMatchObject({ current_version: 3, text: "# 京蟻 見積の方針\n\n1,450,000 円" });
    expect(v3.versions.map((v) => [v.version, v.reverted_from])).toEqual([
      [3, 1],
      [2, null],
      [1, null],
    ]);

    const dl = await req("GET", `/agent/artifacts/${a.id}/download`, undefined, H);
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-disposition")).toContain(encodeURIComponent("京蟻 見積の方針_v3.md"));
    expect(await dl.text()).toBe("# 京蟻 見積の方針\n\n1,450,000 円");
    const rows = await admin.query("select count(*)::int as n from artifact_versions where artifact_id = $1", [a.id]);
    expect(rows.rows[0].n).toBe(3);
  });

  it("表は csv として書き出せ、名前を直せる", async () => {
    const { H } = await signUp();
    const r = await reply(H, "| 項目 | 金額 |\n|---|---|\n| 実装 | 2,970,000 |");
    const a = await json<Art>(
      post("/agent/artifacts", { message_id: r.message, text: "項目,金額\n実装,2970000", format: "csv" }, H),
    );
    expect(a).toMatchObject({ format: "csv", title: "項目,金額", editable: true });
    expect((await req("PATCH", `/agent/artifacts/${a.id}`, { title: "SOICO の見積の表" }, H)).status).toBe(200);
    expect((await json<Art>(req("GET", `/agent/artifacts/${a.id}`, undefined, H))).title).toBe("SOICO の見積の表");
  });

  it("大きすぎる本文は作らない（E-ART-001）。置き場にも DB にも行ができない", async () => {
    const { H } = await signUp();
    const r = await reply(H, "長い");
    const before = (await admin.query("select count(*)::int as n from artifacts")).rows[0].n as number;
    const res = await post(
      "/agent/artifacts",
      { message_id: r.message, text: "あ".repeat(Math.ceil(ARTIFACT_TEXT_MAX / 3) + 10) },
      H,
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({
      code: "E-ART-001",
      message: "大きすぎて成果物にできません（1 MB まで）。分けて書き出してください",
    });
    expect((await admin.query("select count(*)::int as n from artifacts")).rows[0].n).toBe(before);
  });

  it("置き場に置けなければ行を作らず、保存も版を増やさない（E-ART-002）", async () => {
    const { H } = await signUp();
    const r = await reply(H, "# 下書き");
    const a = await json<Art>(post("/agent/artifacts", { message_id: r.message, text: "# 下書き" }, H));
    const tenant = (await admin.query("select tenant_id from artifacts where id = $1", [a.id])).rows[0]
      .tenant_id as string;
    const dir = join(store, "tenants", tenant);
    // この会社の置き場に書けなくする。権限（chmod）だと root では書けてしまうので、置き場の場所を一時的にファイルにする（誰でも書けない）
    renameSync(dir, `${dir}.away`);
    writeFileSync(dir, "置き場ではない");
    try {
      const s = await post(`/agent/artifacts/${a.id}/versions`, { text: "# 直した" }, H);
      expect(s.status).toBe(502);
      expect(await s.json()).toMatchObject({ code: "E-ART-002" });
      const n = await post("/agent/artifacts", { message_id: r.message, text: "# もう 1 つ" }, H);
      expect(n.status).toBe(502);
    } finally {
      rmSync(dir);
      renameSync(`${dir}.away`, dir);
    }
    const after = await json<Art>(req("GET", `/agent/artifacts/${a.id}`, undefined, H));
    expect(after.current_version).toBe(1);
    expect(
      (await admin.query("select count(*)::int as n from artifacts where source_message_id = $1", [r.message])).rows[0]
        .n,
    ).toBe(1);
  });

  it("書き出した本人の物だけ：同じ会社の別の人も他の会社の人も読めず直せない。他人の返事からは書き出せない", async () => {
    const boss = await signUp();
    const r = await reply(boss.H, "# 方針");
    const a = await json<Art>(post("/agent/artifacts", { message_id: r.message, text: "# 方針" }, boss.H));
    const bossMember = (await admin.query("select owner_member_id from artifacts where id = $1", [a.id])).rows[0]
      .owner_member_id as string;
    const t = (await admin.query("select tenant_id from members where id = $1", [bossMember])).rows[0]
      .tenant_id as string;
    const repo = await createRepository(createPool({ databaseUrl: APP_URL, max: 1 }));
    const inv = await createInvitation(
      repo,
      { tenantId: t, userId: bossMember, role: "member" },
      { email: `${uniq()}@example.com`, roleId: "staff" },
    );
    const staff = await json<{ token: string; member_id: string }>(
      post(`/invitations/${inv.token}/accept`, { name: "担当", password: PW }),
    );
    // 招待で入った人の同意は K-55。それまでは今の版に同意済みにする（K-53 の同意し直しの 403 で、見たいはずの 404 が隠れないように）
    await agreeCurrentTerms(
      (await admin.query("select auth_user_id from members where id = $1", [staff.member_id])).rows[0]
        .auth_user_id as string,
    );
    const S = { authorization: `Bearer ${staff.token}` };
    const other = await signUp();
    for (const h of [S, other.H]) {
      expect((await req("GET", `/agent/artifacts/${a.id}`, undefined, h)).status).toBe(404);
      expect((await post(`/agent/artifacts/${a.id}/versions`, { text: "# 乗っ取り" }, h)).status).toBe(404);
      expect((await post(`/agent/artifacts/${a.id}/revert`, { version: 1 }, h)).status).toBe(404);
      expect((await req("GET", `/agent/artifacts/${a.id}/download`, undefined, h)).status).toBe(404);
      expect(await json<unknown[]>(req("GET", "/agent/artifacts", undefined, h))).toEqual([]);
      expect(
        (await post("/agent/artifacts", { message_id: r.message, text: "# 写し" }, h)).status,
        "他人の返事からは書き出せない",
      ).toBe(404);
    }
    expect((await json<Art>(req("GET", `/agent/artifacts/${a.id}`, undefined, boss.H))).current_version).toBe(1);
  });

  it("未ログインは 401・id の形が違えば 404", async () => {
    expect((await req("GET", "/agent/artifacts")).status).toBe(401);
    const { H } = await signUp();
    expect((await req("GET", "/agent/artifacts/nope", undefined, H)).status).toBe(404);
  });
});
