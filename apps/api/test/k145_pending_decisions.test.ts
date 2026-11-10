// K-145 のうち、決める人の答え（D-135・2026-11-10・answer=ffef5862874b「推奨どおり」）を待ってから積んだ行（聞くことが残っている間はコミットしない・正本 §1-11）。
//   D-135.1 ファイルを受ける口は送る量 1MB の守りの外（K145-API-011）／D-135.3 一言・問い合わせの答え・指示を切らない（K145-API-015・migration は K-62 の 0092 の次）／
//   D-135.5 資格情報のサービス名・資料のファイル名も切らない（K145-API-019・answer=3e67d8fb452f）／
//   D-135.4 形違いの id を黙って捨てる所（say・steer の attachment_ids の要素・quote.message_id、proposals/send の target_scope_id、/agent/artifacts の ?conversation_id）も 422（K145-API-002・003 の続き）
//   土台（組み立て・ready・newJob ほか）と BAD_IDS は k145_fixture.ts（試験のファイルどうしで import しない・精査 R 回 1 追加-1）
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { issueToolToken } from "../src/auth/agent-tools.js";
import {
  BAD_IDS,
  newConversation,
  X,
  admin,
  app,
  appPool,
  bootK145,
  closeK145,
  data,
  expectBadId,
  jobsOf,
  newJob,
  newMemory,
  post,
  ready,
  req,
} from "./k145_fixture.js";

beforeAll(bootK145, 60_000);
afterAll(closeK145);

describe("K-145 D-135.4：形違いの id を黙って捨てる所も 422（D-129.42）", () => {
  it("K145-API-002（続き）say・steer の attachment_ids の要素・quote.message_id、proposals/send の target_scope_id が形違いなら 422・その欄。仕事は増えない。null は「無し」で通す", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const mem = await newMemory(r);
    const proposal = (
      await admin.query<{ id: string }>(
        "insert into memory_proposals (tenant_id, scope_id, memory_id, target_scope_id, proposer_member_id, state_id) values ($1, $2, $3, $2, $4, 'draft') returning id",
        [r.tenant, r.scope, mem, r.member],
      )
    ).rows[0]!.id;
    const jobs = await jobsOf(r.member);
    const cases: [string, string, string, (bad: string) => unknown][] = [
      ["POST", "/agent/say", "attachment_ids", (bad) => ({ text: "x", attachment_ids: [bad] })],
      ["POST", "/agent/say", "quote.message_id", (bad) => ({ text: "x", quote: { text: "引用", message_id: bad } })],
      [
        "POST",
        "/agent/steer",
        "attachment_ids",
        (bad) => ({ job_id: job.job_id, text: "直して", attachment_ids: [bad] }),
      ],
      ["POST", `/agent/memory/proposals/${proposal}/send`, "target_scope_id", (bad) => ({ target_scope_id: bad })],
    ];
    for (const [method, path, field, body] of cases)
      for (const bad of BAD_IDS)
        await expectBadId(
          await req(method, path, body(bad), r.H),
          field,
          `${method} ${path} ${field}=${JSON.stringify(bad)}`,
        );
    expect(await jobsOf(r.member)).toBe(jobs);
    expect((await post("/agent/say", { text: "x", quote: { text: "引用", message_id: null } }, r.H)).status).toBe(201);
  }, 120_000);

  it("K145-API-002（続き 2）attachment_ids が並びでない（文字・物）・quote が物でない（文字）ときも黙って捨てずに 422・その欄。仕事は増えない（テスター回 2 #11）", async () => {
    const r = await ready();
    const job = await newJob(r, "running");
    const jobs = await jobsOf(r.member);
    const good = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    for (const [path, extra] of [
      ["/agent/say", { text: "x" }],
      ["/agent/steer", { job_id: job.job_id, text: "直して" }],
    ] as const) {
      for (const v of [good, { id: good }])
        await expectBadId(
          await post(path, { ...extra, attachment_ids: v }, r.H),
          "attachment_ids",
          `${path} attachment_ids=${JSON.stringify(v)}`,
        );
      const q = await post(path, { ...extra, quote: "引用の文" }, r.H);
      expect(q.status, `${path} quote が文字`).toBe(422);
      const j = (await q.json()) as { field?: string; details?: { field: string; message: string }[] };
      expect(j.field).toBe("quote");
      expect(j.details?.[0]).toEqual({ field: "quote", message: "object" });
    }
    expect(await jobsOf(r.member)).toBe(jobs);
  }, 60_000);

  it("K145-API-003（続き）/agent/artifacts の ?conversation_id が形違いなら 422・field conversation_id。空は指定なし（200・[]）", async () => {
    const r = await ready();
    for (const bad of BAD_IDS.filter((v) => v !== ""))
      await expectBadId(
        await req("GET", `/agent/artifacts?conversation_id=${encodeURIComponent(bad)}`, undefined, r.H),
        "conversation_id",
        `artifacts ${bad}`,
      );
    expect((await req("GET", "/agent/artifacts?conversation_id=", undefined, r.H)).status).toBe(200);
    expect(await data<unknown[]>(req("GET", "/agent/artifacts?conversation_id=", undefined, r.H))).toEqual([]);
  }, 60_000);
});

describe("K-145 D-135.1：ファイルを受ける口は送る量 1MB の守りの外", () => {
  it("K145-API-011 ファイルを受ける口は送る量 1MB の守りの外（D-135.1）：資料（multipart・1.5MB）は 201、成果物（/bridge/artifact・1.5MB の PNG・道具の鍵）も 201。置き場の上限（試験は 4MB）はそのまま", async () => {
    const r = await ready();
    const big = new Uint8Array(1_572_864).fill(0x61);
    const fd = new FormData();
    fd.append("file", new File([big], "大きい資料.txt", { type: "text/plain" }));
    const up = await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: r.H, body: fd });
    expect(
      up.status,
      await up
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const job = await newJob(r, "running");
    // K-62（0092）の後、道具の鍵は「その仕事を受け取った PC」（bridge_jobs.taken_session_id）にだけ作れる。
    //   この試験は K-62 の取り込みの後に流すので、受け取った形にしてから鍵を作る（精査 R 回 1 #22）
    await admin.query("update bridge_jobs set taken_session_id = $2 where id = $1", [job.job_id, r.sid]);
    const token = await issueToolToken(appPool, r.sid, job.job_id);
    expect(token).toBeTruthy();
    const png = new Uint8Array(1_572_864);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const art = await app.request(`http://localhost${X}/bridge/artifact`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(png.byteLength),
        "x-kaname-tool-token": token!,
        "x-artifact-name": encodeURIComponent("大きい図.png"),
      },
      body: png,
    });
    expect(
      art.status,
      await art
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    // 置き場の上限（4MB）を超えるファイルは今までどおり 413（E-LIM-002）
    const huge = new FormData();
    huge.append(
      "file",
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "大きすぎ.bin", { type: "application/octet-stream" }),
    );
    expect(
      (await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: r.H, body: huge }))
        .status,
    ).toBe(413);
  }, 60_000);
});

describe("K-145 D-135.3：一言・問い合わせの答え・指示を切らない（API と DB の関数・D-130.4）", () => {
  it("K145-API-015 許可の答えの一言 5000 字・問い合わせの答えの値 5000 字（/agent/answer2）と、止めずに直す指示 30000 字（/agent/steer）は、出来事（bridge_job_events）に一字も欠けずに残る（D-135.3）", async () => {
    const r = await ready();
    const asking = await newJob(r, "asking");
    const job = (
      await admin.query<{ tenant_id: string; scope_id: string | null; member_id: string }>(
        "select tenant_id, scope_id, member_id from bridge_jobs where id = $1",
        [asking.job_id],
      )
    ).rows[0]!;
    await admin.query(
      "insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, payload) values ($1, $2, $3, $4, 'ask', 'r1', $5::jsonb)",
      [
        job.tenant_id,
        job.scope_id,
        job.member_id,
        asking.job_id,
        JSON.stringify({ tool: "AskUserQuestion", questions: [{ question: "どちら" }], summary: "問い" }),
      ],
    );
    const note = `一言${"え".repeat(4996)}まで`;
    const answer = `答え${"お".repeat(4996)}まで`;
    const a = await post(
      "/agent/answer2",
      { job_id: asking.job_id, request_id: "r1", allow: true, note, answers: { どちら: answer } },
      r.H,
    );
    expect(
      a.status,
      await a
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const ev = (
      await admin.query<{ payload: { note: string; answers: Record<string, string> } }>(
        "select payload from bridge_job_events where job_id = $1 and kind = 'answer' and request_id = 'r1'",
        [asking.job_id],
      )
    ).rows[0]!;
    expect(ev.payload.note).toBe(note);
    expect(ev.payload.answers["どちら"]).toBe(answer);
    const running = await newJob(r, "running");
    const text = `指示${"か".repeat(29996)}まで`;
    expect([...text].length).toBe(30000);
    const s = await post("/agent/steer", { job_id: running.job_id, text }, r.H);
    expect(
      s.status,
      await s
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const st = (
      await admin.query<{ payload: { text: string } }>(
        "select payload from bridge_job_events where job_id = $1 and kind = 'steer'",
        [running.job_id],
      )
    ).rows[0]!;
    expect(st.payload.text).toBe(text);
    // 引用（D-135.3）：/agent/say の quote.text 5000 字は、保存する引用（messages.quote）と自分のAI への指示（bridge_jobs.prompt）の両方で欠けない。
    //   /agent/steer の引用も一言の出来事（payload.opts.quote）で欠けない（精査 R 回 1 #5）
    const quoteText = `引用${"き".repeat(4996)}まで`;
    const said = await data<{ job_id: string; conversation_id: string }>(
      post("/agent/say", { text: "ここを詳しく", quote: { text: quoteText, message_id: null } }, r.H),
    );
    const msg = (
      await admin.query<{ quote: { text: string } }>(
        "select quote from messages where job_id = $1 and kind = 'human'",
        [said.job_id],
      )
    ).rows[0]!;
    expect(msg.quote.text).toBe(quoteText);
    const prompt = (
      await admin.query<{ prompt: string }>("select prompt from bridge_jobs where id = $1", [said.job_id])
    ).rows[0]!.prompt;
    expect(prompt).toContain(quoteText);
    const running2 = await newJob(r, "running");
    expect(
      (
        await post(
          "/agent/steer",
          { job_id: running2.job_id, text: "直して", quote: { text: quoteText, message_id: null } },
          r.H,
        )
      ).status,
    ).toBe(201);
    const st2 = (
      await admin.query<{ payload: { opts?: { quote?: { text: string } } } }>(
        "select payload from bridge_job_events where job_id = $1 and kind = 'steer'",
        [running2.job_id],
      )
    ).rows[0]!;
    expect(st2.payload.opts?.quote?.text).toBe(quoteText);
  }, 60_000);
});

describe("K-145 D-135.5：人が打つ資格情報のサービス名と資料のファイル名も黙って切らない（上限も外す・D-130.4）", () => {
  it("K145-API-019 資格情報を預ける（/vault/credentials）サービス名 300 字と、資料を付ける（/agent/attachments）ファイル名 300 字は、答えと DB から読み戻して一字も欠けない（前は 120・200 字で黙って切った）", async () => {
    const r = await ready();
    const service = `サービス${"く".repeat(293)}終わり`;
    expect([...service].length).toBe(300);
    const c = await post(
      "/vault/credentials",
      { service_name: service, login: "me@example.com", password: "pw-k145-123" },
      r.H,
    );
    expect(
      c.status,
      await c
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const created = (await c.json()) as { data: { id: string; service_name: string } };
    expect(created.data.service_name).toBe(service);
    const row = (
      await admin.query<{ service_name: string }>("select service_name from credentials where id = $1", [
        created.data.id,
      ])
    ).rows[0]!;
    expect(row.service_name).toBe(service);
    const fileName = `${"資料の名前".repeat(59)}末.txt`;
    expect([...fileName].length).toBe(300);
    const fd = new FormData();
    fd.append("file", new File([new TextEncoder().encode("中身")], fileName, { type: "text/plain" }));
    const up = await app.request(`http://localhost${X}/agent/attachments`, { method: "POST", headers: r.H, body: fd });
    expect(
      up.status,
      await up
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const att = ((await up.json()) as { data: { id: string; name: string } }).data;
    expect(att.name).toBe(fileName);
    expect(
      (await admin.query<{ name: string }>("select name from attachments where id = $1", [att.id])).rows[0]!.name,
    ).toBe(fileName);
  }, 60_000);
});

describe("K-145 PM の判断（D-130.4・D-135.5 の適用・精査 R 回 1 追加-3）：成果物の名前・会話の検索語・止めた理由も黙って切らない", () => {
  it("K145-API-020 成果物を名前 300 字で書き出すと答え・一覧・DB の名前が一字も欠けない。名前を 300 字で変えても同じ（app.artifact_rename の left 80 を外す）", async () => {
    const r = await ready();
    const conv = await newConversation(r.H);
    const msg = (
      await admin.query<{ id: string }>(
        "insert into messages (tenant_id, conversation_id, body, kind) values ($1, $2, $3, 'ai') returning id",
        [r.tenant, conv, "# 見出し\n本文"],
      )
    ).rows[0]!.id;
    const t1 = `成果物の名前${"け".repeat(291)}終わり`;
    expect([...t1].length).toBe(300);
    const c = await post("/agent/artifacts", { message_id: msg, text: "# 見出し\n本文", title: t1 }, r.H);
    expect(
      c.status,
      await c
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(201);
    const art = ((await c.json()) as { data: { id: string; title: string } }).data;
    expect(art.title).toBe(t1);
    expect(
      (await admin.query<{ title: string }>("select title from artifacts where id = $1", [art.id])).rows[0]!.title,
    ).toBe(t1);
    const t2 = `変えた名前${"こ".repeat(292)}終わり`;
    expect([...t2].length).toBe(300);
    expect((await req("PATCH", `/agent/artifacts/${art.id}`, { title: t2 }, r.H)).status).toBe(200);
    expect(
      (await admin.query<{ title: string }>("select title from artifacts where id = $1", [art.id])).rows[0]!.title,
    ).toBe(t2);
    const list = await data<{ id: string; title: string }[]>(
      req("GET", `/agent/artifacts?conversation_id=${conv}`, undefined, r.H),
    );
    expect(list.find((a) => a.id === art.id)?.title).toBe(t2);
  }, 60_000);

  it("K145-API-021 会話の検索語 90 字は全部で探す（頭の 80 字が同じ別の会話は出ない）。止めたまま本番への理由 300 字は ai_employees と証跡に一字も欠けずに残る", async () => {
    const r = await ready();
    const head = `検索の頭${"さ".repeat(76)}`;
    expect([...head].length).toBe(80);
    const a = await newConversation(r.H);
    const b = await newConversation(r.H);
    const ta = `${head}${"甲".repeat(10)}`;
    expect((await req("PATCH", `/agent/conversations/${a}`, { title: ta }, r.H)).status).toBe(200);
    expect((await req("PATCH", `/agent/conversations/${b}`, { title: `${head}${"乙".repeat(10)}` }, r.H)).status).toBe(
      200,
    );
    const hits = await data<{ id: string }[]>(
      req("GET", `/agent/conversations?q=${encodeURIComponent(ta)}`, undefined, r.H),
    );
    expect(hits.map((x) => x.id)).toContain(a);
    expect(
      hits.map((x) => x.id),
      "頭の 80 字だけで探している",
    ).not.toContain(b);
    const m = (
      await admin.query<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name, role_id) values ($1, $2, 'ai_employee', 'K145 の AI社員', 'staff') returning id",
        [r.tenant, r.scope],
      )
    ).rows[0]!.id;
    const ai = (
      await admin.query<{ id: string }>(
        "insert into ai_employees (tenant_id, scope_id, member_id, created_by) values ($1, $2, $3, $4) returning id",
        [r.tenant, r.scope, m, r.member],
      )
    ).rows[0]!.id;
    const reason = `止める理由${"し".repeat(292)}終わり`;
    expect([...reason].length).toBe(300);
    const x = await post("/onboard/golive/pause", { employee_id: ai, paused: true, reason }, r.H);
    expect(
      x.status,
      await x
        .clone()
        .text()
        .then((t) => t.slice(0, 120)),
    ).toBe(200);
    expect(
      (await admin.query<{ paused_reason: string }>("select paused_reason from ai_employees where id = $1", [ai]))
        .rows[0]!.paused_reason,
    ).toBe(reason);
    const ev = (
      await admin.query<{ payload: { reason: string } }>(
        "select payload from audit_events where target_id = $1 and action = 'golive.employee_paused' order by created_at desc limit 1",
        [ai],
      )
    ).rows[0]!;
    expect(ev.payload.reason).toBe(reason);
  }, 60_000);
});
