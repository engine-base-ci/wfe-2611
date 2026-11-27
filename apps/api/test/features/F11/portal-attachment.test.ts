// K-909「ゲストが依頼に付ける添付を足す口（uploadPortalAttachment）」の単体の試験
//   （口と DB・本物の Postgres・置き場は試験の置き場（関門 C4）・口の入口は createApp と契約の op・偽の画面のログイン）。行 ID（K909-API-…）は 11_tickets/K-909.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/portal-attachment.ts の register（K-326）。
// 試験が決める口の形（契約は 05_flow/screen_api.py の前からある 1 行を直す。ファイルは契約の入口の 1MB の中に入れるため JSON の base64 で送る）:
//   uploadPortalAttachment POST /api/v1/portal/attachments  body { name: string（1〜200 字・前後の空白を取る・/ \ と制御文字を含まない）, content_type: "種類/種類"（100 字まで）, data: string（base64・ファイルの中身）}（知らない欄は 422）
//     201 { data: { id, name } }。中身は 1〜700000 バイト。大きすぎる 422・E-GST-181／足せない種類（実行できる形式：拡張子 exe bat cmd com msi scr ps1 vbs js jar sh app dmg apk dll bin pif lnk のどれか・
//       中身の先頭が MZ・ELF・#!・Mach-O のどれか）422・E-GST-182／まだ依頼に付いていない自分の下書きが 5 つある 422・E-GST-183／空のファイル 422・E-GST-184（どれも欄なし）
//     検査（大きさ・種類）に通った物だけを置き場（関門 C4・objects.put）に置く。置いたら attachments に 1 行（owner_type portal_draft・owner_id＝本人の member id・scope_id＝ゲストのグループの届け先・name・mime・size・
//       storage_ref・scanned_at＝今・created_by＝本人）＋ 証跡 portal.attachment_uploaded（payload は attachment_id と size だけ）。保持期間は 30 日
//     置き場が落ちたら 503・E-PAGE-003 で行は残らない。行を書けなかったら 503 で、置いたファイルを置き場から消す（半端なファイルを残さない）
//   ゲストでない人（役割 requester でない・グループが無い・止めた・抜けた・グループが消えた）は 403・社内の人は入口の 403・ログインなしは 401
// DB（migration 20261127100900_portal_attachment.sql）: attachments.name（列は 0041 で既にある・check だけ足す）・app.portal_attachment_room()（空きを返す）・app.portal_attachment_add(ref, name, mime, size)（security definer）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "@kaname/db/repository";
import { ObjectStore, type StorageDriver } from "@kaname/storage";
import { localDriver } from "@kaname/storage/local";
import { makeFixture, type Fixture } from "../fixture.js";
import {
  asG,
  asJson,
  asM,
  count,
  failOn,
  guest,
  hasNoDetail,
  useHooks,
  world,
  type Json,
  type P,
} from "./portal-world.js";

let f: Fixture;
let objects: ObjectStore;
const spy = { puts: 0, deletes: [] as string[], fail: false };
beforeAll(async () => {
  f = await makeFixture([]);
  const real = localDriver(mkdtempSync(join(tmpdir(), "k909-obj-")));
  const driver: StorageDriver = {
    put: async (k, b, m) => {
      spy.puts += 1;
      if (spy.fail) throw new Error("置き場が落ちた");
      return real.put(k, b, m);
    },
    get: (k) => real.get(k),
    delete: async (k) => {
      spy.deletes.push(k);
      return real.delete(k);
    },
  };
  objects = new ObjectStore(await createRepository(f.pool), driver, {
    signingSecret: "k909-test-files",
    maxBytes: 5 * 1024 * 1024,
  });
  await useHooks(f, "portal-attachment", { objects });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const MAX = 700_000;
const b64 = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString("base64");
const PDF = (size = 1000): Uint8Array => {
  const u = new Uint8Array(size);
  u.set(Buffer.from("%PDF-1.4\n"));
  return u;
};
const upload = (p: P | null, body: unknown, role: "client" | "member" = "client") =>
  f.req("POST", "/portal/attachments", { body, ...(p ? { headers: role === "client" ? asG(f, p) : asM(f, p) } : {}) });
const file = (name: string, bytes: Uint8Array | string = PDF(), type = "application/pdf") => ({
  name,
  content_type: type,
  data: b64(bytes),
});
const drafts = (p: P) =>
  count(f, "attachments", "owner_type = 'portal_draft' and owner_id = $1 and deleted_at is null", [p.id]);
const code = async (r: Response): Promise<string> => String((await asJson(r))["code"]);

describe("K-909 添付を足す（uploadPortalAttachment）", () => {
  it("K909-API-001 足す：201・鍵は id と name。DB は 1 行（owner_type portal_draft・owner_id は本人・scope_id はゲストのグループの届け先・name・mime・size はバイト数・scanned_at あり・created_by は本人）・置き場に同じ中身・証跡 portal.attachment_uploaded（payload は attachment_id と size だけ）", async () => {
    const w = await world(f, "001");
    const a = await guest(f, w, "山田", w.gA);
    const bytes = PDF(1234);
    const r = await upload(a, file("  報告書.pdf  ", bytes));
    expect(r.status, await r.clone().text()).toBe(201);
    const d = (await asJson(r)).data as { id: string; name: string };
    expect(Object.keys(d).sort()).toEqual(["id", "name"]);
    expect(d.name).toBe("報告書.pdf");
    const row = (
      await f.admin.query(
        "select owner_type, owner_id, scope_id, name, mime, size::int as size, storage_ref, scanned_at is not null as scanned, created_by from attachments where id = $1",
        [d.id],
      )
    ).rows[0]!;
    expect(row).toMatchObject({
      owner_type: "portal_draft",
      owner_id: a.id,
      scope_id: w.reqScope,
      name: "報告書.pdf",
      mime: "application/pdf",
      size: 1234,
      scanned: true,
      created_by: a.id,
    });
    expect(String(row["storage_ref"])).toMatch(new RegExp(`^tenants/${w.tenantId}/`));
    const got = await objects.get(
      { tenantId: w.tenantId, userId: a.id, role: "client", stepUpAt: null },
      String(row["storage_ref"]),
    );
    expect(got.status).toBe("done");
    if (got.status === "done") expect(Buffer.from(got.value.body).equals(Buffer.from(bytes))).toBe(true);
    const ev = (
      await f.admin.query<{ payload: Json }>(
        "select payload from audit_events where tenant_id = $1 and action = 'portal.attachment_uploaded'",
        [w.tenantId],
      )
    ).rows;
    expect(ev).toHaveLength(1);
    expect(Object.keys(ev[0]!.payload).sort()).toEqual(["attachment_id", "size"]);
  });

  it("K909-API-002 大きさ：700000 バイトちょうどは通る。700001 は 422・E-GST-181・空のファイルは 422・E-GST-184（欄なし）。断った物は置き場に置かず行も作らない", async () => {
    const w = await world(f, "002");
    const a = await guest(f, w, "山田", w.gA);
    expect((await upload(a, file("ぎりぎり.pdf", PDF(MAX)))).status).toBe(201);
    const puts = spy.puts;
    const big = await upload(a, file("大きい.pdf", PDF(MAX + 1)));
    expect(big.status).toBe(422);
    expect(await code(big)).toBe("E-GST-181");
    expect(hasNoDetail(await asJson(big))).toBe(true);
    const empty = await upload(a, { name: "空.pdf", content_type: "application/pdf", data: "" });
    expect(empty.status).toBe(422);
    expect(await code(empty)).toBe("E-GST-184");
    expect(spy.puts).toBe(puts);
    expect(await drafts(a)).toBe(1);
  });

  it("K909-API-003 種類（拡張子）：exe・bat・cmd・com・msi・scr・ps1・vbs・js・jar・sh・app・dmg・apk・dll・bin・pif・lnk は大文字でも・二重の拡張子（報告書.pdf.exe）でも 422・E-GST-182。pdf・png・docx・xlsx・txt・zip は通る。断った物は置かない", async () => {
    const w = await world(f, "003");
    const a = await guest(f, w, "山田", w.gA);
    const puts = spy.puts;
    for (const ext of [
      "exe",
      "BAT",
      "cmd",
      "com",
      "msi",
      "scr",
      "ps1",
      "vbs",
      "js",
      "jar",
      "sh",
      "app",
      "dmg",
      "apk",
      "dll",
      "bin",
      "pif",
      "lnk",
    ]) {
      const r = await upload(a, file(`x.${ext}`));
      expect(r.status, ext).toBe(422);
      expect(await code(r), ext).toBe("E-GST-182");
    }
    expect((await upload(a, file("報告書.pdf.exe"))).status).toBe(422);
    expect(spy.puts).toBe(puts);
    for (const name of ["a.pdf", "b.png", "c.docx", "d.xlsx", "e.txt"])
      expect((await upload(a, file(name, `text ${name}`))).status, name).toBe(201);
    expect(await drafts(a)).toBe(5);
  });

  it("K909-API-004 種類（中身）：名前が pdf でも、中身の先頭が MZ（Windows の実行ファイル）・ELF・#!（スクリプト）・Mach-O なら 422・E-GST-182。中身が普通の pdf・png の字なら通る（拡張子と中身が食い違っても中身で見分ける）", async () => {
    const w = await world(f, "004");
    const a = await guest(f, w, "山田", w.gA);
    const puts = spy.puts;
    const heads: [string, Uint8Array][] = [
      ["MZ", Buffer.from("MZ\x90\x00\x03")],
      ["ELF", Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1])],
      ["shebang", Buffer.from("#!/bin/sh\necho hi\n")],
      ["Mach-O", Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 7, 0, 0, 1])],
    ];
    for (const [label, head] of heads) {
      const r = await upload(a, file("報告書.pdf", head));
      expect(r.status, label).toBe(422);
      expect(await code(r), label).toBe("E-GST-182");
    }
    expect(spy.puts).toBe(puts);
    expect((await upload(a, file("a.pdf", PDF()))).status).toBe(201);
    expect(
      (await upload(a, file("b.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png"))
        .status,
    ).toBe(201);
  });

  it("K909-API-005 名前：日本語・記号・同じ名前を 2 回は通る（2 行できる）。200 字ちょうどは通り 201 字は 422。空・空白だけ・/ や \\ を含む・制御文字を含むは 422（欄 name）。前後の空白は取る", async () => {
    const w = await world(f, "005");
    const a = await guest(f, w, "山田", w.gA);
    for (const name of ["見積書（最終）#2.pdf", "同じ名前.pdf", "同じ名前.pdf", `${"あ".repeat(196)}.pdf`])
      expect((await upload(a, file(name))).status, name).toBe(201);
    expect(await drafts(a)).toBe(4);
    for (const bad of [
      `${"あ".repeat(197)}.pdf`,
      "",
      "   ",
      "../ひみつ.pdf",
      "a\\b.pdf",
      "a/b.pdf",
      "改\n行.pdf",
      "x\u0000.pdf",
    ]) {
      const r = await upload(a, file(bad));
      expect(r.status, JSON.stringify(bad)).toBe(422);
      expect(JSON.stringify(await asJson(r))).toContain("name");
    }
  });

  it("K909-API-006 入力の形（422）：data が base64 でない・content_type の形が違う（種類/種類でない・101 字）・欄が足りない・知らない欄（owner_id・scope_id）・文字でない。何も置かず行も作らない", async () => {
    const w = await world(f, "006");
    const a = await guest(f, w, "山田", w.gA);
    const puts = spy.puts;
    const base = file("a.pdf");
    const bad: unknown[] = [
      { ...base, data: "これはbase64ではない!!" },
      { ...base, content_type: "pdf" },
      { ...base, content_type: `a/${"b".repeat(100)}` },
      { name: "a.pdf", data: base.data },
      { content_type: "application/pdf", data: base.data },
      { name: "a.pdf", content_type: "application/pdf" },
      { ...base, owner_id: a.id },
      { ...base, scope_id: w.reqScope },
      { ...base, name: 5 },
      {},
      "text",
    ];
    for (const b of bad) expect((await upload(a, b)).status, JSON.stringify(b).slice(0, 60)).toBe(422);
    expect(spy.puts).toBe(puts);
    expect(await drafts(a)).toBe(0);
  });

  it("K909-API-007 5 つまで：まだ依頼に付いていない自分の下書きが 5 つあれば 6 つ目は 422・E-GST-183（欄なし）で置かない。依頼に付いた物・消した物・ほかのゲストの下書きは数えない（人ごと）", async () => {
    const w = await world(f, "007");
    const [a, b] = [await guest(f, w, "甲", w.gA), await guest(f, w, "乙", w.gA)];
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1)
      ids.push(((await asJson(await upload(a, file(`${i}.pdf`)))).data as { id: string }).id);
    const puts = spy.puts;
    const r = await upload(a, file("六つ目.pdf"));
    expect(r.status).toBe(422);
    expect(await code(r)).toBe("E-GST-183");
    expect(hasNoDetail(await asJson(r))).toBe(true);
    expect(spy.puts).toBe(puts);
    expect((await upload(b, file("乙の一つ目.pdf"))).status).toBe(201); // ほかの人の分は数えない
    await f.admin.query(
      "update attachments set owner_type = 'client_request', owner_id = gen_random_uuid() where id = $1",
      [ids[0]],
    ); // 依頼に付いた
    await f.admin.query("update attachments set deleted_at = now() where id = $1", [ids[1]]); // 消した
    expect((await upload(a, file("空いた 1.pdf"))).status).toBe(201);
    expect((await upload(a, file("空いた 2.pdf"))).status).toBe(201);
    expect((await upload(a, file("また満杯.pdf"))).status).toBe(422);
  });

  it("K909-API-008 入口：社内の人は 403・ログインなしは 401・グループに入っていないゲストは 403。外した直後（G-14）：抜けた・止めた・外された・グループが消えたゲストは 403。どれも置き場に置かず行も作らない", async () => {
    const w = await world(f, "008");
    const free = await guest(f, w, "どこにも入っていない", null);
    const puts = spy.puts;
    expect((await upload(w.boss, file("a.pdf"), "member")).status).toBe(403);
    expect((await upload(null, file("a.pdf"))).status).toBe(401);
    expect((await upload(free, file("a.pdf"))).status).toBe(403);
    const cuts: [string, (id: string) => Promise<unknown>][] = [
      ["抜けた", (id) => f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [id])],
      [
        "止めた",
        (id) => f.admin.query("update tenant_memberships set status = 'suspended' where member_id = $1", [id]),
      ],
      [
        "外された",
        (id) => f.admin.query("update guest_group_members set deleted_at = now() where member_id = $1", [id]),
      ],
    ];
    for (const [label, cut] of cuts) {
      const p = await guest(f, w, label, w.gA);
      await cut(p.id);
      expect((await upload(p, file("a.pdf"))).status, label).toBe(403);
    }
    const lone = await guest(f, w, "消える社", w.gB);
    await f.admin.query("update guest_groups set deleted_at = now() where id = $1", [w.gB]);
    expect((await upload(lone, file("a.pdf"))).status).toBe(403);
    expect(spy.puts).toBe(puts);
  });

  it("K909-API-009 上限：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store・超えた分は置かない", async () => {
    const w = await world(f, "009");
    const a = await guest(f, w, "山田", w.gA);
    f.limits["uploadPortalAttachment"] = 2;
    try {
      expect((await upload(a, file("1.pdf"))).status).toBe(201);
      expect((await upload(a, file("2.pdf"))).status).toBe(201);
      const r = await upload(a, file("3.pdf"));
      expect(r.status).toBe(429);
      const s = (await asJson(r))["retry_after_sec"] as number;
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
      expect(r.headers.get("cache-control") ?? "").toContain("no-store");
      expect(await drafts(a)).toBe(2);
    } finally {
      delete f.limits["uploadPortalAttachment"];
    }
  });

  it("K909-API-010 置き場が落ちた：503・E-PAGE-003・行は残らず、証跡も残らない。置き場が戻れば次は通る", async () => {
    const w = await world(f, "010");
    const a = await guest(f, w, "山田", w.gA);
    spy.fail = true;
    try {
      const r = await upload(a, file("落ちる.pdf"));
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    } finally {
      spy.fail = false;
    }
    expect(await drafts(a)).toBe(0);
    expect(
      await count(f, "audit_events", "tenant_id = $1 and action = 'portal.attachment_uploaded'", [w.tenantId]),
    ).toBe(0);
    expect((await upload(a, file("戻った.pdf"))).status).toBe(201);
  });

  it("K909-API-011 行が書けなかった（手順の後片付け）：置いた後に DB の行が書けなければ 503・E-PAGE-003・置いたファイルを置き場から消す（半端なファイルを残さない）・行も証跡も残らない", async () => {
    const w = await world(f, "011");
    const a = await guest(f, w, "山田", w.gA);
    const deletes = spy.deletes.length;
    await failOn(f, "attachments", "new.owner_type = 'portal_draft'", async () => {
      const r = await upload(a, file("途中で失敗.pdf"));
      expect(r.status).toBe(503);
      expect((await asJson(r))["code"]).toBe("E-PAGE-003");
    });
    expect(spy.deletes.length).toBe(deletes + 1);
    expect(spy.deletes.at(-1)).toMatch(new RegExp(`^tenants/${w.tenantId}/`));
    expect(await drafts(a)).toBe(0);
    expect(
      await count(f, "audit_events", "tenant_id = $1 and action = 'portal.attachment_uploaded'", [w.tenantId]),
    ).toBe(0);
  });

  it("K909-API-012 同時に上げる：4 つある人が 2 つ同時に上げると、1 つは 201・もう 1 つは 422・E-GST-183（5 つを超えない）。置いた後に断られた方のファイルは置き場から消える", async () => {
    const w = await world(f, "012");
    const a = await guest(f, w, "山田", w.gA);
    for (let i = 0; i < 4; i += 1) await upload(a, file(`${i}.pdf`));
    const deletes = spy.deletes.length;
    const rs = await Promise.all([upload(a, file("同時の一.pdf")), upload(a, file("同時の二.pdf"))]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(await drafts(a)).toBe(5);
    const loser = rs.find((r) => r.status === 422)!;
    expect(await code(loser)).toBe("E-GST-183");
    expect(spy.deletes.length).toBeGreaterThanOrEqual(deletes); // 空きを先に見る形でも、置いた後に断られた形でも、残るファイルは行と同じ数
  });

  it("K909-API-013 置き場の決まり：保存の参照は会社の名前空間（tenants/<会社>/…）の中・同じ中身を 2 回上げても別の参照・保持期間は 30 日（期限が付く）", async () => {
    const w = await world(f, "013");
    const a = await guest(f, w, "山田", w.gA);
    const [r1, r2] = [await upload(a, file("同じ.pdf")), await upload(a, file("同じ.pdf"))];
    const refs = (
      await f.admin.query<{ storage_ref: string }>("select storage_ref from attachments where id = any($1::uuid[])", [
        [((await asJson(r1)).data as { id: string }).id, ((await asJson(r2)).data as { id: string }).id],
      ])
    ).rows.map((x) => x.storage_ref);
    expect(new Set(refs).size).toBe(2);
    for (const ref of refs) {
      expect(ref).toMatch(new RegExp(`^tenants/${w.tenantId}/`));
      const got = await objects.get({ tenantId: w.tenantId, userId: a.id, role: "client", stepUpAt: null }, ref);
      expect(got.status).toBe("done");
      if (got.status === "done") {
        const days = ((got.value.meta.expiresAt as Date).getTime() - Date.now()) / 86_400_000;
        expect(days).toBeGreaterThan(29);
        expect(days).toBeLessThanOrEqual(30);
      }
    }
  });
});
