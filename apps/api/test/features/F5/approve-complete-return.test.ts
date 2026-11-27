// K-163「差し戻す（理由をつけて作り直させる）」の単体の試験（口・本物の DB・本物の PC の印）。親 K-63 の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま・11_tickets/K-163.md の表のマスと分岐に 1 対 1）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
import { describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import {
  setupApproveComplete,
  CONF_DONE,
  VAL_REASON_EMPTY,
  GONE,
  ARTIFACT,
  f,
  T,
  boss,
  writer,
  json,
  one,
  queue,
  detail,
  approve,
  giveBack,
  take,
  lastSeen,
  stageOf,
  stageKeyOf,
  team,
  ticket,
  delegated,
  approvalRow,
  runsOf,
  jobOf,
  messagesOf,
  details,
  snapshot,
  breakWritable,
} from "./approve-complete.harness.js";

setupApproveComplete();

describe("K-63 承認して完了する：承認・差し戻し（口・本物の DB）", () => {
  it("K63-API-006 承認待ち × 差し戻すと理由 × 承認する人：差し戻しを記録し（理由・next_actor clone）、理由つきの作り直しの仕事を同じ AI に積む。チケットは実行中", async () => {
    const t = await ticket({ body: true }); // K-578：prompt のチケットの中身は本文の行から組む（前の区画は読まない）
    const d = await delegated(t);
    const r = await giveBack(boss, d.approvalId, "  宛名を「株式会社サンプル 経理部」にしてください  ");
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await json(r)).data).toMatchObject({ id: d.approvalId, decision: "return", status_id: "returned" });
    const a = await approvalRow(d.approvalId);
    expect(a).toMatchObject({
      decision: "return",
      status_id: "returned",
      next_actor: "clone",
      return_reason: "宛名を「株式会社サンプル 経理部」にしてください",
    });
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(remake.id).not.toBe(d.makeRunId);
    expect(remake.status_id).toBe("queued");
    expect(remake.approval_id).toBe(d.approvalId); // 作り直しの実行に差し戻した承認を結ぶ（K-62 の getActionRun が理由を返せるように）
    const job = await jobOf(remake.bridge_job_id!);
    expect(job["member_id"]).toBe(d.by.id); // 任せた人の AI が作り直す（D-128.176）
    expect(job["agent_session_id"]).toBe(d.agentSession); // 前の作る実行と同じ続き（K-63 が行に入れる）
    expect(String(job["prompt"])).toContain("月末の請求を出す"); // チケットの中身（K-62 の app.ticket_job_context の組み方）
    expect(String(job["prompt"])).toContain("差し戻されました。理由：宛名を「株式会社サンプル 経理部」にしてください");
    expect(job["permission_mode"]).toBe("manual"); // 作り直しは作る段と同じ manual（D-131.5）
    expect(remake.created_by).toBe(d.by.id); // 作り直しの実行の created_by は任せた人（鎖を保つ・差し戻した人ではない）
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
    expect(await stageKeyOf(t.id)).toBe("running");
    expect((await messagesOf(t.id)).at(-1)!.body).toContain("高本が差し戻しました");
  });

  it("K63-API-007 承認待ち × 差し戻すで理由が空・空白だけ・全角空白だけ：422・E-VAL-020（欄 note）・何も書かない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const before = await snapshot(t);
    for (const note of ["", "   ", "　　", "\n\t"]) {
      const r = await giveBack(boss, d.approvalId, note);
      expect(r.status, JSON.stringify(note)).toBe(422);
      const j = await json(r);
      expect(details(j).map((x) => x.field)).toContain("note");
      expect(JSON.stringify(j)).toContain(VAL_REASON_EMPTY);
    }
    expect(await snapshot(t)).toEqual(before);
  });

  it("K63-API-018 差し戻し済み × 承認する：409・変えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    expect((await giveBack(boss, d.approvalId, "直してください")).status).toBe(201);
    const r = await approve(boss, d.approvalId);
    expect(r.status).toBe(409);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "return", status_id: "returned" });
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
  });

  it("K63-API-019 差し戻し済み・作り直しが届いた × 承認待ちの画面：新しい承認待ちの行として並ぶ（前の行は差し戻しのまま）", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "差し戻した人", ticketAbility: "edit" });
    const t = await ticket({ assignee: who });
    const d = await delegated(t);
    expect((await giveBack(who, d.approvalId, "直してください")).status).toBe(201);
    const second = await delegated(t);
    const rows = (await json(await queue(who))).data as unknown as { id: string }[];
    expect(rows.map((x) => x.id)).toEqual([second.approvalId]);
    expect(await approvalRow(d.approvalId)).toMatchObject({ decision: "return" });
  });

  it("K63-API-020 取り下げ済み（withdrawn_at あり）× 承認する・差し戻す：409・変えない", async () => {
    const t = await ticket();
    const d = await delegated(t);
    await f.admin.query("update approvals set withdrawn_at = now() where id = $1", [d.approvalId]);
    for (const r of [await approve(boss, d.approvalId), await giveBack(boss, d.approvalId, "直して")]) {
      expect(r.status).toBe(409);
      expect((await json(r))["code"]).toBe(CONF_DONE);
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-022 承認待ち × 押す直前に担当が替わった（承認する人は今の担当者から引く）・閲覧のみになった × 開いていた画面のまま：口で止まる（403）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    // 担当を替える口（updateTicket・F4）はまだ無いので、チケットの担当の列だけを替える（承認の行は替えない）
    await f.admin.query("update tickets set assignee_member_id = $2 where id = $1", [t.id, writer.id]);
    expect((await approve(boss, d.approvalId)).status).toBe(403);
    expect((await giveBack(boss, d.approvalId, "直して")).status).toBe(403);
    // 書けない承認する人は、関数が「書ける」（app.ticket_writable）を見て止める（M1）。担当者は 0072 の決まりで常に書けるので、
    //   書けなくなる形（本人のものでない取り込みの下書きに入ったチケット）を置き、関数を直に呼んで確かめる
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const imp = await one<{ id: string }>(
      "insert into ticket_imports (tenant_id, uploaded_by, scope_id, source) values ($1, $2, $3, 'generic') returning id",
      [T.tenantId, writer.id, T.rootScope],
    );
    await f.admin.query("update tickets set draft_import_id = $2 where id = $1", [t2.id, imp.id]);
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    const out = await withTenant(f.pool, ctx, (cl) =>
      cl.query<{ v: { error?: string } }>("select app.approval_decide($1, 'approve', null) as v", [d2.approvalId]),
    );
    expect(out.rows[0]!.v.error).toBe("not_writable");
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
    expect(await runsOf(t2.id, "execute")).toHaveLength(0);
  });
});

describe("K-63 承認して完了する：入力・失敗・守り（口・本物の DB）", () => {
  it("K63-API-041 入力 × 差し戻しの理由に HTML・制御文字：HTML は文としてそのまま残し、作り直しの仕事にも文として渡す。タブ・改行は残し、NUL と C0 制御文字は入口で取り除く（断らない・切らない）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const note = "<script>alert(1)</script> 宛名を直して";
    expect((await giveBack(boss, d.approvalId, note)).status).toBe(201);
    expect((await approvalRow(d.approvalId))["return_reason"]).toBe(note);
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(String((await jobOf(remake.bridge_job_id!))["prompt"])).toContain(note);
    // 制御文字：\t \n \r は文のまま。\u0001・\u001f は取り除く。NUL（\u0000）は入口が 422 で断る（K-427・Postgres の text に NUL は入らない・500 にしない）
    const t2 = await ticket();
    const d2 = await delegated(t2);
    const raw = "宛名を\t直して\r\n日付も\u0002今日に\u0001\u001f";
    const kept = "宛名を\t直して\r\n日付も今日に";
    const r = await giveBack(boss, d2.approvalId, raw);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await approvalRow(d2.approvalId))["return_reason"]).toBe(kept);
    const remake2 = (await runsOf(t2.id, "make")).at(-1)!;
    expect(String((await jobOf(remake2.bridge_job_id!))["prompt"])).toContain(kept);
    // 制御文字だけなら、取り除いた後に空 → E-VAL-020
    const t3 = await ticket();
    const d3 = await delegated(t3);
    const e = await giveBack(boss, d3.approvalId, "\u0002\u0001");
    expect(e.status).toBe(422);
    expect(JSON.stringify(await json(e))).toContain(VAL_REASON_EMPTY);
    // NUL は入口の 422（VALIDATION_ERROR・欄 note）。空になった理由の E-VAL-020 ではない
    const nul = await giveBack(boss, d3.approvalId, "戻す\u0000");
    expect(nul.status, await nul.clone().text()).toBe(422);
    const nulBody = (await json(nul)) as { code?: string; details?: { field: string }[] };
    expect(nulBody.code).toBe("VALIDATION_ERROR");
    expect((nulBody.details ?? []).map((d) => d.field)).toEqual(["note"]);
    expect(JSON.stringify(nulBody)).not.toContain(VAL_REASON_EMPTY);
  });

  it("K63-API-049 守り × 承認・差し戻しの答えの形：id・decision・decided_at・status_id・ticket_id・run_id・pc（live／asleep）だけ", async () => {
    for (const kind of ["approve", "return"] as const) {
      const t = await ticket();
      const d = await delegated(t);
      const r = kind === "approve" ? await approve(boss, d.approvalId) : await giveBack(boss, d.approvalId, "直して");
      expect(r.status).toBe(201);
      const data = (await json(r)).data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([
        "decided_at",
        "decision",
        "id",
        "pc",
        "run_id",
        "status_id",
        "ticket_id",
      ]);
      expect(["live", "asleep"]).toContain(data["pc"]);
      expect(String(data["run_id"])).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});

describe("K-63 承認して完了する：積む仕事の中身（口・本物の DB）", () => {
  it("K63-API-062 失敗 × 差し戻しの守りの判定の所で例外になった：503・E-PAGE-003。何も書かない（fail-closed）", async () => {
    const t = await ticket({ title: "K63 守りが壊れる 差し戻し" });
    const d = await delegated(t);
    const before = await snapshot(t);
    await breakWritable("K63 守りが壊れる 差し戻し", async () => {
      const r = await giveBack(boss, d.approvalId, "宛名を直してください");
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(await snapshot(t)).toEqual(before);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-068 承認待ち（kind が成果物でない承認）× 1 件・承認・差し戻し：404・E-PAGE-001。一覧にも出ない（この口は成果物の承認だけ・D-131.11）", async () => {
    const t = await ticket();
    const other = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
       values ($1, $2, 'escalation', $3, $4, $5, 'pending', false, '[]', $5) returning id`,
      [T.tenantId, T.rootScope, t.id, boss.id, writer.id],
    );
    for (const r of [
      await detail(boss, other.id),
      await approve(boss, other.id),
      await giveBack(boss, other.id, "直して"),
    ]) {
      expect(r.status).toBe(404);
      expect([GONE, "NOT_FOUND"]).toContain(String((await json(r))["code"]));
    }
    expect(((await json(await queue(boss))).data as unknown as { id: string }[]).map((x) => x.id)).not.toContain(
      other.id,
    );
    expect((await approvalRow(other.id))["decision"]).toBeNull();
  });

  it("K63-API-070 許可のモード：承認の後の実行の仕事は auto（D-128.177）、差し戻しの後の作り直しの仕事は manual（D-131.5・D-129.44）", async () => {
    const t1 = await ticket();
    const d1 = await delegated(t1);
    expect((await approve(boss, d1.approvalId)).status).toBe(201);
    const exec = (await runsOf(t1.id, "execute"))[0]!;
    expect((await jobOf(exec.bridge_job_id!))["permission_mode"]).toBe("auto");
    const t2 = await ticket();
    const d2 = await delegated(t2);
    expect((await giveBack(boss, d2.approvalId, "宛名を直して")).status).toBe(201);
    const remake = (await runsOf(t2.id, "make")).at(-1)!;
    expect((await jobOf(remake.bridge_job_id!))["permission_mode"]).toBe("manual");
    // 作り直しの仕事も PC にそのまま渡る（行の permission_mode のまま）
    await lastSeen(d2.pc.sid, 1);
    const job = await take(d2.pc);
    expect(job?.id).toBe(remake.bridge_job_id);
    expect(job?.["permission_mode"]).toBe("manual");
  });

  it("K63-API-075 守り × 承認の関数を直に呼ぶ：決めることが approve・return 以外なら bad_decision で何も書かない。作る段の実行が無い承認は requested_by を任せた人にして仕事を積む", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: false });
    const ctx: TenantContext = { tenantId: T.tenantId, userId: boss.id, role: "member", stepUpAt: null };
    for (const dec of ["self_edit", "stop", "approved", ""]) {
      const out = await withTenant(f.pool, ctx, (cl) =>
        cl.query<{ v: { error?: string } }>("select app.approval_decide($1, $2, null) as v", [d.approvalId, dec]),
      );
      expect(out.rows[0]!.v.error, dec).toBe("bad_decision");
    }
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
    expect(await runsOf(t.id, "execute")).toHaveLength(0);
    // 作る段の実行が無い承認（試験が DB に直に置いた形）：任せた人は requested_by
    const tm = await team("実行の無い承認を頼んだ人");
    const u = await ticket();
    const bare = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
       values ($1, $2, 'artifact', $3, $4, $5, 'pending', true, '[]', $5) returning id`,
      [T.tenantId, T.rootScope, u.id, boss.id, tm.by.id],
    );
    await f.admin.query("update tickets set stage_id = $2, delegated_to_clone = true where id = $1", [
      u.id,
      await stageOf(T.tenantId, "awaiting_approval"),
    ]);
    expect((await approve(boss, bare.id)).status).toBe(201);
    const run = (await runsOf(u.id, "execute"))[0]!;
    const job = await jobOf(run.bridge_job_id!);
    expect(job["member_id"]).toBe(tm.by.id);
    expect(job["agent_session_id"]).toBeNull(); // 続きの元が無い
    expect(job["resume_session_id"]).toBeNull();
  });

  it("K63-API-076 入力 × 差し戻しの理由が長い（5000 文字）：そのまま通り、理由の全文が承認の行・やり取りの 1 行・作り直しの仕事の prompt に残る（上限なし・D-131.1）", async () => {
    const t = await ticket();
    const d = await delegated(t);
    const note = "宛名を「株式会社サンプル 経理部」にしてください。".repeat(300).slice(0, 5000);
    expect(note).toHaveLength(5000);
    const r = await giveBack(boss, d.approvalId, note);
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await approvalRow(d.approvalId))["return_reason"]).toBe(note);
    expect((await messagesOf(t.id)).at(-1)!.body).toContain(note);
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(String((await jobOf(remake.bridge_job_id!))["prompt"])).toContain(note);
    expect(JSON.stringify(await json(r))).not.toContain("E-VAL-021"); // 上限のエラーは無い（欠番）
  });

  it("K63-API-077 任せた人≠承認する人 × 差し戻し → 作り直し → 承認：作り直しの実行の created_by は任せた人で、次の実行の仕事も任せた人の PC に積まれる（承認した人の PC には渡らない・D-128.176）", async () => {
    const approver = await team("承認する人（別の人）");
    const tm = await team("任せた人（別の人）");
    const t = await ticket({ assignee: approver.by });
    const d = await delegated(t, { by: tm });
    expect((await giveBack(approver.by, d.approvalId, "宛名を直してください")).status).toBe(201);
    const remake = (await runsOf(t.id, "make")).at(-1)!;
    expect(remake.created_by).toBe(tm.by.id); // 差し戻した人（承認する人）ではない
    expect((await jobOf(remake.bridge_job_id!))["member_id"]).toBe(tm.by.id);
    // 作り直しが届いた形（K-62 の finish が作る承認待ち）を置く：作る段の実行＝作り直しの実行
    await f.admin.query("update action_runs set status_id = 'done', finished_at = now() where id = $1", [remake.id]);
    await f.admin.query("update bridge_jobs set state_id = 'done', result = $2, taken_session_id = $3 where id = $1", [
      remake.bridge_job_id,
      ARTIFACT,
      tm.pc.sid,
    ]);
    const next = await one<{ id: string }>(
      `insert into approvals (tenant_id, scope_id, kind, ticket_id, action_run_id, approver_member_id, requested_by, status_id, irreversible, human_checks, created_by)
       values ($1, $2, 'artifact', $3, $4, $5, $6, 'pending', true, '[]', $6) returning id`,
      [T.tenantId, T.rootScope, t.id, remake.id, approver.by.id, tm.by.id],
    );
    await f.admin.query("update tickets set stage_id = $2 where id = $1", [
      t.id,
      await stageOf(T.tenantId, "awaiting_approval"),
    ]);
    await lastSeen(approver.pc.sid, 1);
    await lastSeen(tm.pc.sid, 1);
    expect((await approve(approver.by, next.id)).status).toBe(201);
    const exec = (await runsOf(t.id, "execute"))[0]!;
    expect(exec.created_by).toBe(approver.by.id); // 承認の後の実行の記録の created_by は呼んだ人
    expect((await jobOf(exec.bridge_job_id!))["member_id"]).toBe(tm.by.id); // 仕事は任せた人のもの
    expect(await take(approver.pc)).toBeNull(); // 承認した人の PC には渡らない
    const job = await take(tm.pc);
    expect(job?.id).toBe(exec.bridge_job_id);
  });
});
