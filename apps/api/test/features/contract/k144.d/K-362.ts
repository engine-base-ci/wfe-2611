// 葉 K-362「PC を外す口（revokeMyDevice）」が、共有の試験 ../k144-contract.test.ts に足す分（置き方は README.md・K-378）。
//   行は、本体に印つきで書いていた物をそのまま移した（中身は変えていない。字下げと、整形の道具の行の折り返しだけ）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../../src/app.js";
import { nextIp } from "../../fixture.js";
import type { K144Leaf } from "./_base.js";

export const leaf: K144Leaf = {
  UUID_PARAM_CASES: [
    ["K144-API-064", "revokeMyDevice", "path", "id"], // K-362（取り直しの無いセッションでも、形の違う id は取り直しの 403 より先に 422）
  ],
  tests: ({ def, count, writer }) => {
    // K-362 ここから
    describe("K-144 ㉖ 付けるまで進めない（K-321）：段 4 で作った口も、印（mfaPending）の立ったセッションは入口で 403・MFA_REQUIRED で止まり、振る舞いに届かない", () => {
      it("K144-API-072 revokeMyDevice（PC を外す・DELETE /bridge/devices/:id）：印の立ったセッション（取り直し済み）は 403・MFA_REQUIRED。外す振る舞い（hooks）に届かず、外れた PC の行は増えない。契約で mfaOpen でなく、並びに 403 がある", async () => {
        const d = def("revokeMyDevice");
        expect(d.mfaOpen).toBe(false);
        expect(d.errors).toContain(403);
        let reached = 0;
        const app = createApp({
          version: "test",
          repo: {} as never, // 入口で止まるので、表には届かない
          resolve: (async () => ({
            ctx: { tenantId: writer.tenantId, userId: writer.id, role: "member", stepUpAt: new Date() },
            sessionId: "",
            authUserId: "",
            termsPending: false,
            mfaPending: true,
          })) as never,
          contract: {
            hooks: {
              revokeMyDevice: {
                before: async () => {
                  reached++;
                  return { status: 418, body: {} };
                },
              },
            },
          },
        });
        const revoked = () =>
          count("select count(*) as n from sessions where kind_id = 'bridge' and revoked_at is not null");
        const before = await revoked();
        const r = await app.request(`http://localhost/api/v1/bridge/devices/${randomUUID()}`, {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer k144-mfa",
            "x-forwarded-for": nextIp(),
          },
        });
        expect(r.status).toBe(403);
        expect(((await r.json()) as { code?: string }).code).toBe("MFA_REQUIRED");
        expect(reached, "振る舞い（hooks）に届いた").toBe(0);
        expect(await revoked()).toBe(before);
      });
    });
    // K-362 ここまで
  },
};
