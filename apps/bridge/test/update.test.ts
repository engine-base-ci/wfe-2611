// Bridge が自分で新しい版を受け取り、指紋を確かめて入れ替える（D-109・T-B-06）。
//   本物の http で受け取り、本物の ditto／plutil／sh で .app を入れ替える（mac のみ。手元の PC の /Applications には触らない）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUNDLE_ID, download, fetchLatest, newer, replaceScript, startUpdater, type UpdateInfo } from "../src/update";

const mac = process.platform === "darwin";
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const until = async (ok: () => boolean, ms = 10_000) => {
  const t0 = Date.now();
  while (!ok()) {
    if (Date.now() - t0 > ms) throw new Error("待ちきれませんでした");
    await new Promise((r) => setTimeout(r, 50));
  }
};

/** 偽の Kaname Bridge.app（Info.plist の id と版・中身の目印） */
function fakeApp(dir: string, version: string, mark: string, id = BUNDLE_ID): string {
  const app = join(dir, "Kaname Bridge.app");
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  writeFileSync(join(app, "Contents", "MacOS", "Kaname Bridge"), "#!/bin/sh\n");
  writeFileSync(join(app, "Contents", "mark.txt"), mark);
  writeFileSync(
    join(app, "Contents", "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>\n`,
  );
  return app;
}

// Kaname の代わり（目録と中身を返す）
let server: Server;
let api = "";
let latest: unknown = { released: false };
let files: Record<string, Buffer> = {};
let fileHits = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    if (u.pathname === "/api/auth-ext/bridge/latest") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ data: latest }));
    }
    const m = /^\/api\/auth-ext\/bridge\/file\/(.+)$/.exec(u.pathname);
    const b = m ? files[decodeURIComponent(m[1]!)] : undefined;
    if (!b) {
      res.statusCode = 404;
      return res.end();
    }
    fileHits++;
    res.setHeader("content-length", String(b.length));
    res.end(b);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const a = server.address();
  api = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => server.close());

const publish = (version: string, name: string, body: Buffer, over: Partial<{ sha256: string; size: number }> = {}) => {
  files = { [name]: body };
  latest = {
    released: true,
    version,
    update: {
      name,
      url: `/api/auth-ext/bridge/file/${encodeURIComponent(name)}`,
      sha256: over.sha256 ?? sha(body),
      size: over.size ?? body.length,
    },
  };
};

describe("版を比べる", () => {
  it("日時の版は 0.1.0 より新しく、同じ・古いものは新しくない", () => {
    expect(newer("0.260928.1530", "0.1.0")).toBe(true);
    expect(newer("0.260928.1531", "0.260928.1530")).toBe(true);
    expect(newer("0.260928.930", "0.260928.1530")).toBe(false);
    expect(newer("0.260928.1530", "0.260928.1530")).toBe(false);
    expect(newer("x", "0.1.0")).toBe(false);
  });
});

describe("BRG-06-018 受け取って指紋を確かめる（D-109.4）", () => {
  const body = Buffer.from("new-version-bytes");
  it("新しい版があれば場所・指紋・大きさを返し、受け取ったものの指紋が合えば置く", async () => {
    publish("0.260928.1530", "Kaname-Bridge-0.260928.1530-arm64-mac.zip", body);
    const u = (await fetchLatest(api, "mac", "arm64", "0.1.0"))!;
    expect(u).toMatchObject({ version: "0.260928.1530", sha256: sha(body), size: body.length });
    expect(u.url).toBe(`${api}/api/auth-ext/bridge/file/Kaname-Bridge-0.260928.1530-arm64-mac.zip`);
    const dir = mkdtempSync(join(tmpdir(), "kaname-up-"));
    const p = await download(u, dir);
    expect(readFileSync(p).equals(body)).toBe(true);
  });
  it("同じ版・配布していないなら何もしない", async () => {
    expect(await fetchLatest(api, "mac", "arm64", "0.260928.1530")).toBeNull();
    latest = { released: false };
    expect(await fetchLatest(api, "mac", "arm64", "0.1.0")).toBeNull();
  });
  it("指紋が合わない・大きさが合わないものは捨てて投げる（途中のファイルを残さない）", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-up-"));
    const name = "x.zip";
    files = { [name]: body };
    const base: UpdateInfo = {
      version: "9.9.9",
      name,
      url: `${api}/api/auth-ext/bridge/file/${name}`,
      sha256: sha(Buffer.from("other")),
      size: body.length,
    };
    await expect(download(base, dir)).rejects.toThrow("指紋が目録と合いません");
    await expect(download({ ...base, sha256: sha(body), size: body.length + 5 }, dir)).rejects.toThrow(
      "大きさが目録と合いません",
    );
    await expect(download({ ...base, sha256: sha(body), size: 3 }, dir)).rejects.toThrow("大きさが目録と合いません");
    expect(existsSync(join(dir, name))).toBe(false);
    expect(existsSync(join(dir, `${name}.part`))).toBe(false);
  });
});

describe.runIf(mac)("BRG-06-019 入れ替えの手順（sh）", () => {
  it("いまの Bridge が終わるのを待って入れ替え、立ち上げ直す", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-rep-"));
    const target = fakeApp(join(dir, "Applications"), "0.1.0", "old");
    const source = fakeApp(join(dir, "stage"), "0.260928.1530", "new");
    const waitFor = spawn("/bin/sleep", ["0.6"]);
    const relaunched = join(dir, "relaunched");
    const script = join(dir, "r.sh");
    writeFileSync(
      script,
      replaceScript({
        pid: waitFor.pid!,
        target,
        source,
        backup: join(dir, "bak.app"),
        relaunch: ["/usr/bin/touch", relaunched],
      }),
    );
    const t0 = Date.now();
    await new Promise((r) => spawn("/bin/sh", [script]).on("close", r));
    expect(Date.now() - t0, "終わるまで待った").toBeGreaterThanOrEqual(400);
    expect(readFileSync(join(target, "Contents", "mark.txt"), "utf8")).toBe("new");
    expect(existsSync(join(dir, "bak.app"))).toBe(false);
    expect(existsSync(relaunched)).toBe(true);
  });
  it("入れ替えに失敗したら元に戻して元の版を立ち上げる（Bridge を無くさない）", () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-rep-"));
    const target = fakeApp(join(dir, "Applications"), "0.1.0", "old");
    const relaunched = join(dir, "relaunched");
    const script = join(dir, "r.sh");
    writeFileSync(
      script,
      replaceScript({
        pid: 999_999,
        target,
        source: join(dir, "無い.app"),
        backup: join(dir, "bak.app"),
        relaunch: ["/usr/bin/touch", relaunched],
      }),
    );
    spawnSync("/bin/sh", [script]);
    expect(readFileSync(join(target, "Contents", "mark.txt"), "utf8")).toBe("old");
    expect(existsSync(relaunched)).toBe(true);
  });
  it("場所にクォートが入っていても壊れない", () => {
    const s = replaceScript({
      pid: 1,
      target: "/A/it's.app",
      source: "/B/x.app",
      backup: "/C/b.app",
      relaunch: ["/usr/bin/open", "-n", "/A/it's.app"],
    });
    expect(s).toContain(`OLD='/A/it'\\''s.app'`);
  });
});

describe.runIf(mac)("自分で受け取って入れ替える（起動から立ち上げ直しまで）", () => {
  /** 新しい版の zip を作って Kaname に置く */
  function release(version: string, id = BUNDLE_ID): void {
    const dir = mkdtempSync(join(tmpdir(), "kaname-rel-"));
    fakeApp(dir, version, `v${version}`, id);
    const zip = join(dir, "app.zip");
    spawnSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", join(dir, "Kaname Bridge.app"), zip]);
    publish(version, `Kaname-Bridge-${version}-arm64-mac.zip`, readFileSync(zip));
  }
  function installed() {
    const dir = mkdtempSync(join(tmpdir(), "kaname-inst-"));
    const app = fakeApp(join(dir, "Applications"), "0.1.0", "v0.1.0");
    return { dir, app, execPath: join(app, "Contents", "MacOS", "Kaname Bridge"), relaunched: join(dir, "relaunched") };
  }
  const deps = (i: ReturnType<typeof installed>, over: Partial<Parameters<typeof startUpdater>[0]> = {}) => {
    const notes: string[] = [];
    let quits = 0;
    const waitFor = spawn("/bin/sleep", ["0.3"]);
    const u = startUpdater({
      apiBase: api,
      currentVersion: "0.1.0",
      platform: "darwin",
      arch: "arm64",
      execPath: i.execPath,
      isPackaged: true,
      dir: join(i.dir, "updates"),
      isBusy: () => false,
      onNote: (t) => notes.push(t),
      quit: () => quits++,
      relaunch: () => ["/usr/bin/touch", i.relaunched],
      pid: waitFor.pid!,
      ...over,
    });
    return { u, notes, quits: () => quits };
  };

  it("BRG-06-017 BRG-06-019 起動時に見に行って新しい版を受け取り、中身が Kaname Bridge のその版だと確かめてから入れ替え、立ち上げ直す", async () => {
    release("0.260928.1530");
    const i = installed();
    const r = deps(i);
    await until(() => existsSync(i.relaunched));
    r.u.stop();
    expect(r.quits()).toBe(1);
    expect(readFileSync(join(i.app, "Contents", "mark.txt"), "utf8")).toBe("v0.260928.1530");
    expect(r.notes.at(-1)).toContain("新しい版（0.260928.1530）に入れ替えます");
  });
  it("BRG-06-019 仕事を動かしている間は入れ替えない。終わったら入れ替える", async () => {
    release("0.260928.1531");
    const i = installed();
    let busy = true;
    const r = deps(i, { isBusy: () => busy });
    await new Promise((res) => setTimeout(res, 1_500));
    expect(r.quits(), "仕事中は待つ").toBe(0);
    expect(readFileSync(join(i.app, "Contents", "mark.txt"), "utf8")).toBe("v0.1.0");
    busy = false;
    await until(() => existsSync(i.relaunched), 15_000);
    r.u.stop();
    expect(readFileSync(join(i.app, "Contents", "mark.txt"), "utf8")).toBe("v0.260928.1531");
  }, 20_000);
  it("BRG-06-018 指紋が合わなければ使わず、1 回だけ理由を出す（入れ替えない）", async () => {
    release("0.260928.1532");
    (latest as { update: { sha256: string } }).update.sha256 = "0".repeat(64);
    const i = installed();
    const r = deps(i);
    await until(() => r.notes.length > 0);
    await r.u.checkNow();
    r.u.stop();
    expect(r.notes).toEqual([
      "新しい版を受け取りましたが、確かめられなかったので使いませんでした（指紋が目録と合いません）",
    ]);
    expect(r.quits()).toBe(0);
    expect(readFileSync(join(i.app, "Contents", "mark.txt"), "utf8")).toBe("v0.1.0");
  });
  it("BRG-06-018 中身が Kaname Bridge でなければ入れ替えない", async () => {
    release("0.260928.1533", "com.example.other");
    const i = installed();
    const r = deps(i);
    await until(() => r.notes.length > 0);
    r.u.stop();
    expect(r.notes[0]).toContain("Kaname Bridge ではありません");
    expect(r.quits()).toBe(0);
  });
  it("立ち上がったら前に受け取った残り（zip・展開したもの）を片づける", async () => {
    latest = { released: false };
    const i = installed();
    mkdirSync(join(i.dir, "updates", "app-0.1.0"), { recursive: true });
    writeFileSync(join(i.dir, "updates", "old.zip"), "x");
    const r = deps(i);
    await r.u.checkNow();
    r.u.stop();
    expect(existsSync(join(i.dir, "updates"))).toBe(false);
  });
  it("BRG-06-020 配布物でない起動（開発）なら受け取りにも行かず、そう言う", async () => {
    release("0.260928.1534");
    const i = installed();
    fileHits = 0;
    const r = deps(i, { isPackaged: false });
    await until(() => r.notes.length > 0);
    r.u.stop();
    expect(r.notes[0]).toBe("新しい版（0.260928.1534）があります。開発中の起動なので入れ替えません");
    expect(fileHits).toBe(0);
    expect(r.quits()).toBe(0);
  });
  it("BRG-06-020 書けない場所に入っていれば受け取りにも行かず、入れ直しを案内する", async () => {
    release("0.260928.1535");
    const i = installed();
    const { chmodSync } = await import("node:fs");
    const apps = join(i.dir, "Applications");
    chmodSync(apps, 0o555);
    fileHits = 0;
    try {
      const r = deps(i);
      await until(() => r.notes.length > 0);
      r.u.stop();
      expect(r.notes[0]).toBe(
        "新しい版（0.260928.1535）があります。この場所には書けないので、Kaname の画面から入れ直してください",
      );
      expect(fileHits).toBe(0);
      expect(r.quits()).toBe(0);
    } finally {
      chmodSync(apps, 0o755);
    }
  });
  it("BRG-06-017 起動時に無かった新しい版も、古いと言われたとき（checkNow）にすぐ見に行く", async () => {
    latest = { released: false };
    const i = installed();
    const r = deps(i);
    await r.u.checkNow();
    expect(r.quits()).toBe(0);
    release("0.260928.1536");
    await r.u.checkNow();
    await until(() => existsSync(i.relaunched));
    r.u.stop();
    expect(r.quits()).toBe(1);
    expect(readFileSync(join(i.app, "Contents", "mark.txt"), "utf8")).toBe("v0.260928.1536");
  });
});
