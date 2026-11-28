// 本人の PC の Claude Code の記録を読む（D-112）。本人の記録には触らない（一時フォルダを置き場にする）
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aiEntries, joinResponse, sessionFile } from "../src/transcript";
import { parseLine } from "../src/stream";
import { runClaude, forgetClaude } from "../src/runner";

const SID = "386d5cb2-fc77-4cb1-a91f-6ecb032a2a57";
const line = (o: unknown) => JSON.stringify(o);
function fakeProjects() {
  const root = mkdtempSync(join(tmpdir(), "kaname-projects-"));
  mkdirSync(join(root, "-Users-q-work"));
  const file = join(root, "-Users-q-work", `${SID}.jsonl`);
  writeFileSync(
    file,
    [
      line({
        type: "user",
        uuid: "u1",
        message: { role: "user", content: "会社のことを聞いて" },
        timestamp: "2026-09-28T08:07:27.000Z",
      }),
      line({
        type: "assistant",
        uuid: "a1",
        message: { content: [{ type: "thinking", thinking: "" }] },
        timestamp: "2026-09-28T08:07:55.000Z",
      }),
      line({
        type: "assistant",
        uuid: "a2",
        message: { content: [{ type: "text", text: "わかりました。4 問うかがいます。" }] },
        timestamp: "2026-09-28T08:07:57.000Z",
      }),
      line({
        type: "assistant",
        uuid: "a3",
        message: { content: [{ type: "tool_use", name: "AskUserQuestion", input: {} }] },
        timestamp: "2026-09-28T08:08:10.000Z",
      }),
      line({
        type: "user",
        uuid: "u2",
        message: { content: [{ type: "tool_result", content: "Tool call interrupted" }] },
        timestamp: "2026-09-28T11:08:42.000Z",
      }),
      "{壊れた行",
      line({
        type: "assistant",
        uuid: "a6",
        message: { model: "<synthetic>", content: [{ type: "text", text: "No response requested." }] },
        timestamp: "2026-09-28T11:08:42.000Z",
      }),
      line({
        type: "assistant",
        uuid: "a4",
        isSidechain: true,
        message: { content: [{ type: "text", text: "脇道の文" }] },
      }),
      line({
        type: "assistant",
        uuid: "a5",
        message: { content: [{ type: "text", text: "たたき台を置きました。" }] },
        timestamp: "2026-09-28T11:24:44.000Z",
      }),
    ].join("\n"),
  );
  return { root, file };
}

describe("CHT-31-002 本人の PC の Claude Code の記録を読む（D-112）", () => {
  it("projects の下を session の id で探す（作業フォルダに依存しない）。無ければ null", () => {
    const { root, file } = fakeProjects();
    expect(sessionFile(SID, root)).toBe(file);
    expect(sessionFile("00000000-0000-0000-0000-000000000000", root)).toBeNull();
    expect(sessionFile("../../etc/passwd", root), "id の形でなければ探さない").toBeNull();
  });
  it("写すのは自分のAI の文だけ（考えている中身・道具・道具の返り値・本人の文・脇道・壊れた行・Claude Code が自分で足した文は写さない）。id と時刻は記録のまま", () => {
    const { file } = fakeProjects();
    expect(aiEntries(file)).toEqual([
      { uuid: "a2", text: "わかりました。4 問うかがいます。", at: "2026-09-28T08:07:57.000Z" },
      { uuid: "a5", text: "たたき台を置きました。", at: "2026-09-28T11:24:44.000Z" },
    ]);
  });
});

describe("CHT-31-001 流れながら写す（D-112）", () => {
  it("Claude Code が流す assistant の文は、記録と同じ id つきで取り出す（脇道は写さない）", () => {
    const e = parseLine(
      line({
        type: "assistant",
        uuid: "5d984925-aaaa-bbbb-cccc-000000000000",
        parent_tool_use_id: null,
        message: { content: [{ type: "text", text: "わかりました。" }] },
      }),
    );
    expect(e).toMatchObject({
      type: "progress",
      entry: { uuid: "5d984925-aaaa-bbbb-cccc-000000000000", text: "わかりました。" },
    });
    const side = parseLine(
      line({
        type: "assistant",
        uuid: "x",
        parent_tool_use_id: "toolu_1",
        message: { content: [{ type: "text", text: "脇道" }] },
      }),
    );
    expect(side && "entry" in side ? side.entry : undefined).toBeUndefined();
  });
  it("runClaude は文が出るたびに onEntry を呼ぶ（本物と同じく結末の前）", async () => {
    process.env["KANAME_CLAUDE_BIN"] = join(__dirname, "fake-claude.mjs");
    forgetClaude();
    const got: string[] = [];
    const f = await runClaude(
      { job_id: "j", prompt: "請求書", agent_session_id: null, conversation_id: "c" },
      { onEntry: (e) => got.push(e.text) },
    );
    expect(f.state).toBe("done");
    expect(got).toEqual(["答え:請求書"]);
    delete process.env["KANAME_CLAUDE_BIN"];
    forgetClaude();
  });
});

describe("CHT-35-001 同じ返答の文は 1 つの吹き出しに（D-115）", () => {
  it("返答の途中に「考える」が挟まって文が 2 行に分かれても、最初の文の id のまま 1 つにつなぐ。返答が変わった（道具の後）所でだけ分かれる", () => {
    const root = mkdtempSync(join(tmpdir(), "kaname-projects-"));
    mkdirSync(join(root, "-w"));
    const file = join(root, "-w", `${SID}.jsonl`);
    writeFileSync(
      file,
      [
        line({
          type: "assistant",
          uuid: "b1",
          message: { id: "msg_A", content: [{ type: "text", text: "いい形です。" }] },
          timestamp: "2026-09-29T04:58:18.000Z",
        }),
        line({
          type: "assistant",
          uuid: "b2",
          message: { id: "msg_A", content: [{ type: "thinking", thinking: "" }] },
        }),
        line({
          type: "assistant",
          uuid: "b3",
          message: { id: "msg_A", content: [{ type: "text", text: "そこに寄せますね。" }] },
        }),
        line({
          type: "assistant",
          uuid: "b4",
          message: { id: "msg_A", content: [{ type: "tool_use", name: "mcp__kaname__goal_set", input: {} }] },
        }),
        line({ type: "user", uuid: "u9", message: { content: [{ type: "tool_result", content: "ok" }] } }),
        line({
          type: "assistant",
          uuid: "b5",
          message: { id: "msg_B", content: [{ type: "text", text: "整いました。" }] },
        }),
      ].join("\n"),
    );
    expect(aiEntries(file).map((e) => [e.uuid, e.text])).toEqual([
      ["b1", "いい形です。\n\nそこに寄せますね。"],
      ["b5", "整いました。"],
    ]);
  });
  it("流れながら写すときも、同じ返答の 2 つ目の文は 1 つ目の id のままつないだ文になる（返答の id が無い古い形は今までどおり 1 つずつ）", () => {
    const seen = new Map();
    expect(joinResponse(seen, { uuid: "b1", text: "一文目。", group: "msg_A" })).toEqual({
      uuid: "b1",
      text: "一文目。",
      group: "msg_A",
    });
    expect(joinResponse(seen, { uuid: "b3", text: "二文目。", group: "msg_A" })).toEqual({
      uuid: "b1",
      text: "一文目。\n\n二文目。",
      group: "msg_A",
    });
    expect(joinResponse(seen, { uuid: "b5", text: "別の返答。", group: "msg_B" })).toMatchObject({
      uuid: "b5",
      text: "別の返答。",
    });
    expect(joinResponse(seen, { uuid: "c1", text: "id なし" })).toEqual({ uuid: "c1", text: "id なし" });
  });
  it("Claude Code が流す文に返答の id が付く", () => {
    const e = parseLine(
      line({
        type: "assistant",
        uuid: "b1",
        message: { id: "msg_A", content: [{ type: "text", text: "いい形です。" }] },
      }),
    );
    expect(e).toMatchObject({ type: "progress", entry: { uuid: "b1", text: "いい形です。", group: "msg_A" } });
  });
});
