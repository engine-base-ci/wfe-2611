// K-355 預けた後に自分の PC が 1 回ログインして確かめる（D-117・段 4 に入れる決め answer=ac0813ee7c21）の口：
//   checkCredentialLogin（もう一度確かめる）・answerCredentialLoginCheck（頼まれたコードに答える）・reportCredentialCheck（PC が途中と結果を知らせる）。
// 本番と同じ bootApi・本物の DB・本物の PC の印（土台 credential-device.harness.ts）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { E, PROTOCOL, msg, setupCredentialDevice, type Pc, type Who } from "./credential-device.harness.js";

const h = setupCredentialDevice("k355");
const T = 60_000;

/** 預けて（PC が無いので確かめは積まれない）、PC をつなぎ、もう一度確かめて、PC がその仕事を取る */
async function started(
  tag: string,
  o: Parameters<typeof h.cred>[1] = {},
): Promise<{ w: Who; p: Pc; id: string; job: string }> {
  const w = await h.who(tag);
  const id = await h.cred(w, o);
  const p = await h.pc(w);
  const r = await h.check(w, id);
  expect(r.status, await r.clone().text()).toBe(201);
  const job = String((await h.json(r)).data!["job_id"]);
  const got = await h.take(p);
  expect(got?.job_id, "確かめの仕事を PC が取る").toBe(job);
  return { w, p, id, job };
}
const asking = async (p: Pc, id: string, job: string, request = "r1") => {
  const r = await h.report(p, id, {
    job_id: job,
    state: "asking",
    request_ref: request,
    ask_kind: "code",
    text: "発注ナビ の SMS のコード",
  });
  expect(r.status, await r.clone().text()).toBe(201);
};
const code = async (r: Response) => ((await h.json(r)).data as Record<string, unknown>)["code"];

describe("K-355 checkCredentialLogin（もう一度確かめる）", () => {
  it(
    "K355-API-001 自分のログイン情報・PC あり・確かめていない：201 { state: pending, job_id }。確かめの仕事が 1 つ積まれ（kind login_check・その情報・宛先は使える場所の 1 つ目）、行は pending",
    async () => {
      const w = await h.who("ok");
      const id = await h.cred(w, { destinations: ["login.hacchu-navi.example", "hacchu-navi.example"] });
      await h.pc(w);
      const r = await h.check(w, id);
      expect(r.status, await r.clone().text()).toBe(201);
      const d = (await h.json(r)).data!;
      expect(Object.keys(d).sort()).toEqual(["job_id", "state"]);
      expect(d["state"]).toBe("pending");
      const job = await h.jobRow(String(d["job_id"]));
      expect(job).toMatchObject({
        state_id: "queued",
        kind: "login_check",
        credential_id: id,
        prompt: "https://login.hacchu-navi.example/",
      });
      expect((await h.credRow(id))["login_check_state"]).toBe("pending");
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    },
    T,
  );

  it(
    "K355-API-027 使える場所の 1 つ目が *. で始まる：開く先は *. で始まらない 1 つ目（https://login.example.org/）で、開く先に * の字は入らない。全部が *. の物は開く先を決められないので確かめの仕事を積まず、201 { state: no_target, job_id: null }・行は unreachable と「使える場所に足してください」を含む文（仮の形・代表の答えで変わる）",
    async () => {
      const w = await h.who("wild");
      const mixed = await h.cred(w, { destinations: ["*.example.com", "login.example.org"] });
      const onlyWild = await h.cred(w, { destinations: ["*.example.com", "*.example.net"] });
      // 預けた直後（PC なし）：全部が *. の物は、PC の有る無しより先に「開く先が決められない」になる（no_bridge にしない）
      expect((await h.credRow(mixed))["login_check_state"]).toBe("no_bridge");
      expect((await h.credRow(onlyWild))["login_check_state"]).toBe("unreachable");
      await h.pc(w);
      const r1 = await h.check(w, mixed);
      expect(r1.status, await r1.clone().text()).toBe(201);
      const prompt = String((await h.jobRow(String((await h.json(r1)).data!["job_id"])))["prompt"]);
      expect(prompt).toBe("https://login.example.org/");
      expect(prompt).not.toContain("*");
      const r2 = await h.check(w, onlyWild);
      expect(r2.status, await r2.clone().text()).toBe(201);
      expect((await h.json(r2)).data).toEqual({ state: "no_target", job_id: null });
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [onlyWild])).toBe(0);
      const row = await h.credRow(onlyWild);
      expect(row["login_check_state"]).toBe("unreachable");
      expect(String(row["login_check_detail"])).toContain("使える場所に足してください");
      // Bridge に * 入りの開く先は 1 つも渡らない（example.com を開かせて「使える場所の外」の偽の知らせを出さない）
      expect(
        await h.count(
          "select count(*) as n from bridge_jobs where member_id = $1 and kind = 'login_check' and prompt like '%*%'",
          [w.user.memberId],
        ),
      ).toBe(0);
    },
    T,
  );

  it(
    "K355-API-028 PC が初めて生きている知らせを送ったとき：まだ確かめていない（行が no_bridge）自分のログイン情報に確かめの仕事を 1 つずつ積み、行は pending。2 回目の知らせでは積まない。API キー・ほかの人の物・消した物には積まない",
    async () => {
      const w = await h.who("first");
      const other = await h.who("first-other");
      const login = await h.cred(w);
      const key = await h.cred(w, { kind: "key" });
      const gone = await h.cred(w);
      const theirs = await h.cred(other);
      await h.admin.query("update credentials set deleted_at = now() where id = $1", [gone]);
      expect((await h.credRow(login))["login_check_state"]).toBe("no_bridge");
      const p = await h.pc(w); // つないだだけ（まだ生きている知らせは無い）では積まない
      const jobsOf = (id: string) =>
        h.count("select count(*) as n from bridge_jobs where credential_id = $1 and kind = 'login_check'", [id]);
      expect(await jobsOf(login)).toBe(0);
      const beat = () =>
        h.req(
          "POST",
          "/api/v1/bridge/heartbeat",
          { health: [], protocol: PROTOCOL, version: "1.4.0" },
          { headers: p.headers },
        );
      const b1 = await beat();
      expect(b1.status, await b1.clone().text()).toBeLessThan(300);
      expect(await jobsOf(login)).toBe(1);
      expect((await h.credRow(login))["login_check_state"]).toBe("pending");
      const b2 = await beat();
      expect(b2.status, await b2.clone().text()).toBeLessThan(300);
      expect(await jobsOf(login)).toBe(1);
      expect(await jobsOf(key)).toBe(0);
      expect(await jobsOf(gone)).toBe(0);
      expect(await jobsOf(theirs)).toBe(0);
      expect((await h.credRow(theirs))["login_check_state"]).toBe("no_bridge");
    },
    T,
  );

  it(
    "K355-API-029 S4 の失敗（最初の知らせで積む所が断られる）：生きている知らせは 2xx のまま通り、PC は生きている扱いになる。仕事は 0・行は no_bridge のまま（残った行は、中身を上書きすると確かめ直る・K-353）",
    async () => {
      const w = await h.who("first-fail");
      const id = await h.cred(w);
      const p = await h.pc(w);
      const fn = `k355_block_${id.replace(/-/g, "")}`;
      await h.admin.query(
        `create or replace function public.${fn}() returns trigger language plpgsql as $$ begin if new.credential_id = '${id}' then raise exception 'k355 block'; end if; return new; end $$`,
      );
      await h.admin.query(
        `create trigger ${fn} before insert on bridge_jobs for each row execute function public.${fn}()`,
      );
      try {
        const b = await h.req(
          "POST",
          "/api/v1/bridge/heartbeat",
          { health: [], protocol: PROTOCOL, version: "1.4.0" },
          { headers: p.headers },
        );
        expect(b.status, await b.clone().text()).toBeLessThan(300);
      } finally {
        await h.admin.query(`drop trigger if exists ${fn} on bridge_jobs`);
        await h.admin.query(`drop function if exists public.${fn}()`);
      }
      expect(
        await h.count("select count(*) as n from sessions where id = $1 and alive_at is not null", [p.sessionId]),
      ).toBe(1);
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(0);
      expect((await h.credRow(id))["login_check_state"]).toBe("no_bridge");
    },
    T,
  );

  it(
    "K355-API-002 PC をつないでいない：201 { state: no_pc, job_id: null }。仕事は積まない。行は no_bridge と「PC をつないで」を含む文（PC をつなぐと自動で 1 回試す）",
    async () => {
      const w = await h.who("nopc");
      const id = await h.cred(w);
      const r = await h.check(w, id);
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await h.json(r)).data).toEqual({ state: "no_pc", job_id: null });
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(0);
      const row = await h.credRow(id);
      expect(row["login_check_state"]).toBe("no_bridge");
      expect(String(row["login_check_detail"])).toContain("PC をつないで");
    },
    T,
  );

  it(
    "K355-API-003 台帳で規約が自動操作を禁じるサービス：201 { state: forbidden, job_id: null }。仕事は積まない。行は forbidden",
    async () => {
      const w = await h.who("forbid");
      const id = await h.cred(w);
      await h.pc(w);
      const svc = (
        await h.admin.query<{ id: string }>(
          "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values ($1, '禁止の例', 'hacchu-navi.example', 'forbidden') returning id",
          [w.user.tenantId],
        )
      ).rows[0]!.id;
      await h.admin.query("update credentials set service_id = $2 where id = $1", [id, svc]);
      const r = await h.check(w, id);
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await h.json(r)).data).toEqual({ state: "forbidden", job_id: null });
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(0);
      expect((await h.credRow(id))["login_check_state"]).toBe("forbidden");
    },
    T,
  );

  it(
    "K355-API-004 いま確かめている（待ち・動いている・コード待ち）：409・E-CRED-012 とその文。仕事は増えない",
    async () => {
      const { w, p, id, job } = await started("busy");
      for (const stage of ["running", "asking"]) {
        if (stage === "asking") await asking(p, id, job);
        const r = await h.check(w, id);
        expect(r.status, stage).toBe(409);
        const j = await h.json(r);
        expect(j["code"], stage).toBe(E.checkBusy);
        expect(String(j["message"] ?? ""), stage).toBe(msg(E.checkBusy));
      }
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(1);
    },
    T,
  );

  it(
    "K355-API-005 API キー・値（kind key）：409・E-CRED-013。仕事は積まない",
    async () => {
      const w = await h.who("key");
      const id = await h.cred(w, { kind: "key" });
      await h.pc(w);
      const r = await h.check(w, id);
      expect(r.status).toBe(409);
      expect((await h.json(r))["code"]).toBe(E.notLogin);
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(0);
    },
    T,
  );

  it(
    "K355-API-006 守り：ほかの人の個人の物・ほかのワークスペースの物・消した物は 404（在るかを漏らさない）。仕事は積まない",
    async () => {
      const a = await h.who("own-a");
      const b = await h.who("own-b");
      const mine = await h.cred(a);
      const gone = await h.cred(b);
      await h.admin.query("update credentials set deleted_at = now() where id = $1", [gone]);
      // PC は預けた後につなぐ（つないだ後に預けると、預ける口が確かめの仕事を 1 つ積み、下の「仕事は 0」を満たせない）
      await h.pc(b);
      for (const [label, id] of [
        ["ほかの人・ほかのワークスペース", mine],
        ["消した", gone],
      ] as const) {
        const r = await h.check(b, id);
        expect(r.status, label).toBe(404);
      }
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = any($1)", [[mine, gone]])).toBe(
        0,
      );
    },
    T,
  );

  it(
    "K355-API-007 失効した・期限が過ぎた：409・E-CRED-011。仕事は積まない",
    async () => {
      const w = await h.who("revoked");
      await h.pc(w);
      const revoked = await h.cred(w);
      const expired = await h.cred(w);
      await h.drain(await h.pc(w));
      await h.admin.query("update credentials set revoked_at = now() where id = $1", [revoked]);
      await h.admin.query("update credentials set expires_at = now() - interval '1 minute' where id = $1", [expired]);
      for (const id of [revoked, expired]) {
        const before = await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id]);
        const r = await h.check(w, id);
        expect(r.status).toBe(409);
        expect((await h.json(r))["code"]).toBe(E.revoked);
        expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(before);
      }
    },
    T,
  );

  it(
    "K355-API-008 失敗 S1：確かめを積む関数が使えない → 503・E-PAGE-003。仕事も行の状態も変わらない",
    async () => {
      const w = await h.who("s1");
      const id = await h.cred(w);
      await h.pc(w);
      const before = await h.credRow(id);
      await h.withoutFn("app.credential_check_start(uuid, uuid)", async () => {
        const r = await h.check(w, id);
        expect(r.status).toBe(503);
        expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      });
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [id])).toBe(0);
      expect((await h.credRow(id))["login_check_state"]).toBe(before["login_check_state"]);
    },
    T,
  );

  it(
    "K355-API-030 上書きで使える場所を替えた後：台帳の判定は今の使える場所で決まる（預けた時に結んだ service_id のままでは決めない）。禁止のサービスから外した物は 201 pending で開く先は今の場所、禁止のサービスの下の名前に替えた物は 201 forbidden で仕事を積まない",
    async () => {
      const w = await h.who("moved");
      const bad = `bank-${w.user.memberId.slice(0, 8)}.example`;
      await h.admin.query(
        "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values ($1, '禁止の例（替えた後）', $2, 'forbidden')",
        [w.user.tenantId, bad],
      );
      // 禁止のサービスに当たる場所で預ける（預けた時に service_id が禁止のサービスに結ばれる）→ 上書きで別の場所に替えた（service_id は前のまま）
      const away = await h.cred(w, { destinations: [bad] });
      expect((await h.credRow(away))["login_check_state"]).toBe("forbidden");
      await h.admin.query("update credentials set destinations = $2 where id = $1", [away, ["ok-moved.example"]]);
      // 禁止でない場所で預ける → 上書きで禁止のサービスの下の名前に替えた
      const into = await h.cred(w, { destinations: ["ok-before.example"] });
      await h.admin.query("update credentials set destinations = $2 where id = $1", [into, [`login.${bad}`]]);
      await h.pc(w);
      const r1 = await h.check(w, away);
      expect(r1.status, await r1.clone().text()).toBe(201);
      const d1 = (await h.json(r1)).data!;
      expect(d1["state"]).toBe("pending");
      expect((await h.jobRow(String(d1["job_id"])))["prompt"]).toBe("https://ok-moved.example/");
      const r2 = await h.check(w, into);
      expect(r2.status, await r2.clone().text()).toBe(201);
      expect((await h.json(r2)).data).toEqual({ state: "forbidden", job_id: null });
      expect(await h.count("select count(*) as n from bridge_jobs where credential_id = $1", [into])).toBe(0);
      expect((await h.credRow(into))["login_check_state"]).toBe("forbidden");
    },
    T,
  );
});

describe("K-355 answerCredentialLoginCheck（頼まれたコードに答える）", () => {
  it(
    "K355-API-009 頼まれているコードに答える：201 { accepted: true }。答えの行にコードがあり、仕事は running に戻る。証跡に答えたこと（コードは書かない）",
    async () => {
      const { w, p, id, job } = await started("ans");
      await asking(p, id, job);
      const r = await h.answer(w, id, { request_ref: "r1", code: "123456" });
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await h.json(r)).data).toEqual({ accepted: true });
      const ev = (
        await h.admin.query(
          "select payload from bridge_job_events where job_id = $1 and kind = 'answer' and request_id = 'r1'",
          [job],
        )
      ).rows;
      expect(ev).toHaveLength(1);
      expect((ev[0] as { payload: Record<string, unknown> }).payload["code"]).toBe("123456");
      expect((await h.jobRow(job))["state_id"]).toBe("running");
      const audit = (
        await h.admin.query(
          "select payload::text as t from audit_events where action = 'credential.two_factor_answered' and target_id = $1",
          [id],
        )
      ).rows as { t: string }[];
      expect(audit).toHaveLength(1);
      expect(audit[0]!.t).not.toContain("123456");
    },
    T,
  );

  it(
    "K355-API-010 スマホで承認した：{ approved: true } は 201。答えの行の値は approved",
    async () => {
      const { w, p, id, job } = await started("approve");
      await h.report(p, id, {
        job_id: job,
        state: "asking",
        request_ref: "r2",
        ask_kind: "approve",
        text: "スマホで承認してください",
      });
      const r = await h.answer(w, id, { request_ref: "r2", approved: true });
      expect(r.status, await r.clone().text()).toBe(201);
      const ev = (
        await h.admin.query("select payload from bridge_job_events where job_id = $1 and kind = 'answer'", [job])
      ).rows[0] as {
        payload: Record<string, unknown>;
      };
      expect(ev.payload["code"]).toBe("approved");
    },
    T,
  );

  it(
    "K355-API-011 表記ゆらぎ：全角の数字・空白・ハイフン入り「１２３ ４５６」「123-456」は 123456 として置く",
    async () => {
      const { w, p, id, job } = await started("nfkc");
      await asking(p, id, job, "r3");
      expect((await h.answer(w, id, { request_ref: "r3", code: "１２３ ４５６" })).status).toBe(201);
      const v = (
        await h.admin.query(
          "select payload->>'code' as c from bridge_job_events where job_id = $1 and kind = 'answer'",
          [job],
        )
      ).rows[0] as { c: string };
      expect(v.c).toBe("123456");
      await asking(p, id, job, "r4");
      expect((await h.answer(w, id, { request_ref: "r4", code: "123-456" })).status).toBe(201);
      const v2 = (
        await h.admin.query(
          "select payload->>'code' as c from bridge_job_events where job_id = $1 and kind = 'answer' and request_id = 'r4'",
          [job],
        )
      ).rows[0] as { c: string };
      expect(v2.c).toBe("123456");
    },
    T,
  );

  it(
    "K355-API-012 入力：空・空白だけ・65 文字のコードは 422・E-VAL-009。code と approved の両方・どちらも無い は 422。どれも答えの行を作らない",
    async () => {
      const { w, p, id, job } = await started("empty");
      await asking(p, id, job);
      for (const body of [
        { request_ref: "r1", code: "" },
        { request_ref: "r1", code: "　 " },
        { request_ref: "r1", code: "1".repeat(65) },
      ]) {
        const r = await h.answer(w, id, body);
        expect(r.status, JSON.stringify(body)).toBe(422);
        expect((await h.json(r))["code"]).toBe(E.codeEmpty);
      }
      for (const body of [{ request_ref: "r1", code: "123456", approved: true }, { request_ref: "r1" }]) {
        const r = await h.answer(w, id, body);
        expect(r.status, JSON.stringify(body)).toBe(422);
      }
      expect(
        await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'answer'", [job]),
      ).toBe(0);
    },
    T,
  );

  it(
    "K355-API-013 頼まれていない（違う request_ref・確かめが終わった）：404・E-CRED-014 とその文。答えの行は作らない",
    async () => {
      const { w, p, id, job } = await started("notasked");
      let r = await h.answer(w, id, { request_ref: "never", code: "123456" });
      expect(r.status).toBe(404);
      expect((await h.json(r))["code"]).toBe(E.notAsked);
      await asking(p, id, job);
      expect((await h.report(p, id, { job_id: job, state: "stopped", detail: "止めました" })).status).toBe(201);
      r = await h.answer(w, id, { request_ref: "r1", code: "123456" });
      expect(r.status).toBe(404);
      const j = await h.json(r);
      expect(j["code"]).toBe(E.notAsked);
      expect(String(j["message"] ?? "")).toBe(msg(E.notAsked));
      expect(
        await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'answer'", [job]),
      ).toBe(0);
    },
    T,
  );

  it(
    "K355-API-014 守り：ほかの人の物に答える → 404・答えの行は作らない",
    async () => {
      const { p, id, job } = await started("other-owner");
      await asking(p, id, job);
      const stranger = await h.who("stranger");
      const r = await h.answer(stranger, id, { request_ref: "r1", code: "123456" });
      expect(r.status).toBe(404);
      expect(
        await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'answer'", [job]),
      ).toBe(0);
    },
    T,
  );

  it(
    "K355-API-015 操作の揺れ：同じ頼みに 2 回答える → 2 回目も 201。答えの行は 1 つで、1 回目のコードのまま",
    async () => {
      const { w, p, id, job } = await started("twice");
      await asking(p, id, job);
      expect((await h.answer(w, id, { request_ref: "r1", code: "111111" })).status).toBe(201);
      expect((await h.answer(w, id, { request_ref: "r1", code: "222222" })).status).toBe(201);
      const rows = (
        await h.admin.query(
          "select payload->>'code' as c from bridge_job_events where job_id = $1 and kind = 'answer'",
          [job],
        )
      ).rows as { c: string }[];
      expect(rows.map((x) => x.c)).toEqual(["111111"]);
    },
    T,
  );

  it(
    "K355-API-016 秘密を出さない：答える間のログにコードの字が無い",
    async () => {
      const { w, p, id, job } = await started("log");
      await asking(p, id, job);
      const logs = await h.captureLogs(async () => {
        expect((await h.answer(w, id, { request_ref: "r1", code: "975310" })).status).toBe(201);
      });
      expect(logs).not.toContain("975310");
    },
    T,
  );

  it(
    "K355-API-017 失敗 S2：答えを置く関数が使えない → 503・E-PAGE-003。答えの行も仕事の段も変わらない",
    async () => {
      const { w, p, id, job } = await started("s2");
      await asking(p, id, job);
      await h.withoutFn("app.credential_check_answer(uuid, uuid, text, text)", async () => {
        const r = await h.answer(w, id, { request_ref: "r1", code: "123456" });
        expect(r.status).toBe(503);
        expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      });
      expect(
        await h.count("select count(*) as n from bridge_job_events where job_id = $1 and kind = 'answer'", [job]),
      ).toBe(0);
      expect((await h.jobRow(job))["state_id"]).toBe("asking");
    },
    T,
  );
});

describe("K-355 reportCredentialCheck（PC が途中と結果を知らせる）", () => {
  it(
    "K355-API-018 結果 ok：201 { accepted: true, code: null }。行は ok・文・時刻、仕事は done（result ok）、証跡は結果の種類だけ",
    async () => {
      const { p, id, job } = await started("rep-ok");
      const r = await h.report(p, id, { job_id: job, state: "ok", detail: "入れました" });
      expect(r.status, await r.clone().text()).toBe(201);
      expect((await h.json(r)).data).toEqual({ accepted: true, code: null });
      const row = await h.credRow(id);
      expect(row).toMatchObject({ login_check_state: "ok", login_check_detail: "入れました" });
      expect(row["login_check_at"]).not.toBeNull();
      expect(await h.jobRow(job)).toMatchObject({ state_id: "done", result: "ok" });
      const a = (
        await h.admin.query(
          "select payload from audit_events where action = 'credential.login_check' and target_id = $1",
          [id],
        )
      ).rows as {
        payload: Record<string, unknown>;
      }[];
      expect(a).toHaveLength(1);
      expect(a[0]!.payload).toMatchObject({ job_id: job, state: "ok" });
    },
    T,
  );

  it("K355-API-019 結果の種類ごと：bad_password・needs_2fa・bad_code・captcha・unreachable・no_form は仕事 done。stopped・no_answer は仕事 stopped で理由は文。行の状態はどれも送った種類", async () => {
    for (const state of [
      "bad_password",
      "needs_2fa",
      "bad_code",
      "captcha",
      "unreachable",
      "no_form",
      "stopped",
      "no_answer",
    ]) {
      const { p, id, job } = await started(`rep-${state}`);
      const r = await h.report(p, id, { job_id: job, state, detail: `${state} の訳` });
      expect(r.status, state).toBe(201);
      expect((await h.credRow(id))["login_check_state"], state).toBe(state);
      const j = await h.jobRow(job);
      if (state === "stopped" || state === "no_answer")
        expect(j, state).toMatchObject({ state_id: "stopped", stopped_reason: `${state} の訳` });
      else expect(j, state).toMatchObject({ state_id: "done", result: state });
    }
  }, 240_000);

  it(
    "K355-API-020 途中 asking：201 { code: null }。仕事は asking、頼みの行（ask・種類・本人に見せる文）が 1 つ。同じ request_ref を 2 回送っても 1 つ",
    async () => {
      const { p, id, job } = await started("rep-ask");
      await asking(p, id, job);
      await asking(p, id, job);
      expect((await h.jobRow(job))["state_id"]).toBe("asking");
      const ev = (
        await h.admin.query("select payload from bridge_job_events where job_id = $1 and kind = 'ask'", [job])
      ).rows as {
        payload: Record<string, unknown>;
      }[];
      expect(ev).toHaveLength(1);
      expect(ev[0]!.payload).toMatchObject({ tool: "TwoFactorCode", summary: "発注ナビ の SMS のコード" });
      expect((await h.credRow(id))["login_check_state"]).not.toBe("asking");
    },
    T,
  );

  it(
    "K355-API-021 途中 waiting：答える前は code null。本人が答えた後の 1 回目だけ code。2 回目は null（取ったら消える・答えの行からコードが消え taken）",
    async () => {
      const { w, p, id, job } = await started("rep-wait");
      await asking(p, id, job);
      const wait = () => h.report(p, id, { job_id: job, state: "waiting", request_ref: "r1" });
      expect(await code(await wait())).toBeNull();
      expect((await h.answer(w, id, { request_ref: "r1", code: "654321" })).status).toBe(201);
      expect(await code(await wait())).toBe("654321");
      expect(await code(await wait())).toBeNull();
      const ev = (
        await h.admin.query("select payload from bridge_job_events where job_id = $1 and kind = 'answer'", [job])
      ).rows[0] as {
        payload: Record<string, unknown>;
      };
      expect(ev.payload["code"]).toBeUndefined();
      expect(ev.payload["taken"]).toBe(true);
    },
    T,
  );

  it(
    "K355-API-022 守り：ほかのアカウントの PC・道の id と仕事の情報が違う・確かめでない仕事 は 404。どれも行と仕事を変えない",
    async () => {
      const { w, p, id, job } = await started("rep-guard");
      const other = await h.pc(await h.who("rep-guard-other"));
      const otherCred = await h.cred(w);
      const chat = await h.chatJob(w.user.memberId, w.user.tenantId);
      await h.take(p);
      for (const [label, pcx, credId, jobId] of [
        ["ほかの PC", other, id, job],
        ["違う情報", p, otherCred, job],
        ["会話の仕事", p, id, chat],
      ] as const) {
        const r = await h.report(pcx, credId, { job_id: jobId, state: "ok", detail: "x" });
        expect(r.status, label).toBe(404);
      }
      // 行は running（PC が確かめの仕事を取った時に、取る関数 app.bridge_take_job が pending から running にしている）
      expect((await h.credRow(id))["login_check_state"]).toBe("running");
      expect((await h.jobRow(job))["state_id"]).toBe("running");
    },
    T,
  );

  it(
    "K355-API-023 対象の状態：もう終わった仕事に知らせる → 409・E-CRED-010。行は最初の結果のまま",
    async () => {
      const { p, id, job } = await started("rep-done");
      expect((await h.report(p, id, { job_id: job, state: "ok", detail: "入れました" })).status).toBe(201);
      const r = await h.report(p, id, { job_id: job, state: "bad_password", detail: "後から" });
      expect(r.status).toBe(409);
      expect((await h.json(r))["code"]).toBe(E.jobNotRunning);
      expect((await h.credRow(id))["login_check_state"]).toBe("ok");
    },
    T,
  );

  it(
    "K355-API-024 入力：知らない state・401 文字の detail・asking で request_ref が無い・ask_kind が code／approve でない は 422。行も仕事も変えない",
    async () => {
      const { p, id, job } = await started("rep-422");
      for (const body of [
        { job_id: job, state: "great" },
        { job_id: job, state: "ok", detail: "あ".repeat(401) },
        { job_id: job, state: "asking", ask_kind: "code", text: "x" },
        { job_id: job, state: "asking", request_ref: "r1", ask_kind: "voice", text: "x" },
      ]) {
        const r = await h.report(p, id, body);
        expect(r.status, JSON.stringify(body).slice(0, 80)).toBe(422);
      }
      // 行は running（PC が確かめの仕事を取った時に、取る関数 app.bridge_take_job が pending から running にしている）
      expect((await h.credRow(id))["login_check_state"]).toBe("running");
      expect((await h.jobRow(job))["state_id"]).toBe("running");
    },
    T,
  );

  it(
    "K355-API-025 利用者の状態：外した PC の印 → 401。行も仕事も変えない",
    async () => {
      const { p, id, job } = await started("rep-gone");
      await h.admin.query("update sessions set revoked_at = now() where id = $1", [p.sessionId]);
      const r = await h.report(p, id, { job_id: job, state: "ok" });
      expect(r.status).toBe(401);
      expect((await h.credRow(id))["login_check_state"]).toBe("running");
    },
    T,
  );

  it(
    "K355-API-026 失敗 S3：結果を書く関数が使えない → 503・E-PAGE-003。行・仕事・証跡は変わらない（PC は次の問い合わせでもう一度送れる）",
    async () => {
      const { p, id, job } = await started("s3");
      await h.withoutFn(
        "app.bridge_credential_check_report(uuid, uuid, uuid, text, text, text, text, text)",
        async () => {
          const r = await h.report(p, id, { job_id: job, state: "ok", detail: "入れました" });
          expect(r.status).toBe(503);
          expect((await h.json(r))["code"]).toBe("E-PAGE-003");
        },
      );
      // 行は running（PC が確かめの仕事を取った時に、取る関数 app.bridge_take_job が pending から running にしている）
      expect((await h.credRow(id))["login_check_state"]).toBe("running");
      expect((await h.jobRow(job))["state_id"]).toBe("running");
      expect(
        await h.count(
          "select count(*) as n from audit_events where action = 'credential.login_check' and target_id = $1",
          [id],
        ),
      ).toBe(0);
    },
    T,
  );
});
