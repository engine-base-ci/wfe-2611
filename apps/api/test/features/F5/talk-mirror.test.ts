// K-760「PC の側：会話の写しを送る・取り戻す先（mirrorConversationEntries・listMirrorTargets）」の単体の試験（口・本物の DB・本物の PC の印）。
//   名前の頭の行 ID（K760-API-…）は 11_tickets/K-760.md の行の表と 1 対 1。土台は K-761 が持ち込む F5/talk-pc.kit.ts。
// 口：POST /api/v1/bridge/jobs/:id/conversation-entries ← { entries: [{ uuid, text, at? }] } → 201 { data: { inserted } }（会話は仕事から決める）
//     GET  /api/v1/bridge/mirror-targets?limit → 200 { data: [{ conversation_id, agent_session_id, job_id }], meta: { limit } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setupPcKit, type PcWorld } from "./talk-pc.kit.js";

const k = setupPcKit();
const OPS = ["mirrorConversationEntries", "listMirrorTargets"];
const ready = () => k.load("talk-mirror", { ops: OPS });
const uuid = (n: number) => `0000000${n}-aaaa-bbbb-cccc-000000000000`;
const entry = (n: number, text: string, at = "2026-11-22T08:00:00.000Z") => ({ uuid: uuid(n), text, at });

/** 自分の PC・自分の会話・その会話の仕事（その PC が受け取った動いている仕事） */
async function setup(label: string) {
  const w = await k.world(label);
  const pc = await k.pc(w.me);
  const conversation = await k.conversation(w.me);
  const job = await k.job(w, w.me, { conversation, takenBy: pc });
  return { w, pc, conversation, job };
}
const mirror = async (pc: { token: string } | null, job: string, body: unknown) => {
  await ready();
  return k.call(pc, "POST", `/bridge/jobs/${job}/conversation-entries`, body);
};
const targets = async (pc: { token: string } | null, q = "") => {
  await ready();
  return k.call(pc, "GET", `/bridge/mirror-targets${q}`);
};
const bodies = async (conversation: string) =>
  (
    await k.f.admin.query<{ body: string; transcript_uuid: string | null; job_id: string | null; created_at: string }>(
      "select body, transcript_uuid, job_id, created_at from messages where conversation_id = $1 and kind = 'ai' and deleted_at is null order by created_at, id",
      [conversation],
    )
  ).rows;

describe("K-760 会話の写しを送る（mirrorConversationEntries）", () => {
  it("K760-API-001 動いている会話の仕事 × 写しを送る × その仕事を受け取った PC：201・入れた数・自分の AI の吹き出し（記録と同じ id・仕事・記録の時刻）。Cache-Control に private と no-store", async () => {
    const s = await setup("写す");
    const r = await mirror(s.pc, s.job, {
      entries: [entry(1, "わかりました。"), entry(2, "たたき台を置きました。", "2026-11-22T08:05:00.000Z")],
    });
    expect(r.status, await r.clone().text()).toBe(201);
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect((await k.json(r)).data).toEqual({ inserted: 2 });
    const rows = await bodies(s.conversation);
    expect(rows.map((x) => [x.body, x.transcript_uuid, x.job_id])).toEqual([
      ["わかりました。", uuid(1), s.job],
      ["たたき台を置きました。", uuid(2), s.job],
    ]);
    expect(new Date(rows[1]!.created_at).toISOString()).toBe("2026-11-22T08:05:00.000Z");
  });

  it("K760-API-002 同じ id を 2 回送る（同じ通知が 2 回届く）：2 回目は入れた数 0・吹き出しは 1 つのまま", async () => {
    const s = await setup("二重");
    const body = { entries: [entry(1, "一度だけ")] };
    expect((await k.json(await mirror(s.pc, s.job, body))).data).toEqual({ inserted: 1 });
    expect((await k.json(await mirror(s.pc, s.job, body))).data).toEqual({ inserted: 0 });
    expect(await bodies(s.conversation)).toHaveLength(1);
  });

  it("K760-API-003 同じ返答の続き（同じ id・前の文から始まる長い文）は書き換える。短い文・前の文から始まらない文では書き換えない（D-115）", async () => {
    const s = await setup("続き");
    await mirror(s.pc, s.job, { entries: [entry(1, "まず、請求書を")] });
    expect((await k.json(await mirror(s.pc, s.job, { entries: [entry(1, "まず、請求書を作ります。")] }))).data).toEqual(
      { inserted: 1 },
    );
    expect((await bodies(s.conversation))[0]!.body).toBe("まず、請求書を作ります。");
    for (const text of ["まず", "別の書き出しの文です。"]) {
      expect((await k.json(await mirror(s.pc, s.job, { entries: [entry(1, text)] }))).data).toEqual({ inserted: 0 });
    }
    const rows = await bodies(s.conversation);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe("まず、請求書を作ります。");
  });

  it("K760-API-004 「覚える」の印（[[覚える: …]]）は吹き出しの字から消える。印の中身は記憶に入れない（覚えるのは仕事の結末で 1 回だけ・D-105.1）", async () => {
    const s = await setup("印");
    const before = await k.count("select count(*) as n from memories where created_by = $1", [s.w.me.id]);
    await mirror(s.pc, s.job, { entries: [entry(1, "了解です。\n[[覚える: 請求は月末にまとめる]]")] });
    expect((await bodies(s.conversation))[0]!.body).toBe("了解です。");
    expect(await k.count("select count(*) as n from memories where created_by = $1", [s.w.me.id])).toBe(before);
  });

  it("K760-API-005 写す前からある同じ文（id を持たない前の答え）は、その吹き出しに id を付けるだけ。履歴を二重にしない", async () => {
    const s = await setup("付ける");
    await k.f.admin.query(
      "insert into messages (tenant_id, conversation_id, body, kind, job_id) values ($1, $2, '前からある答え', 'ai', $3)",
      [s.w.tenantId, s.conversation, s.job],
    );
    expect((await k.json(await mirror(s.pc, s.job, { entries: [entry(1, "前からある答え")] }))).data).toEqual({
      inserted: 0,
    });
    const rows = await bodies(s.conversation);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.transcript_uuid).toBe(uuid(1));
  });

  it("K760-API-006 読み飛ばす物：id の形でない・空・空白だけの文は入れず、ほかは入る。入れた数は入った分だけ。200001 字の文は 200000 字で残る", async () => {
    const s = await setup("飛ばす");
    const r = await mirror(s.pc, s.job, {
      entries: [
        { uuid: "zz", text: "id の形が違う" },
        { uuid: uuid(1), text: "   " },
        { uuid: uuid(2), text: "" },
        entry(3, "入る文"),
      ],
    });
    expect(r.status).toBe(201);
    expect((await k.json(r)).data).toEqual({ inserted: 1 });
    expect((await bodies(s.conversation)).map((x) => x.body)).toEqual(["入る文"]);
    await mirror(s.pc, s.job, { entries: [entry(4, "あ".repeat(200_001))] });
    const long = (await bodies(s.conversation)).find((x) => x.transcript_uuid === uuid(4));
    expect([...long!.body]).toHaveLength(200_000);
  });

  it("K760-API-007 入力の形の誤り：entries が無い・配列でない・0 件・501 件・知らない項目：どれも 422（欄 entries か体の項目）。何も入らない", async () => {
    const s = await setup("形");
    const bad: unknown[] = [
      {},
      { entries: "x" },
      { entries: [] },
      { entries: Array.from({ length: 501 }, (_, i) => entry(i + 1, "x")) },
      { entries: [entry(1, "x")], extra: 1 },
    ];
    for (const b of bad) {
      const r = await mirror(s.pc, s.job, b);
      expect(r.status, JSON.stringify(b).slice(0, 60)).toBe(422);
    }
    expect(await bodies(s.conversation)).toHaveLength(0);
    // 500 件ちょうどは通る
    const ok = await mirror(s.pc, s.job, { entries: Array.from({ length: 500 }, (_, i) => entry(i + 1, `文 ${i}`)) });
    expect(ok.status).toBe(201);
    expect((await k.json(ok)).data).toEqual({ inserted: 500 });
  });

  it("K760-API-008 守り：ほかの PC（同じ人の別の PC が受け取った仕事）・ほかの人の PC・無い仕事の id：どれも 404（NOT_FOUND）で何も入らない", async () => {
    const s = await setup("他の PC");
    const second = await k.pc(s.w.me);
    const others = await k.pc(s.w.other);
    for (const [label, pc, job] of [
      ["別の PC", second, s.job],
      ["他の人の PC", others, s.job],
      ["無い id", s.pc, randomUUID()],
    ] as const) {
      const r = await mirror(pc, job, { entries: [entry(1, "入ってはいけない")] });
      expect(r.status, label).toBe(404);
      const b = await k.json(r);
      expect(b.code, label).toBe("NOT_FOUND");
      expect(Object.keys(b).sort(), label).toEqual(["code", "error"]);
      expect(b["field"], label).toBeUndefined();
    }
    expect(await bodies(s.conversation)).toHaveLength(0);
  });

  it("K760-API-009 会話の無い仕事（記憶のまとめ・チケットの仕事）：409・E-TALK-030 で何も入らない", async () => {
    const w = await k.world("会話なし");
    const pc = await k.pc(w.me);
    const job = await k.job(w, w.me, { conversation: null, takenBy: pc });
    const r = await mirror(pc, job, { entries: [entry(1, "どこにも入らない")] });
    expect(r.status).toBe(409);
    expect((await k.json(r)).code).toBe("E-TALK-030");
    expect(await k.count("select count(*) as n from messages where tenant_id = $1", [w.tenantId])).toBe(0);
  });

  it("K760-API-010 終わった仕事にも写せる（写し漏れを記録から取り戻す・D-112）。仕事が動いているかは問わない", async () => {
    const w = await k.world("取り戻す");
    const pc = await k.pc(w.me);
    const conversation = await k.conversation(w.me);
    const job = await k.job(w, w.me, { conversation, takenBy: pc, state: "done" });
    const r = await mirror(pc, job, { entries: [entry(1, "終わった後で写す")] });
    expect(r.status).toBe(201);
    expect((await bodies(conversation)).map((x) => x.body)).toEqual(["終わった後で写す"]);
  });

  it("K760-API-011 会話が消されていたら 404（NOT_FOUND）で何も入らない", async () => {
    const s = await setup("消えた");
    await k.f.admin.query("update conversations set deleted_at = now() where id = $1", [s.conversation]);
    const r = await mirror(s.pc, s.job, { entries: [entry(1, "x")] });
    expect(r.status).toBe(404);
    expect((await k.json(r)).code).toBe("NOT_FOUND");
    expect(await k.count("select count(*) as n from messages where conversation_id = $1", [s.conversation])).toBe(0);
  });

  it("K760-API-018 外した PC・PC の印なしは 401（吹き出しは増えない）", async () => {
    const s = await setup("外した");
    const gone = await k.pc(s.w.me, { revoked: true });
    expect((await mirror(gone, s.job, { entries: [entry(1, "x")] })).status).toBe(401);
    expect((await mirror(null, s.job, { entries: [entry(1, "x")] })).status).toBe(401);
    expect(await bodies(s.conversation)).toHaveLength(0);
  });

  it("K760-API-019 1 分に 61 回目は 429（retry_after_sec は 1 以上の整数）", async () => {
    await ready();
    k.f.limits["mirrorConversationEntries"] = 60;
    const t = await setup("上限");
    let last = 0;
    let body: Record<string, unknown> = {};
    for (let i = 0; i < 61; i++) {
      const x = await mirror(t.pc, t.job, { entries: [entry(1, "同じ")] });
      last = x.status;
      if (i === 60) body = await k.json(x);
    }
    expect(last).toBe(429);
    expect(Number.isInteger(body["retry_after_sec"]) && (body["retry_after_sec"] as number) >= 1).toBe(true);
    k.f.limits["mirrorConversationEntries"] = 100_000;
  });

  it("K760-API-012 S1 の失敗：失敗：DB の関数が使えない（会話の写しを書けない）：503・E-PAGE-003。吹き出しは 1 つも残らず、ログに字を出さない。直ったら写せる", async () => {
    const s = await setup("落ちる");
    await ready();
    await k.f.admin.query("alter function app.talk_mirror_entries(uuid, uuid, jsonb) rename to talk_mirror_entries_x");
    try {
      const logs = await k.captureLogs(async () => {
        const r = await mirror(s.pc, s.job, { entries: [entry(1, "ログに出してはいけない字")] });
        expect(r.status).toBe(503);
        expect((await k.json(r)).code).toBe("E-PAGE-003");
      });
      expect(logs).not.toContain("ログに出してはいけない字");
      expect(await bodies(s.conversation)).toHaveLength(0);
    } finally {
      await k.f.admin.query(
        "alter function app.talk_mirror_entries_x(uuid, uuid, jsonb) rename to talk_mirror_entries",
      );
    }
    expect((await mirror(s.pc, s.job, { entries: [entry(1, "直った後")] })).status).toBe(201);
  });

  it("K760-API-013 DB の関数の守り（2 層目）：security definer・public から外し kaname_app だけ。印が無い・外した PC は null、ほかの人の会話の仕事には書けない", async () => {
    const s = await setup("関数");
    const acl = await k.row<{ definer: boolean; pub: boolean; app: boolean }>(
      `select p.prosecdef as definer, has_function_privilege('public', p.oid, 'execute') as pub, has_function_privilege('kaname_app', p.oid, 'execute') as app
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'talk_mirror_entries'`,
    );
    expect(acl).toEqual({ definer: true, pub: false, app: true });
    const call = async (sid: string, job: string) =>
      (
        await k.f.pool.query<{ v: unknown }>("select app.talk_mirror_entries($1, $2, $3::jsonb) as v", [
          sid,
          job,
          JSON.stringify([entry(1, "直に")]),
        ])
      ).rows[0]!.v;
    expect(await call(randomUUID(), s.job)).toBeNull();
    const gone = await k.pc(s.w.me, { revoked: true });
    expect(await call(gone.sid, s.job)).toBeNull();
    expect(await call(s.pc.sid, s.job)).toEqual({ inserted: 1 });
    // 同じ PC でも、仕事が別の人の会話に結ばれていたら書けない
    const theirs = await k.conversation(s.w.other);
    const bad = await k.job(s.w, s.w.me, { conversation: theirs, takenBy: s.pc });
    expect(await call(s.pc.sid, bad)).toEqual({ error: "not_found" });
    expect(await bodies(theirs)).toHaveLength(0);
  });
});

describe("K-760 取り戻す先を読む（listMirrorTargets）", () => {
  const seed = async (w: PcWorld, pcOwner = w.me) => {
    const pc = await k.pc(pcOwner);
    const conversation = await k.conversation(pcOwner);
    return { pc, conversation };
  };

  it("K760-API-014 14 日以内・session あり・消していない本人の会話だけ。会話ごと session ごとに 1 つ（いちばん新しい仕事の id つき）・新しい順。200 の meta は limit だけ（続きの鍵を持たない）", async () => {
    const w = await k.world("先");
    const { pc, conversation } = await seed(w);
    const second = await k.conversation(w.me);
    const old = await k.conversation(w.me);
    const noSession = await k.conversation(w.me);
    const deleted = await k.conversation(w.me, { deleted: true });
    await k.job(w, w.me, { conversation, agentSession: "sess-a", ageDays: 3 });
    const newest = await k.job(w, w.me, { conversation, agentSession: "sess-a", ageDays: 1 });
    const other = await k.job(w, w.me, { conversation: second, agentSession: "sess-b", ageDays: 0 });
    await k.job(w, w.me, { conversation: old, agentSession: "sess-old", ageDays: 15 });
    await k.job(w, w.me, { conversation: noSession, agentSession: null });
    await k.job(w, w.me, { conversation: deleted, agentSession: "sess-del" });
    const r = await targets(pc);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    const b = await k.json(r);
    expect(b.data).toEqual([
      { conversation_id: second, agent_session_id: "sess-b", job_id: other },
      { conversation_id: conversation, agent_session_id: "sess-a", job_id: newest },
    ]);
    expect(b.meta).toEqual({ limit: 50 });
  });

  it("K760-API-015 件数：51 件あっても既定は新しい 50 件。limit=2 は 2 件。51 以上・0・文字は 422", async () => {
    const w = await k.world("件数");
    const { pc } = await seed(w);
    for (let i = 0; i < 51; i++) {
      const c = await k.conversation(w.me);
      await k.job(w, w.me, { conversation: c, agentSession: `sess-${i}`, ageDays: 0 });
    }
    expect(((await k.json(await targets(pc))).data as unknown[]).length).toBe(50);
    expect(((await k.json(await targets(pc, "?limit=2"))).data as unknown[]).length).toBe(2);
    for (const q of ["?limit=51", "?limit=0", "?limit=abc"]) expect((await targets(pc, q)).status, q).toBe(422);
  });

  it("K760-API-016 ほかの人・別の会社の会話は出ない（自分の PC の人の分だけ）。0 件なら空の並び", async () => {
    const w = await k.world("他人");
    const { pc } = await seed(w);
    const other = await seed(w, w.other);
    const abroad = await k.conversation(w.outsider);
    await k.job(w, w.other, { conversation: other.conversation, agentSession: "sess-other" });
    await k.job(w, w.outsider, { conversation: abroad, agentSession: "sess-abroad" });
    const r = await targets(pc);
    expect(r.status).toBe(200);
    expect((await k.json(r)).data).toEqual([]);
  });

  it("K760-API-017 守り：PC の印なし・外した PC は 401。1 分に 121 回目は 429。DB の関数が使えなければ 503・E-PAGE-003", async () => {
    const w = await k.world("守り");
    const { pc } = await seed(w);
    expect((await targets(null)).status).toBe(401);
    const gone = await k.pc(w.me, { revoked: true });
    expect((await targets(gone)).status).toBe(401);
    k.f.limits["listMirrorTargets"] = 120;
    let last = 0;
    for (let i = 0; i < 121; i++) last = (await targets(pc)).status;
    expect(last).toBe(429);
    k.f.limits["listMirrorTargets"] = 100_000;
    await k.f.admin.query("alter function app.talk_mirror_targets(uuid, integer) rename to talk_mirror_targets_x");
    try {
      const r = await targets(pc);
      expect(r.status).toBe(503);
      expect((await k.json(r)).code).toBe("E-PAGE-003");
    } finally {
      await k.f.admin.query("alter function app.talk_mirror_targets_x(uuid, integer) rename to talk_mirror_targets");
    }
  });

  it("K760-API-020 つなぎ直した PC（新しい session）・同じ人の別の PC には、前の PC が受け取った仕事は返らない。受け取った PC には返る・受け取り前（古い行）の仕事は同じ人のどの PC にも返る（写す口と同じ条件）", async () => {
    const w = await k.world("つなぎ直し");
    const first = await k.pc(w.me);
    const conversation = await k.conversation(w.me);
    const taken = await k.job(w, w.me, { conversation, agentSession: "sess-taken", takenBy: first });
    const free = await k.job(w, w.me, { conversation: await k.conversation(w.me), agentSession: "sess-free" });
    const again = await k.pc(w.me);
    const ids = async (pc: { token: string }) =>
      ((await k.json(await targets(pc))).data as { job_id: string }[]).map((x) => x.job_id).sort();
    expect(await ids(first)).toEqual([taken, free].sort());
    expect(await ids(again)).toEqual([free]);
    // 返らない仕事は、写す口でもその PC には書けない（同じ条件）
    expect((await mirror(again, taken, { entries: [entry(1, "x")] })).status).toBe(404);
  });
});
