// 会話の契約の口（/api/v1/conversations）が、画面の口と同じ本体（DB の関数）を通ることの試験（K-712：記憶を直す口は外した）。
// 本番（server.ts）と同じ agentHooks を差し込み、表に直接書く汎用の道を通らないことを、作った行の中身で確かめる
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createPool } from "@kaname/db/pool";
import { agentHooks } from "../src/hooks/agent.js";
import { endpointOf, makeHarness, type Harness } from "./harness.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
let h: Harness;
let admin: pg.Pool;
let appPool: pg.Pool;

beforeAll(async () => {
  h = await makeHarness();
  admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
  appPool = createPool({ databaseUrl: APP_URL, max: 2 });
  Object.assign(h.hooks, agentHooks(appPool));
});
afterAll(async () => {
  await appPool?.end();
  await admin?.end();
  await h?.close();
});
const row = async (table: string, id: string) =>
  (await admin.query(`select * from ${table} where id = $1`, [id])).rows[0];

describe("会話の契約の口は画面の口と同じ本体を通る", () => {
  it("作る → 名前を変える → ほかの人は変えられない → 消す。ログインなしは 401", async () => {
    const created = await h.call(endpointOf("createConversation"), "boss", { body: { incognito: true } });
    expect(created.status, await created.clone().text()).toBe(201);
    const id = ((await created.json()) as { data: { id: string } }).data.id;
    const r0 = await row("conversations", id);
    expect(r0["owner_member_id"]).toBe(h.S.bossA); // 本人の会話として DB の関数が作った
    expect(r0["incognito"]).toBe(true);

    const renamed = await h.call(endpointOf("updateConversation"), "boss", { id, body: { title: "見積の相談" } });
    expect(renamed.status, await renamed.clone().text()).toBe(200);
    expect((await row("conversations", id))["title"]).toBe("見積の相談");

    const other = await h.call(endpointOf("updateConversation"), "staff", { id, body: { title: "書き換え" } });
    expect([403, 404]).toContain(other.status);
    expect((await row("conversations", id))["title"]).toBe("見積の相談");

    const anon = await h.call(endpointOf("deleteConversation"), "anon", { id });
    expect(anon.status).toBe(401);
    const del = await h.call(endpointOf("deleteConversation"), "boss", { id });
    expect(del.status, await del.clone().text()).toBe(200);
    expect((await row("conversations", id))["deleted_at"]).not.toBeNull();
  });

  it("名前を空にすると 422。行は変わらない", async () => {
    const created = await h.call(endpointOf("createConversation"), "boss", { body: {} });
    const id = ((await created.json()) as { data: { id: string } }).data.id;
    const r = await h.call(endpointOf("updateConversation"), "boss", { id, body: { title: "   " } });
    expect(r.status).toBe(422);
    expect((await row("conversations", id))["title"]).toBeNull();
  });
});
