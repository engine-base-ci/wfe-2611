// K-145「前の道すじ（/api/auth-ext）の id の確かめ・送る量の守り・切り捨て」の単体の試験（口・本物の Postgres・RLS あり）。
//   名前の頭の行 ID（K145-API-…）は 11_tickets/K-145.md の表のマスに 1 対 1 で結ぶ。テストはチケットのセッションが書き、実装より先にコミットする（D-128.125・D-132）。
//   決まり：
//     ・D-129.42 入力の id は入口で正式な uuid（契約の入口 op.ts と同じ isUuid＝z.uuid()）として確かめ、違えば 422（欄の名前・理由 "uuid"）。中で 500 になる道を残さない
//     ・D-130.1 送る内容全体 1MB の守り（読みながら数え、超えた時点で 413・「送る内容が大きすぎます」）を前の道すじと node のサーバーにも
//     ・D-130.2 DB の決まりに合わず断るときの文は「入力内容を確認してください」（2 層目・22P02）
//     ・D-130.4 人が自由に書く欄（会話の名前・記憶・一言・指示）を黙って切らない
//   K-62 が消す口（/bridge/take・finish・progress・control・tool）はここでは触らない
// K-358：預けたログイン情報の前の道すじ（/vault/credentials・/bridge/code・/bridge/credentials/*）を消したので、その行を外した（id の形の確かめは契約の入口が持つ・K354-API-013・K355-API-024）
// K-765：会話の写し（/bridge/entries・/bridge/attachment）と /bridge/mirror-targets は契約の口へ移り前の道すじから外したので、その行を外し、鍵の確かめは /bridge/steers で見る
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { isUuid } from "@kaname/contracts";
import { createApp } from "../src/app.js";
import { parseDigest } from "../src/auth/memory.js";
import {
  BAD_IDS,
  BAD_PATH_IDS,
  BODY_MAX,
  GOOD_IDS,
  X,
  admin,
  app,
  appPool,
  bootK145,
  closeK145,
  count,
  countingBody,
  data,
  eventsOf,
  expectBadId,
  fullWidth,
  jobsOf,
  jsonOf,
  newConversation,
  newJob,
  newMemory,
  newProposal,
  post,
  ready,
  req,
  type Json,
} from "./k145_fixture.js";

beforeAll(bootK145, 60_000);
afterAll(closeK145);

describe("K-145 画面の口（ログインの要る前の道すじ）の id は正式な uuid で確かめる（D-129.42）", () => {
  it("K145-API-001 道の値 :id（会話・一言・許可・まとめ・記憶・候補・成果物・資格情報）が正式な uuid でない 7 種は 422・field id・理由 uuid。500 にならず、行は増えない・変わらない", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    const before = {
      conv: await count("select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null", [
        r.member,
      ]),
      mem: await count("select count(*) as n from memories where owner_member_id = $1", [r.member]),
      art: await count("select count(*) as n from artifacts where owner_member_id = $1", [r.member]),
    };
    const routes: [string, (id: string) => string, unknown][] = [
      ["PATCH", (id) => `/agent/conversations/${id}`, { title: "x" }],
      ["DELETE", (id) => `/agent/conversations/${id}`, undefined],
      ["POST", (id) => `/agent/conversations/${id}/read`, {}],
      ["DELETE", (id) => `/agent/steer/${id}`, undefined],
      ["DELETE", (id) => `/agent/permission-rules/${id}`, undefined],
      ["POST", (id) => `/agent/memory/digest/${id}/undo`, { memory_id: randomUUID() }],
      ["POST", (id) => `/agent/memory/digest/${id}/pick`, { index: 0 }],
      ["PATCH", (id) => `/agent/memory/${id}`, { body: "覚える" }],
      ["DELETE", (id) => `/agent/memory/${id}`, undefined],
      ["POST", (id) => `/agent/memory/proposals/${id}/send`, {}],
      ["POST", (id) => `/agent/memory/proposals/${id}/decide`, { accept: true }],
      ["GET", (id) => `/agent/artifacts/${id}`, undefined],
      ["PATCH", (id) => `/agent/artifacts/${id}`, { title: "x" }],
      ["POST", (id) => `/agent/artifacts/${id}/versions`, { text: "x" }],
      ["POST", (id) => `/agent/artifacts/${id}/revert`, { version: 1 }],
      ["GET", (id) => `/agent/artifacts/${id}/download`, undefined],
    ];
    for (const [method, path, body] of routes)
      for (const bad of BAD_PATH_IDS) {
        const label = `${method} ${path("<id>")} id=${JSON.stringify(bad)}`;
        await expectBadId(await req(method, path(encodeURIComponent(bad)), body, r.H), "id", label);
        // 同じ形違いをもう 1 回・正しい要求の直後も同じ答え（操作の揺れ）
        await expectBadId(await req(method, path(encodeURIComponent(bad)), body, r.H), "id", `${label}（2 回目）`);
      }
    expect((await req("PATCH", `/agent/conversations/${conv}`, { title: "正しい" }, r.H)).status).toBe(200);
    await expectBadId(
      await req("PATCH", `/agent/conversations/${encodeURIComponent(BAD_PATH_IDS[0]!)}`, { title: "x" }, r.H),
      "id",
      "正しい要求の直後",
    );
    expect({
      conv: await count("select count(*) as n from conversations where owner_member_id = $1 and deleted_at is null", [
        r.member,
      ]),
      mem: await count("select count(*) as n from memories where owner_member_id = $1", [r.member]),
      art: await count("select count(*) as n from artifacts where owner_member_id = $1", [r.member]),
    }).toEqual(before);
  }, 120_000);

  it("K145-API-002 体の id の欄（say の conversation_id・branch_from／resume・stop・steer・answer・answer2 の job_id／new の conversation_id／undo の memory_id／send の target_scope_id／artifacts の message_id／testrun/cancel の run_id／golive/pause の employee_id）が形違いなら 422・その欄の名前。仕事・会話・成果物は増えない（黙って捨てる所〔attachment_ids・quote.message_id・target_scope_id〕は D-135.4・k145_pending_decisions.test.ts）", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const conv = await newConversation(r.H);
    const jobs = await jobsOf(r.member);
    const convs = await count("select count(*) as n from conversations where owner_member_id = $1", [r.member]);
    const events = await eventsOf(job.job_id);
    const cases: [string, string, string, (bad: string) => unknown][] = [
      ["POST", "/agent/say", "conversation_id", (bad) => ({ text: "x", conversation_id: bad })],
      ["POST", "/agent/say", "branch_from", (bad) => ({ text: "x", branch_from: bad })],
      ["POST", "/agent/resume", "job_id", (bad) => ({ job_id: bad, how: "continue" })],
      ["POST", "/agent/new", "conversation_id", (bad) => ({ conversation_id: bad })],
      ["POST", "/agent/answer", "job_id", (bad) => ({ job_id: bad, request_id: "r1", allow: true })],
      ["POST", "/agent/stop", "job_id", (bad) => ({ job_id: bad })],
      ["POST", "/agent/steer", "job_id", (bad) => ({ job_id: bad, text: "直して" })],
      ["POST", "/agent/answer2", "job_id", (bad) => ({ job_id: bad, request_id: "r1", allow: true })],
      ["POST", `/agent/memory/digest/${randomUUID()}/undo`, "memory_id", (bad) => ({ memory_id: bad })],
      ["POST", "/agent/artifacts", "message_id", (bad) => ({ message_id: bad, text: "# 表\n中身" })],
      ["POST", "/onboard/testrun/cancel", "run_id", (bad) => ({ run_id: bad })],
      ["POST", "/onboard/golive/pause", "employee_id", (bad) => ({ employee_id: bad, paused: true })],
    ];
    const creds = await count("select count(*) as n from credentials where owner_member_id = $1", [r.member]);
    // 預かり先（関門 C8・vault）にも書かない：形の確かめは d.secrets.store より前（store も store_failed も証跡が増えない・精査 R 回 1 の気づき）
    const stores = await count(
      "select count(*) as n from audit_events where tenant_id = $1 and action like 'secret.store%'",
      [r.tenant],
    );
    for (const [method, path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(
          await req(method, path, body(bad), r.H),
          field,
          `${method} ${path} ${field}=${JSON.stringify(bad)}`,
        );
    expect(await count("select count(*) as n from credentials where owner_member_id = $1", [r.member])).toBe(creds);
    expect(
      await count("select count(*) as n from audit_events where tenant_id = $1 and action like 'secret.store%'", [
        r.tenant,
      ]),
      "形違いの service_id で預かり先に書いた",
    ).toBe(stores);
    // 形違いの要求では会話が増えていない
    expect(await count("select count(*) as n from conversations where owner_member_id = $1", [r.member])).toBe(convs);
    // null・送らない は「無し」：仕事は積まれる（会話は開いている 1 本を使う＝app.agent_open_conversation の決まり。開いていなければ作る）
    expect((await post("/agent/say", { text: "x" }, r.H)).status).toBe(201);
    expect(await jobsOf(r.member)).toBe(jobs + 1);
    expect(await count("select count(*) as n from conversations where owner_member_id = $1", [r.member])).toBe(convs);
    expect(await eventsOf(job.job_id)).toBe(events);
    expect((await req("GET", `/agent/conversations`, undefined, r.H)).status).toBe(200);
    void conv;
  }, 120_000);

  it("K145-API-003 問い合わせの id（/agent/state・/agent/messages の ?conversation_id）が形違いなら 422・field conversation_id。空（?conversation_id=）は指定なし（/agent/artifacts の ?conversation_id は黙って無視 → 422 は D-135.4・k145_pending_decisions.test.ts）", async () => {
    const r = await ready();
    for (const bad of BAD_IDS.filter((v) => v !== "")) {
      const q = encodeURIComponent(bad);
      await expectBadId(
        await req("GET", `/agent/state?conversation_id=${q}`, undefined, r.H),
        "conversation_id",
        `state ${bad}`,
      );
      await expectBadId(
        await req(
          "GET",
          `/agent/messages?conversation_id=${q}&before=${encodeURIComponent(new Date().toISOString())}`,
          undefined,
          r.H,
        ),
        "conversation_id",
        `messages ${bad}`,
      );
    }
    expect((await req("GET", "/agent/state?conversation_id=", undefined, r.H)).status).toBe(200);
    // /agent/messages は「いつより前か」が要る口。空の会話は 422 の文だけ（500 にしない）
    const m = await req(
      "GET",
      `/agent/messages?conversation_id=&before=${encodeURIComponent(new Date().toISOString())}`,
      undefined,
      r.H,
    );
    expect(m.status).toBe(422);
    expect((await jsonOf(m)).message).toContain("会話の id と、いつより前か");
  }, 60_000);
});

describe("K-145 PC の口（x-bridge-session）の id も同じ部品で確かめる", () => {
  it("K145-API-004 ask・answer・partial・steers・answer2 の job_id が形違いなら 422・その欄。出来事・証跡は増えない（形違いの id と印の順は K145-API-018）", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const events = await eventsOf(job.job_id);
    const audits = await count("select count(*) as n from audit_events where tenant_id = $1", [r.tenant]);
    // K-765：entries・attachment は契約の口へ移り前の道すじから外した（契約の口の id の形は K-760・K-761 の試験と生成の試験が見る）
    const cases: [string, string, (bad: string) => unknown][] = [
      ["/bridge/ask", "job_id", (bad) => ({ job_id: bad, request_id: "r1", tool: "Bash", summary: "ls" })],
      ["/bridge/answer", "job_id", (bad) => ({ job_id: bad, request_id: "r1" })],
      ["/bridge/partial", "job_id", (bad) => ({ job_id: bad, text: "途中" })],
      ["/bridge/steers", "job_id", (bad) => ({ job_id: bad })],
      ["/bridge/answer2", "job_id", (bad) => ({ job_id: bad, request_id: "r1" })],
    ];
    for (const [path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(await post(path, body(bad), r.B), field, `${path} ${field}=${JSON.stringify(bad)}`);
    expect(await eventsOf(job.job_id)).toBe(events);
    expect(await count("select count(*) as n from audit_events where tenant_id = $1", [r.tenant])).toBe(audits);
    // 正しい形の id は中へ（無い仕事は 404・動いている仕事の partial は 200）
    expect((await post("/bridge/partial", { job_id: randomUUID(), text: "x" }, r.B)).status).toBe(404);
    expect((await post("/bridge/partial", { job_id: job.job_id, text: "途中の文" }, r.B)).status).toBe(200);
  }, 120_000);

  it("K145-API-005 鍵の形：前の形（sessions の id）が uuid でない 36 字 → 401／正式な uuid か kpc_… で解けない → 410／外した直後（0 秒）の鍵 → 410（G-12・G-14）。どれも何も書かない", async () => {
    const r = await ready();
    const events = await count("select count(*) as n from bridge_job_events where tenant_id = $1", [r.tenant]);
    for (const bad of BAD_PATH_IDS) {
      const x = await post("/bridge/steers", { job_id: randomUUID() }, { "x-bridge-session": bad }); // K-765：mirror-targets は前の道すじから外したので、鍵だけで答えが決まる別の PC の口で見る
      expect(x.status, `鍵=${JSON.stringify(bad)}`).toBe(401);
      expect((await jsonOf(x)).code).toBe("UNAUTHENTICATED");
    }
    for (const key of [randomUUID(), "00000000-0000-4000-8000-000000000000", `kpc_${"a".repeat(43)}`]) {
      const x = await post("/bridge/steers", { job_id: randomUUID() }, { "x-bridge-session": key });
      expect(x.status, `鍵=${key}`).toBe(410);
      expect((await jsonOf(x)).code).toBe("SESSION_GONE");
    }
    // 外した直後（0 秒）
    expect(
      (await post("/bridge/steers", { job_id: randomUUID() }, r.B)).status,
      "外す前は鍵が通る（無い仕事なので 404）",
    ).toBe(404);
    // 外す前の道すじ（画面の auth-ext の外す口）は K-367 で消した（契約の口 revokeMyDevice は K-362 の試験が見る）。ここでは行を直に外す。
    //   理由は前の口が書いていた値（logout）のまま：新しい理由の値（K-362 の migration が足す）に依らず、その migration の前の木でも後の木でも通る
    await admin.query("update sessions set revoked_at = now(), revoke_reason_id = 'logout' where id = $1", [r.sid]);
    const gone = await post("/bridge/steers", { job_id: randomUUID() }, r.B);
    expect(gone.status).toBe(410);
    expect(await count("select count(*) as n from bridge_job_events where tenant_id = $1", [r.tenant])).toBe(events);
  }, 60_000);
});

describe("K-145 正しい uuid は今までどおり中へ（500 にしない）・表記ゆらぎ・2 層目", () => {
  it("K145-API-006 無い行（v4・v7・nil・max・大文字）は 404。他の人の会話・記憶の id も 404 で中身を返さず、一覧の件数にも混ざらない（TP-PERM-03・04）", async () => {
    const me = await ready();
    const other = await ready();
    const theirs = await newConversation(other.H);
    const theirMem = await newMemory(other);
    for (const id of [...GOOD_IDS, theirs]) {
      const r1 = await req("PATCH", `/agent/conversations/${id}`, { title: "乗っ取り" }, me.H);
      expect(r1.status, id).toBe(404);
      expect((await jsonOf(r1)).code).toBe("CONVERSATION_NOT_FOUND");
      expect((await req("DELETE", `/agent/conversations/${id}`, undefined, me.H)).status, id).toBe(404);
      expect((await req("GET", `/agent/artifacts/${id}`, undefined, me.H)).status, id).toBe(404);
      expect((await post(`/agent/memory/proposals/${id}/send`, {}, me.H)).status, id).toBe(404);
      const m = await req(
        "GET",
        `/agent/messages?conversation_id=${id}&before=${encodeURIComponent(new Date().toISOString())}`,
        undefined,
        me.H,
      );
      expect(m.status, id).toBe(404);
    }
    expect((await req("PATCH", `/agent/memory/${theirMem}`, { body: "書き換え" }, me.H)).status).toBe(404);
    expect((await admin.query("select body from memories where id = $1", [theirMem])).rows[0]!.body).toBe("前の本文");
    expect((await req("PATCH", `/agent/conversations/${theirs}`, { title: "乗っ取り" }, me.H)).status).toBe(404);
    expect(await data<unknown[]>(req("GET", `/agent/artifacts?conversation_id=${theirs}`, undefined, me.H))).toEqual(
      [],
    );
    const list = await data<{ id: string }[]>(req("GET", "/agent/conversations", undefined, me.H));
    expect(list.map((c) => c.id)).not.toContain(theirs);
  }, 60_000);

  it("K145-API-007 表記ゆらぎ：道の値が大文字・前後の空白・全角の自分の会話の id でも、揃えて同じ会話として 200（契約の入口 K144-API-016 と同じ）", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    for (const [label, make] of [
      ["大文字", (u: string) => u.toUpperCase()],
      ["前後の空白", (u: string) => `  ${u}  `],
      ["全角", fullWidth],
    ] as const) {
      const x = await req(
        "PATCH",
        `/agent/conversations/${encodeURIComponent(make(conv))}`,
        { title: `名前 ${label}` },
        r.H,
      );
      expect(x.status, label).toBe(200);
      const t = (await admin.query("select title from conversations where id = $1", [conv])).rows[0]!.title as string;
      expect(t, label).toBe(`名前 ${label}`);
    }
  }, 60_000);

  it("K145-API-008 2 層目：入口の確かめを外して形違いの文字が DB の uuid の引数に届いても（22P02）、500 でなく 422・VALIDATION_ERROR・「入力内容を確認してください」。答えに DB の文を出さない（D-130.2）", async () => {
    // 入口の確かめの無い小さな口を /api/auth-ext に付ける（本物の pg・本物の app.ts の onError）
    const leaky = new Hono();
    leaky.get("/k145/cast/:v", async (c) => {
      const r = await appPool.query<{ v: string }>("select $1::uuid as v", [c.req.param("v")]);
      return c.json({ data: r.rows[0]!.v });
    });
    const app2 = createApp({ version: "test", authExt: leaky });
    // 記録（console.error）には番号（22P02）だけ。送った値と DB の文は出さない（K-144 ㊳ と同じ・精査 R 回 1 #4）
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      logged.push(a.map((x) => (x instanceof Error ? `${x.message} ${x.stack ?? ""}` : String(x))).join(" "));
    });
    // DB の uuid の型が断る形だけ（①36 個のハイフン・③g を含む・⑦形違い・⑧37 字）。版や variant の桁だけが違う②④⑤は、
    //   Postgres の uuid の型が通す（16 進 32 桁なら受ける）ので 22P02 にならない。それを断るのは 1 層目（入口の isUuid）
    for (const bad of [0, 2, 5, 6].map((i) => BAD_PATH_IDS[i]!)) {
      logged.length = 0;
      const x = await app2.request(`http://localhost${X}/k145/cast/${encodeURIComponent(bad)}`);
      expect(logged.join("\n"), `${bad}: 記録に番号が無い`).toContain("22P02");
      expect(logged.join("\n"), `${bad}: 記録に DB の文が出た`).not.toMatch(/invalid input syntax/i);
      expect(logged.join("\n"), `${bad}: 記録に送った値が出た`).not.toContain(bad);
      const text = await x.clone().text();
      expect(x.status, `${bad}: ${text.slice(0, 120)}`).toBe(422);
      const j = (await x.json()) as Json;
      expect(j.code).toBe("VALIDATION_ERROR");
      expect(j.details?.[0]?.message).toBe("入力内容を確認してください");
      expect(text).not.toMatch(/invalid input syntax|uuid/i);
    }
    spy.mockRestore();
    const ok = await app2.request(`http://localhost${X}/k145/cast/${GOOD_IDS[0]}`);
    expect(ok.status).toBe(200);
  }, 60_000);

  it("K145-API-018 断る順（契約の入口 op.ts と同じく、だれかが先・形が後）：画面の口はログインしていなければ形違いの id でも 401。PC の口は 印の頭が無い・印の形が違う → 401、印の形は合うが外した・知らない印 → 410、生きている印 → 422（id の形）。どれも何も書かない", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const bad = BAD_PATH_IDS[0]!;
    // 画面の口：ログインしていない（頭なし）
    for (const [method, path, body] of [
      ["PATCH", `/agent/conversations/${encodeURIComponent(bad)}`, { title: "x" }],
      ["GET", `/agent/artifacts/${encodeURIComponent(bad)}`, undefined],
      ["POST", "/agent/say", { text: "x", conversation_id: bad }],
      ["POST", "/agent/answer", { job_id: bad, request_id: "r1", allow: true }],
      ["GET", `/agent/state?conversation_id=${encodeURIComponent(bad)}`, undefined],
    ] as const) {
      const x = await req(method, path, body);
      expect(x.status, `${method} ${path}`).toBe(401);
      expect((await jsonOf(x)).code).toBe("UNAUTHENTICATED");
    }
    // PC の口：頭なし・形の違う印 → 401
    const events = await eventsOf(job.job_id);
    const pcCases: [string, (id: string) => unknown][] = [
      ["/bridge/ask", (id) => ({ job_id: id, request_id: "r1", tool: "Bash", summary: "ls" })],
      ["/bridge/partial", (id) => ({ job_id: id, text: "途中" })],
      ["/bridge/answer2", (id) => ({ job_id: id, request_id: "r1" })],
    ];
    for (const [path, body] of pcCases) {
      expect((await post(path, body(bad))).status, `${path} 頭なし`).toBe(401);
      expect((await post(path, body(bad), { "x-bridge-session": "not-a-key" })).status, `${path} 形の違う印`).toBe(401);
      expect((await post(path, body(bad), r.B)).status, `${path} 生きている印`).toBe(422);
    }
    // 外した印（形は合う）→ 形違いの id でも 410（Bridge は印を捨てる）
    // 外す前の道すじ（画面の auth-ext の外す口）は K-367 で消した（契約の口 revokeMyDevice は K-362 の試験が見る）。ここでは行を直に外す。
    //   理由は前の口が書いていた値（logout）のまま：新しい理由の値（K-362 の migration が足す）に依らず、その migration の前の木でも後の木でも通る
    await admin.query("update sessions set revoked_at = now(), revoke_reason_id = 'logout' where id = $1", [r.sid]);
    for (const [path, body] of pcCases) {
      const x = await post(path, body(bad), r.B);
      expect(x.status, `${path} 外した印`).toBe(410);
      expect((await jsonOf(x)).code).toBe("SESSION_GONE");
    }
    expect(await eventsOf(job.job_id)).toBe(events);
  }, 60_000);
});

describe("K-145 送る量の守り（D-130.1・G-16）を前の道すじと node のサーバーにも", () => {
  it("K145-API-009 /sign-in（ログイン不要）と /agent/say（ログイン要る）に (a) content-length を 100 と偽った 5MB の流れ (b) 頭の無い 5MB の流れ (c) 頭だけ 1,048,577 の小さな体 → どれも 413・PAYLOAD_TOO_LARGE・「送る内容が大きすぎます」。(a)(b) は 1MB と 2 かたまりまでしか読まず、(c) は 1 バイトも読まない。ログインしていなくても 413 が 401 より先。仕事は増えない", async () => {
    const r = await ready();
    const jobs = await jobsOf(r.member);
    const bad: string[] = [];
    const TOTAL = 5 * BODY_MAX;
    for (const [path, headers] of [
      ["/sign-in", {}],
      ["/agent/say", r.H],
    ] as const) {
      for (const [label, length, total, maxRead] of [
        ["(a) content-length を 100 と偽った", "100", TOTAL, "limit"],
        ["(b) content-length の頭が無い", null, TOTAL, "limit"],
        ["(c) content-length の頭だけが 1,048,577", String(BODY_MAX + 1), 2, "none"],
        // 守りの外は道で決める：資料の口でない口に multipart の頭を付けても守りは外れない（テスター回 2 #6）
        ["(d) multipart の頭を付けた頭の無い 5MB の流れ", null, TOTAL, "limit"],
      ] as const) {
        const b = countingBody(total);
        const h: Record<string, string> = {
          "content-type": label.startsWith("(d)") ? "multipart/form-data; boundary=k145" : "application/json",
          ...headers,
        };
        if (length !== null) h["content-length"] = length;
        const res = await app.request(
          new Request(`http://localhost${X}${path}`, {
            method: "POST",
            headers: h,
            body: b.stream,
            duplex: "half",
          } as RequestInit),
        );
        const j = await jsonOf(res);
        if (res.status !== 413 || j.code !== "PAYLOAD_TOO_LARGE" || j.message !== "送る内容が大きすぎます")
          bad.push(`${path} ${label}：${res.status} ${JSON.stringify(j).slice(0, 80)}`);
        if (maxRead === "none" && b.pulled() !== 0)
          bad.push(`${path} ${label}：読まずに断るはずが ${b.pulled()} バイト読んだ`);
        if (maxRead === "limit" && b.pulled() > BODY_MAX + 2 * b.chunk)
          bad.push(`${path} ${label}：${b.pulled()} バイト読んだ（上限は ${BODY_MAX + 2 * b.chunk}）`);
      }
    }
    expect(bad).toEqual([]);
    expect(await jobsOf(r.member)).toBe(jobs);
  }, 120_000);

  it("K145-API-010 /agent/say の体がちょうど 1,048,576 バイトは 201（仕事が 1 つ増える）、1,048,577 バイトは 413（増えない）", async () => {
    const r = await ready();
    const bodyOf = (bytes: number) => {
      const wrap = Buffer.byteLength('{"text":""}');
      return `{"text":"${"a".repeat(bytes - wrap)}"}`;
    };
    expect(Buffer.byteLength(bodyOf(BODY_MAX))).toBe(BODY_MAX);
    const jobs = await jobsOf(r.member);
    const ok = await post("/agent/say", bodyOf(BODY_MAX), r.H);
    expect(
      ok.status,
      await ok
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    expect(await jobsOf(r.member)).toBe(jobs + 1);
    const big = await post("/agent/say", bodyOf(BODY_MAX + 1), r.H);
    expect(big.status).toBe(413);
    expect((await jsonOf(big)).code).toBe("PAYLOAD_TOO_LARGE");
    expect(await jobsOf(r.member)).toBe(jobs + 1);
  }, 60_000);

  it("K145-API-012 本番と同じ node のサーバー（@hono/node-server）に、頭の無い 5MB の流れを /api/v1/auth/sign-in へ送ると 413 が返り、接続が閉じる（吊るさない）。サーバーは落ちない（/health が 200）", async () => {
    const server: ServerType = await new Promise((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => resolve(s));
    });
    try {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      expect(port).toBeGreaterThan(0);
      const result = await new Promise<{ status: number; body: string; sent: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("10 秒たっても答えが来ない（吊るしている）")), 10_000);
        let sent = 0;
        const rq = httpRequest(
          {
            host: "127.0.0.1",
            port,
            method: "POST",
            path: "/api/v1/auth/sign-in",
            headers: { "content-type": "application/json", "transfer-encoding": "chunked" },
          },
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => {
              clearTimeout(timer);
              resolve({ status: res.statusCode ?? 0, body, sent });
            });
          },
        );
        rq.on("error", (e) => {
          // 413 を返した後にサーバーが切る（EPIPE／ECONNRESET）のは「吊るさない」の形。答えを受け取っていれば上の end が先に解決する
          if (!["EPIPE", "ECONNRESET"].includes((e as NodeJS.ErrnoException).code ?? "")) {
            clearTimeout(timer);
            reject(e);
          }
        });
        const chunk = Buffer.alloc(65_536, 0x61);
        const pump = () => {
          while (sent < 5 * BODY_MAX) {
            sent += chunk.byteLength;
            if (!rq.write(chunk)) return rq.once("drain", pump);
          }
          rq.end();
        };
        pump();
      });
      expect(result.status).toBe(413);
      expect(JSON.parse(result.body)).toMatchObject({ code: "PAYLOAD_TOO_LARGE", message: "送る内容が大きすぎます" });
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(health.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});

describe("K-145 人が書く欄を黙って切らない（D-130.4）", () => {
  it("K145-API-013 会話の名前 300 字（PATCH /agent/conversations/:id）と記憶の題 300 字・本文 5000 字（PATCH /agent/memory/:id）は、一覧と DB から読み戻して一字も欠けない", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    const title = `会話の名前${"長".repeat(290)}終`;
    expect((await req("PATCH", `/agent/conversations/${conv}`, { title }, r.H)).status).toBe(200);
    const list = await data<{ id: string; title: string }[]>(req("GET", "/agent/conversations", undefined, r.H));
    expect(list.find((c) => c.id === conv)?.title).toBe(title);
    const mem = await newMemory(r);
    const mTitle = `題${"い".repeat(298)}末`;
    const mBody = `本文${"あ".repeat(4996)}末尾`;
    expect([...mBody].length).toBe(5000);
    expect((await req("PATCH", `/agent/memory/${mem}`, { title: mTitle, body: mBody }, r.H)).status).toBe(200);
    const row = (
      await admin.query<{ title: string; body: string }>("select title, body from memories where id = $1", [mem])
    ).rows[0]!;
    expect(row.title).toBe(mTitle);
    expect(row.body).toBe(mBody);
  }, 60_000);

  it("K145-API-014 候補の確認（POST /agent/memory/proposals/:id/decide）の本文 5000 字は、上の層の記憶に一字も欠けずに入る", async () => {
    const r = await ready();
    const proposal = await newProposal(r);
    const body = `上の層の決まり${"う".repeat(4990)}おわり`;
    const x = await post(`/agent/memory/proposals/${proposal}/decide`, { accept: true, body }, r.H);
    expect(
      x.status,
      await x
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(200);
    const row = (
      await admin.query<{ body: string }>(
        "select body from memories where source_type_id = 'proposal' and source_ref_id = $1",
        [proposal],
      )
    ).rows[0];
    expect(row?.body).toBe(body);
  }, 60_000);
});

describe("K-145 部品の決まり（DB に触らない）", () => {
  it("K145-API-016 まとめの答え（parseDigest）：merged.memory_ids は正式な uuid だけ残す（版の桁 0・36 個のハイフンは捨てる）。propose.target_scope_id は正式な uuid でなければ空（DB に届けない）", () => {
    const good = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const r = parseDigest(
      JSON.stringify({
        remembered: [],
        merged: [{ memory_ids: [...BAD_IDS, good], body: "m" }],
        propose: [...BAD_IDS, good].map((t, i) => ({ body: `p${i}`, target_scope_id: t })),
        discarded: [],
      }),
    );
    expect(r?.merged).toEqual([{ memory_ids: [good], title: "", body: "m", kind: "" }]);
    expect(r?.propose.map((p) => p.target_scope_id)).toEqual([...BAD_IDS.map(() => ""), good]);
  });

  it("K145-API-017 契約の isUuid（z.uuid()）の決まり：違う 8 つは false・正しい 5 つ（v4・v7・nil・max・大文字）は true。前後の空白は false（揃えるのは入口の normalize）", () => {
    expect(BAD_IDS.map((v) => isUuid(v))).toEqual(BAD_IDS.map(() => false));
    expect(GOOD_IDS.map((v) => isUuid(v))).toEqual(GOOD_IDS.map(() => true));
    expect(isUuid(` ${GOOD_IDS[0]} `)).toBe(false);
  });
});
