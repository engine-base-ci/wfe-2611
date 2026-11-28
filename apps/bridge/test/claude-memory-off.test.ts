// K-737 の追記（2026-11-23・控え帳の代表の言葉 2026-11-22 23:00）の単体の試験：Bridge が本人の Claude Code を起こすとき、Claude の側にナレッジ・チケットを残させない。
//   行 ID は K737-BRG-NNN（11_tickets/K-737.md の表の行と 1 対 1）。見るのは起こし方（引数と環境）だけ。本物の Claude は起こさない。
//   AI に読ませるのは制限しない（読む道具は止めない）。記憶は Kaname の側だけが持ち、仕事ごとに渡す（Claude の自動の記憶・CLAUDE.md・メモのファイルは作らせない）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import { buildArgs, runEnv, type Job } from "../src/runner";

const base: Job = { job_id: "j-1", prompt: "p", agent_session_id: null, conversation_id: "c-1" };
// 仕事の種類ごと（自分の AI の会話・作る段・承認の後の実行・試し打ち・作る画面の会話）。ログインの試しは AI を起こさないので入れない
const JOBS: Record<string, Job> = {
  会話: { ...base },
  作る段: { ...base, conversation_id: null, kind: "ticket", ticket_id: "t-1", phase: "make", tool_token: "tok" },
  承認の後の実行: {
    ...base,
    conversation_id: null,
    kind: "ticket",
    ticket_id: "t-1",
    phase: "execute",
    tool_token: "tok",
  },
  試し打ち: {
    ...base,
    conversation_id: null,
    kind: "ticket",
    ticket_id: "t-1",
    phase: "dry_run" as unknown as Job["phase"],
    tool_token: "tok",
  },
};
const LIST = [{ domain: "x.com", service: "X" }];
const GUARD = { hookPath: "/tmp/h.cjs", log: "/tmp/g.log", nodeBin: "/usr/bin/node" };
// 書き写して残す宛先（Claude の記憶・CLAUDE.md・メモ）。Write と Edit を使わない道具として渡す
const MEMORY_DENY = [
  "Write(**/CLAUDE.md)",
  "Edit(**/CLAUDE.md)",
  "Write(**/CLAUDE.local.md)",
  "Edit(**/CLAUDE.local.md)",
  "Write(~/.claude/**)",
  "Edit(~/.claude/**)",
];
const deniedOf = (args: string[]): string[] => {
  const i = args.indexOf("--disallowedTools");
  if (i < 0) return [];
  const out: string[] = [];
  for (let k = i + 1; k < args.length && !(args[k] ?? "").startsWith("--"); k++) out.push(args[k] as string);
  return out;
};

describe("K-737 Claude の側にナレッジ・チケットを残させない（Bridge の起こし方）", () => {
  it("K737-BRG-010 守り × どの仕事の種類でも、Claude を起こす環境で自動の記憶を止める（CLAUDE_CODE_DISABLE_AUTO_MEMORY が 1）。本人の環境にあっても上書きして 1 にする", () => {
    const before = process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"];
    try {
      for (const [name, job] of Object.entries(JOBS)) {
        delete process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"];
        expect(runEnv(job, null)["CLAUDE_CODE_DISABLE_AUTO_MEMORY"], `${name}：環境に無くても 1`).toBe("1");
        process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"] = "0";
        expect(runEnv(job, GUARD)["CLAUDE_CODE_DISABLE_AUTO_MEMORY"], `${name}：本人の環境が 0 でも 1`).toBe("1");
      }
    } finally {
      if (before === undefined) delete process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"];
      else process.env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"] = before;
    }
  });

  it("K737-BRG-011 守り × どの仕事の種類でも、使わない道具（--disallowedTools）に CLAUDE.md・CLAUDE.local.md・~/.claude の Write と Edit が入る。禁止の宛先の一覧が空でも入り、有れば WebFetch の宛先と 1 つの一覧にまとまる。読む道具は止めない・--allowedTools は最後のまま", () => {
    for (const [name, job] of Object.entries(JOBS)) {
      const none = deniedOf(buildArgs(job));
      expect(none, `${name}：禁止の宛先が無くても入る`).toEqual(expect.arrayContaining(MEMORY_DENY));
      const withList = buildArgs({ ...job, blocked: LIST, allowed_tools: ["Edit"] }, [], GUARD);
      const denied = deniedOf(withList);
      expect(denied, `${name}：WebFetch の宛先と記憶の宛先が 1 つの一覧`).toEqual(
        expect.arrayContaining([...MEMORY_DENY, "WebFetch(domain:x.com)"]),
      );
      expect(
        withList.filter((a) => a === "--disallowedTools"),
        `${name}：--disallowedTools は 1 回だけ`,
      ).toHaveLength(1);
      expect(
        denied.filter((d) => /^(Read|Glob|Grep|Bash|NotebookRead)/.test(d)),
        `${name}：AI に読ませるのは制限しない（読む道具・実行の道具は止めない）`,
      ).toEqual([]);
      expect(withList.slice(-2), `${name}：可変長の --allowedTools は最後のまま`).toEqual(["--allowedTools", "Edit"]);
    }
  });
});
