// K-62「AI に任せる」の試験の道具（口・本物の DB）。delegate.test.ts（人が呼ぶ口）と delegate-bridge.test.ts（PC が呼ぶ口）が使う。
//   土台は K-57・K-60 の apps/api/test/features/fixture.ts（本物の Postgres・本物の口の振る舞い・本物の PC の印の解決）。
//   K-60 と K-62 の口の一覧の工場 ticketHooks(pool)・delegateHooks(pool)（apps/api/src/hooks/・本物のサーバーと fuzz の的が差すのと同じもの）を、土台の hooks に足して使う。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。間違っていると思ったら、作る人に戻す。
//
// 試験が決める口の形（11_tickets/K-62.md「契約を直す」）:
//   delegateTicket   POST /tickets/:id/delegate   体 {}            → 201 { data: { run_id, job_id, status: "queued", pc: "live"|"asleep" } }
//   listTicketRuns   GET  /tickets/:id/runs                         → 200 { data: [実行の 1 件…（新しい順）], meta: { limit, total } }
//   getActionRun     GET  /action_runs/:id                          → 200 { data: 実行の 1 件 }
//     実行の 1 件 = { id, ticket_id, phase, status, by: { member_id, display_name }, pc, silent, last_event_at, progress,
//                    stopped_reason, return_reason（作り直しなら差し戻した承認の理由・はじめは null）, started_at, finished_at, checks: { state: "none" } }
//   takeBridgeJob    POST /bridge/jobs/take       体 { wait_sec, protocol, idle } → 201 { data: { job: 仕事|null, forbidden_domains, next_ms, outdated } }
//     仕事 = 行の中身をそのまま（prompt・agent_session_id・kind・phase・ticket_id・permission_mode・tool_token ほか。take で組み直さない）
//   reportJobProgress POST /bridge/jobs/:id/progress 体 { seq, kind, text, … }   → 201 { data: { ok: true } }
//   getJobControl    GET  /bridge/jobs/:id/control                  → 200 { data: { stop, reason, steers } }
//   callKanameTool   POST /bridge/jobs/:id/tools/:name 頭 x-kaname-tool-token 体 { input } → 201 { data: { result } }
//   finishBridgeJob  POST /bridge/jobs/:id/finish 体 { state, result, reason, agent_session_id } → 201 { data: { ok: true, outcome } }
//     outcome: "awaiting_approval"（成果物の版と承認待ちを作った）・"stopped"（止まった扱いにした）・"done"（会話・ログインの試しの仕事）
import { createHash } from "node:crypto";
import { expect } from "vitest";
import { makeFixture, nextIp, type Fixture, type Person } from "../fixture.js";
import { delegateHooks } from "../../../src/hooks/delegate.js";
import { ticketHooks } from "../../../src/hooks/tickets.js";

/** Bridge の約束の版。K-62 で 1 つ上げる（4 → 5）。古い Bridge には仕事を渡さない（E-CONN-012） */
export const PROTOCOL = 5;
export const OLD_PROTOCOL = 4;
export const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** 足すエラー（K-62 が errors.json に足す・文は「聞きたいこと」1 の推奨。決まったら文だけ直す） */
export const E = {
  noPc: "E-CONN-001", // PC をつないだことが無い・外した（409・積まない）
  running: "E-CONF-013", // 走っている実行がある（409・今の実行を返す）
  notDelegable: "E-CONF-014", // 承認待ち・完了（409）
  emptyResult: "E-SIG-004", // 結果が空（完了とみなさず止まった）
  silent: "E-TO-005", // 10 分（確認待ちは 30 分）知らせが無い（画面に出すだけ）
  oldBridge: "E-CONN-012",
} as const;
export const MSG = {
  emptyResult: "自分のAI が結果を返さずに終わりました。完了とは見なしていません",
  ticketDeleted: "チケットが消されたので止めました",
  noWrite: "このチケットを直す権限が無くなったので止めました",
  pcGone: "PC を外したので止まりました",
  pcWaking: "PC が起きるのを待っています",
  tooLong: "結果が長すぎて受け取れません",
  // 帯に出す止まった理由（決める人の決定 D-129.47）
  noReason: "AI が途中で止まりました（理由は届いていません）。もう一度「AI に任せる」を押せます",
  cancelledOnPc: "PC でこの実行をやめました。もう一度「AI に任せる」を押せます",
  bridgeDown:
    "PC の Kaname Bridge が途中で止まったので、ここで止まりました。Bridge を開き直してから、もう一度「AI に任せる」を押してください",
} as const;

export type Json = Record<string, unknown> & { data?: unknown; code?: string };
export const json = async (r: Response): Promise<Json> => (await r.json()) as Json;
export const data = async <T = Record<string, unknown>>(r: Response): Promise<T> => (await json(r)).data as T;

export interface Device {
  token: string;
  /** その PC の sessions の行の id（試験で時刻を動かすときに使う） */
  sessionId: string;
  owner: Person;
}
export interface Company {
  tenantId: string;
  rootScope: string;
}
export interface Kit {
  f: Fixture;
  T: Company;
  O: Company;
  taskKind: string;
  /** チケットを 1 枚作る（作る人・担当者を選べる）。返すのは id */
  ticket: (creator: Person, o?: { assignee?: Person; scope?: string; purpose?: string }) => Promise<string>;
  /** PC をつなぐ（接続コード → 引き取り → 生きている知らせ 1 回） */
  device: (p: Person, label?: string) => Promise<Device>;
  /** その PC の最後の知らせを「いまから n 秒前」に置く（眠らずに時刻を進める） */
  lastSeen: (d: Device, secondsAgo: number) => Promise<void>;
  delegate: (p: Person, ticketId: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
  take: (d: Device, body?: Record<string, unknown>) => Promise<Response>;
  /** 取って、仕事があることを確かめて返す */
  takeJob: (d: Device) => Promise<Record<string, unknown> & { job_id: string; tool_token: string | null }>;
  progress: (d: Device, jobId: string, body: Record<string, unknown>) => Promise<Response>;
  control: (d: Device, jobId: string) => Promise<Response>;
  finish: (
    d: Device,
    jobId: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => Promise<Response>;
  tool: (d: Device, jobId: string, name: string, token: string | null, input?: unknown) => Promise<Response>;
  run: (p: Person, runId: string) => Promise<Response>;
  runs: (p: Person, ticketId: string) => Promise<Response>;
  q: <R extends Record<string, unknown> = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<R[]>;
  n: (sql: string, p?: unknown[]) => Promise<number>;
  stageOf: (ticketId: string) => Promise<string>;
  close: () => Promise<void>;
}

const jst = (days = 0) => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);

export async function makeKit(): Promise<Kit> {
  const f = await makeFixture();
  // 任せる口は段10 の K-699 から、任せる人の「必ず守る」を読む（app.knowledge_context）。読むのは会社に入っている人（tenant_memberships が active）
  //   だけなので、試験の人も本物と同じく会社に入れて作る（入れないと KNW_GUARD_CONTEXT で 503・段6 と段10 を合わせた統合の枝で出た）
  const basePerson = f.person;
  f.person = async (tenantId, scopeId, o = {}) => {
    const p = await basePerson(tenantId, scopeId, o);
    await f.admin.query(
      "insert into tenant_memberships (tenant_id, member_id, role, status) values ($1, $2, 'member', 'active') on conflict (tenant_id, member_id) do nothing",
      [tenantId, p.id],
    );
    return p;
  };
  // 本物のサーバー（apps/api/src/server.ts）と同じ順：チケットを作る（K-60）の工場の後に、K-62 の工場（getTicket を can.delegate つきに替える）
  Object.assign(f.hooks, ticketHooks(f.pool), delegateHooks(f.pool));
  // 1 つの試験のファイルで 60 回より多く任せる・取りに来る。上限そのものは K62-API-034 だけで確かめ、ほかでは上げておく
  for (const op of [
    "delegateTicket",
    "takeBridgeJob",
    "reportJobProgress",
    "getJobControl",
    "callKanameTool",
    "finishBridgeJob",
    "getActionRun",
    "listTicketRuns",
    "createTicket",
    "createPairingCode",
    "claimPairingCode",
    "sendHeartbeat",
  ])
    f.limits[op] = 100_000;
  const T = await f.company("K62 の会社", "AI");
  const O = await f.company("K62 の別の会社", "OT");
  const reader = await f.person(T.tenantId, T.rootScope, { name: "種別を読む人", ticketAbility: "view" });
  const kinds = (await data<{ id: string; name: string }[]>(
    await f.req("GET", "/ticket_kinds", { headers: reader.auth }),
  )) as { id: string; name: string }[];
  const taskKind = kinds.find((k) => k.name === "タスク")!.id;
  const q: Kit["q"] = async (sql, p = []) => (await f.admin.query(sql, p)).rows as never;
  const n: Kit["n"] = async (sql, p = []) => Number((await f.admin.query<{ n: string }>(sql, p)).rows[0]!.n);

  /** 種別は会社ごとの行（会社を作るとその会社の種別ができる）。チケットを作る会社の「タスク」を引く */
  const kindIn = async (tenantId: string): Promise<string> =>
    tenantId === T.tenantId
      ? taskKind
      : (
          await q<{ id: string }>(
            "select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null",
            [tenantId],
          )
        )[0]!.id;
  const ticket: Kit["ticket"] = async (creator, o = {}) => {
    const r = await f.req("POST", "/tickets", {
      headers: creator.auth,
      body: {
        scope_id: o.scope ?? T.rootScope,
        kind_id: await kindIn(creator.tenantId),
        title: "見積を作る",
        assignee_member_id: (o.assignee ?? creator).id,
        due_on: jst(3),
        // 確認項目が 0 件だと「AI に任せる」が 409（E-CONF-020）になるので 1 件付けて作る（K-565）
        specs: ["金額と内訳がそろっている"],
        body: {
          doc: {
            type: "doc",
            content: [
              o.purpose ?? "先方に出す見積のたたき台を作る",
              "金額と内訳がそろっている",
              "前回の見積を読む",
              "内訳を書く",
            ].map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
          },
        },
      },
    });
    expect(r.status, await r.clone().text()).toBe(201);
    return String((await data(r))["id"]);
  };
  const device: Kit["device"] = async (p, label = "高本の MacBook") => {
    const c = await f.req("POST", "/bridge/pairing-codes", { body: {}, headers: p.auth });
    expect(c.status, await c.clone().text()).toBe(201);
    const code = String((await data(c))["code"]);
    const cl = await f.req("POST", "/bridge/claim", { body: { code, device_label: label }, ip: nextIp() });
    expect(cl.status, await cl.clone().text()).toBe(201);
    const got = await data(cl);
    const d: Device = { token: String(got["device_token"]), sessionId: String(got["device_id"]), owner: p };
    const b = await f.req("POST", "/bridge/heartbeat", {
      body: { health: [], protocol: PROTOCOL, version: "1.5.0" },
      headers: { "x-bridge-session": d.token },
    });
    expect(b.status, await b.clone().text()).toBe(201);
    return d;
  };
  const lastSeen: Kit["lastSeen"] = async (d, secondsAgo) => {
    await f.admin.query("update sessions set last_seen_at = now() - make_interval(secs => $2) where id = $1", [
      d.sessionId,
      secondsAgo,
    ]);
  };
  const dev = (d: Device, extra: Record<string, string> = {}) => ({ "x-bridge-session": d.token, ...extra });
  const take: Kit["take"] = (d, body = {}) =>
    f.req("POST", "/bridge/jobs/take", {
      body: { wait_sec: 0, protocol: PROTOCOL, idle: false, ...body },
      headers: dev(d),
    });
  const takeJob: Kit["takeJob"] = async (d) => {
    const r = await take(d);
    expect(r.status, await r.clone().text()).toBe(201);
    const job = (await data(r))["job"] as
      (Record<string, unknown> & { job_id: string; tool_token: string | null }) | null;
    expect(job, "仕事が渡る").not.toBeNull();
    return job!;
  };
  return {
    f,
    T,
    O,
    taskKind,
    ticket,
    device,
    lastSeen,
    delegate: (p, id, body = {}, headers = {}) =>
      f.req("POST", `/tickets/${id}/delegate`, { body, headers: { ...p.auth, ...headers } }),
    take,
    takeJob,
    progress: (d, jobId, body) => f.req("POST", `/bridge/jobs/${jobId}/progress`, { body, headers: dev(d) }),
    control: (d, jobId) => f.req("GET", `/bridge/jobs/${jobId}/control`, { headers: dev(d) }),
    finish: (d, jobId, body, headers = {}) =>
      f.req("POST", `/bridge/jobs/${jobId}/finish`, { body, headers: dev(d, headers) }),
    tool: (d, jobId, name, token, input = {}) =>
      f.req("POST", `/bridge/jobs/${jobId}/tools/${name}`, {
        body: { input },
        headers: dev(d, token === null ? {} : { "x-kaname-tool-token": token }),
      }),
    run: (p, runId) => f.req("GET", `/action_runs/${runId}`, { headers: p.auth }),
    runs: (p, ticketId) => f.req("GET", `/tickets/${ticketId}/runs`, { headers: p.auth }),
    q,
    n,
    stageOf: async (id) =>
      (
        await q<{ key: string }>(
          "select s.key from tickets t join ticket_stages s on s.id = t.stage_id where t.id = $1",
          [id],
        )
      )[0]!.key,
    close: () => f.close(),
  };
}

/** 任せて 201 を確かめ、答えの中身を返す */
export async function delegateOk(
  k: Kit,
  p: Person,
  ticketId: string,
): Promise<{ run_id: string; job_id: string; status: string; pc: string }> {
  const r = await k.delegate(p, ticketId);
  expect(r.status, await r.clone().text()).toBe(201);
  return data(r);
}
