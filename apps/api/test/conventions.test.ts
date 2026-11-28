// 自分のAI に渡す会話の決まり（D-111・D-114）。Kaname の正本と Bridge の控えがずれないこと、聞き取りのときの覚え方が入っていること
import { describe, expect, it } from "vitest";
import { AGENT_CONVENTIONS, ONBOARD_REMEMBER } from "../src/auth/conventions.js";
import { CONVENTIONS } from "../../bridge/src/conventions.js";

describe("会話の決まり", () => {
  it("CHT-34-003 はじめの設定の聞き取りでは、分かった事実を remember で「項目：内容」の形で残す決まりが入っている（それ以外は「覚えて」と言われたときだけ）", () => {
    expect(AGENT_CONVENTIONS).toContain("はじめの設定で会社のことを聞き取っているとき");
    expect(AGENT_CONVENTIONS).toContain("本人に聞かずに、その場で Kaname の remember を呼んで 1 つずつ残す");
    expect(AGENT_CONVENTIONS).toContain("「覚えておきましょうか？」とは聞かない");
    expect(AGENT_CONVENTIONS).toContain("形は「項目：内容」");
    expect(AGENT_CONVENTIONS).toContain("それ以外で勝手に書かない");
    expect(ONBOARD_REMEMBER).toContain("本人に聞かずに");
  });
  it("Kaname の正本と Bridge の控えは同じ文（控えは古い Kaname から仕事が来たときだけ使う）", () => {
    expect(CONVENTIONS.startsWith(AGENT_CONVENTIONS), "Bridge の控えが Kaname の決まりとずれている").toBe(true);
  });
});
