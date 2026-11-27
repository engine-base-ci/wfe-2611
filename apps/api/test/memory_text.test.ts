// 記憶の文を読む（D-105）。DB に触らない部分。K-712：毎朝のまとめに渡す文を組む関数は、まとめを押す旧い道ごと外したので、その試験も外した
import { describe, expect, it } from "vitest";
import { parseDigest, takeRemember } from "../src/auth/memory.js";

describe("takeRemember（D-105.1）", () => {
  it("印を抜き出して返事から消す。全角のコロンも読む。空の印は数えない", () => {
    expect(takeRemember("了解です。\n\n[[覚える: 税込を先に]]\n[[覚える：窓口は鈴木さん]]\n[[覚える:  ]]")).toEqual({
      text: "了解です。",
      items: ["税込を先に", "窓口は鈴木さん"],
    });
    expect(takeRemember("印なし")).toEqual({ text: "印なし", items: [] });
  });
});

describe("parseDigest（D-105.4）", () => {
  it("```json の囲みを読み、知らない形の要素は捨てる", () => {
    const r = parseDigest(
      '前置き\n```json\n{"remembered":[{"title":"t","body":"b","kind":"rule"},{"title":"空"}],"merged":[{"memory_ids":["x","00000000-0000-0000-0000-000000000001","3fa85f64-5717-4562-b3fc-2c963f66afa6"],"body":"m"}],"propose":[],"discarded":[{"text":"d"}]}\n```',
    );
    expect(r).toEqual({
      remembered: [{ title: "t", body: "b", kind: "rule", source: "" }],
      merged: [{ memory_ids: ["3fa85f64-5717-4562-b3fc-2c963f66afa6"], title: "", body: "m", kind: "" }], // 版の桁 0 の id は正式な uuid でないので捨てる（D-129.42・K-145）
      propose: [],
      discarded: [{ text: "d", why: "" }],
    });
  });
  it("囲みが無くても JSON を読む。JSON でなければ null", () => {
    expect(parseDigest('{"remembered":[],"merged":[],"propose":[],"discarded":[]}')).toEqual({
      remembered: [],
      merged: [],
      propose: [],
      discarded: [],
    });
    expect(parseDigest("書き忘れました")).toBeNull();
    expect(parseDigest('{"foo":1}')).toBeNull();
  });
});
