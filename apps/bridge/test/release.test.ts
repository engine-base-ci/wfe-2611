// 配布のコマンド（scripts/release.mjs・D-109.1）が置いた目録が、置き場の実物と合っていること。
//   目録の指紋と大きさを実物から数え直す（目録が無い環境＝まだ配布していないなら飛ばす）
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REL = join(__dirname, "..", "release");
const MANIFEST = join(REL, "kaname-bridge.json");

describe.runIf(existsSync(MANIFEST))("BRG-06-015 配布のコマンドが書いた目録", () => {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    version: string;
    files: { platform: string; arch: string; kind: string; name: string; sha256: string; size: number }[];
  };
  it("版は日時から付いた 0.YYMMDD.HHMM で、0.1.0 より新しい", () => {
    expect(m.version).toMatch(/^0\.\d{6}\.\d{1,4}$/);
  });
  it("入れ替え用の中身（zip）と人が受け取るもの（dmg）が同じ版で載り、指紋と大きさが実物と合う", () => {
    const kinds = new Set(m.files.map((f) => `${f.platform}/${f.kind}`));
    expect(kinds.has("mac/app")).toBe(true);
    expect(kinds.has("mac/installer")).toBe(true);
    for (const f of m.files) {
      expect(f.name).toContain(m.version);
      const p = join(REL, f.name);
      expect(statSync(p).size, f.name).toBe(f.size);
      expect(createHash("sha256").update(readFileSync(p)).digest("hex"), f.name).toBe(f.sha256);
    }
  });
  it("zip の中の Bridge は目録と同じ版（配る前に版がずれていない）", async () => {
    const { spawnSync } = await import("node:child_process");
    const zip = m.files.find((f) => f.platform === "mac" && f.kind === "app")!;
    const r = spawnSync("/usr/bin/unzip", ["-p", join(REL, zip.name), "Kaname Bridge.app/Contents/Info.plist"], { maxBuffer: 1 << 20 });
    expect(r.stdout.toString()).toContain(`<string>${m.version}</string>`);
  });
});
