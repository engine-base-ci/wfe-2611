// K-950 問い合わせの添付を上げる（uploadInquiryAttachment・POST /api/v1/inquiries/attachments）と、上げ終わりの受け口
//   （POST /api/uploads/inquiry/:token/done・apps/api/src/features/F12/inquiries/upload-route.ts・契約の口の外）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   体（1 つ 10MB・D-156.26）は口（Vercel の関数・体は 4.5MB まで）を通さない：ブラウザは関門 C4 が署名した上げ先（upload_url）へ直に PUT し、
//   上げ終わったら done_url を呼ぶ。口は置き場の物の頭と大きさを名乗りと照らしてから受ける（D-156.11）。
//   上げ終わりで照らした中身は、関門 C4 の put で新しい参照に置き直し（storage_ref はその新しい参照）、上げ先の物は消す。
//   上げ先の URL は期限まで使えるので、照らした後に置き直されても受けた物が変わらないようにする（PM の決め・案 A・D-156.11）。
//   この土台の置き場はローカル（外の署名なし）なので、上げ先は口の住所のローカルの受け口（/api/uploads/local・S3 と同じく署名の大きさと種類だけを受ける）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { refOf, s3Client, s3Presigner } from "@kaname/storage";
import { FAKE_S3 } from "../../fake-s3.js";
import { startInquiries, isFlat, API_BASE, type Inquiries, type World } from "./inquiry.harness.js";

let t: Inquiries;
let w: World;

beforeAll(async () => {
  t = await startInquiries("k950", ["inquiry-upload", "inquiry-create"]);
  w = await t.world("山口商事");
});
afterAll(async () => {
  await t.close();
});

const MB = 1024 * 1024;
const UPLOADS = `${API_BASE}/api/uploads`;
const HEAD: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
  "image/gif": [...Buffer.from("GIF89a")],
  "image/webp": [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")],
  "application/pdf": [...Buffer.from("%PDF-1.7")],
  "application/zip": [0x50, 0x4b, 0x03, 0x04],
};
/** 名乗った種類の頭で始まる size バイトの中身 */
const file = (type: string, size: number): Buffer => {
  const b = Buffer.alloc(size, 0x20);
  Buffer.from(HEAD[type]!).copy(b);
  return b;
};
const start = (o: Record<string, unknown> = {}, who = w.asker) =>
  t.call(who, "POST", "/inquiries/attachments", {
    name: "画面の写し.png",
    content_type: "image/png",
    size: 2 * MB,
    ...o,
  });
type Begun = { id: string; upload_url: string; done_url: string; expires_at: string };
const tokenOf = (doneUrl: string): string => /\/inquiry\/([A-Za-z0-9_-]{43})\/done$/.exec(doneUrl)?.[1] ?? "";
/** 上げ先へ PUT（この土台ではローカルの受け口）。本番は置き場（S3）へ直に送り、口を通らない */
const put = async (url: string, body: Buffer, type = "image/png") =>
  (await t.upload()).request(url.slice(UPLOADS.length), { method: "PUT", headers: { "content-type": type }, body });
/** 上げ終わりの受け口 */
const done = async (doneUrl: string) => (await t.upload()).request(doneUrl.slice(UPLOADS.length), { method: "POST" });
const begin = async (o: Record<string, unknown> = {}): Promise<Begun> => {
  const r = await start(o);
  expect(r.status).toBe(201);
  return (await t.json(r)).data as Begun;
};
/** 上げて、上げ終わりを呼ぶ */
const send = async (a: Begun, body: Buffer, type = "image/png") => {
  expect((await put(a.upload_url, body, type)).status, type).toBe(200);
  return done(a.done_url);
};
const ctx = () => ({ tenantId: w.tenantId, userId: w.asker.id, role: "member" as const, stepUpAt: null });
/** 置き場に直に置く（署名の大きさをすり抜けた物・置き場の外から置かれた物を作る） */
const place = (id: string, body: Buffer, type = "image/png") =>
  t.objects.put(ctx(), refOf(w.tenantId, id), body, { contentType: type });
const stored = async (id: string) => (await t.objects.get(ctx(), refOf(w.tenantId, id))).status === "done";
const att = (id: string) =>
  t.row<Record<string, unknown>>(
    "select owner_type, owner_id, uploaded_by, name, mime, size, scanned_at, storage_ref, upload_ref, upload_token_hash, upload_expires_at from attachments where id = $1",
    [id],
  );
/** 置き場の参照の中身（無ければ null） */
const read = async (ref: string) => {
  const g = await t.objects.get(ctx(), ref);
  return g.status === "done" ? Buffer.from(g.value.body) : null;
};
/** 受けた物の参照（上げ先とは別の、関門 C4 の put が作った参照） */
const refAt = async (id: string) => String((await att(id))!["storage_ref"]);
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/**
 * 関門 C4 の置き場の 1 つの働きを、試験の間だけ落とす（置き場が落ちた形）。戻す関数を返す。
 * "put-failed" は本物の put と同じ形（ドライバが落ちても投げずに { status: "failed" } を返す・packages/storage/src/index.ts の put）
 */
const breakStore = (m: "get" | "put" | "put-failed" | "delete") => {
  const o = t.objects as unknown as Record<string, unknown>;
  const name = m === "put-failed" ? "put" : m;
  o[name] =
    m === "put-failed"
      ? async () => ({
          status: "failed",
          reason: "保存先に書けませんでした",
          handoff: "少し待ってやり直す。続くなら運営に問い合わせる",
        })
      : async () => {
          throw new Error("置き場が落ちた（試験）");
        };
  return () => {
    delete o[name];
  };
};
/** DB の今の時刻（記録の occurred_at と同じ時計） */
const dbNow = async () => (await t.f.admin.query("select clock_timestamp() as t")).rows[0].t as Date;
/** since の後に関門 C4 の put で置いて、まだ消していない物（上げ先と keep を除く）＝後片付けの漏れ */
const leftovers = async (since: Date, keep: string[]) =>
  (
    await t.f.admin.query(
      `select p.target_id from audit_events p
        where p.tenant_id = $1 and p.action = 'object.put' and p.occurred_at >= $2 and not (p.target_id = any($3::text[]))
          and not exists (select 1 from audit_events d where d.action = 'object.delete' and d.target_id = p.target_id)`,
      [w.tenantId, since, keep],
    )
  ).rows;
const codeOf = async (r: Response) => ((await r.json()) as Record<string, unknown>)["code"];

describe("K-950 上げる先を求める", () => {
  it("K950-API-001 201 で 4 欄。上げ先は関門 C4 が署名した置き場の URL（この土台はローカルの受け口）・上げ終わりは口の /api/uploads/inquiry/<43 字>/done。行は本人・問い合わせ用・検査前・置く参照は会社の名前空間・印は hash だけ・期限は 10 分", async () => {
    const r = await start();
    expect(r.status).toBe(201);
    const d = (await t.json(r)).data as Record<string, string>;
    expect(Object.keys(d).sort()).toEqual(["done_url", "expires_at", "id", "upload_url"]);
    expect(d["upload_url"]!.startsWith(`${UPLOADS}/local`)).toBe(true);
    expect(d["done_url"]).toMatch(new RegExp(`^${UPLOADS.replace(/\./g, "\\.")}/inquiry/[A-Za-z0-9_-]{43}/done$`));
    const token = tokenOf(d["done_url"]!);
    expect(d["upload_url"]).not.toContain(token);
    const a = await att(d["id"]!);
    expect(a).toMatchObject({
      owner_type: "inquiry",
      owner_id: null,
      uploaded_by: w.asker.id,
      name: "画面の写し.png",
      mime: "image/png",
      scanned_at: null,
      storage_ref: null,
      upload_ref: refOf(w.tenantId, d["id"]!),
      upload_token_hash: createHash("sha256").update(token).digest("hex"),
    });
    expect(Number(a!["size"])).toBe(2 * MB);
    const left = new Date(String(a!["upload_expires_at"])).getTime() - Date.now();
    expect(left).toBeGreaterThan(9 * 60e3);
    expect(left).toBeLessThanOrEqual(10 * 60e3 + 5e3);
    expect(new Date(d["expires_at"]!).getTime()).toBe(new Date(String(a!["upload_expires_at"])).getTime());
  });

  it("K950-API-002 種類は 6 つ・大きさは 1〜10485760。ほかの種類・0・10MB を 1 バイト超える大きさは 422 で行を作らない", async () => {
    for (const type of Object.keys(HEAD)) expect((await start({ content_type: type })).status, type).toBe(201);
    const before = await t.n("select count(*) as n from attachments where uploaded_by = $1", [w.asker.id]);
    expect((await start({ content_type: "text/html" })).status).toBe(422);
    expect((await start({ size: 0 })).status).toBe(422);
    expect((await start({ size: 10 * MB + 1 })).status).toBe(422);
    expect((await start({ size: 10 * MB })).status).toBe(201);
    expect(await t.n("select count(*) as n from attachments where uploaded_by = $1", [w.asker.id])).toBe(before + 1);
  });

  it("K950-API-003 名前は前後の空白と道の区切り（/ と \\）の前を落として残す。落として空なら「ファイル」", async () => {
    const a = await begin({ name: "  ../../secret/画面.png " });
    expect((await att(a.id))!["name"]).toBe("画面.png");
    const b = await begin({ name: "C:\\Users\\tanaka\\ログ.zip", content_type: "application/zip" });
    expect((await att(b.id))!["name"]).toBe("ログ.zip");
    const c = await begin({ name: "dir/" });
    expect((await att(c.id))!["name"]).toBe("ファイル");
  });

  it("K950-API-004 先方の権限の人は 403・ログインしていないと 401 で、どちらも行を作らない", async () => {
    const before = await t.n("select count(*) as n from attachments where tenant_id = $1", [w.tenantId]);
    expect((await start({}, w.guest)).status).toBe(403);
    expect(
      (await t.call(null, "POST", "/inquiries/attachments", { name: "a.png", content_type: "image/png", size: 10 }))
        .status,
    ).toBe(401);
    expect(await t.n("select count(*) as n from attachments where tenant_id = $1", [w.tenantId])).toBe(before);
  });

  it("K950-API-005 DB が落ちると 503 E-PAGE-003 で行を作らない", async () => {
    const restore = await t.breakWrites("attachments", { tenant_id: w.tenantId });
    const before = await t.n("select count(*) as n from attachments where tenant_id = $1", [w.tenantId]);
    try {
      const r = await start();
      expect(r.status).toBe(503);
      expect((await t.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await t.n("select count(*) as n from attachments where tenant_id = $1", [w.tenantId])).toBe(before);
  });
});

describe("K-950 上げ先と上げ終わり", () => {
  it("K950-UP-001 2MB の画像を上げ先へ送り、上げ終わりを呼ぶと 200 で id と大きさ。照らした中身は新しい参照（会社の名前空間・上げ先と別）に置き直して storage_ref に入り、上げ先の物は消え、印も消える", async () => {
    const a = await begin();
    const body = file("image/png", 2 * MB);
    const r = await send(a, body);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: unknown }).data).toEqual({ id: a.id, size: 2 * MB });
    const row = await att(a.id);
    expect(row!["scanned_at"]).not.toBeNull();
    expect(row!["upload_token_hash"]).toBeNull();
    const ref = await refAt(a.id);
    expect(ref).toMatch(new RegExp(`^tenants/${w.tenantId}/${UUID}$`));
    expect(ref).not.toBe(refOf(w.tenantId, a.id));
    const g = await t.objects.get(ctx(), ref);
    expect(g.status).toBe("done");
    expect(g.status === "done" && Buffer.from(g.value.body).equals(body)).toBe(true);
    expect(g.status === "done" && g.value.meta.contentType).toBe("image/png");
    expect(await stored(a.id)).toBe(false);
    expect(
      await t.n("select count(*) as n from audit_events where action = 'object.delete' and target_id::text = $1", [
        refOf(w.tenantId, a.id),
      ]),
    ).toBe(1);
  });

  it("K950-UP-002 6 つの種類は、それぞれの頭で始まる中身なら通る", async () => {
    for (const type of Object.keys(HEAD)) {
      const a = await begin({ content_type: type, size: 64 });
      expect((await send(a, file(type, 64), type)).status, type).toBe(200);
    }
  });

  it("K950-UP-003 置いた中身の頭が名乗った種類と違う（png と名乗って PDF・ただの文字）と上げ終わりは 415 E-INQ-003・置き場の物を消し、行は検査前のまま", async () => {
    for (const body of [file("application/pdf", 64), Buffer.alloc(64, 0x41)]) {
      const a = await begin({ size: 64 });
      const r = await send(a, body);
      expect(r.status).toBe(415);
      expect(await codeOf(r)).toBe("E-INQ-003");
      const row = await att(a.id);
      expect(row!["scanned_at"]).toBeNull();
      expect(row!["storage_ref"]).toBeNull();
      expect(await stored(a.id)).toBe(false);
    }
  });

  it("K950-UP-004 大きさ：上げ先は署名した大きさと違う体を 403 で断る。置き場の物が名乗りと違えば上げ終わりは 400 E-INQ-004・10MB を超えれば 413 E-INQ-004・置いていなければ 400 E-INQ-004。どれも消して受けない", async () => {
    const a = await begin({ size: 100 });
    expect((await put(a.upload_url, file("image/png", 99))).status).toBe(403);
    await place(a.id, file("image/png", 99));
    const r = await done(a.done_url);
    expect([r.status, await codeOf(r)]).toEqual([400, "E-INQ-004"]);
    const b = await begin({ size: 10 * MB });
    await place(b.id, file("image/png", 10 * MB + 1));
    const r2 = await done(b.done_url);
    expect([r2.status, await codeOf(r2)]).toEqual([413, "E-INQ-004"]);
    const c = await begin({ size: 64 });
    const r3 = await done(c.done_url);
    expect([r3.status, await codeOf(r3)]).toEqual([400, "E-INQ-004"]);
    for (const id of [a.id, b.id, c.id]) {
      expect((await att(id))!["storage_ref"]).toBeNull();
      expect(await stored(id)).toBe(false);
    }
  });

  it("K950-UP-005 印が違う・期限が切れた・消した添付の上げ終わりは 404（欄・details なし）で受けない", async () => {
    const bad = await done(`${UPLOADS}/inquiry/${"A".repeat(43)}/done`);
    expect(bad.status).toBe(404);
    expect(isFlat((await bad.json()) as Record<string, unknown>)).toBe(true);
    const late = await begin({ size: 64 });
    expect((await put(late.upload_url, file("image/png", 64))).status).toBe(200);
    await t.f.admin.query("update attachments set upload_expires_at = now() - interval '1 second' where id = $1", [
      late.id,
    ]);
    expect((await done(late.done_url)).status).toBe(404);
    const gone = await begin({ size: 64 });
    expect((await put(gone.upload_url, file("image/png", 64))).status).toBe(200);
    await t.f.admin.query("update attachments set deleted_at = now() where id = $1", [gone.id]);
    expect((await done(gone.done_url)).status).toBe(404);
    for (const id of [late.id, gone.id]) expect((await att(id))!["scanned_at"]).toBeNull();
  });

  it("K950-UP-006 上げ終わりの後に、期限内の同じ上げ先へ同じ大きさの別の中身を置き直しても、受けた物は変わらない。同じ印の 2 回目は 404 で、1 回目の参照と中身は変わらない（印は 1 回だけ）", async () => {
    const a = await begin({ size: 64 });
    const first = file("image/png", 64);
    expect((await send(a, first)).status).toBe(200);
    const ref = await refAt(a.id);
    const other = file("image/png", 64);
    other.fill(0x41, 16);
    expect([200, 403]).toContain((await put(a.upload_url, other)).status);
    expect((await done(a.done_url)).status).toBe(404);
    expect(await refAt(a.id)).toBe(ref);
    expect((await read(ref))!.equals(first)).toBe(true);
  });

  it("K950-UP-007 同じ印で同時に 2 回上げ終わりを呼んでも、受けるのは 1 回だけ（片方 200・片方 404・受けた記録は 1 行・受けた物は読め、負けた側が置き直した物と上げ先の物は残らない）", async () => {
    const a = await begin({ size: 64 });
    const body = file("image/png", 64);
    expect((await put(a.upload_url, body)).status).toBe(200);
    const since = await dbNow();
    const rs = await Promise.all([done(a.done_url), done(a.done_url)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(
      await t.n("select count(*) as n from audit_events where action = 'inquiry_attachment.put' and target_id = $1", [
        a.id,
      ]),
    ).toBe(1);
    const ref = await refAt(a.id);
    expect((await read(ref))!.equals(body)).toBe(true);
    expect(await leftovers(since, [ref])).toEqual([]);
    expect(await stored(a.id)).toBe(false);
  });

  it("K950-UP-008 照らして置き直した後に DB の書き込みが落ちると 503 E-PAGE-003・行は検査前のまま・置き直した物だけ消し上げ先の物と印は残す。DB が戻れば同じ上げ終わりで 200（案 A・UP-012 とそろえる）", async () => {
    const a = await begin({ size: 64 });
    const body = file("image/png", 64);
    expect((await put(a.upload_url, body)).status).toBe(200);
    const ref = refOf(w.tenantId, a.id);
    const since = await dbNow();
    const restore = await t.breakWrites("attachments", { id: a.id });
    let r: Response;
    try {
      r = await done(a.done_url);
    } finally {
      await restore();
    }
    expect([r.status, await codeOf(r)]).toEqual([503, "E-PAGE-003"]);
    const row = await att(a.id);
    expect(row!["storage_ref"]).toBeNull();
    expect(row!["scanned_at"]).toBeNull();
    expect(row!["upload_token_hash"]).not.toBeNull();
    expect(
      await t.n("select count(*) as n from audit_events where action = 'object.delete' and target_id::text = $1", [
        ref,
      ]),
    ).toBe(0);
    expect(await stored(a.id)).toBe(true);
    expect(await leftovers(since, [])).toEqual([]);
    const again = await done(a.done_url);
    expect(again.status).toBe(200);
    expect((await read(await refAt(a.id)))!.equals(body)).toBe(true);
  });

  it("K950-UP-012 置き場が落ちている（読むのが投げる・置き直すのが failed を返す・置き直すのが投げる）と上げ終わりは 503 E-PAGE-003。行は検査前のまま・印は残り、置き場が戻ればやり直せる", async () => {
    for (const m of ["get", "put-failed", "put"] as const) {
      const a = await begin({ size: 64 });
      const body = file("image/png", 64);
      expect((await put(a.upload_url, body)).status).toBe(200);
      const since = await dbNow();
      const restore = breakStore(m);
      let r: Response;
      try {
        r = await done(a.done_url);
      } finally {
        restore();
      }
      expect([r.status, await codeOf(r)], m).toEqual([503, "E-PAGE-003"]);
      const row = await att(a.id);
      expect(row!["scanned_at"], m).toBeNull();
      expect(row!["storage_ref"], m).toBeNull();
      expect(row!["upload_token_hash"], m).not.toBeNull();
      expect(await stored(a.id), m).toBe(true);
      expect(await leftovers(since, []), m).toEqual([]);
      expect((await done(a.done_url)).status, m).toBe(200);
      expect((await read(await refAt(a.id)))!.equals(body), m).toBe(true);
    }
  });

  it("K950-UP-013 受けた後に上げ先の物を消すのが落ちても 200 で、受けた物は新しい参照から読める（上げ先の物は残る・申し送り）", async () => {
    const a = await begin({ size: 64 });
    const body = file("image/png", 64);
    expect((await put(a.upload_url, body)).status).toBe(200);
    const restore = breakStore("delete");
    let r: Response;
    try {
      r = await done(a.done_url);
    } finally {
      restore();
    }
    expect(r.status).toBe(200);
    const row = await att(a.id);
    expect(row!["scanned_at"]).not.toBeNull();
    expect((await read(await refAt(a.id)))!.equals(body)).toBe(true);
  });

  it("K950-UP-009 記録：上げ先を出したときに関門 C4 の object.presign_put（参照・大きさ）、受けたときに inquiry_attachment.put（C4・添付の id・大きさと種類）が 1 行ずつ。名前は入れない", async () => {
    const a = await begin({ name: "秘密の名前 P3.png", size: 64 });
    expect((await send(a, file("image/png", 64))).status).toBe(200);
    const ref = refOf(w.tenantId, a.id);
    const e = await t.row<{ c: string; p: Record<string, unknown> }>(
      "select choke_point_id as c, payload as p from audit_events where action = 'object.presign_put' and target_id::text = $1",
      [ref],
    );
    expect(e!.c).toBe("C4");
    expect(Number(e!.p["size"])).toBe(64);
    const mine = await t.row<{ c: string; p: Record<string, unknown> }>(
      "select choke_point_id as c, payload as p from audit_events where action = 'inquiry_attachment.put' and target_id = $1",
      [a.id],
    );
    expect(mine!.c).toBe("C4");
    expect(mine!.p).toMatchObject({ size: 64, mime: "image/png" });
    expect(JSON.stringify(e!.p) + JSON.stringify(mine!.p)).not.toContain("P3");
  });

  it("K950-UP-010 上げ終わった添付は問い合わせに付けられ（K-949 の口）、上げ終わる前の添付は付けられない（409 E-INQ-001）", async () => {
    const before = await begin({ size: 64 });
    const ask = () =>
      t.call(w.asker, "POST", "/inquiries", {
        topic: "trouble",
        title: "写しを付けた",
        body: "見てください",
        attachment_ids: [before.id],
      });
    expect((await put(before.upload_url, file("image/png", 64))).status).toBe(200);
    expect((await ask()).status).toBe(409);
    expect((await done(before.done_url)).status).toBe(200);
    expect((await ask()).status).toBe(201);
  });

  it("K950-UP-011 本番の上げ先（S3 の署名）：URL は置き場の住所で口の住所でない・署名に content-length と content-type が入り・期限は 600 秒（Vercel の関数の体の上限 4.5MB を通らない）", async () => {
    const client = s3Client({
      endpoint: "https://storage.example.test",
      region: FAKE_S3.region,
      bucket: "kaname-test",
      accessKeyId: FAKE_S3.accessKeyId,
      secretAccessKey: FAKE_S3.secretAccessKey,
    });
    const signer = s3Presigner(client, "https://storage.example.test", "kaname-test");
    const url = await signer.presignPut!(refOf(w.tenantId, "00000000-0000-4000-8000-000000000000"), {
      contentType: "image/png",
      size: 10 * MB,
      ttlSec: 600,
    });
    const u = new URL(url);
    expect(u.origin).toBe("https://storage.example.test");
    expect(url.startsWith(API_BASE)).toBe(false);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    const signed = (u.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");
    expect(signed).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
  });
});
