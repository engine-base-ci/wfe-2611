// K-427「入口が NUL（U+0000）を含む入力を 422 で断る」の単体の試験（口・本物の Postgres）。名前の頭の行 ID（K427-API-…）は 11_tickets/K-427.md の行の表と 1 対 1。
// 由来：契約 fuzz（G36）が listTickets の q に NUL を入れて 500 を見つけた。Postgres の text は NUL を入れられない（22021）ので、DB に渡った所で落ちていた。
// 決まり：口ごとに直さず、入口（op.ts）で道の値・問い合わせ・体（JSON の文字列とキー）のどれでも NUL を含めば 422・VALIDATION_ERROR・欄の名前・理由「使えない文字」。
//   答えに送った字を出さない。入口の順（401・403・501 のあとに 422）は変えない。2 層目として DB の番号 22021・22P05 も 422（app.ts の onError と同じ写し）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbInputFailure } from "../src/contract/op.js";
import { ticketHooks } from "../src/hooks/tickets.js";
import { makeFixture, type Fixture, type Person } from "./features/fixture.js";

let f: Fixture;
interface World {
  tenantId: string;
  root: string;
  me: Person;
  task: { id: string };
}
const SECRET_TEXT = "でたらめな字ZQX";
const NUL = "\u0000";
const dueOn = () => new Date(Date.now() + 9 * 3600_000 + 3 * 86400_000).toISOString().slice(0, 10);

const json = async (r: Response) => (await r.json()) as Record<string, unknown>;
const detailsOf = (b: Record<string, unknown>) => (b["details"] ?? []) as { field: string; message: string }[];

async function world(): Promise<World> {
  const c = await f.company(`K427 の会社 ${Math.random().toString(36).slice(2, 7)}`, "NU");
  const me = await f.person(c.tenantId, c.rootScope, { name: "高本", ticketAbility: "edit" });
  const kinds = (await json(await f.req("GET", "/ticket_kinds", { headers: me.auth })))["data"] as {
    id: string;
    name: string;
  }[];
  return { tenantId: c.tenantId, root: c.rootScope, me, task: kinds.find((k) => k.name === "タスク")! };
}
const ticketCount = async (tenantId: string) =>
  Number(
    (await f.admin.query<{ n: string }>("select count(*) as n from tickets where tenant_id = $1", [tenantId])).rows[0]!
      .n,
  );
/** 作る口で 1 件作る。title は選べる。extraSections を渡したときだけ区画の入力 sections を送る（K-578 で契約から外れた欄・NUL の確かめは契約の形より前） */
const create = (w: World, title: string, extraSections: Record<string, unknown> = {}) =>
  f.req("POST", "/tickets", {
    body: {
      scope_id: w.root,
      kind_id: w.task.id,
      title,
      assignee_member_id: w.me.id,
      due_on: dueOn(),
      ...(Object.keys(extraSections).length ? { sections: extraSections } : {}),
    },
    headers: w.me.auth,
  });
const list = (w: World, qs: string, headers: Record<string, string> = w.me.auth) =>
  f.req("GET", `/tickets?${qs}`, { headers });

beforeAll(async () => {
  f = await makeFixture([ticketHooks]);
  f.limits["createTicket"] = 10_000;
  f.limits["listTickets"] = 10_000;
  f.limits["listScopes"] = 10_000;
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-427 入口：NUL（U+0000）を含む入力は 422", () => {
  it("K427-API-001 契約 fuzz が見つけた形（limit・scope_id・cursor 空・view 空・q に NUL 混じりのでたらめな字）：500 でなく 422・VALIDATION_ERROR・欄 q。答えに送った字を出さない", async () => {
    const w = await world();
    const r = await list(
      w,
      `limit=86&scope_id=${w.root}&cursor=&view=&q=${encodeURIComponent(`${SECRET_TEXT}${NUL}%x${NUL}`)}`,
    );
    const text = await r.clone().text();
    expect(r.status, text).toBe(422);
    const b = await json(r);
    expect(b["code"]).toBe("VALIDATION_ERROR");
    expect(detailsOf(b).map((d) => d.field)).toContain("q");
    expect(text).not.toContain(SECRET_TEXT);
    // 先頭・途中・末尾のどこに NUL があっても同じ
    for (const q of [`${NUL}abc`, `ab${NUL}c`, `abc${NUL}`, NUL]) {
      const x = await list(w, `q=${encodeURIComponent(q)}`);
      expect(x.status, JSON.stringify(q)).toBe(422);
    }
  });

  it("K427-API-002 q 以外の欄（view）と、一覧でない口（GET /scopes の使わない欄）の問い合わせでも、NUL があれば 422・その欄の名前。ふつうの値は今までどおり 200", async () => {
    const w = await world();
    const v = await list(w, `view=${encodeURIComponent(`mine${NUL}`)}`);
    expect(v.status, await v.clone().text()).toBe(422);
    expect(detailsOf(await json(v)).map((d) => d.field)).toContain("view");
    const s = await f.req("GET", `/scopes?x=${encodeURIComponent(`a${NUL}b`)}`, { headers: w.me.auth });
    expect(s.status, await s.clone().text()).toBe(422);
    expect(detailsOf(await json(s)).map((d) => d.field)).toContain("x");
    expect((await list(w, "view=all")).status).toBe(200);
    expect((await f.req("GET", "/scopes?x=ab", { headers: w.me.auth })).status).toBe(200);
  });

  it("K427-API-003 体の文字列（title）に NUL（JSON の \\u0000）：422・欄 title。チケットは増えない。NUL の無い同じ題は 201", async () => {
    const w = await world();
    const before = await ticketCount(w.tenantId);
    for (const title of [`請求書${NUL}`, `${NUL}請求書`, `請${NUL}求書`]) {
      const r = await create(w, title);
      const text = await r.clone().text();
      expect(r.status, `${JSON.stringify(title)} ${text}`).toBe(422);
      expect(detailsOf(await json(r)).map((d) => d.field)).toContain("title");
    }
    expect(await ticketCount(w.tenantId)).toBe(before);
    const ok = await create(w, "請求書");
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect(await ticketCount(w.tenantId)).toBe(before + 1);
  });

  it("K427-API-004 入れ子の値（sections の欄の値）とキー（sections の欄の名前）の NUL：422・欄は入れ子の道（sections.<キー>）か sections。jsonb の 22P05 まで届かず、チケットは増えない", async () => {
    const w = await world();
    const before = await ticketCount(w.tenantId);
    const key = "purpose"; // K-578：種別の区画は答えに出ないので、前の区画の名前を 1 つ決めて送る
    const inValue = await create(w, "入れ子の値", { [key]: `書いた${NUL}` });
    expect(inValue.status, await inValue.clone().text()).toBe(422);
    expect(detailsOf(await json(inValue)).map((d) => d.field)).toContain(`sections.${key}`);
    const inKey = await create(w, "入れ子のキー", { [`別${NUL}の欄`]: "書いた" });
    const keyText = await inKey.clone().text();
    expect(inKey.status, keyText).toBe(422);
    expect(JSON.parse(keyText).code).toBe("VALIDATION_ERROR");
    expect(await ticketCount(w.tenantId)).toBe(before);
  });

  it("K427-API-005 ふつうの字は断らない：全角・絵文字・タブ・改行・NUL でない制御文字（\\u0001）の q は 200、同じ字の題は 201 で、その q で出る", async () => {
    const w = await world();
    const title = "ＡＢＣ請求書🧾\tメモ";
    const made = await create(w, title);
    expect(made.status, await made.clone().text()).toBe(201);
    for (const q of ["ＡＢＣ", "請求書🧾", "メモ", "a\u0001b", "line\nbreak"]) {
      const r = await list(w, `view=all&q=${encodeURIComponent(q)}`);
      expect(r.status, `${JSON.stringify(q)} ${await r.clone().text()}`).toBe(200);
    }
    const hit = (await json(await list(w, `view=all&q=${encodeURIComponent("ＡＢＣ")}`)))["data"] as {
      title: string;
    }[];
    expect(hit.map((x) => x.title).join("|")).toContain("請求書🧾");
  });

  it("K427-API-006 入口の順は変わらない：ログインしていない人の NUL は 401（422 でない）。ログインの人が NUL で断られた直後の、ふつうの要求は 200", async () => {
    const w = await world();
    const anon = await f.req("GET", `/tickets?q=${encodeURIComponent(`a${NUL}`)}`);
    expect(anon.status, await anon.clone().text()).toBe(401);
    const bad = await list(w, `q=${encodeURIComponent(`a${NUL}`)}`);
    expect(bad.status).toBe(422);
    expect((await list(w, "view=all&q=a")).status).toBe(200);
  });

  it("K427-API-009 道の値（uuid でない token）の NUL：公開の口 getInvitation・acceptInvitation は 401 を挟まず 422・VALIDATION_ERROR・欄 token。NUL の無い token は入口の確かめを通る（422 にならない）", async () => {
    for (const [method, path] of [
      ["GET", `/auth/invitations/ab%00cd`],
      ["POST", `/auth/invitations/ab%00cd/accept`],
    ] as const) {
      const r = await f.req(method, path, method === "POST" ? { body: {} } : {});
      const text = await r.clone().text();
      expect(r.status, `${method} ${path} ${text}`).toBe(422);
      const b = await json(r);
      expect(b["code"]).toBe("VALIDATION_ERROR");
      expect(detailsOf(b).map((d) => d.field)).toEqual(["token"]);
    }
    const plain = await f.req("GET", "/auth/invitations/abcd");
    expect(plain.status, await plain.clone().text()).not.toBe(422);
  });

  it("K427-API-007 2 層目：DB が NUL で落ちた番号（text の 22021・jsonb の 22P05）は DB の決まりに合わない入力として数える。無関係の番号は数えない", () => {
    expect(dbInputFailure({ code: "22021" })).not.toBeNull();
    expect(dbInputFailure({ code: "22P05" })).not.toBeNull();
    expect(dbInputFailure({ code: "22P02" })).not.toBeNull(); // 前から
    expect(dbInputFailure({ code: "57014" })).toBeNull(); // 時間切れは入力の誤りでない
    expect(dbInputFailure(new Error("x"))).toBeNull();
  });
});
