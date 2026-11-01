// 手元で会話の画面を確かめるための Bridge（本物の輪＝apps/bridge の loop をそのまま使い、CLI だけ偽物に差す）。
//   node scripts/dev/fake-bridge.mjs <接続コード KNM-xxxx>
//   画面の「自分のPCをつなぐ」で出たコードを渡す。本人のサブスクは使わない
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
process.env["KANAME_CLAUDE_BIN"] = join(ROOT, "scripts/dev/fake-claude-demo.mjs");
const API = process.env["KANAME_API"] ?? "http://127.0.0.1:3011";
const code = process.argv[2];
if (!code) {
  console.error("接続コードを渡してください（node scripts/dev/fake-bridge.mjs KNM-1234）");
  process.exit(2);
}
const r = await fetch(`${API}/api/auth-ext/bridge/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, device_label: "手元の確かめ用（偽の Claude）" }) });
const j = await r.json();
if (!r.ok) {
  console.error("つなげませんでした", j);
  process.exit(1);
}
const sid = j.data.session_id;
console.log("つながりました", sid);
const { startLoop } = await import(join(ROOT, "apps/bridge/dist/loop.js"));
startLoop({
  apiBase: API,
  sessionId: () => sid,
  health: async () => [{ name: "偽の Claude", ok: true }],
  onChange: (s) => console.log(new Date().toISOString().slice(11, 19), s.working ? `動いている ${s.working}` : "待っている", s.lastError ?? ""),
  onGone: () => {
    console.log("鍵が通らなくなりました");
    process.exit(0);
  },
});
