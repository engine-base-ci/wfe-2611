// K-765「前の道すじと /ai/chat の残りを消す」の口の側の試験（ファイルを読む・DB は要らない）。
//   契約の口へ移った Bridge の道すじ 3 本（/bridge/entries・/bridge/mirror-targets・/bridge/attachment）を前の道すじ（auth-ext）から外す。
//   移った先：会話の写し K-760（mirrorConversationEntries・listMirrorTargets）・仕事に付いたファイル K-761（getFileForBridge）。Bridge は K-760・K-761 が呼び先を替えた。
//   はじめの設定（面接・下書き）が使う /agent/say・/agent/state・/agent/stream は残す（この葉では消さない）。
//   前の /ai/chat は /ai/talk へ送るだけになった（K-762）ので、/ai/chat を指す字の残り 2 か所（探すの行き先・右パネルの既定）を /ai/talk にする（K765-API-004）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("K-765 前の道すじ", () => {
  it("K765-API-001 Bridge の前の道すじ 3 本を auth-ext から外した（agent.ts に /bridge/entries・/bridge/mirror-targets・/bridge/attachment の登録が無い）", () => {
    const src = read("apps/api/src/auth/agent.ts");
    for (const p of ["/bridge/entries", "/bridge/mirror-targets", "/bridge/attachment"])
      expect(src, p).not.toMatch(new RegExp(`app\\.(get|post|put|delete)\\("${p.replace(/\//g, "\\/")}"`));
  });
  it("K765-API-002 Bridge が前の道すじを呼んでいない（apps/bridge/src/loop.ts に 3 本の道すじの字が無い）", () => {
    const src = read("apps/bridge/src/loop.ts");
    for (const p of ["/bridge/entries", "/bridge/mirror-targets", "/bridge/attachment"])
      expect(src, p).not.toContain(`"${p}"`);
  });
  it("K765-API-003 はじめの設定が使う道すじは残す（ext.ts に /agent/say・/agent/state・agent-stream.ts に /agent/stream が在る）", () => {
    expect(read("apps/api/src/auth/ext.ts")).toContain('app.post("/agent/say"');
    expect(read("apps/api/src/auth/ext.ts")).toContain('app.get("/agent/state"');
    expect(read("apps/api/src/auth/agent-stream.ts")).toContain('app.get("/agent/stream"');
  });
  it("K765-API-004 前の /ai/chat を指す字が残らない（探すの会話の行き先 conversations.ts は /ai/talk?c=<id>・右パネルの「会話モードで開く」の既定 panel.tsx は /ai/talk）", () => {
    const search = read("apps/api/src/features/F7/search/conversations.ts");
    expect(search).not.toContain("/ai/chat");
    expect(search).toContain("url: `/ai/talk?c=${r.id}`");
    const panel = read("apps/web/components/ai/panel.tsx");
    expect(panel).not.toContain('"/ai/chat"');
    expect(panel).toContain('chatHref = "/ai/talk" as Route');
  });
});
