// 許可のモードを引数にする唯一の場所（D-104.14・D-092 ②）
import { describe, expect, it } from "vitest";
import { modeArgs, optionArgs } from "./modes";
import { buildArgs, limitReason, whyStopped } from "./runner";
import { memoryPrompt } from "./conventions";

describe("modeArgs", () => {
  it("知らない値・空は毎回聞く（manual）に倒す", () => {
    expect(modeArgs(null)).toEqual(["--permission-mode", "manual"]);
    expect(modeArgs("dontAsk")).toEqual(["--permission-mode", "manual"]);
    expect(modeArgs("--dangerously-skip-permissions")).toEqual(["--permission-mode", "manual"]);
  });
  it("本人が選んだ値はそのまま渡す（全部許可も、選んだときだけ）", () => {
    expect(modeArgs("acceptEdits")).toEqual(["--permission-mode", "acceptEdits"]);
    expect(modeArgs("bypassPermissions")).toEqual(["--permission-mode", "bypassPermissions"]);
  });
});

describe("optionArgs", () => {
  it("形が怪しいモデル・強さ・ルールは渡さない", () => {
    expect(optionArgs({ model: "opus; rm -rf", effort: "ultra", allowed_tools: ["Bash(git status)", "Bash(x\ny)", "--bad"] })).toEqual(["--allowedTools", "Bash(git status)"]);
  });
  it("モデル・強さ・いつも許可のルールを渡す", () => {
    expect(optionArgs({ model: "sonnet", effort: "high", allowed_tools: ["Edit", "Bash(npm test)"] })).toEqual(["--model", "sonnet", "--effort", "high", "--allowedTools", "Edit", "Bash(npm test)"]);
  });
});

describe("buildArgs", () => {
  it("書きながらの返事を受け、続きから再開し、可変長のルールは最後に置く", () => {
    const a = buildArgs({ job_id: "j", prompt: "p", agent_session_id: "s-1", conversation_id: null, permission_mode: "plan", allowed_tools: ["Edit"] }, ["/tmp/k"]);
    expect(a).toContain("--include-partial-messages");
    expect(a.slice(a.indexOf("--resume"), a.indexOf("--resume") + 2)).toEqual(["--resume", "s-1"]);
    expect(a.slice(a.indexOf("--permission-mode"), a.indexOf("--permission-mode") + 2)).toEqual(["--permission-mode", "plan"]);
    expect(a.slice(a.indexOf("--add-dir"), a.indexOf("--add-dir") + 2)).toEqual(["--add-dir", "/tmp/k"]);
    expect(a.slice(-2)).toEqual(["--allowedTools", "Edit"]);
    expect(a).not.toContain("--dangerously-skip-permissions");
  });
  it("会話の仕事にだけ Kaname の書き方を渡す（会話の無い仕事＝記憶のまとめには渡さない）", () => {
    const chat = buildArgs({ job_id: "j", prompt: "p", agent_session_id: null, conversation_id: "c" });
    expect(chat[chat.indexOf("--append-system-prompt") + 1]).toContain("[[覚える:");
    expect(buildArgs({ job_id: "j", prompt: "p", agent_session_id: null, conversation_id: null })).not.toContain("--append-system-prompt");
  });
});

describe("limitReason（E-LIM-010）", () => {
  it("達した枠と戻る時刻（PC の時計）を出す。分からなければ一般の文", () => {
    const at = new Date(2026, 8, 27, 18, 40).getTime() / 1000;
    expect(limitReason([{ window: "five_hour", utilization: 1, resets_at: at }])).toBe(
      "サブスクの 5 時間の枠に達しました。18:40 に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）",
    );
    expect(limitReason([{ window: "week", utilization: 1.2, resets_at: at }])).toContain("サブスクの週の枠に達しました");
    expect(limitReason([])).toContain("上限に当たりました");
    expect(whyStopped('{"subtype":"error","error":"rate_limit"}', "", 1, [{ window: "five_hour", utilization: 1, resets_at: at }])).toContain("18:40 に戻ります");
  });
});

describe("memoryPrompt（D-105.8）", () => {
  it("決まりは上の層ほど強く本人の頼みより優先、好みは本人に近いほど強い、の順で渡す。記憶が無ければ何も足さない", () => {
    const p = memoryPrompt([
      { kind: "rule", scope: "会社", personal: false, body: "値引きは部長の承認が要る" },
      { kind: "rule", scope: "本人", personal: true, body: "見積は税抜" },
      { kind: "preference", scope: "本人", personal: true, body: "宛名は御中" },
      { kind: "preference", scope: "会社", personal: false, body: "敬語は丁寧に" },
    ]);
    expect(p.indexOf("値引き")).toBeLessThan(p.indexOf("見積は税抜"));
    expect(p.indexOf("宛名は御中")).toBeLessThan(p.indexOf("敬語は丁寧に"));
    expect(p).toContain("決まりとぶつかったら");
    expect(memoryPrompt([])).toBe("");
    const args = buildArgs({ job_id: "j", prompt: "p", agent_session_id: null, conversation_id: "c", memories: [{ kind: "rule", scope: "会社", personal: false, body: "値引き禁止" }] });
    expect(args[args.indexOf("--append-system-prompt") + 1]).toContain("[会社] 値引き禁止");
  });
});
