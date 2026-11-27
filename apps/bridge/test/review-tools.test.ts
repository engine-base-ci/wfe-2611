// K-737「PC の側：AI に見せる道具 spec_check・guard_report・draft_propose を足す」の単体の試験（Bridge の道具の定義・仕事ごとの出し分け・道具のサーバーの台本・進み具合の字）。
//   行 ID は K737-BRG-NNN（11_tickets/K-737.md の表の行と 1 対 1）。道具のサーバー（MCP_SERVER_SOURCE）を一時フォルダに書いて素の node の子として動かし、JSON-RPC を送る。
//   送り先（Bridge の手元の口の代わり）は偽の HTTP サーバー。契約の口・DB は動かさない（API の側は K-736・K-738・K-775・K-737 の K737-API-…）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MCP_SERVER_SOURCE,
  TOOL_DEFS,
  kanameServer,
  toolDefsFor,
  toolDefsForJob,
  writeMcpServer,
} from "../src/kaname-tools";
import { label } from "../src/stream";

const names = (defs: { name: string }[]) => defs.map((d) => d.name);
const CHAT_ONLY_BEFORE = [
  "draft_read",
  "goal_set",
  "goal_remove",
  "ledger_set",
  "ledger_remove",
  "duty_set",
  "duty_remove",
  "artifact_put",
  "remember",
];

type Hit = { path: string; body: Record<string, unknown>; token: string | null };
let api: Server;
let base = "";
let hits: Hit[] = [];
let next: { status: number; body: unknown } = { status: 201, body: { data: { result: { ok: true } } } };
let dir = "";
beforeAll(async () => {
  api = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      hits.push({
        path: req.url ?? "",
        body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
        token: typeof req.headers["x-kaname-tool-token"] === "string" ? req.headers["x-kaname-tool-token"] : null,
      });
      res.writeHead(next.status, { "content-type": "application/json" });
      res.end(JSON.stringify(next.body));
    });
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const a = api.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  dir = mkdtempSync(join(tmpdir(), "k737-"));
});
afterAll(async () => {
  api.close();
});

/** 道具のサーバーが返す JSON-RPC の答え（この試験が読む所だけ） */
interface RpcReply {
  id: number;
  result: { tools: { name: string }[]; content: { text: string }[]; isError?: boolean };
}
interface Server2 {
  ask: (method: string, params?: unknown) => Promise<RpcReply>;
  close: () => void;
  child: ChildProcessWithoutNullStreams;
}
/** 道具のサーバーを子として動かす。tools はその仕事の道具の名前（KANAME_TOOLS） */
function start(tools: string[], apiBase: string = base): Server2 {
  const child = spawn(process.execPath, [writeMcpServer(dir)], {
    env: { ...process.env, KANAME_API_BASE: apiBase, KANAME_TOOL_TOKEN: "t".repeat(43), KANAME_TOOLS: tools.join(",") },
  });
  let buf = "";
  const waiting = new Map<number, (m: RpcReply) => void>();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (c: string) => {
    buf += c;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const ln of lines) {
      if (!ln.trim()) continue;
      const m = JSON.parse(ln) as RpcReply;
      waiting.get(m["id"])?.(m);
    }
  });
  let n = 0;
  return {
    child,
    ask: (method, params = {}) =>
      new Promise((resolve) => {
        const id = ++n;
        waiting.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      }),
    close: () => child.kill(),
  };
}
const call = async (s: Server2, name: string, args: unknown) => {
  const r = await s.ask("tools/call", { name, arguments: args });
  const c = (r["result"]["content"] as { text: string }[])[0]!.text;
  return { text: c, isError: r["result"]["isError"] === true };
};

describe("K-737 道具の定義と出し分け", () => {
  it("K737-BRG-001 道具の定義：spec_check（spec_id・basis が必須）・guard_report（spec_id が必須・note は任意）・draft_propose（title・body・checks のどれも任意）。説明に使い方の決まりが入る", () => {
    const d = Object.fromEntries(TOOL_DEFS.map((t) => [t.name, t]));
    const props = (n: string) => Object.keys((d[n]!.inputSchema["properties"] ?? {}) as object).sort();
    const req = (n: string) => ((d[n]!.inputSchema["required"] ?? []) as string[]).slice().sort();
    expect(props("spec_check")).toEqual(["basis", "spec_id"]);
    expect(req("spec_check")).toEqual(["basis", "spec_id"]);
    expect(props("guard_report")).toEqual(["note", "spec_id"]);
    expect(req("guard_report")).toEqual(["spec_id"]);
    expect(props("draft_propose")).toEqual(["body", "checks", "title"]);
    expect(req("draft_propose")).toEqual([]);
    expect(d["spec_check"]!.description).toContain("確かめられた物だけ");
    expect(d["spec_check"]!.description).toContain("外す");
    expect(d["guard_report"]!.description).toContain("必ず守る");
    expect(d["guard_report"]!.description).toContain("チェックは付けない");
    expect(d["draft_propose"]!.description).toContain("案");
    const checks = (
      d["draft_propose"]!.inputSchema["properties"] as Record<string, { type: string; items?: { type: string } }>
    )["checks"]!;
    expect(checks).toMatchObject({ type: "array", items: { type: "string" } });
  });

  it("K737-BRG-002 チケットの仕事の道具は ticket_read・spec_check・guard_report（定義の並びのまま）。ログインの試しは空。会話の仕事（自分の AI の会話・種類なし）は ticket_read・spec_check・guard_report・draft_propose を除いた前の道具のまま", () => {
    const t = names(toolDefsFor("ticket"));
    expect(t).toEqual(expect.arrayContaining(["ticket_read", "spec_check", "guard_report"]));
    expect(t).not.toContain("draft_propose");
    expect(t.filter((x) => ["ticket_read", "spec_check", "guard_report"].includes(x))).toEqual([
      "ticket_read",
      "spec_check",
      "guard_report",
    ]);
    expect(toolDefsFor("login_check")).toEqual([]);
    for (const chat of [toolDefsFor("chat"), toolDefsFor(null), toolDefsFor(undefined)]) {
      const n = names(chat);
      for (const x of ["ticket_read", "spec_check", "guard_report", "draft_propose"]) expect(n).not.toContain(x);
      expect(n).toEqual(expect.arrayContaining(CHAT_ONLY_BEFORE));
    }
  });

  it("K737-BRG-003 仕事ごとの出し分け（toolDefsForJob）：作る画面の会話（kind chat・talk_kind draft）は draft_propose だけ。自分の AI の会話（clone）・チケットの会話（ticket）・種類なし・古い API の仕事は前の会話の道具。チケットの仕事は 3 つ（作る段・承認の後の実行）・試し打ちは確認項目を変えない仕事なので ticket_read だけ（spec_check・guard_report は渡さない）・ログインの試しは空", () => {
    expect(names(toolDefsForJob({ kind: "chat", talk_kind: "draft" }))).toEqual(["draft_propose"]);
    for (const tk of ["clone", "ticket", null, undefined] as const) {
      const n = names(toolDefsForJob({ kind: "chat", talk_kind: tk }));
      expect(n).toEqual(names(toolDefsFor("chat")));
      expect(n).not.toContain("draft_propose");
    }
    expect(names(toolDefsForJob({ kind: "ticket", talk_kind: "draft" }))).toEqual(names(toolDefsFor("ticket")));
    expect(toolDefsForJob({ kind: "login_check", talk_kind: "draft" })).toEqual([]);
    // 試し打ち（確認項目を変えない仕事）は ticket_read だけ。作る段・承認の後の実行は 3 つ
    expect(names(toolDefsForJob({ kind: "ticket", phase: "dry_run" }))).toEqual(["ticket_read"]);
    for (const phase of ["make", "execute", null, undefined] as const)
      expect(names(toolDefsForJob({ kind: "ticket", phase }))).toEqual(
        expect.arrayContaining(["ticket_read", "spec_check", "guard_report"]),
      );
    expect(names(toolDefsForJob({ talk_kind: "draft" }))).toEqual(["draft_propose"]); // 種類なしは会話と同じ
  });

  it("K737-BRG-004 道具のサーバーに渡す環境 KANAME_TOOLS は、その仕事の道具の名前だけ（チケット＝3 つ・試し打ち＝ticket_read だけ・作る画面の会話＝draft_propose だけ・前の会話＝前のまま）。鍵が無ければサーバーは無い", () => {
    const k = { serverPath: "/tmp/k.js", nodeBin: "node", apiBase: "http://127.0.0.1:1" };
    const env = (kind: "ticket" | "chat", tk?: string | null, phase?: string | null) =>
      (kanameServer(k, "t".repeat(43), kind, tk as never, phase as never) as { env: Record<string, string> }).env[
        "KANAME_TOOLS"
      ]!.split(",");
    expect(env("ticket")).toEqual(expect.arrayContaining(["ticket_read", "spec_check", "guard_report"]));
    expect(env("ticket", null, "dry_run")).toEqual(["ticket_read"]);
    expect(env("chat", "draft")).toEqual(["draft_propose"]);
    expect(env("chat", "clone")).toEqual(names(toolDefsFor("chat")));
    expect(env("chat")).toEqual(names(toolDefsFor("chat")));
    expect(kanameServer(k, null, "chat", "draft")).toBeNull();
  });
});

describe("K-737 道具のサーバーの台本（子として動かす）", () => {
  it("K737-BRG-005 tools/list：チケットの仕事は 3 つ・作る画面の会話は draft_propose だけを返し、ほかの道具は呼べない（その道具はありません）", async () => {
    const t = start(names(toolDefsForJob({ kind: "ticket" })));
    const d = start(names(toolDefsForJob({ kind: "chat", talk_kind: "draft" })));
    try {
      const lt = names((await t.ask("tools/list"))["result"]["tools"]);
      expect(lt).toEqual(expect.arrayContaining(["guard_report", "spec_check", "ticket_read"])); // 要る名前が在る（段 10 の knowledge_open が加わっても通る）
      expect(lt).not.toContain("draft_propose");
      expect(lt).not.toContain("draft_read");
      const ld = names((await d.ask("tools/list"))["result"]["tools"]);
      expect(ld).toEqual(["draft_propose"]);
      const r = await call(d, "spec_check", { spec_id: "x", basis: "y" });
      expect(r).toMatchObject({ isError: true });
      expect(r.text).toContain("その道具はありません");
    } finally {
      t.close();
      d.close();
    }
  });

  it("K737-BRG-006 呼ぶと入力を道具の名前の道へそのまま送り（鍵つき）、答えの data を AI に返す：spec_check は spec_id と basis・guard_report は spec_id と note・draft_propose は title・body・checks", async () => {
    const s = start(["ticket_read", "spec_check", "guard_report", "draft_propose"]);
    try {
      hits = [];
      next = { status: 201, body: { data: { result: { ok: true, id: "s1", checked: true } } } };
      const r = await call(s, "spec_check", { spec_id: "s1", basis: "合計が見積と同じ" });
      expect(r.isError).toBe(false);
      expect(JSON.parse(r.text)).toEqual({ result: { ok: true, id: "s1", checked: true } });
      expect(hits).toHaveLength(1);
      expect(hits[0]!.path).toBe("/tools/spec_check");
      expect(hits[0]!.token).toBe("t".repeat(43));
      expect(hits[0]!.body).toEqual({ name: "spec_check", input: { spec_id: "s1", basis: "合計が見積と同じ" } });
      await call(s, "guard_report", { spec_id: "s2", note: "直した" });
      expect(hits[1]!.path).toBe("/tools/guard_report");
      expect(hits[1]!.body["input"]).toEqual({ spec_id: "s2", note: "直した" });
      await call(s, "draft_propose", { title: "見積を作る", body: "本文", checks: ["合計がそろっている"] });
      expect(hits[2]!.path).toBe("/tools/draft_propose");
      expect(hits[2]!.body["input"]).toEqual({ title: "見積を作る", body: "本文", checks: ["合計がそろっている"] });
    } finally {
      s.close();
    }
  });

  it("K737-BRG-007 断られたときの AI への文：422 は欄名つきで直し方が分かる文・spec_check の 404／409・guard_report の 404・draft_propose の 409（3 回まで）・403 はそれぞれ決めた文。内部の番号・状態コードの字を出さない", async () => {
    const s = start(["ticket_read", "spec_check", "guard_report", "draft_propose"]);
    try {
      const fail = async (name: string, status: number, body: unknown, args: unknown = {}) => {
        next = { status, body };
        return call(s, name, args);
      };
      const a = await fail("spec_check", 422, {
        error: "validation_failed",
        details: [{ field: "basis", message: "200 字までです" }],
      });
      expect(a.isError).toBe(true);
      expect(a.text).toBe("入力が正しくありません：basis：200 字までです");
      const b = await fail("spec_check", 404, { error: "not_found", code: "NOT_FOUND" });
      expect(b.text).toContain("その確認項目は見つかりません");
      const c = await fail("spec_check", 409, { error: "conflict", code: "E-SPEC-001" });
      expect(c.text).toContain("完了");
      const d = await fail("guard_report", 404, { error: "not_found", code: "NOT_FOUND" });
      expect(d.text).toContain("必ず守る");
      const e = await fail("draft_propose", 409, { error: "conflict", code: "E-TALK-070" });
      expect(e.text).toContain("3 回");
      for (const name of ["spec_check", "guard_report", "draft_propose"]) {
        const f = await fail(name, 403, { error: "forbidden", code: "FORBIDDEN" });
        expect(f.isError).toBe(true);
        expect(f.text).toBe("この道具は今は使えません");
      }
      for (const x of [a, b, c, d, e]) {
        expect(x.text).not.toMatch(/E-[A-Z]+-\d+|\b4\d\d\b|NOT_FOUND|FORBIDDEN/);
      }
    } finally {
      s.close();
    }
  });

  it("K737-BRG-008 ほかの道具の失敗の文は前のまま：goal_set の 422 は「Kaname に置けませんでした：Kaname が 422」・届かないときは「Kaname に届きませんでした」。台本にログ出力（console.log）が無い", async () => {
    const s = start(["goal_set"]);
    const dead = start(["spec_check"], "http://127.0.0.1:9"); // 誰も聞いていない口
    try {
      next = { status: 422, body: { error: "validation_failed", details: [{ field: "name", message: "必須です" }] } };
      const r = await call(s, "goal_set", {});
      expect(r.text).toBe("Kaname に置けませんでした：Kaname が 422");
      const d = await call(dead, "spec_check", { spec_id: "x", basis: "y" });
      expect(d.isError).toBe(true);
      expect(d.text).toContain("Kaname に届きませんでした");
    } finally {
      s.close();
      dead.close();
    }
    expect(MCP_SERVER_SOURCE).not.toContain("console.log");
  });
});

describe("K-737 進み具合の字・手元の口", () => {
  it("K737-BRG-009 進み具合の字：spec_check「確認項目にチェックを付けています」・guard_report「守れていなかった決まりを知らせています」・draft_propose「チケットの案を出しています」。道具の内部の名前は出さず、前の道具の字は前のまま", () => {
    expect(label("mcp__kaname__spec_check")).toBe("確認項目にチェックを付けています");
    expect(label("mcp__kaname__guard_report")).toBe("守れていなかった決まりを知らせています");
    expect(label("mcp__kaname__draft_propose")).toBe("チケットの案を出しています");
    for (const n of ["spec_check", "guard_report", "draft_propose"])
      expect(label(`mcp__kaname__${n}`)).not.toContain(n);
    expect(label("mcp__kaname__ticket_read")).toBe("チケットを読んでいます");
    expect(label("mcp__kaname__goal_set")).toBe("たたき台に目標を置いています");
  });
});
