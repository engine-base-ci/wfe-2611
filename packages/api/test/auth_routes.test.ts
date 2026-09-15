import { describe, expect, it } from "vitest";
import pg from "pg";
import { createAuth } from "@kaname/auth";
import { createApp } from "../src/app.js";

const URL = process.env["DATABASE_URL"] ?? "postgres://postgres:postgres@127.0.0.1:55433/kaname_test";
const AUTH_URL = URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");

describe("/api/auth/*（Better Auth の handler に渡す）", () => {
  it("GET /api/auth/ok が 200", async () => {
    const appPool = new pg.Pool({ connectionString: URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"), max: 1 });
    const { auth, pool } = createAuth({
      authDatabaseUrl: AUTH_URL,
      appPool,
      secret: "test-secret-0123456789-abcdefghijklmnop",
      baseURL: "http://localhost:3000",
    });
    try {
      const res = await createApp({ auth }).request("http://localhost:3000/api/auth/ok");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      const nope = await createApp({}).request("http://localhost:3000/api/auth/ok");
      expect(nope.status).toBe(404);
    } finally {
      await pool.end();
      await appPool.end();
    }
  });
});
