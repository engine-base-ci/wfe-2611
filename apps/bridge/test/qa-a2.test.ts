// QA A2：配布（T-B-06）の G-11（外部リソースの実在）と G-15（信号なし終了）を Bridge 本体で確かめる。
//   画面の無いところ（自己診断の部品・受け取り・入れ替えの手順）なので vitest。本物の http・本物の ditto／sh を使う（mac のみ）。
//   手元の PC の /Applications や本人の Bridge には触らない（一時フォルダの偽の .app だけ）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { forgetClaude, findClaude, runClaude } from "../src/runner";
import { browserCheck } from "../src/browser";
import { startLoop, type LoopState } from "../src/loop";
import { BUNDLE_ID, download, replaceScript, startUpdater, type UpdateInfo } from "../src/update";

const mac = process.platform === "darwin";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const until = async (ok: () => boolean, ms = 10_000) => {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error("待ちきれませんでした");
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe("BRG-06-013 G-11 自己診断：触る外部リソース（Claude Code・Chrome・Kaname の API）が無ければ理由が出る（黙って落ちない）", () => {
  const before = process.env["KANAME_CLAUDE_BIN"];
  afterAll(() => {
    if (before === undefined) delete process.env["KANAME_CLAUDE_BIN"];
    else process.env["KANAME_CLAUDE_BIN"] = before;
    forgetClaude();
  });

  it("Claude Code が無い PC では見つからないと判定し、仕事は「見つかりません」の理由つきで止まる（終わったことにしない）", async () => {
    process.env["KANAME_CLAUDE_BIN"] = join(tmpdir(), `kaname-qa-a2-無い-${Date.now()}`);
    forgetClaude();
    expect(await findClaude()).toBeNull();
    const f = await runClaude({ job_id: "j-qa", prompt: "請求書", agent_session_id: null, conversation_id: "c-qa", permission_mode: "manual" });
    expect(f.state).toBe("stopped");
    expect(f).toMatchObject({ reason: "このPCに Claude Code が見つかりません。入れてログインしてください" });
  });

  it("置いてあっても動かない Claude Code（本体の無い紙だけ）は、在ることにしない", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-qa-a2-"));
    const stub = join(dir, "claude");
    writeFileSync(stub, "#!/bin/sh\necho 'Error: claude native binary not installed' >&2\nexit 1\n");
    chmodSync(stub, 0o755);
    process.env["KANAME_CLAUDE_BIN"] = stub;
    forgetClaude();
    expect(await findClaude()).toBeNull();
  });

  it("Chrome が無ければ「使える」にせず、理由と直し方を返す（自分の Chrome／Bridge 専用のどちらでも）", () => {
    const c = browserCheck("chrome", false, null, true);
    expect(c.ok).toBe(false);
    expect(c.detail).toContain("Chrome が見つかりません");
    const d = browserCheck("dedicated", false, null, true);
    expect(d.ok).toBe(false);
    expect(d.detail).toContain("Chrome が見つかりません");
  });

  it("Kaname の API に届かなければ、生きていることにせず理由を出す", async () => {
    const seen: LoopState[] = [];
    const stop = startLoop({
      apiBase: "http://127.0.0.1:9", // 誰も待っていない口
      sessionId: () => "00000000-0000-0000-0000-000000000000",
      health: async () => [],
      onChange: (s) => seen.push(s),
      onGone: () => undefined,
    });
    try {
      await until(() => seen.some((s) => !!s.lastError), 10_000);
    } finally {
      stop();
    }
    const last = seen.filter((s) => s.lastError).at(-1)!;
    expect(last.alive).toBe(false);
    expect(last.lastError).toMatch(/^Kaname に届きません（/);
  });
});

// ---- G-15：配布の外のプロセス（受け取り・入れ替え）が途中で切れる・殺される
let server: Server;
let api = "";
let latest: unknown = { released: false };
let body: Buffer = Buffer.alloc(0);
let cutAt = -1; // この大きさまで送って接続を切る（-1 は切らない）
beforeAll(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    if (u.pathname === "/api/auth-ext/bridge/latest") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: latest }));
    }
    res.setHeader("content-length", String(body.length));
    if (cutAt >= 0) {
      res.write(body.subarray(0, cutAt));
      setTimeout(() => res.socket?.destroy(), 50); // 途中で切れる（完了の合図が無い）
      return;
    }
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const a = server.address();
  api = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => server.close());

/** 偽の Kaname Bridge.app（Info.plist の id と版・中身の目印）。files を足すと入れ替えに時間がかかる */
function fakeApp(dir: string, version: string, mark: string, files = 0): string {
  const app = join(dir, "Kaname Bridge.app");
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  mkdirSync(join(app, "Contents", "Resources"), { recursive: true });
  writeFileSync(join(app, "Contents", "MacOS", "Kaname Bridge"), "#!/bin/sh\n");
  for (let i = 0; i < files; i++) writeFileSync(join(app, "Contents", "Resources", `r${i}.bin`), "x".repeat(10));
  writeFileSync(
    join(app, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>\n`,
  );
  writeFileSync(join(app, "Contents", "mark.txt"), mark);
  return app;
}
/** 入れ替えた先が、そのまま立ち上げられる完全な .app か（どの版か） */
function whole(app: string, files: number): string | null {
  try {
    const mark = readFileSync(join(app, "Contents", "mark.txt"), "utf8");
    const plist = readFileSync(join(app, "Contents", "Info.plist"), "utf8");
    if (!plist.includes(BUNDLE_ID) || !existsSync(join(app, "Contents", "MacOS", "Kaname Bridge"))) return null;
    if (mark === "new" && readdirSync(join(app, "Contents", "Resources")).length !== files) return null;
    return mark;
  } catch {
    return null;
  }
}

describe("BRG-06-014 G-15 配布の外のプロセスが完了の合図を出さずに終わる・途中で切れる", () => {
  it("受け取りが途中で切れたら成功にしない（中途半端なファイルを残さず、投げる）", async () => {
    body = Buffer.alloc(200_000, 7);
    cutAt = 50_000;
    const dir = mkdtempSync(join(tmpdir(), "kaname-qa-a2-dl-"));
    const u: UpdateInfo = { version: "0.261001.1200", name: "Kaname-Bridge-0.261001.1200-arm64.zip", url: `${api}/f`, sha256: sha(body), size: body.length };
    await expect(download(u, dir)).rejects.toThrow();
    expect(readdirSync(dir), "途中のファイルを残さない").toEqual([]);
    cutAt = -1;
  });

  it.runIf(mac)("受け取りが途中で切れたら入れ替えも終了もせず、止まったことを Bridge の窓に 1 回知らせる", async () => {
    body = Buffer.alloc(200_000, 9);
    cutAt = 50_000;
    latest = {
      released: true,
      version: "0.261001.1201",
      update: { name: "Kaname-Bridge-0.261001.1201-arm64.zip", url: "/api/auth-ext/bridge/file/x", sha256: sha(body), size: body.length },
    };
    const root = mkdtempSync(join(tmpdir(), "kaname-qa-a2-up-"));
    const app = fakeApp(join(root, "Applications"), "0.1.0", "old");
    const notes: string[] = [];
    let quits = 0;
    const u = startUpdater({
      apiBase: api, currentVersion: "0.1.0", platform: "darwin", arch: "arm64", execPath: join(app, "Contents", "MacOS", "Kaname Bridge"),
      isPackaged: true, dir: join(root, "updates"), isBusy: () => false, onNote: (t) => notes.push(t), quit: () => quits++,
      relaunch: () => ["/usr/bin/true"], pid: 999_999,
    });
    await u.checkNow();
    await new Promise((r) => setTimeout(r, 300));
    u.stop();
    cutAt = -1;
    latest = { released: false };
    expect(quits, "成功にしない（終了して入れ替えに進まない）").toBe(0);
    expect(whole(app, 0), "いまの版はそのまま").toBe("old");
    expect(notes.length, "止まったことを知らせる（黙って次の機会を待たない）").toBeGreaterThan(0);
  });

  it.runIf(mac)("入れ替えの手順が途中で殺されても、Bridge を無くさない（元の版か新しい版の、どちらかの完全な .app が残る）", async () => {
    const FILES = 3000;
    const root = mkdtempSync(join(tmpdir(), "kaname-qa-a2-rep-"));
    const target = fakeApp(join(root, "Applications"), "0.1.0", "old");
    const source = fakeApp(join(root, "stage"), "0.261001.1202", "new", FILES);
    const backup = join(root, "previous.app");
    const script = join(root, "replace.sh");
    writeFileSync(script, replaceScript({ pid: 999_999, target, source, backup, relaunch: ["/usr/bin/touch", join(root, "relaunched")] }), { mode: 0o755 });
    const p = spawn("/bin/sh", [script], { detached: true, stdio: "ignore" });
    // 元の版を退けて、新しい版を写している最中に殺す（電源が落ちた・強制終了された）
    await until(() => existsSync(backup) && existsSync(join(target, "Contents")), 10_000);
    process.kill(-p.pid!, "SIGKILL");
    await new Promise((r) => setTimeout(r, 300));
    const left = whole(target, FILES);
    try {
      expect(left, `入れ替え先が欠けた .app のまま残った（退けた元の版は ${existsSync(backup) ? backup : "無い"}）`).not.toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
