// K-1019「照合が使えなかった登録の小窓」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え（listOpsPwned・K-995 の形）→ 部品の値（features/F12/ops/pwned-shape.ts の pwnedRowView）。
//   字は下絵（features/F12/ops/ops-sample.ts の PWNED_ROWS）が正。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-1019.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { pwnedRowView } from "../features/F12/ops/pwned-shape";
import { PWNED_ROWS } from "../features/F12/ops/ops-sample";

const A = [
  {
    workspace: { id: "w1", name: "山田工務店" },
    member: { id: "m1", name: "山田 健二" },
    last_at: "2026-11-01T05:22:00.000Z",
    count: 1,
  },
  {
    workspace: { id: "w2", name: "佐々木 恵" },
    member: { id: "m2", name: "佐々木 恵" },
    last_at: "2026-11-01T00:05:00.000Z",
    count: 2,
  },
  {
    workspace: { id: "w3", name: "北村デザイン事務所" },
    member: { id: "m3", name: "北村 透" },
    last_at: "2026-10-31T09:47:00.000Z",
    count: 1,
  },
  /** 登録を確定しないまま去った申し込み（まとめて 1 行・K-1110・D-156.69） */
  { workspace: null, member: null, last_at: "2026-10-30T13:14:00.000Z", count: 3 },
];

describe("K-1019 小窓の 1 行の字", () => {
  it("K1019-UN-001 下絵の 4 行と同じ字：日時は日本時間の MM/DD HH:mm・ワークスペース・人。id はワークスペースの id（確定前の行は pending）", () => {
    const got = A.map(pwnedRowView);
    expect(got.map(({ at, ws, person }) => ({ at, ws, person }))).toEqual([...PWNED_ROWS]);
    expect(got.map((r) => r.id)).toEqual(["w1", "w2", "w3", "pending"]);
  });

  it("K1019-UN-002 境目の字：日本時間で日付が替わる時刻（UTC 15:00 は翌日の 00:00）・1 けたの月日は 0 を付ける・人が null なら「—」", () => {
    expect(pwnedRowView({ ...A[0]!, last_at: "2026-12-31T15:00:00.000Z" }).at).toBe("01/01 00:00");
    expect(pwnedRowView({ ...A[0]!, last_at: "2026-03-04T23:59:00.000Z" }).at).toBe("03/05 08:59");
    expect(pwnedRowView({ ...A[0]!, member: null }).person).toBe("—");
  });

  it("K1019-UN-003 確定前の 1 行（workspace・member が null）：ワークスペースは「（登録はまだ確定していません）」・人は「—」・id は pending（申し込みのメールや名前を出さない）", () => {
    expect(pwnedRowView(A[3]!)).toEqual({
      id: "pending",
      at: "10/30 22:14",
      ws: "（登録はまだ確定していません）",
      person: "—",
    });
  });
});
