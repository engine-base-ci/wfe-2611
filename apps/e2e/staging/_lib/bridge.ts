// 組み立てた Bridge（apps/bridge/dist・K-97）を、staging の口に向けて回す（K-65・D-129.14・D-141.1）。
//   使う本物：接続コードの引き取り（dist/pairing.js の claimCode・名乗り BRIDGE_UA）・PC の輪（dist/loop.js の startLoop＝知らせ・取る・途中の様子・終わりを
//   本物の順と間合いで呼ぶ）・AI を起こす所（dist/runner.js）。AI だけ偽物（scripts/dev/fake-claude-demo.mjs）を差す。本人のサブスクは使わない。
//   窓（Electron）とこの PC の中だけの口（38617）は開かない：代表の Bridge に触らない。窓つき・包んだ形・本物の Claude Code は代表の 1 回（K-205）。
//   行き先は環境の値 STAGING_API_BASE（_lib/site.ts の API）。輪には引数 apiBase で渡す（KANAME_API_BASE は窓＝main.ts が読む名前で、輪は読まない）。
//   探したもの：apps/web/tests/_lib/agent-bridge.ts（輪を回すが、_lib/api.ts を読む＝手元の DB の管理者の接続と pg が要る・行き先は手元の API・
//   引き取りは前の道すじの口）・test-pc.ts（src を直に読む・輪を回さない・DB を読む）・f5-flow.ts の workOf（DB の道具と同じファイル）。staging では使えないので作った。
//   輪が起こす子（偽の AI）に渡る環境は、Bridge の許可リスト（apps/bridge/src/env.ts の childEnv）だけ：STAGING_ の名前の値は渡らない
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { API } from "./site";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DIST = join(ROOT, "apps/bridge/dist");
/** 決まった答えを返す偽の Claude Code。ふつうの仕事には「## 9 月の請求のまとめ」で始まる文を返す */
const FAKE_CLAUDE = join(ROOT, "scripts/dev/fake-claude-demo.mjs");
/** 偽の Claude Code がふつうの仕事に返す文の頭（承認待ちの帯に出る） */
export const FAKE_REPLY_HEAD = "9 月の請求のまとめ";
const TIMEOUT_MS = 30_000;

type ClaimReply = { ok: true; token: string } | { ok: false; message: string };
interface LoopState {
  alive: boolean;
  lastBeatAt: string | null;
  working: string | null;
  lastError: string | null;
}
interface Built {
  pairing: {
    BRIDGE_UA: string;
    claimCode: (apiBase: string, code: string, pc: { label: string; machineId: string }) => Promise<ClaimReply>;
  };
  loop: {
    BRIDGE_PROTOCOL: number;
    startLoop: (d: {
      apiBase: string;
      sessionId: () => string | null;
      health: () => Promise<unknown>;
      onChange: (s: LoopState) => void;
      onGone: () => void;
      loginCheckHeadless?: boolean;
      loginCheckAnswerWaitMs?: number;
    }) => () => void;
  };
  runner: { forgetClaude: () => void };
}
/** 組み立てた物を読む。無ければ止める（飛ばさない：統合テストの回は、この前の段で組み立てて確かめている・K-97） */
function built(): Built {
  if (!existsSync(join(DIST, "loop.js")))
    throw new Error(
      "組み立てた Bridge（apps/bridge/dist/loop.js）が無い。先に pnpm --filter @kaname/bridge build（K-97）",
    );
  const from = createRequire(join(DIST, "loop.js"));
  return {
    pairing: from("./pairing.js") as Built["pairing"],
    loop: from("./loop.js") as Built["loop"],
    runner: from("./runner.js") as Built["runner"],
  };
}

/** 契約の口 takeBridgeJob の job（見る所だけ） */
export interface Job {
  job_id: string;
  kind: string;
  ticket_id: string | null;
  phase: string | null;
}
export interface StagingPc {
  label: string;
  /** つながったか（PC の印を持っているか）。印そのものは外に出さない */
  connected: () => boolean;
  /** 画面に出たコードを引き取る（本物の Bridge の claimCode）。通ったかと、通らなかったときの文 */
  claim: (code: string) => Promise<{ ok: boolean; message: string | null }>;
  /** 生きている知らせを 1 回（輪の知らせと同じ形）。口の番号を返す */
  beat: () => Promise<number>;
  /** 仕事を 1 回取りに行く（待ち受けなし・輪を回していない PC だけが使う）。口の番号と、取れた仕事（無ければ null） */
  take: () => Promise<{ status: number; job: Job | null }>;
  /** 仕事を終える（輪を回していない PC だけが使う）。口の番号と outcome */
  finish: (jobId: string, result: string) => Promise<{ status: number; outcome: string | null }>;
  /** 輪を回し始める（知らせ・取る・偽の AI を動かす・終わりを返す、を輪が自分でする） */
  startLoop: () => void;
  /** 輪の最後の様子（落ちたときの手がかり。住所は伏せてから記録に書く） */
  loopState: () => string;
  /** PC を閉じる（輪を止める） */
  close: () => void;
}

/** staging につなぐ PC を 1 台（まだつながっていない）。筋の終わりに close() する */
export function stagingPc(label: string): StagingPc {
  const b = built();
  const machineId = randomUUID();
  let token: string | null = null;
  let stop: (() => void) | null = null;
  let last: LoopState | null = null;
  let gone = false;
  const call = async (path: string, body: unknown, extra: Record<string, string> = {}) => {
    if (!token) throw new Error("まだつながっていない PC は口を呼ばない");
    let res: Response;
    try {
      res = await fetch(`${API}/api/v1/bridge${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bridge-session": token,
          "user-agent": b.pairing.BRIDGE_UA,
          ...extra,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Error(`PC の口（${path.replace(/[0-9a-f-]{36}/, "<id>")}）に届かない`);
    }
    const j = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> };
    return { status: res.status, data: j.data ?? null };
  };
  return {
    label,
    connected: () => token !== null,
    claim: async (code) => {
      const r = await b.pairing.claimCode(API, code, { label, machineId });
      if (r.ok) token = r.token;
      return { ok: r.ok, message: r.ok ? null : r.message };
    },
    beat: async () => (await call("/heartbeat", { health: [], protocol: b.loop.BRIDGE_PROTOCOL })).status,
    take: async () => {
      if (stop) throw new Error("輪を回している PC では、試験が仕事を取らない（輪と取り合う）");
      const r = await call("/jobs/take", { wait_sec: 0, protocol: b.loop.BRIDGE_PROTOCOL, idle: false });
      return { status: r.status, job: (r.data?.["job"] as Job | null | undefined) ?? null };
    },
    finish: async (jobId, result) => {
      if (stop) throw new Error("輪を回している PC では、試験が仕事を終えない");
      const r = await call(
        `/jobs/${encodeURIComponent(jobId)}/finish`,
        { state: "done", result, agent_session_id: randomUUID() },
        { "idempotency-key": `k65-${jobId}-done` },
      );
      return { status: r.status, outcome: (r.data?.["outcome"] as string | undefined) ?? null };
    },
    startLoop: () => {
      if (!token) throw new Error("まだつながっていない PC は輪を回さない");
      if (stop) return;
      // AI は偽物を差す（輪が読む名前・apps/bridge/src/env.ts の BRIDGE_ENV_KEYS）。前に見つけた置き場は忘れさせる
      process.env["KANAME_CLAUDE_BIN"] = FAKE_CLAUDE;
      b.runner.forgetClaude();
      stop = b.loop.startLoop({
        apiBase: API,
        sessionId: () => token,
        health: async () => [],
        onChange: (s) => {
          last = s;
        },
        onGone: () => {
          gone = true;
        },
        loginCheckHeadless: true,
        loginCheckAnswerWaitMs: 20_000,
      });
    },
    loopState: () =>
      `回している=${stop !== null} 生きている=${last?.alive ?? "?"} 動かしている仕事=${last?.working ? "有り" : "無し"} 印が切れた=${gone} 最後の誤り=${last?.lastError ?? "無し"}`,
    close: () => {
      stop?.();
      stop = null;
    },
  };
}
