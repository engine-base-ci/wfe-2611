// K-352「預ける口（createCredential）」の単体の試験（口と DB・本物の Postgres・本物の秘密の関門）。
// テストの名前の頭の行 ID（K352-API-…）は 11_tickets/K-352.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-352.py で直す）:
//   createCredential  POST /api/v1/credentials（本人・60 回／分／人・取り直しか、ログインから 15 分の内）
//     体 { layer: "workspace"|"personal", kind: "login"|"key", name, description?, login?, password?, value?,
//          two_factor?: "none"|"totp"|"sms"|"email"|"push", totp_secret?, destinations: string[], expires_on?: "YYYY-MM-DD"|null }（strict）
//     201 { data: Credential }（一覧 K-351 と同じ 14 の鍵。値・vault_ref は返さない）・Cache-Control: private, no-store
//     順：入力の確かめ（422）→ ワークスペースの権限（403・E-CRED-007）→ 本人確認（403・STEP_UP_REQUIRED）→ 同じ名前（409・E-CRED-006）
//         → 消える保管先（503・E-SEC-002）→ 金庫に入れる（502・E-SEC-001／503・E-SEC-003）→ 行を作る（503・E-PAGE-003・金庫の物を失効）→ 確かめの仕事を積む
//     名前：NFKC・前後の空白を落とし大文字に。^[A-Z][A-Z0-9_]{0,63}$ でなければ 422・E-CRED-001（欄 name）
//     使える場所：1〜20 個。NFKC・小文字・http(s):// と道を落とし、日本語のドメインは punycode に。頭の *. は残す。重なりは 1 つに。
//       空・無い → 422・E-CRED-003／形違い（点の無い名前・IP・空白・21 個以上）→ 422・E-CRED-002（欄 destinations）
//     期限：日本の今日より前・暦に無い日・形違い → 422・E-CRED-004（欄 expires_on）。行の expires_at はその日の日本の 23:59:59.999
//     中身：login は login と password、key は value だけ。欠け・種類の混ざり → 422・E-CRED-005（欄の名前つき）
//     2 段階：totp は totp_secret（Base32・空白と小文字は直す）が要る。無い・形違い・totp でないのに付ける → 422・E-VAL-003（欄 totp_secret）
//     kind_id：login で totp → password_totp、ほかの login → basic、key → api_key
//     確かめ（D-117）：login だけ、預けた本人の PC に 1 回ログインを試す仕事を積む（app.credential_login_check_enqueue）。
//       PC が無い → login_check.state no_bridge・規約で禁止の宛先 → forbidden・積めた → pending。積めなくても 201（state は null のまま・ログに残す）
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DESTINATION_PATTERN,
  EXPIRES_PATTERN,
  LOGIN_PATTERN,
  NAME_PATTERN,
  TOTP_PATTERN,
} from "../../../src/features/F3/credentials/patterns.js";
import { kanameError } from "@kaname/errors";
import { RateLimited } from "@kaname/secrets";
import { setupCredentials, type Person } from "./credentials.harness.js";
// 作り物の秘密の値は _fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K352_KEY_VALUE, K352_PASSWORD, K352_TOTP_SECRET, K352_TOTP_SECRET_SPACED } from "../../_fake/secrets.js";

const h = setupCredentials();
const KEYS = [
  "can_edit",
  "created_at",
  "description",
  "destinations",
  "expires_on",
  "id",
  "kind",
  "last_used_at",
  "layer",
  "login_check",
  "name",
  "two_factor",
  "updated_at",
  "use_count",
];
const PASSWORD = K352_PASSWORD;
const KEY_VALUE = K352_KEY_VALUE;
const jstDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + offsetDays * 86_400_000));

let A: { tenantId: string; rootScope: string };
let staff: Person;
beforeAll(async () => {
  A = await h.company("K352 会社 A");
  staff = await h.person(A.tenantId, A.rootScope, { name: "担当者" });
});

let seq = 0;
const fresh = async (o: { admin?: boolean } = {}) =>
  h.person(A.tenantId, A.rootScope, { name: `人 ${++seq}`, ...(o.admin ? { admin: true } : {}) });
const loginBody = (over: Record<string, unknown> = {}) => ({
  layer: "personal",
  kind: "login",
  name: `LOGIN_${++seq}`,
  description: "発注ナビのログイン",
  login: "taka@example.com",
  password: PASSWORD,
  two_factor: "sms",
  destinations: ["hacchu-navi.example"],
  expires_on: "2027-11-10",
  ...over,
});
const keyBody = (over: Record<string, unknown> = {}) => ({
  layer: "personal",
  kind: "key",
  name: `KEY_${++seq}`,
  value: KEY_VALUE,
  destinations: ["api.freee.co.jp"],
  ...over,
});
const post = (p: Person, body: unknown, o: Parameters<typeof h.as>[1] = {}) =>
  h.req("POST", "/credentials", { body, headers: h.as(p, o) });
const rowsOf = async (p: Person) =>
  (
    await h.admin.query<Record<string, unknown>>(
      "select * from credentials where owner_member_id = $1 and deleted_at is null order by created_at",
      [p.id],
    )
  ).rows;
const jobsOf = async (credentialId: string) =>
  Number(
    (
      await h.admin.query<{ n: string }>(
        "select count(*) as n from bridge_jobs where credential_id = $1 and kind = 'login_check'",
        [credentialId],
      )
    ).rows[0]!.n,
  );
const expect422 = async (r: Response, code: string, field: string) => {
  expect(r.status, await r.clone().text()).toBe(422);
  const j = await h.json(r);
  expect(j["code"]).toBe(code);
  expect(((j["details"] as { field?: string }[] | undefined) ?? []).map((d) => d.field)).toContain(field);
};

// 時刻や預けた物の状態で決まる断り：409・欄は付けない。本文全体（error・文）を正本の番号と照らす
const expect409 = async (r: Response, code: string) => {
  expect(r.status, await r.clone().text()).toBe(409);
  const j = await h.json(r);
  expect(j["error"]).toBe("conflict");
  expect(j["code"]).toBe(code);
  expect(j["message"]).toBe(kanameError(code).entry.message);
  expect(j["field"]).toBeUndefined();
  expect(j["details"]).toBeUndefined();
};

// NFKC で「.」を含む 2 字以上に開く互換の 27 字（‥ … ⒈〜⒛ ㏂ ㏇ ㏘ ︙ ︰）と、「?」「/」を含む 7 字（⁇ ⁈ ⁉ ℀ ℁ ℅ ℆）。前は受けたが、点や区切りと数えると前は断っていた形を新しく受けるため断る例外
const COMPAT_DOT_CHARS = [
  "\u2025", "\u2026", "\u2047", "\u2048", "\u2049", "\u2100", "\u2101", "\u2105", "\u2106", "\u33c2", "\u33c7", "\u33d8", "\ufe19", "\ufe30",
  ...Array.from({ length: 20 }, (_, i) => String.fromCharCode(0x2488 + i)),
]; // prettier-ignore

describe("K-352 預ける口", () => {
  it("K352-API-001 個人のログイン情報を預ける（ログインから 15 分の内・PC がつながっている）：201・答えは一覧と同じ形で値と参照を返さない。行・金庫の中身・確かめの仕事ができる", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const body = loginBody({ name: "HACCHU_NAVI_LOGIN" });
    const r = await post(me, body);
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({
      name: "HACCHU_NAVI_LOGIN",
      description: "発注ナビのログイン",
      layer: "personal",
      kind: "login",
      two_factor: "sms",
      destinations: ["hacchu-navi.example"],
      expires_on: "2027-11-10",
      use_count: 0,
      last_used_at: null,
      can_edit: true,
    });
    expect((d["login_check"] as Record<string, unknown>)["state"]).toBe("pending");
    const text = JSON.stringify(d);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain("sec_");
    const row = (await h.row(String(d["id"])))!;
    expect(row).toMatchObject({
      owner_member_id: me.id,
      layer: "personal",
      kind_id: "basic",
      two_factor_id: "sms",
      service_name: "HACCHU_NAVI_LOGIN",
      service_domain: "hacchu-navi.example",
    });
    expect(String(row["vault_ref"])).toMatch(/^sec_/);
    expect((row["expires_at"] as Date).toISOString()).toBe("2027-11-10T14:59:59.999Z");
    expect(await h.plain(me, String(row["vault_ref"]))).toEqual({
      login: "taka@example.com",
      password: PASSWORD,
      totp_secret: null,
    });
    expect(await jobsOf(String(d["id"]))).toBe(1);
  });

  it("K352-API-002 鍵の値（kind key）を預ける：201・kind key・2 段階 none。金庫の中身は { value }。確かめの仕事は積まない（login_check はどれも null）", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const r = await post(me, keyBody({ name: "FREEE_API_KEY" }));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(d).toMatchObject({ kind: "key", two_factor: "none", destinations: ["api.freee.co.jp"], expires_on: null });
    expect(d["login_check"]).toEqual({ state: null, detail: null, at: null, request_id: null });
    const row = (await h.row(String(d["id"])))!;
    expect(row["kind_id"]).toBe("api_key");
    expect(await h.plain(me, String(row["vault_ref"]))).toEqual({ value: KEY_VALUE });
    expect(await jobsOf(String(d["id"]))).toBe(0);
  });

  it("K352-API-003 ワークスペースに預ける（credentials の edit がある人）：201・layer workspace・can_edit true。同じ会社の別の人の一覧に出る", async () => {
    await h.ready();
    const admin = await fresh({ admin: true });
    const r = await post(admin, keyBody({ layer: "workspace", name: `WS_KEY_${++seq}` }));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(d).toMatchObject({ layer: "workspace", can_edit: true });
    const l = await h.req("GET", "/credentials", { headers: h.as(staff) });
    const seen = ((await h.json(l)).data as Record<string, unknown>[]).find((x) => x["id"] === d["id"]);
    expect(seen).toMatchObject({ layer: "workspace", can_edit: false });
  });

  it("K352-API-004 ワークスペースに預ける（edit が無い人）：403・E-CRED-007。金庫に置かず、行も作らない", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    const r = await post(me, keyBody({ layer: "workspace" }));
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("E-CRED-007");
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-005 本人確認：ログインから 16 分・取り直し無しは 403・STEP_UP_REQUIRED で何も置かない。取り直しが 14 分前なら（ログインが 16 分前でも）201", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    const r = await post(me, keyBody(), { loginAgoSec: 16 * 60, stepUpAgoSec: null });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(0);
    const ok = await post(me, keyBody(), { loginAgoSec: 16 * 60, stepUpAgoSec: 14 * 60 });
    expect(ok.status, await ok.clone().text()).toBe(201);
  });

  it("K352-API-006 名前：全角・小文字・前後の空白は直して大文字で保存。形違い（数字始まり・日本語・空・65 文字・ß）は 422・E-CRED-001 で何も置かない。前後は全角の空白でもよい", async () => {
    await h.ready();
    const me = await fresh();
    const r = await post(me, keyBody({ name: " ｈａｃｃｈｕ_navi " }));
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await h.json(r)).data as Record<string, unknown>)["name"]).toBe("HACCHU_NAVI");
    // 前後は全角の空白（U+3000）でも受ける（契約の pattern の前後の空白は trim が落とす字）
    const wide = await post(me, keyBody({ name: "\u3000ｗｉｄｅ_ｎａｍｅ\u3000" }));
    expect(wide.status, await wide.clone().text()).toBe(201);
    expect(((await h.json(wide)).data as Record<string, unknown>)["name"]).toBe("WIDE_NAME");
    const puts = h.vault.puts.length;
    // ß・ı・ſ は大文字にすると英字になるが、打ったとおりが契約の pattern に合わないので断る
    for (const bad of ["1ABC", "発注ナビ", "", `A${"B".repeat(64)}`, "ßTEST", "ıAB", "ſAB"])
      await expect422(await post(me, keyBody({ name: bad })), "E-CRED-001", "name");
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(2);
  });

  it("K352-API-026 口が打ったとおりに照らす pattern（patterns.ts の名前・使える場所・認証アプリの鍵・期限）は、契約（08_api/openapi.yaml の CredentialCreateInput・CredentialUpdateInput）の pattern と 1 字も違わない", () => {
    const py =
      "import yaml,json,sys;d=yaml.safe_load(open(sys.argv[1]));s=d['components']['schemas'];" +
      "c=s['CredentialCreateInput']['properties'];u=s['CredentialUpdateInput']['properties'];" +
      "print(json.dumps({'name':c['name']['pattern'],'destinations':c['destinations']['items']['pattern'],'totp':c['totp_secret']['pattern']," +
      "'expires':c['expires_on']['pattern'],'login':c['login']['pattern'],'uDestinations':u['destinations']['items']['pattern']," +
      "'uTotp':u['totp_secret']['pattern'],'uExpires':u['expires_on']['pattern'],'uLogin':u['login']['pattern']}))";
    const yamlPath = fileURLToPath(new URL("../../../../../08_api/openapi.yaml", import.meta.url));
    const got = JSON.parse(execFileSync("python3", ["-c", py, yamlPath], { encoding: "utf8" })) as Record<
      string,
      string
    >;
    expect(got["name"]).toBe(NAME_PATTERN);
    expect(got["destinations"]).toBe(DESTINATION_PATTERN);
    expect(got["totp"]).toBe(TOTP_PATTERN);
    expect(got["expires"]).toBe(EXPIRES_PATTERN);
    expect(got["login"]).toBe(LOGIN_PATTERN);
    expect(got["uDestinations"]).toBe(DESTINATION_PATTERN);
    expect(got["uTotp"]).toBe(TOTP_PATTERN);
    expect(got["uExpires"]).toBe(EXPIRES_PATTERN);
    expect(got["uLogin"]).toBe(LOGIN_PATTERN);
  });

  // 失効しただけ（消していない）の物は名前の重なりに数えない（代表の答え answer=449e72553c59）
  it("K352-API-007 同じ名前：同じ人の個人で重なれば 409・E-CRED-006 で金庫に置かない。個人とワークスペース・別の人の個人・失効しただけの物となら同じ名前で 201", async () => {
    await h.ready();
    const me = await fresh({ admin: true });
    const you = await fresh();
    expect((await post(me, keyBody({ name: "SAME_NAME" }))).status).toBe(201);
    const puts = h.vault.puts.length;
    const dup = await post(me, keyBody({ name: "same_name" }));
    expect(dup.status).toBe(409);
    expect((await h.json(dup))["code"]).toBe("E-CRED-006");
    expect(h.vault.puts.length).toBe(puts);
    expect((await post(me, keyBody({ name: "SAME_NAME", layer: "workspace" }))).status).toBe(201);
    expect((await post(you, keyBody({ name: "SAME_NAME" }))).status).toBe(201);
    const ws = await post(me, keyBody({ name: "SAME_NAME", layer: "workspace" }));
    expect(ws.status).toBe(409);
    expect((await h.json(ws))["code"]).toBe("E-CRED-006");
    // 会社を止めたときの一括失効などで失効しただけの物（一覧に出ず上書きも 404）は、同じ名前で預け直せる
    const old = await post(me, keyBody({ name: "REVOKED_ONLY" }));
    expect(old.status).toBe(201);
    const oldId = ((await h.json(old)).data as { id: string }).id;
    await h.admin.query("update credentials set revoked_at = now() where id = $1", [oldId]);
    const again = await post(me, keyBody({ name: "REVOKED_ONLY" }));
    expect(again.status, await again.clone().text()).toBe(201);
    expect(((await h.json(again)).data as { id: string }).id).not.toBe(oldId);
  });

  it("K352-API-008 使える場所の整え：URL の形・大文字・全角・道・問い合わせ・断片・末尾の点は落として名前（new URL の hostname）に。URL の @ の前（userinfo）は名前に数えない。重なりは 1 つに。頭の *. は残す。日本語のドメインは punycode", async () => {
    await h.ready();
    const me = await fresh();
    const r = await post(
      me,
      keyBody({
        destinations: [
          " HTTPS://Hacchu-Navi.Example/login?x=1 ",
          "hacchu-navi.example",
          "*.Example.COM",
          "ｅｘａｍｐｌｅ．ｃｏｍ",
          "example.com.",
          "例え.jp",
          "https://hacchu-navi.example@evil.test/",
          "https://a.example.net/https://evil.example/?next=evil.example#evil.example",
        ],
      }),
    );
    expect(r.status, await r.clone().text()).toBe(201);
    expect(((await h.json(r)).data as Record<string, unknown>)["destinations"]).toEqual([
      "hacchu-navi.example",
      "*.example.com",
      "example.com",
      "xn--r8jz45g.jp",
      "evil.test",
      "a.example.net",
    ]);
    // 前から受けている形は今も受ける（表記ゆらぎ）：ポート・scheme なしの道と user@・日本語の道・全角の ：／／・々・日本語以外の IDN・IDN の TLD・混ざり・長い日本語
    const more = await post(
      me,
      keyBody({
        destinations: [
          "https://example.com:8080/",
          "example.org:8080",
          "example.net/path",
          "user@example.edu",
          "https://example.dev/日本語",
          "ｈｔｔｐｓ：／／example.io",
          "佐々木.jp",
          "한국.kr",
          "пример.рф",
          "例え.みんな",
          "abc日本.example.com",
          "あいうえおかきくけこさ.jp",
        ],
      }),
    );
    expect(more.status, await more.clone().text()).toBe(201);
    expect(((await h.json(more)).data as Record<string, unknown>)["destinations"]).toEqual([
      "example.com",
      "example.org",
      "example.net",
      "example.edu",
      "example.dev",
      "example.io",
      "xn--u6jy55gilq.jp",
      "xn--3e0b707e.kr",
      "xn--e1afmkfd.xn--p1ai",
      "xn--r8jz45g.xn--q9jyb4c",
      "xn--abc-v08fl0d.example.com",
      "xn--l8jegikgoqsuw.jp",
    ]);
    // そのままの punycode・全角ハイフン・横棒・空のポート・IDNA が受けない字（未割り当て・結合記号・数字だけの名前になる字）は断らず、
    // NFKC・小文字の字のまま名前にして保存する。「＼@」はブラウザの読み方（＼ は区切りでなく @ の前の字）に合わせ、行き先は evil.test
    const odd = ["a¨.example.com", "\u0301a.example.com", "example.①"];
    const kept = await post(
      me,
      keyBody({
        destinations: [
          "xn--r8jz45g.jp",
          "ａ－ｂ.example.com",
          "a‐b.example.net",
          "https://example.org:/",
          ...odd,
          "https://example.edu＼@evil.test/",
        ],
      }),
    );
    expect(kept.status, await kept.clone().text()).toBe(201);
    expect(((await h.json(kept)).data as Record<string, unknown>)["destinations"]).toEqual([
      "xn--r8jz45g.jp",
      "a-b.example.com",
      "xn--ab-v1t.example.net", // U+2010 は IDNA が受ける字なので punycode になる（前と同じ）
      "example.org",
      ...odd.map((x) => x.normalize("NFKC").toLowerCase()),
      "evil.test",
    ]);
  });

  // 公開の接尾辞だけ（co.jp・*.co.jp・ne.jp）を断る（代表の答え answer=449e72553c59）
  it("K352-API-009 使える場所の欠けと形違い：空の並び・無いは 422・E-CRED-003。点の無い名前・IP・空白入り・道だけ・21 個・公開の接尾辞だけ（co.jp・*.co.jp・ne.jp）は 422・E-CRED-002。どれも何も置かない", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    await expect422(await post(me, keyBody({ destinations: [] })), "E-CRED-003", "destinations");
    const noDest = Object.fromEntries(Object.entries(keyBody()).filter(([k]) => k !== "destinations"));
    await expect422(await post(me, noDest), "E-CRED-003", "destinations");
    const many = Array.from({ length: 21 }, (_, i) => `s${i}.example.com`);
    for (const bad of [
      ["localhost"],
      ["192.168.0.1"],
      ["exa mple.com"],
      ["https://"],
      many,
      ["co.jp"],
      ["*.co.jp"],
      ["NE.JP"],
      // 互換形で書いた公開の接尾辞だけは、pattern を通っても預けた物がどこでも使えてしまう守りのため断る（契約の 422 の説明に名指し）
      ["ᶜo.jp"],
      ["ⓒⓞ.jp"],
      ...COMPAT_DOT_CHARS.map((c) => [`a${c}b.example.com`]),
      // 前は受けたが今は断る例外（実際に打たれない形・「前に受けていた入力は今も受ける」の例外として名指し）：
      //   バックスラッシュ・百分率形のホスト・ゼロ幅空白・、〃〈〉など U+3001〜303F と U+2012 以外の U+2016〜2027 の約物
      ["https://example.com\\path"],
      ["%41bc.example.com"],
      ["a\u200b.example.com"],
      ["a、b.example.com"],
      ["a〃b.example.com"],
      ["a〈b〉.example.com"],
      ["a†b.example.com"],
    ])
      await expect422(await post(me, keyBody({ destinations: bad })), "E-CRED-002", "destinations");
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-010 期限：日本の今日は 201。昨日は 409・E-CRED-004（欄なし）。暦に無い日（2027-02-30・2027-02-29・全角の ２０２７－０２－２９）・形違い（2027/11/10）は 422・VALIDATION_ERROR（欄 expires_on）。うるう日（2096-02-29）と全角の数字・ハイフンは 201。null と無いは期限なし", async () => {
    await h.ready();
    const me = await fresh();
    const today = await post(me, keyBody({ expires_on: jstDay(0) }));
    expect(today.status, await today.clone().text()).toBe(201);
    expect(((await h.json(today)).data as Record<string, unknown>)["expires_on"]).toBe(jstDay(0));
    // 日本の今日より前は時刻で決まるので 409・E-CRED-004（欄なし）。形違い・暦に無い日・全角の数字は契約の pattern に合わず 422（欄 expires_on）
    await expect409(await post(me, keyBody({ expires_on: jstDay(-1) })), "E-CRED-004");
    for (const bad of ["2027-02-30", "2027/11/10", "2027-13-01", "2027-02-29", "２０２７－０２－２９"])
      await expect422(await post(me, keyBody({ expires_on: bad })), "VALIDATION_ERROR", "expires_on");
    const leap = await post(me, keyBody({ name: "LEAP_DAY", expires_on: "2096-02-29" }));
    expect(leap.status, await leap.clone().text()).toBe(201);
    // 全角の数字とハイフンは前から受けている（表記ゆらぎ）。半角に直して日付を見る
    const wide = jstDay(2)
      .replace(/\d/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
      .replace(/-/g, "－");
    const w = await post(me, keyBody({ expires_on: wide }));
    expect(w.status, await w.clone().text()).toBe(201);
    expect(((await h.json(w)).data as Record<string, unknown>)["expires_on"]).toBe(jstDay(2));
    const none = await post(me, keyBody({ expires_on: null }));
    expect(((await h.json(none)).data as Record<string, unknown>)["expires_on"]).toBeNull();
  });

  it("K352-API-011 中身の欠けと種類の混ざり：ログインで login・password が空、鍵で value が空、鍵に login、ログインに value は 422・E-CRED-005（欄の名前つき）", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    await expect422(await post(me, loginBody({ login: "  " })), "E-CRED-005", "login");
    await expect422(await post(me, loginBody({ password: "" })), "E-CRED-005", "password");
    await expect422(await post(me, keyBody({ value: "" })), "E-CRED-005", "value");
    await expect422(await post(me, keyBody({ login: "x@example.com" })), "E-CRED-005", "login");
    await expect422(await post(me, loginBody({ value: "x" })), "E-CRED-005", "value");
    expect(h.vault.puts.length).toBe(puts);
  });

  it("K352-API-012 認証アプリの鍵：無い・Base32 でない・totp でないのに付けると 422・E-VAL-003。空白と小文字は直し、kind_id は password_totp", async () => {
    await h.ready();
    const me = await fresh();
    await expect422(await post(me, loginBody({ two_factor: "totp" })), "E-VAL-003", "totp_secret");
    await expect422(
      await post(me, loginBody({ two_factor: "totp", totp_secret: "not-base32!!" })),
      "E-VAL-003",
      "totp_secret",
    );
    await expect422(
      await post(me, loginBody({ two_factor: "sms", totp_secret: K352_TOTP_SECRET })),
      "E-VAL-003",
      "totp_secret",
    );
    const r = await post(me, loginBody({ two_factor: "totp", totp_secret: K352_TOTP_SECRET_SPACED }));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(d["two_factor"]).toBe("totp");
    const row = (await h.row(String(d["id"])))!;
    expect(row["kind_id"]).toBe("password_totp");
    expect((await h.plain(me, String(row["vault_ref"])))?.["totp_secret"]).toBe(K352_TOTP_SECRET);
    // アプリからのコピーで入る形も受ける：全角の空白・改行・nbsp を挟む／全角の ＝ で詰める（表記ゆらぎ・前から受けている）
    const t = K352_TOTP_SECRET;
    const messy = `${t.slice(0, 4)}\u3000${t.slice(4, 8)}\n${t.slice(8, 12)}\u00a0${t.slice(12)}`;
    const m = await post(me, loginBody({ two_factor: "totp", totp_secret: messy }));
    expect(m.status, await m.clone().text()).toBe(201);
    const mRow = (await h.row(String(((await h.json(m)).data as Record<string, unknown>)["id"])))!;
    expect((await h.plain(me, String(mRow["vault_ref"])))?.["totp_secret"]).toBe(t);
    const padded = await post(me, loginBody({ two_factor: "totp", totp_secret: `${t}＝＝` }));
    expect(padded.status, await padded.clone().text()).toBe(201);
    const pRow = (await h.row(String(((await h.json(padded)).data as Record<string, unknown>)["id"])))!;
    expect((await h.plain(me, String(pRow["vault_ref"])))?.["totp_secret"]).toBe(`${t}==`);
  });

  it("K352-API-013 知らない欄（vault_ref・owner_member_id）と、決まった値の外（layer・kind・two_factor）は 422 で何も置かない", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    for (const extra of [
      { vault_ref: "sec_x" },
      { owner_member_id: staff.id },
      { layer: "group" },
      { kind: "oauth" },
      { two_factor: "fax" },
    ]) {
      const r = await post(me, loginBody(extra));
      expect(r.status, JSON.stringify(extra)).toBe(422);
    }
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-014 PC がつながっていない：201・login_check.state は no_bridge・確かめの仕事は積まない", async () => {
    await h.ready();
    const me = await fresh();
    const r = await post(me, loginBody());
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect((d["login_check"] as Record<string, unknown>)["state"]).toBe("no_bridge");
    expect(await jobsOf(String(d["id"]))).toBe(0);
  });

  it("K352-API-015 規約で自動操作が禁止の宛先：201・login_check.state は forbidden・仕事は積まない。行はその台帳のサービスに結ぶ", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const domain = `bank-${Date.now().toString(36)}.example`;
    const sid = await h.service(A.tenantId, domain, "forbidden");
    const r = await post(me, loginBody({ destinations: [domain] }));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect((d["login_check"] as Record<string, unknown>)["state"]).toBe("forbidden");
    expect(await jobsOf(String(d["id"]))).toBe(0);
    expect((await h.row(String(d["id"])))?.["service_id"]).toBe(sid);
  });

  it("K352-API-016 staging で消える保管先のまま：503・E-SEC-002 で金庫に置かず行も作らない", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    h.deps.env = "staging";
    h.vault.durable = false;
    try {
      const r = await post(me, keyBody());
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-SEC-002");
    } finally {
      h.deps.env = "test";
      h.vault.durable = true;
    }
    expect(h.vault.puts.length).toBe(puts);
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-017 手順 1 の失敗：金庫に置けないと 502・E-SEC-001、上限なら 503・E-SEC-003 と retry_after_sec。どちらも行を作らない", async () => {
    await h.ready();
    const me = await fresh();
    h.vault.failPut = new Error("置き場に届かない");
    try {
      const r = await post(me, keyBody());
      expect(r.status).toBe(502);
      expect((await h.json(r))["code"]).toBe("E-SEC-001");
      h.vault.failPut = new RateLimited(42);
      const r2 = await post(me, keyBody());
      expect(r2.status).toBe(503);
      const j = await h.json(r2);
      expect(j["code"]).toBe("E-SEC-003");
      expect(j["retry_after_sec"]).toBe(42);
    } finally {
      h.vault.failPut = null;
    }
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-018 手順 2 の失敗：行を作れない（引き金で断る）と 503・E-PAGE-003。手順 1 で置いた金庫の物は失効させる", async () => {
    await h.ready();
    const me = await fresh();
    const fn = `k352_block_${me.id.replace(/-/g, "")}`;
    await h.admin.query(
      `create or replace function public.${fn}() returns trigger language plpgsql as $$ begin if new.owner_member_id = '${me.id}' then raise exception 'k352 block'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert on credentials for each row execute function public.${fn}()`,
    );
    try {
      const puts = h.vault.puts.length;
      const r = await post(me, keyBody());
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      const placed = h.vault.puts.slice(puts);
      expect(placed).toHaveLength(1);
      expect(await h.vault.live(placed[0]!)).toBe(false);
    } finally {
      await h.admin.query(`drop trigger if exists ${fn} on credentials`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-019 手順 2 の失敗で、後片付け（金庫の物の失効）も失敗：503・E-PAGE-003。金庫の物は残り、ログに参照と「後片付け」が出て値は出ない", async () => {
    await h.ready();
    const me = await fresh();
    const fn = `k352_block2_${me.id.replace(/-/g, "")}`;
    await h.admin.query(
      `create or replace function public.${fn}() returns trigger language plpgsql as $$ begin if new.owner_member_id = '${me.id}' then raise exception 'k352 block'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert on credentials for each row execute function public.${fn}()`,
    );
    h.vault.failRevoke = new Error("失効に届かない");
    const placed: string[] = [];
    try {
      const puts = h.vault.puts.length;
      const logs = await h.captureLogs(async () => {
        const r = await post(me, keyBody());
        expect(r.status).toBe(503);
        expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      });
      placed.push(...h.vault.puts.slice(puts));
      expect(placed).toHaveLength(1);
      expect(logs).toContain(placed[0]!);
      expect(logs).toContain("後片付け");
      expect(logs).not.toContain(KEY_VALUE);
    } finally {
      h.vault.failRevoke = null;
      await h.admin.query(`drop trigger if exists ${fn} on credentials`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
    expect(await h.vault.live(placed[0]!)).toBe(true);
    expect(await rowsOf(me)).toHaveLength(0);
  });

  it("K352-API-020 同じ名前で同時に 2 回：201 はちょうど 1 回・もう 1 回は 409・E-CRED-006。行は 1 つで、行に結ばれない金庫の物は全部失効", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    const name = `RACE_${++seq}`;
    const rs = await Promise.all([post(me, keyBody({ name })), post(me, keyBody({ name }))]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await h.json(rs.find((r) => r.status === 409)!))["code"]).toBe("E-CRED-006");
    const rows = await rowsOf(me);
    expect(rows).toHaveLength(1);
    for (const ref of h.vault.puts.slice(puts).filter((x) => x !== rows[0]!["vault_ref"]))
      expect(await h.vault.live(ref)).toBe(false);
  });

  it("K352-API-021 手順 3 の失敗：確かめの仕事を積めない（引き金で断る）：201 で行は残り、login_check.state は null。ログに id と「確かめ」", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const fn = `k352_nojob_${me.id.replace(/-/g, "")}`;
    await h.admin.query(
      `create or replace function public.${fn}() returns trigger language plpgsql as $$ begin if new.member_id = '${me.id}' then raise exception 'k352 no job'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create trigger ${fn} before insert on bridge_jobs for each row execute function public.${fn}()`,
    );
    try {
      let id = "";
      const logs = await h.captureLogs(async () => {
        const r = await post(me, loginBody());
        expect(r.status, await r.clone().text()).toBe(201);
        const d = (await h.json(r)).data as Record<string, unknown>;
        id = String(d["id"]);
        expect((d["login_check"] as Record<string, unknown>)["state"]).toBeNull();
      });
      expect(logs).toContain(id);
      expect(logs).toContain("確かめ");
      expect(logs).not.toContain(PASSWORD);
      expect(await h.row(id)).toMatchObject({ login_check_state: null, deleted_at: null });
    } finally {
      await h.admin.query(`drop trigger if exists ${fn} on bridge_jobs`);
      await h.admin.query(`drop function if exists public.${fn}()`);
    }
  });

  it("K352-API-022 漏らさない：預けた値（パスワード・鍵の値）は、その間のログにも答えにも出ない。証跡に credential.create が 1 行で値は無い", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    let id = "";
    const logs = await h.captureLogs(async () => {
      const a = await post(me, loginBody());
      const b = await post(me, keyBody());
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      const ta = await a.text();
      const tb = await b.text();
      for (const t of [ta, tb]) {
        expect(t).not.toContain(PASSWORD);
        expect(t).not.toContain(KEY_VALUE);
      }
      id = (JSON.parse(ta) as { data: { id: string } }).data.id;
    });
    expect(logs).not.toContain(PASSWORD);
    expect(logs).not.toContain(KEY_VALUE);
    const ev = await h.admin.query<{ payload: unknown }>(
      "select to_jsonb(a) as payload from audit_events a where a.target_id = $1 and a.action = 'credential.create'",
      [id],
    );
    expect(ev.rows).toHaveLength(1);
    expect(JSON.stringify(ev.rows[0]!.payload)).not.toContain(PASSWORD);
  });

  it("K352-API-023 ログインしていない：401 で金庫に置かない", async () => {
    await h.ready();
    const puts = h.vault.puts.length;
    const r = await h.req("POST", "/credentials", { body: keyBody() });
    expect(r.status).toBe(401);
    expect(h.vault.puts.length).toBe(puts);
  });

  it("K352-API-024 上限：同じ人が上限を超えたら 429 と retry_after_sec（1〜60 の整数）で金庫に置かない", async () => {
    await h.ready();
    const me = await fresh();
    h.limits["createCredential"] = 1;
    try {
      expect((await post(me, keyBody())).status).toBe(201);
      const puts = h.vault.puts.length;
      const r = await post(me, keyBody());
      expect(r.status).toBe(429);
      const s = Number((await h.json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      expect(h.vault.puts.length).toBe(puts);
    } finally {
      delete h.limits["createCredential"];
    }
  });

  it("K352-API-025 同意し直しが要るセッション：403・E-AUTH-010 で金庫に置かない", async () => {
    await h.ready();
    const me = await fresh();
    const puts = h.vault.puts.length;
    const r = await post(me, keyBody(), { termsPending: true });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("E-AUTH-010");
    expect(h.vault.puts.length).toBe(puts);
  });
});
