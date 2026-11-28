// K-145：依存を持てない層の正本 UUID_RE（packages/db/src/id.ts）の決まりを、契約の isUuid（z.uuid()）と同じにする（D-129.42）。
//   nil と max を通す・版と variant の桁を見る・大文字を通す・前後の空白は通さない。context.ts（assertContext）と listen.ts がこれを使う。
//   DB に触らない。行 ID は 11_tickets/K-145.md の表。テストはチケットのセッションが書き、実装より先にコミットする（D-128.125）
import { describe, expect, it } from "vitest";
import { UUID_RE } from "../src/id.js";
import { assertContext } from "../src/context.js";

const BAD_IDS = [
  "------------------------------------",
  "3fa85f64-5717-0562-b3fc-2c963f66afa6",
  "3fa85f64-5717-4562-b3fc-2c963f66afag",
  "3fa85f64-5717-4562-c3fc-2c963f66afa6",
  "3fa85f64-5717-9562-b3fc-2c963f66afa6",
  "",
  "not-a-uuid",
  "3fa85f64-5717-4562-b3fc-2c963f66afa60",
];
const GOOD_IDS = [
  "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "0193c5a0-5f3e-7c0a-9d4e-0b1a2c3d4e5f",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "3FA85F64-5717-4562-B3FC-2C963F66AFA6",
];

describe("K-145 DB の層の uuid の決まり", () => {
  it("K145-DB-001 UUID_RE は違う 8 つを通さず、正しい 5 つ（v4・v7・nil・max・大文字）を通す。前後の空白は通さない。assertContext は版の桁 0 の tenantId・userId を投げ、正しいものは通す", () => {
    expect(BAD_IDS.map((v) => UUID_RE.test(v))).toEqual(BAD_IDS.map(() => false));
    expect(GOOD_IDS.map((v) => UUID_RE.test(v))).toEqual(GOOD_IDS.map(() => true));
    expect(UUID_RE.test(` ${GOOD_IDS[0]} `)).toBe(false);
    expect(() => assertContext({ tenantId: BAD_IDS[1]!, userId: GOOD_IDS[0]!, role: "member" })).toThrow(/tenantId/);
    expect(() => assertContext({ tenantId: GOOD_IDS[0]!, userId: BAD_IDS[0]!, role: "member" })).toThrow(/userId/);
    expect(() => assertContext({ tenantId: GOOD_IDS[1]!, userId: GOOD_IDS[2]!, role: "member" })).not.toThrow();
    expect(() => assertContext({ tenantId: null, userId: null, role: "anonymous" })).not.toThrow();
  });
});
