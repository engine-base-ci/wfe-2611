// 画面のテストで、本物の Bridge の輪（apps/bridge の loop）を動かす。CLI だけ偽物（scripts/dev/fake-claude-demo.mjs）に差す。
// 本人のサブスクは使わない。画面 → API → Bridge → CLI → API → 画面 を全部通す（L-003：描画は動作ではない）
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API, claimBridge } from "./api";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export interface AgentBridge {
  sid: string;
  stop: () => void;
}
/** この人の PC をつないだことにして、Bridge の輪を回し始める。stop() で止める（PC を閉じた）
 *  browser を渡すと、Bridge の窓でそのブラウザを選んだことにする（D-119.2）。自己診断は本物の判定（browser.ts）で返す */
export async function startAgentBridge(
  token: string,
  opts: { browser?: "chrome" | "dedicated" | "off" } = {},
): Promise<AgentBridge> {
  process.env["KANAME_CLAUDE_BIN"] = join(ROOT, "scripts/dev/fake-claude-demo.mjs");
  // Bridge の輪（loop.js）と同じ場所から読む。試験の側から別に読むと、Playwright では runner が 2 つになり、
  // 輪が覚えた Chrome のつながりを試験の側が読めない（2026-09-30 実例）
  const fromLoop = createRequire(join(ROOT, "apps/bridge/dist/loop.js"));
  const runner = fromLoop("./runner.js") as {
    forgetClaude: () => void;
    forgetChromeState: () => void;
    chromeState: () => { status: string; at: number } | null;
  };
  runner.forgetClaude();
  runner.forgetChromeState();
  const { browserCheck } = fromLoop("./browser.js") as {
    browserCheck: (
      c: "chrome" | "dedicated" | "off",
      hasChrome: boolean,
      seen: { status: string; at: number } | null,
      hasPw: boolean,
    ) => unknown;
  };
  const { startLoop } = fromLoop("./loop.js") as {
    startLoop: (d: {
      apiBase: string;
      sessionId: () => string | null;
      health: () => Promise<unknown>;
      onChange: () => void;
      onGone: () => void;
      onBrowser?: (b: "chrome" | "dedicated" | "off") => void;
      loginCheckHeadless?: boolean;
      loginCheckAnswerWaitMs?: number;
    }) => () => void;
  };
  const sid = await claimBridge(token);
  // 使うブラウザは Kaname が正本（D-120.1）。browser を渡したら、その値を Kaname に選んでおき、自己診断も Kaname から届いた値で返す
  if (opts.browser) {
    const r = await fetch(`${API}/api/auth-ext/agent/browser`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ browser: opts.browser }),
    });
    if (!r.ok) throw new Error(`ブラウザを選べない: ${r.status}`);
  }
  let current = opts.browser ?? null;
  const stop = startLoop({
    apiBase: API,
    sessionId: () => sid,
    loginCheckHeadless: true, // 試験では Chrome の窓を出さない（T-B-38）
    loginCheckAnswerWaitMs: Number(process.env["KANAME_TEST_ANSWER_WAIT_MS"] ?? 20_000), // 試験では 10 分待たない（T-B-39）
    health: async () => (current ? [browserCheck(current, true, runner.chromeState(), true)] : []),
    onChange: () => undefined,
    onGone: () => undefined,
    onBrowser: (b) => {
      if (current) current = b;
    },
  });
  return { sid, stop };
}
