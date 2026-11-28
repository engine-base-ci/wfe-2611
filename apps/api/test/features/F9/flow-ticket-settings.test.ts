// K-715「中間（段 10・J3）：設定を変えると作る面と詳細に効く（種別のひな形・状態の名前と色・項目）」の試験（口の組・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K715-J-NNN・K715-H-001（チケット 11_tickets/K-715.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-settings.md。
//   単体の葉（K-704 種別・K-705 状態・K-706・K-717 項目）が受けた分岐は重ねず、設定を変えたあとに、チケットを作る口（K-437）・チケットを読む口（K-560）・
//   値を直す口（K-564）・種別と項目を読む口（K-560・K-563）が変わるかを見る。段 5 の K-454・K-456 が「段 10 の後に足す」と書いた会社の項目の試験（作るとき必須で止まる・
//   値が入る・直す）はここで受ける（行 009〜013）。
//   「ひな形が入る」は、作る面が種別を選んだときに listTicketKinds の body_template を本文に入れて createTicket の body.doc に載せる動き（K-442・K-560）を、
//   口で再現して見る（口の createTicket はひな形を自分では足さない）。
//   行 001〜013 は 1 本の筋（1 つの会社）で、前の行が作った物を次の行が読む（上から順に流れる）。行 014 は別の会社を足して見る。
//   土台は settings.harness.ts（K-704 が運ぶ）を読むだけで、変えない。口の振る舞いは startSettings が読む hooks のファイル（K-326）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startSettings, type Json, type Settings, type World } from "./settings.harness.js";

const HOOKS = [
  "ticket-kinds-write",
  "ticket-stages-write",
  "ticket-fields-read",
  "ticket-fields-write",
  "ticket-fields-edit",
  "ticket-update",
] as const;
const jst = (days = 0): string => new Date(Date.now() + 9 * 3600_000 + days * 86400_000).toISOString().slice(0, 10);
const DOC = (head: string, body = "ここに書く") => ({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: head }] },
    { type: "paragraph", content: [{ type: "text", text: body }] },
  ],
});

let s: Settings;
beforeAll(async () => {
  s = await startSettings(HOOKS);
}, 120_000);
afterAll(async () => {
  await s?.close();
});

const dataOf = async (r: Response, status: number): Promise<Json> => {
  expect(r.status, await r.clone().text()).toBe(status);
  return ((await s.json(r)).data ?? {}) as Json;
};
const rowsOf = async (r: Response): Promise<Json[]> => {
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await s.json(r)).data ?? []) as Json[];
};
const codeOf = async (r: Response): Promise<unknown> => (await s.json(r))["code"];
const kinds = (w: World): Promise<Json[]> => s.call(w.member, "GET", "/ticket_kinds").then(rowsOf);
const kindRow = async (w: World, id: string): Promise<Json> => (await kinds(w)).find((x) => x["id"] === id)!;
const stages = (w: World): Promise<Json[]> => s.call(w.member, "GET", "/ticket_stages").then(rowsOf);
const master = (w: World): Promise<Json[]> => s.call(w.admin, "GET", "/ticket-field-master").then(rowsOf);
/** チケットを作る口（作る面と同じ入力：題名・種別・担当者・期限・本文 body.doc・会社の項目 fields） */
const make = (w: World, kind: string, extra: Record<string, unknown> = {}): Promise<Response> =>
  s.call(w.member, "POST", "/tickets", {
    scope_id: w.rootScope,
    kind_id: kind,
    title: "見積を作る",
    assignee_member_id: w.member.id,
    due_on: jst(3),
    ...extra,
  });
const detail = async (w: World, id: string): Promise<Json> =>
  dataOf(await s.call(w.member, "GET", `/tickets/${id}`), 200);
const fieldOf = (d: Json, id: string): Json | undefined => (d["fields"] as Json[]).find((f) => f["id"] === id);
const valueRows = (field: string): Promise<number> =>
  s.n("select count(*) as n from ticket_field_values where field_id = $1 and deleted_at is null", [field]);

interface Story {
  w: World;
  /** 足した種別「見積」と、前からの種別「課題」 */
  kind: string;
  other: string;
  ticket: string;
  tpl: Json;
  req: string;
  sel: string;
  options: Json[];
  made: string;
}
let S: Story;

describe("K-715 中間：設定を変えると作る面と詳細に効く", () => {
  it("K715-J-001 種別を足してひな形を決める：管理者が種別「見積」（色 coral・ひな形つき）を足すと 201。メンバーが読む種別の一覧に、色・ひな形が出て、会社の項目はまだ無い。作る面と同じにひな形を本文に入れて作ると、詳細の本文にひな形の字が入る。メンバーは種別を足せない（403）", async () => {
    const w = await s.world("K715 筋");
    const tpl = DOC("見積の目的");
    const r = await dataOf(
      await s.call(w.admin, "POST", "/ticket_kinds", { name: "見積", color_key: "coral", body_template: tpl }),
      201,
    );
    const kind = String(r["id"]);
    expect(r).toMatchObject({ name: "見積", color_key: "coral", is_builtin: false });
    const row = await kindRow(w, kind);
    expect(row).toMatchObject({ name: "見積", color_key: "coral", fields: [] });
    expect(JSON.stringify(row["body_template"])).toContain("見積の目的");
    expect((await s.call(w.member, "POST", "/ticket_kinds", { name: "勝手", color_key: "teal" })).status).toBe(403);
    const made = await dataOf(await make(w, kind, { body: { doc: row["body_template"] } }), 201);
    const ticket = String((made["ticket"] as Json | undefined)?.["id"] ?? made["id"]);
    const d = await detail(w, ticket);
    expect(String((d["body"] as Json)["text"])).toContain("見積の目的");
    S = {
      w,
      kind,
      other: await s.kindId(w, "課題"),
      ticket,
      tpl,
      req: "",
      sel: "",
      options: [],
      made: "",
    };
  });

  it("K715-J-002 ひな形を直すと、これから作る分に効く：管理者がひな形を直すと種別の一覧が新しいひな形を返し、新しく作った詳細には新しい字が入る。前に作ったチケットの本文は変わらない", async () => {
    const { w, kind, ticket } = S;
    const r = await dataOf(
      await s.call(w.admin, "PATCH", `/ticket_kinds/${kind}`, { body_template: DOC("見積の前提") }),
      200,
    );
    expect(JSON.stringify(r["body_template"])).toContain("見積の前提");
    const row = await kindRow(w, kind);
    expect(JSON.stringify(row["body_template"])).toContain("見積の前提");
    expect(JSON.stringify(row["body_template"])).not.toContain("見積の目的");
    const fresh = await dataOf(await make(w, kind, { body: { doc: row["body_template"] } }), 201);
    const id = String((fresh["ticket"] as Json | undefined)?.["id"] ?? fresh["id"]);
    expect(String(((await detail(w, id))["body"] as Json)["text"])).toContain("見積の前提");
    const old = await detail(w, ticket);
    expect(String((old["body"] as Json)["text"])).toContain("見積の目的");
    expect(String((old["body"] as Json)["text"])).not.toContain("見積の前提");
  });

  it("K715-J-003 色を直して並べる：種別の色を直すと一覧の色の鍵が変わり、並べ直すと一覧の並びが変わる（今ある種別の id を全部送る）。並びが今と合わない送り方は 409 E-KND-004", async () => {
    const { w, kind } = S;
    expect(
      await dataOf(await s.call(w.admin, "PATCH", `/ticket_kinds/${kind}`, { color_key: "plum" }), 200),
    ).toMatchObject({
      color_key: "plum",
    });
    expect((await kindRow(w, kind))["color_key"]).toBe("plum");
    const ids = (await kinds(w)).map((x) => String(x["id"]));
    const reordered = [kind, ...ids.filter((x) => x !== kind)];
    await dataOf(await s.call(w.admin, "POST", "/ticket_kinds/order", { kind_ids: reordered }), 200);
    expect((await kinds(w)).map((x) => x["id"])).toEqual(reordered);
    const bad = await s.call(w.admin, "POST", "/ticket_kinds/order", { kind_ids: [kind] });
    expect(bad.status).toBe(409);
    expect(await codeOf(bad)).toBe("E-KND-004");
  });

  it("K715-J-004 使っているチケットのある種別は消せない：チケットのある「見積」を消そうとすると 409 E-KND-003（使っているチケットの数つき）。種別もチケットも残り、そのチケットは今までどおり開ける", async () => {
    const { w, kind, ticket } = S;
    const r = await s.call(w.admin, "DELETE", `/ticket_kinds/${kind}`);
    expect(r.status).toBe(409);
    const body = await s.json(r);
    expect(body["code"]).toBe("E-KND-003");
    expect(Number(((body["detail"] ?? {}) as Json)["ticket_count"])).toBeGreaterThanOrEqual(2);
    expect(await kindRow(w, kind)).toBeTruthy();
    expect(((await detail(w, ticket))["kind"] as Json)["id"]).toBe(kind);
  });

  it("K715-J-005 使っていない種別は消せて、作るときに選べなくなる：チケットの無い種別を足してすぐ消すと 200・一覧から消える。その種別でチケットを作ろうとすると 404（体に欄も details も無い）で、チケットは増えない", async () => {
    const { w } = S;
    const gone = String(
      (await dataOf(await s.call(w.admin, "POST", "/ticket_kinds", { name: "仮", color_key: "sage" }), 201))["id"],
    );
    expect(await dataOf(await s.call(w.admin, "DELETE", `/ticket_kinds/${gone}`), 200)).toMatchObject({ id: gone });
    expect((await kinds(w)).some((x) => x["id"] === gone)).toBe(false);
    const before = await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    const r = await make(w, gone);
    expect(r.status).toBe(404);
    const body = await s.json(r);
    expect(Object.keys(body)).not.toContain("field");
    expect(Object.keys(body)).not.toContain("details");
    expect(await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId])).toBe(before);
  });

  it("K715-J-006 状態の名前と色を直すと一覧と詳細に効く：作業中の状態の名前と色を直すと、状態の一覧が新しい名前と色の鍵を返し、その状態にあるチケットの詳細の段の名前も新しくなる（鍵 doing は変わらない）", async () => {
    const { w } = S;
    const doing = await s.stageId(w, "doing");
    const t = await s.ticket(w, { stageId: doing });
    const r = await dataOf(
      await s.call(w.admin, "PATCH", `/ticket_stages/${doing}`, { name: "着手中", color_key: "amber" }),
      200,
    );
    expect(r).toMatchObject({ key: "doing", name: "着手中", color_key: "amber" });
    expect((await stages(w)).find((x) => x["id"] === doing)).toMatchObject({
      key: "doing",
      name: "着手中",
      color_key: "amber",
    });
    expect((await detail(w, t))["stage"]).toMatchObject({ key: "doing", name: "着手中" });
  });

  it("K715-J-007 状態を足して並べる・始めと終わりは消せない：状態を足すと終わりの直前に入る（201）。始めを先頭・終わりを最後に置いたまま並べ替えると一覧の並びが変わり、始めか終わりを消そうとすると 409 E-STG-003、始めを先頭に置かない並びは 409 E-STG-007", async () => {
    const { w } = S;
    const added = String(
      (await dataOf(await s.call(w.admin, "POST", "/ticket_stages", { name: "確認待ち", color_key: "teal" }), 201))[
        "id"
      ],
    );
    const list = (await stages(w)).map((x) => String(x["id"]));
    expect(list.indexOf(added)).toBe(list.length - 2);
    const next = [list[0]!, added, ...list.slice(1).filter((x) => x !== added)];
    await dataOf(await s.call(w.admin, "POST", "/ticket_stages/order", { stage_ids: next }), 200);
    expect((await stages(w)).map((x) => x["id"])).toEqual(next);
    for (const key of ["todo", "done"]) {
      const r = await s.call(w.admin, "DELETE", `/ticket_stages/${await s.stageId(w, key)}`);
      expect(r.status, key).toBe(409);
      expect(await codeOf(r), key).toBe("E-STG-003");
    }
    const wrong = await s.call(w.admin, "POST", "/ticket_stages/order", {
      stage_ids: [added, ...next.filter((x) => x !== added)],
    });
    expect(wrong.status).toBe(409);
    expect(await codeOf(wrong)).toBe("E-STG-007");
  });

  it("K715-J-008 使っている状態は消せない：足した状態にチケットがあると消そうとして 409 E-STG-005（使っている数つき）。チケットを別の状態へ移すと消せて、一覧から消える", async () => {
    const { w } = S;
    const stage = (await stages(w)).find((x) => x["name"] === "確認待ち")!["id"] as string;
    const t = await s.ticket(w, { stageId: stage });
    const r = await s.call(w.admin, "DELETE", `/ticket_stages/${stage}`);
    expect(r.status).toBe(409);
    const body = await s.json(r);
    expect(body["code"]).toBe("E-STG-005");
    expect(Number(((body["detail"] ?? {}) as Json)["ticket_count"])).toBe(1);
    await s.f.admin.query("update tickets set stage_id = $2 where id = $1", [t, await s.stageId(w, "todo")]);
    expect(await dataOf(await s.call(w.admin, "DELETE", `/ticket_stages/${stage}`), 200)).toMatchObject({ id: stage });
    expect((await stages(w)).some((x) => x["id"] === stage)).toBe(false);
  });

  it("K715-J-009 項目を足すと作るときに止まる・値が入る：管理者が「先方の担当者名」（文字・必須・見積だけ）を足すと、見積の種別の読みにだけその項目が出る。見積を項目なしで作ろうとすると 409 E-FLD-004（チケットは増えない）。課題は項目なしで作れる。値を入れて作ると詳細に値が出て、設定の側の値の数が 1 になる", async () => {
    const { w, kind, other } = S;
    const f = await dataOf(
      await s.call(w.admin, "POST", "/ticket-fields", {
        name: "先方の担当者名",
        field_type: "short_text",
        kind_ids: [kind],
        required: true,
        description: "契約書の名前",
      }),
      201,
    );
    const req = String(f["id"]);
    expect(f).toMatchObject({ required: true, kind_ids: [kind], all_kinds: false, value_count: 0 });
    expect(((await kindRow(w, kind))["fields"] as Json[]).map((x) => x["id"])).toEqual([req]);
    expect(((await kindRow(w, other))["fields"] as Json[]).map((x) => x["id"])).not.toContain(req);
    const before = await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    const stop = await make(w, kind);
    expect(stop.status).toBe(409);
    expect(await codeOf(stop)).toBe("E-FLD-004");
    expect(await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId])).toBe(before);
    expect((await make(w, other)).status).toBe(201);
    const made = await dataOf(await make(w, kind, { fields: { [req]: "山田さん" } }), 201);
    const id = String((made["ticket"] as Json | undefined)?.["id"] ?? made["id"]);
    expect(fieldOf(await detail(w, id), req)).toMatchObject({
      name: "先方の担当者名",
      required: true,
      value: "山田さん",
    });
    expect((await master(w)).find((x) => x["id"] === req)).toMatchObject({ value_count: 1 });
    S.req = req;
    S.made = id;
  });

  it("K715-J-010 選ぶ型の項目：「請求先」（1 つ選ぶ・経理／営業）を足すと選ぶ物に id が付き、見積の種別の読みに同じ id で出る。選んで作ると詳細に選んだ物が出る。選ぶ物に無い値は 409 E-FLD-002・見積に出ない課題に付けると 409 E-FLD-001（どちらもチケットは増えない）", async () => {
    const { w, kind, other, req } = S;
    const f = await dataOf(
      await s.call(w.admin, "POST", "/ticket-fields", {
        name: "請求先",
        field_type: "select",
        kind_ids: [kind],
        options: [{ name: "経理" }, { name: "営業" }],
      }),
      201,
    );
    const sel = String(f["id"]);
    const options = f["options"] as Json[];
    expect(options.map((o) => o["name"])).toEqual(["経理", "営業"]);
    const inKind = ((await kindRow(w, kind))["fields"] as Json[]).find((x) => x["id"] === sel)!;
    expect((inKind["options"] as Json[]).map((o) => o["id"])).toEqual(options.map((o) => o["id"]));
    const before = await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId]);
    const made = await dataOf(await make(w, kind, { fields: { [req]: "佐藤さん", [sel]: options[1]!["id"] } }), 201);
    const id = String((made["ticket"] as Json | undefined)?.["id"] ?? made["id"]);
    expect(fieldOf(await detail(w, id), sel)).toMatchObject({ value: options[1]!["id"] });
    const bad = await make(w, kind, { fields: { [req]: "佐藤さん", [sel]: "00000000-0000-4000-8000-000000000009" } });
    expect(bad.status).toBe(409);
    expect(await codeOf(bad)).toBe("E-FLD-002");
    const wrongKind = await make(w, other, { fields: { [sel]: options[0]!["id"] } });
    expect(wrongKind.status).toBe(409);
    expect(await codeOf(wrongKind)).toBe("E-FLD-001");
    expect(await s.n("select count(*) as n from tickets where tenant_id = $1", [w.tenantId])).toBe(before + 1);
    S.sel = sel;
    S.options = options;
  });

  it("K715-J-011 項目と値を直す：詳細の値を直す口（updateTicket の fields）で値が変わり、必須の項目は空にできない（409 E-FLD-004）。設定で項目の名前を直すと、詳細でも新しい名前で同じ値が出る。値が入っている間は型を変えられない（409 E-FMS-002）", async () => {
    const { w, req, made } = S;
    const upd = await s.call(w.member, "PATCH", `/tickets/${made}`, { fields: { [req]: "鈴木さん" } });
    expect(upd.status, await upd.clone().text()).toBe(200);
    expect(fieldOf(await detail(w, made), req)).toMatchObject({ value: "鈴木さん" });
    const empty = await s.call(w.member, "PATCH", `/tickets/${made}`, { fields: { [req]: null } });
    expect(empty.status).toBe(409);
    expect(await codeOf(empty)).toBe("E-FLD-004");
    expect(fieldOf(await detail(w, made), req)).toMatchObject({ value: "鈴木さん" });
    expect(
      await dataOf(await s.call(w.admin, "PATCH", `/ticket-fields/${req}`, { name: "先方の担当" }), 200),
    ).toMatchObject({
      name: "先方の担当",
    });
    expect(fieldOf(await detail(w, made), req)).toMatchObject({ name: "先方の担当", value: "鈴木さん" });
    const type = await s.call(w.admin, "PATCH", `/ticket-fields/${req}`, { field_type: "number" });
    expect(type.status).toBe(409);
    expect(await codeOf(type)).toBe("E-FMS-002");
  });

  it("K715-J-012 項目を並べる：項目の並びを入れ替えると、設定の一覧と、種別の読み（作る面・詳細の項目の並び）が同じ順になる。今の項目と合わない並びは 409 E-FMS-003", async () => {
    const { w, kind, req, sel } = S;
    const order = [sel, req];
    expect(
      (await rowsOf(await s.call(w.admin, "POST", "/ticket-fields/order", { field_ids: order }))).map((x) => x["id"]),
    ).toEqual(order);
    expect(((await kindRow(w, kind))["fields"] as Json[]).map((x) => x["id"])).toEqual(order);
    expect(((await detail(w, S.made))["fields"] as Json[]).map((x) => x["id"])).toEqual(order);
    const bad = await s.call(w.admin, "POST", "/ticket-fields/order", { field_ids: [req] });
    expect(bad.status).toBe(409);
    expect(await codeOf(bad)).toBe("E-FMS-003");
  });

  it("K715-J-013 項目を消すと値が見えなくなる：必須の項目を消すと 200。詳細にその項目も値も出なくなり、見積を項目なしで作れるようになる（消した必須は止めない）。値の行は消えずに残り、同じ名前の項目をもう一度足せる（値は戻らない）", async () => {
    const { w, kind, req, made } = S;
    expect(await valueRows(req)).toBeGreaterThan(0);
    expect(await dataOf(await s.call(w.admin, "DELETE", `/ticket-fields/${req}`), 200)).toMatchObject({ id: req });
    expect(fieldOf(await detail(w, made), req)).toBeUndefined();
    expect((await master(w)).some((x) => x["id"] === req)).toBe(false);
    expect((await make(w, kind, { fields: { [S.sel]: S.options[0]!["id"] } })).status).toBe(201);
    expect(await valueRows(req)).toBeGreaterThan(0);
    const again = await dataOf(
      await s.call(w.admin, "POST", "/ticket-fields", {
        name: "先方の担当",
        field_type: "short_text",
        kind_ids: [kind],
      }),
      201,
    );
    expect(again["id"]).not.toBe(req);
    expect(fieldOf(await detail(w, made), String(again["id"]))).toMatchObject({ value: null });
  });

  it("K715-J-014 設定は管理者だけ・別の会社には効かない：メンバーは項目・状態も足せず直せない（403）。別の会社の管理者が、この会社の種別・状態・項目を直す・消す・並べるは 404（在るかを漏らさない）で、この会社の設定は変わらない。別の会社の種別の一覧に「見積」は出ない", async () => {
    const { w, kind, sel } = S;
    expect(
      (await s.call(w.member, "POST", "/ticket-fields", { name: "勝手", field_type: "short_text", kind_ids: [kind] }))
        .status,
    ).toBe(403);
    const doing = await s.stageId(w, "doing");
    expect((await s.call(w.member, "PATCH", `/ticket_stages/${doing}`, { name: "勝手" })).status).toBe(403);
    const o = await s.world("K715 別の会社");
    for (const [method, path, body] of [
      ["PATCH", `/ticket_kinds/${kind}`, { name: "乗っ取り" }],
      ["DELETE", `/ticket_kinds/${kind}`, undefined],
      ["PATCH", `/ticket_stages/${doing}`, { name: "乗っ取り" }],
      ["PATCH", `/ticket-fields/${sel}`, { name: "乗っ取り" }],
      ["DELETE", `/ticket-fields/${sel}`, undefined],
    ] as const) {
      const r = await s.call(o.admin, method, path, body);
      expect(r.status, `${method} ${path}`).toBe(404);
    }
    expect((await kinds(o)).some((x) => x["name"] === "見積")).toBe(false);
    expect((await stages(w)).find((x) => x["id"] === doing)).toMatchObject({ name: "着手中" });
    expect((await master(w)).some((x) => x["id"] === sel)).toBe(true);
  });

  // K715-H-001 は人が確かめる行（画面を通す確認）。試験のコードは書かない（チケットの judge-skip）。
});
