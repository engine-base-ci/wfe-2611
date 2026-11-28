// K-708「チケットの設定の「状態」」の単体の試験（画面の外の、決まった形だけ）：
//   口の答え → 部品の値と保存の差分・並べ替えの全部の id（stages-shape.ts）。ブラウザ・口は使わない。
//   行 ID は 11_tickets/K-708.md の表。テストはチケットを作る人が書き、実装する人は変えない
import { describe, expect, it } from "vitest";
import {
  allIds,
  lockText,
  moveStage,
  shapeStages,
  stagePatch,
  stageProblem,
} from "../features/F9/settings/stages-shape";

type StageIn = Parameters<typeof shapeStages>[0][number];
const s = (id: string, position: number, lock: StageIn["lock"], over: Partial<StageIn> = {}): StageIn =>
  ({ id, key: null, name: id, color_key: "indigo", position, lock, ...over }) as StageIn;
/** 全部で 8 つ：未着手・作業中・確認中（仕組み）・先方の返事待ち・保留・実行中（仕組み）・承認待ち（仕組み）・完了 */
const ANSWER: StageIn[] = [
  s("done", 90, "end", { color_key: "sage" }),
  s("todo", 10, "start", { color_key: "teal-light" }),
  s("hold", 40, null, { color_key: "plum" }),
  s("checking", 25, "system"),
  s("doing", 20, null),
  s("running", 45, "system"),
  s("wait", 30, null, { color_key: "amber" }),
  s("appr", 47, "system"),
];

describe("K708-UN", () => {
  it("K708-UN-001 shapeStages：仕組みの状態は一覧に出さず、position の昇順・色は color_key（知らない鍵は indigo）・始めと終わりは消せない訳の字・途中の状態は訳なし", () => {
    const rows = shapeStages([...ANSWER, s("odd", 50, null, { color_key: "nonsense" })]);
    expect(rows.map((r) => r.id)).toEqual(["todo", "doing", "wait", "hold", "odd", "done"]);
    expect(rows.map((r) => r.tone)).toEqual(["teal-light", "indigo", "amber", "plum", "indigo", "sage"]);
    expect(rows.find((r) => r.id === "todo")?.locked).toBe("始めの状態なので消せません");
    expect(rows.find((r) => r.id === "done")?.locked).toBe("終わりの状態なので消せません");
    expect(rows.find((r) => r.id === "hold")?.locked).toBeUndefined();
    expect(lockText("system")).toBe("仕組みが使う状態なので消せません");
    expect(lockText(null)).toBeUndefined();
    expect(allIds(ANSWER)).toEqual(["todo", "doing", "checking", "wait", "hold", "running", "appr", "done"]);
  });

  it("K708-UN-002 moveStage：動かした状態を一覧（仕組みの状態を除く）の中の行き先に置き、仕組みの状態は自分の場所のまま、全部の id を返す", () => {
    expect(moveStage(ANSWER, "hold", 1)).toEqual([
      "todo",
      "hold",
      "checking",
      "doing",
      "wait",
      "running",
      "appr",
      "done",
    ]);
    expect(moveStage(ANSWER, "doing", 3)).toEqual([
      "todo",
      "wait",
      "checking",
      "hold",
      "doing",
      "running",
      "appr",
      "done",
    ]);
    expect(moveStage(ANSWER, "wait", 1)).toEqual([
      "todo",
      "wait",
      "checking",
      "doing",
      "hold",
      "running",
      "appr",
      "done",
    ]);
  });

  it("K708-UN-003 moveStage の断り：始めと終わりは動かせず、始めの前・終わりの後・今と同じ場所・知らない id・仕組みの状態は null（口を呼ばない）", () => {
    expect(moveStage(ANSWER, "todo", 2)).toBeNull();
    expect(moveStage(ANSWER, "done", 1)).toBeNull();
    expect(moveStage(ANSWER, "doing", 0)).toBeNull();
    expect(moveStage(ANSWER, "doing", 4)).toBeNull();
    expect(moveStage(ANSWER, "wait", 2)).toBeNull();
    expect(moveStage(ANSWER, "nope", 1)).toBeNull();
    expect(moveStage(ANSWER, "checking", 1)).toBeNull();
  });

  it("K708-UN-004 stagePatch・stageProblem：変えた欄だけ（名前は全角空白も落として比べる）・空と 21 字は問題の文・20 字は null", () => {
    const base = s("wait", 30, null, { name: "先方の返事待ち", color_key: "amber" });
    expect(stagePatch(base, { name: "先方の返事待ち", tone: "amber" })).toEqual({});
    expect(stagePatch(base, { name: "　返事待ち　", tone: "amber" })).toEqual({ name: "返事待ち" });
    expect(stagePatch(base, { name: "先方の返事待ち", tone: "sage" })).toEqual({ color_key: "sage" });
    expect(stagePatch(base, { name: "x", tone: "coral" })).toEqual({ name: "x", color_key: "coral" });
    expect(stageProblem("")).toBe("名前を入れてください");
    expect(stageProblem("　")).toBe("名前を入れてください");
    expect(stageProblem("あ".repeat(21))).toBe("名前は 20 字までです");
    expect(stageProblem("あ".repeat(20))).toBeNull();
  });
});
