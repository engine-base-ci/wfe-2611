// K-145：置き場の参照（tenants/<会社>/<物>）の形の確かめを、正式な uuid（@kaname/db/id の UUID_RE・契約の isUuid と同じ決まり）にそろえる（D-129.42）。
//   DB に触らない。行 ID は 11_tickets/K-145.md の表。テストはチケットのセッションが書き、実装より先にコミットする（D-128.125）
import { describe, expect, it } from "vitest";
import { parseRef, refOf } from "../src/index.js";

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
const TENANT = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const OBJECT = "0193c5a0-5f3e-7c0a-9d4e-0b1a2c3d4e5f";

describe("K-145 置き場の参照の形", () => {
  it("K145-STO-001 parseRef：会社か物が正式な uuid でない 8 種は null（denied）。正しい uuid は { tenantId, id } で refOf と往復する。`..`・余分な区切り・前後の空白は null", () => {
    for (const bad of BAD_IDS) {
      expect(parseRef(`tenants/${bad}/${OBJECT}`), `会社=${JSON.stringify(bad)}`).toBeNull();
      expect(parseRef(`tenants/${TENANT}/${bad}`), `物=${JSON.stringify(bad)}`).toBeNull();
    }
    expect(parseRef(refOf(TENANT, OBJECT))).toEqual({ tenantId: TENANT, id: OBJECT });
    expect(parseRef(refOf(TENANT.toUpperCase(), OBJECT))).toEqual({ tenantId: TENANT.toUpperCase(), id: OBJECT });
    for (const odd of [
      `tenants/${TENANT}/../${OBJECT}`,
      `tenants/${TENANT}/${OBJECT}/x`,
      ` tenants/${TENANT}/${OBJECT}`,
      `tenant/${TENANT}/${OBJECT}`,
      `tenants/${TENANT}`,
    ])
      expect(parseRef(odd), odd).toBeNull();
  });
});
