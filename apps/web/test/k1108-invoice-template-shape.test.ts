// K-1108「請求書の型の設定の画面」の画面の外の試験：答え（K-1107 の 9 欄）→ 部品の値・欄 → 体・欄の誤り（features/F12/ops2/invoice-template-shape.ts）。
//   純粋な関数だけ（ブラウザ・口は使わない）。行 ID は 11_tickets/K-1108.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import { bodyOf, errorsOf, viewOf } from "../features/F12/ops2/invoice-template-shape";

const VALUES = {
  company: "Kaname 運営",
  address: "〒530-0001 大阪府大阪市北区梅田 1-1-1",
  regNo: "T1234567890123",
  contact: "info@kaname.example",
  bank: "みらい銀行 梅田支店 普通 1234567 カナメウンエイ",
  note: "",
};
const ANSWER = {
  company: VALUES.company,
  address: VALUES.address,
  reg_no: VALUES.regNo,
  contact: VALUES.contact,
  payee: VALUES.bank,
  note: "",
  version: 3,
  updated_at: "2026-11-01T03:00:00Z",
  updated_by_name: "佐野",
};
const NOW = new Date("2026-11-09T01:00:00Z");

describe("K-1108 請求書の型の形", () => {
  it("K1108-UN-001 bodyOf：7 つの鍵・前後の空白を落とす・全角の登録番号は半角の大文字・備考が空なら空の字", () => {
    const b = bodyOf({ ...VALUES, company: "  Kaname 運営 ", regNo: "ｔ１２３４５６７８９０１２３", note: "   " }, 3);
    expect(b).toEqual({
      company: "Kaname 運営",
      address: VALUES.address,
      reg_no: "T1234567890123",
      contact: VALUES.contact,
      payee: VALUES.bank,
      note: "",
      version: 3,
    });
    expect(Object.keys(b)).toHaveLength(7);
  });

  it("K1108-UN-002 errorsOf：空・空白だけの 4 つの欄・登録番号の形・字数の上限の字。正しければ誤り 0", () => {
    expect(errorsOf(VALUES)).toEqual({});
    expect(errorsOf({ ...VALUES, company: "　", address: "", contact: " ", bank: "" })).toEqual({
      company: "会社名を書いてください",
      address: "住所を書いてください",
      contact: "連絡先を書いてください",
      bank: "振込先を書いてください",
    });
    expect(errorsOf({ ...VALUES, regNo: "T123" })).toEqual({ regNo: "登録番号は T と 13 けたの数字で書いてください" });
    expect(
      errorsOf({ ...VALUES, company: "あ".repeat(101), address: "あ".repeat(201), note: "あ".repeat(501) }),
    ).toEqual({
      company: "100 字までにしてください",
      address: "200 字までにしてください",
      note: "500 字までにしてください",
    });
  });

  it("K1108-UN-003 viewOf：直した日（日本時間）と人の字・日をまたぐ時刻・直した時刻が無ければ aside は null・振込先は bank", () => {
    expect(viewOf(ANSWER, NOW)).toEqual({ values: VALUES, aside: "11/01 に 佐野 が直した" });
    expect(viewOf({ ...ANSWER, updated_at: "2026-10-31T16:00:00Z" }, NOW).aside).toBe("11/01 に 佐野 が直した");
    expect(viewOf({ ...ANSWER, updated_at: null, updated_by_name: null, version: 0 }, NOW).aside).toBeNull();
  });
});
