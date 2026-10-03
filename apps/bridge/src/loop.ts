// Kaname と話す輪（T-B-03・D-090）。
//   生きていると知らせる（最後の応答を本当に動かす）／仕事を取りに行く／結末を返す
// 鍵は claim のときに受け取った bridge の session id。ログインの情報は持たない。
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { readGuardLog, writeHook } from "./guard";
import { writeMcpServer, type KanameTools } from "./kaname-tools";
import { dedicatedBrowser } from "./browser";
import { aiEntries, joinResponse, sessionFile, sizeOf } from "./transcript";
import { runClaude, stopCurrent, type Answer, type Finish, type Guard, type Job } from "./runner";
import { runLoginCheck } from "./login-check";
import { label, phaseText, type Entry } from "./stream";

const ANSWER_POLL_MS = 1_500;
const ANSWER_WAIT_MS = 30 * 60_000; // 確認に 30 分答えが無ければ許可しない（勝手に許可しない・止まったことは理由に出す）
/** 確認に答えが無いまま時間がたったときに会話へ残す 1 行（E-GATE-010 の文言と次の一手）。前は Bridge の中で黙って断り、画面に何も出なかった（2026-10-01） */
export const ASK_TIMEOUT_NOTICE =
  "本人が許可しませんでした（確認に答えが無いまま時間がたったので、実行していません）。続けるときは、会話で「続けて」と書いて送り、次の問いで答えてください";
/** 動いている間、止める／止めずに直すの合図を見に行く間（D-104.9） */
const CONTROL_POLL_MS = 1_500;
/** 書きながらの返事を送る間（D-104.8）。1 文字ごとには送らない */
const PARTIAL_MS = 400;
/** Kaname と話す約束の版。問い合わせの答え・止めずに直す・禁止の関門など、やりとりの形を変えたら上げる。
 *  API はこれより古い Bridge に仕事を渡さない（古い版が答えを落としていた・2026-09-28） */
export const BRIDGE_PROTOCOL = 4;
/** ブラウザを使えなかったときに会話へ残す 1 行（D-119）。何をすれば直るかまで書く */
export const BROWSER_OFF_NOTICE = {
  chrome:
    "AI が Chrome を使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていてこの Claude と同じアカウントでログインしているか確かめてください。ブラウザを使わない作業はそのまま続けます",
  dedicated:
    "AI が Bridge 専用のブラウザを開けませんでした。この PC に Chrome が入っているか確かめてください。Bridge の窓の「AI が使うブラウザ」で自分の Chrome に切り替えることもできます。ブラウザを使わない作業はそのまま続けます",
} as const;
/** 禁止の宛先を止めた記録を読みに行く間（D-107.4） */
const GUARD_POLL_MS = 500;
/** 付けた資料の上限（1 件）。これより大きいものは取りに行かない */
const ATTACH_MAX = 25 * 1024 * 1024;
/** フックの置き場（中身が同じなら書き直さない）と、この仕事の止めた記録の場所（D-107.3） */
function prepareGuard(jobId: string): Guard {
  const dir = join(tmpdir(), "kaname-guard");
  mkdirSync(dir, { recursive: true });
  return { hookPath: writeHook(dir), log: join(dir, `${jobId}.log`), nodeBin: process.execPath };
}

/** Kaname の道具のサーバーの置き場（D-110）。中身が同じなら書き直さない */
function prepareTools(apiBase: string): KanameTools {
  const dir = join(tmpdir(), "kaname-tools");
  mkdirSync(dir, { recursive: true });
  return { serverPath: writeMcpServer(dir), nodeBin: process.execPath, apiBase };
}

export interface LoopDeps {
  apiBase: string;
  sessionId: () => string | null;
  health: () => Promise<unknown>;
  onChange: (s: LoopState) => void;
  /** この端末の鍵が通らなくなったとき（退会・停止・接続を外した・つなぎ直し）。覚えている鍵を捨てる */
  onGone: () => void;
  /** Kaname に「この Bridge は古い」と言われたとき（新しい版をすぐ見に行く・D-109.3） */
  onOutdated?: () => void;
  /** この PC で AI が使うブラウザ（D-119.2・本人が Bridge の窓で選ぶ）。無ければ使わない */
  browser?: () => Browser;
  /** 消えない置き場（専用のブラウザのログインの状態を持つ）。無ければ tmp */
  dataDir?: string;
  /** Kaname に知らされた、この端末で AI が使うブラウザ（D-120.1）。窓に同じ値を出す */
  onBrowser?: (b: Browser) => void;
  /** 試験だけ：1 回のログインを画面に出さずに動かす（本人の PC では出す・D-119.6） */
  loginCheckHeadless?: boolean;
  /** 試験だけ：2 段階のコード・承認の返事を待つ上限（本人の PC では 10 分・D-117.5） */
  loginCheckAnswerWaitMs?: number;
}
export type Browser = "chrome" | "dedicated" | "off";

/** 仕事に渡すブラウザ（D-119）。Kaname が決めていればそれ。会話の無い仕事（記憶のまとめ）は使わない */
export function browserFor(job: Pick<Job, "browser" | "conversation_id">, chosen: Browser | undefined): Browser {
  if (job.browser) return job.browser;
  return job.conversation_id ? (chosen ?? "off") : "off";
}
export interface LoopState {
  alive: boolean;
  lastBeatAt: string | null;
  working: string | null; // いま動かしている仕事の id
  lastError: string | null;
}

/** 生きている知らせ（自己診断の報告つき）。仕事の問い合わせ自体も「生きている」を兼ねるので間は長めでよい（D-097） */
const HEARTBEAT_MS = 60_000;
/** 仕事が動いている最中、Kaname に待ち受けてもらう長さ。入ったらすぐ返ってくる（D-097） */
const TAKE_WAIT_SEC = 20;
/** Kaname に届かないとき・鍵が無いときに次に試すまで */
const RETRY_MS = 5_000;

export function startLoop(d: LoopDeps): () => void {
  const state: LoopState = { alive: false, lastBeatAt: null, working: null, lastError: null };
  let stopped = false;
  // 止めたら待ち受け中の問い合わせも切る（つなぎ直した後に古い輪が仕事を取らない）
  const abort = new AbortController();
  const call = async <T>(path: string, body: unknown): Promise<{ data: T; next_ms?: number } | null> => {
    const sid = d.sessionId();
    if (!sid || stopped) return null;
    try {
      const r = await fetch(`${d.apiBase}/api/auth-ext${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-bridge-session": sid },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (!r.ok) {
        // 鍵が通らない＝この端末はもう登録されていない（退会・停止・権限変更・つなぎ直し・接続を外した）。
        // 覚えたままにすると「つながっています」と言い続ける（G-14 口座状態の波及）
        const gone = [401, 403, 410].includes(r.status); // 404 は「その仕事が無い」であって鍵の話ではない
        state.lastError = gone ? "この端末の接続は切れています。つなぎ直してください" : `Kaname が ${r.status}`;
        state.alive = false;
        if (gone) d.onGone();
        d.onChange({ ...state });
        return null;
      }
      state.lastError = null;
      return (await r.json()) as { data: T; next_ms?: number };
    } catch (e) {
      if (stopped) return null;
      state.lastError = `Kaname に届きません（${e instanceof Error ? e.message : "不明"}）`;
      state.alive = false;
      d.onChange({ ...state });
      return null;
    }
  };
  const post = async <T>(path: string, body: unknown): Promise<T | null> => (await call<T>(path, body))?.data ?? null;
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // 生きている知らせは 1 本ずつ、出した順に送る。追い越すと古い自己診断が新しいものを上書きする
  // （起動直後の 1 回目が遅れて、仕事の後に送った「Chrome とつながっていない」を消していた・2026-09-30 実例）
  let beating: Promise<void> = Promise.resolve();
  const beat = (): Promise<void> => (beating = beating.then(beatOnce, beatOnce));
  const beatOnce = async (): Promise<void> => {
    const ok = await post<{ ok: boolean; browser?: Browser | null }>("/bridge/heartbeat", {
      health: await d.health(),
      protocol: BRIDGE_PROTOCOL,
    });
    // Kaname が正本の選択（D-120.1）を窓に写す
    if (ok?.browser) d.onBrowser?.(ok.browser);
    if (ok) {
      state.alive = true;
      state.lastBeatAt = new Date().toISOString();
      d.onChange({ ...state });
    }
  };

  const alive = (): void => {
    state.alive = true;
    state.lastBeatAt = new Date().toISOString();
    d.onChange({ ...state });
  };

  /** 仕事を取りに行く（1 回）。取れたら動かして結末を返す。次に聞くまでの間を返す */
  const tick = async (): Promise<number> => {
    // 取りに行く＝この PC はいま何も動かしていない（1 件ずつ順に動かす）。残った仕事の後始末を Kaname に頼む
    const r = await call<Job | null>("/bridge/take", {
      wait_sec: TAKE_WAIT_SEC,
      protocol: BRIDGE_PROTOCOL,
      idle: true,
    });
    if (!r) return RETRY_MS;
    if ((r as { outdated?: boolean }).outdated) d.onOutdated?.();
    alive(); // 問い合わせが通った＝生きている（Kaname 側も同じ 1 回で知らせを受けている）
    const job = r.data;
    if (!job) return typeof r.next_ms === "number" && r.next_ms >= 0 ? r.next_ms : RETRY_MS;
    state.working = job.job_id;
    d.onChange({ ...state });
    // 預けたログイン情報で 1 回だけ入ってみる仕事（D-117.1）：AI は起こさない。鍵は受け取り口の中だけ。結果は種類と理由だけを返す
    if (job.kind === "login_check" && job.credential_id) {
      const r = await runLoginCheck(
        {
          apiBase: d.apiBase,
          sessionId: d.sessionId,
          dataDir: d.dataDir ?? join(tmpdir(), "kaname-bridge"),
          ...(d.loginCheckHeadless ? { headless: true } : {}),
          ...(d.loginCheckAnswerWaitMs ? { answerWaitMs: d.loginCheckAnswerWaitMs, pollMs: 1_000 } : {}),
        },
        job.job_id,
        job.credential_id,
      );
      await post("/bridge/credentials/check-result", { job_id: job.job_id, state: r.state, detail: r.detail });
      state.working = null;
      d.onChange({ ...state });
      return 0;
    }
    let seq = 0;
    // 途中経過は仕事を待たせずに、出た順に 1 本ずつ送る（追い越すと古い使用量が新しいものを上書きする）。
    // 結末の前には必ず届け終える（後から届くと仕事が閉じていて捨てられる）
    let sent: Promise<unknown> = Promise.resolve();
    const progress = (kind: string, body: Record<string, unknown>): void => {
      const n = ++seq;
      sent = sent
        .then(() => post("/bridge/progress", { job_id: job.job_id, seq: n, kind, ...body }))
        .catch(() => undefined);
    };
    // 自分のAI の文を記録と同じ id で写す（D-112）。途中経過と同じ列で、結末より先に届ける
    // 同じ返答の文は 1 つの吹き出しに（D-115）。この仕事の中で返答ごとに覚えておく
    const responses = new Map<string, Entry>();
    const entry = (uuid: string, text: string): void => {
      if (!job.conversation_id) return;
      sent = sent
        .then(() =>
          post("/bridge/entries", {
            conversation_id: job.conversation_id,
            job_id: job.job_id,
            entries: [{ uuid, text, at: new Date().toISOString() }],
          }),
        )
        .catch(() => undefined);
    };
    // 付けた資料（D-104.11）：署名 URL で取りに行き、この仕事だけの置き場に置いて、場所を文に添える
    const { dir, lines: attached } = await fetchAttachments(job);
    const prompt = attached.length
      ? `${job.prompt}\n\n付けた資料（このPCに置きました）:\n${attached.map((l) => `- ${l}`).join("\n")}`
      : job.prompt;
    // 書きながらの返事は間引いて送る（最後の 1 回は必ず送る）
    let lastPartial = "";
    let lastPhase = "";
    let sentPartial = "";
    let partialTimer: ReturnType<typeof setTimeout> | null = null;
    const flushPartial = (): void => {
      partialTimer = null;
      if (lastPartial === sentPartial) return;
      sentPartial = lastPartial;
      void post("/bridge/partial", { job_id: job.job_id, text: lastPartial });
    };
    // 止める／止めずに直すの合図を見に行く（D-104.9）
    let controlling = true;
    const control = (async () => {
      while (controlling && !stopped) {
        await sleep(CONTROL_POLL_MS);
        if (!controlling) break;
        const c = await post<{ stop: boolean }>("/bridge/control", { job_id: job.job_id });
        if (!c) continue;
        if (c.stop) {
          stopCurrent("あなたが止めました");
          break;
        }
      }
    })();
    // 台帳で禁止・銀行の宛先は、全部許可でも PC の上で止める（D-107.2・D-107.3）。止めたらフックが書き残した行を読んで知らせる（D-107.4）
    const guard = job.blocked?.length ? prepareGuard(job.job_id) : null;
    let guardPos = 0;
    const readGuard = (): void => {
      if (!guard) return;
      const r = readGuardLog(guard.log, guardPos);
      guardPos = r.next;
      for (const h of r.hits) {
        progress("blocked", { blocked: h });
        progress("status", {
          text: `${h.service}（${h.domain}）は規約で自動操作が禁止のため止めました。正規の連携か、手で操作してください`,
        }); // E-GATE-011
        progress("tool", {
          tool: { name: h.tool, target: `${h.domain}（規約で禁止のため止めました）`, ok: false, ms: 0 },
        });
      }
    };
    const guardTimer = guard ? setInterval(readGuard, GUARD_POLL_MS) : null;
    // AI が使うブラウザ（D-119）。専用のブラウザはログインの状態を Bridge の置き場に持ち続ける（tmp に置かない）
    const browser = browserFor(job, d.browser?.());
    let browserWasOff = false; // 使えなかったか（知らせは 1 回）
    const dedicated =
      browser === "dedicated" ? dedicatedBrowser(d.dataDir ?? join(tmpdir(), "kaname-bridge"), process.execPath) : null;
    const f: Finish = await runClaude(
      { ...job, prompt, browser },
      {
        // 途中経過と会話の id を Kaname に流す（D-093.4・D-093.7・D-104.8）。届かなくても仕事は続ける
        onEvent: (e) => {
          if (e.type === "init") progress("init", { agent_session_id: e.session, model: e.model });
          else if (e.type === "limit") progress("limit", { windows: e.windows });
          else if (e.type === "progress") {
            if (e.todos) progress("plan", { todos: e.todos });
            const last = e.tools[e.tools.length - 1];
            if (last)
              progress("status", { text: last.target ? `${label(last.name)}：${last.target}` : label(last.name) });
          }
        },
        onPartial: (text) => {
          lastPartial = text;
          partialTimer ??= setTimeout(flushPartial, PARTIAL_MS);
        },
        // 文が 1 つ出た：記録と同じ id で写し、書きかけは消す（写した文と書きかけを 2 回出さない）
        onEntry: (e) => {
          if (partialTimer) clearTimeout(partialTimer);
          partialTimer = null;
          lastPartial = "";
          flushPartial();
          const joined = joinResponse(responses, e);
          entry(joined.uuid, joined.text);
        },
        // いま何をしているか（考えている・道具を準備している・返事を書き始めた）。書きかけの前の返事は消す
        // （消さないと、問い合わせの後も前の書きかけのまま「書いています」に見える・2026-09-28 実例）
        onPhase: (phase, tool) => {
          if (phase !== "writing" && (lastPartial || sentPartial)) {
            if (partialTimer) clearTimeout(partialTimer);
            partialTimer = null;
            lastPartial = "";
            flushPartial();
          }
          const text = phaseText(phase, tool);
          if (text !== lastPhase) {
            lastPhase = text;
            progress("status", { text });
          }
        },
        onReply: (text) => {
          if (partialTimer) clearTimeout(partialTimer);
          partialTimer = null;
          lastPartial = sentPartial = "";
          progress("reply", { text });
        },
        // 区切りで順番待ちの一言を取りに行く（D-104.9）。取った時点で本人の吹き出しになる
        takeSteers: async (reply) => {
          await sent; // 写した文（entries）が先に届いてから区切りを渡す（順番が入れ替わらない・D-112）
          const r = await post<{ steers: { text: string }[] }>("/bridge/steers", { job_id: job.job_id, reply });
          const texts = (r?.steers ?? []).map((s) => s.text);
          if (texts.length) {
            // 答えは吹き出しになった。書きかけの表示は次の答えの分から
            lastPartial = sentPartial = "";
          }
          return texts;
        },
        // 道具の呼び出しの記録（D-100.2）。名前・対象・成否・時間だけ。中身は送らない
        onTool: (tl) => progress("tool", { tool: tl }),
        // AI が Chrome を使えない（拡張機能が無い・Chrome が閉じている・切れた）。会話に 1 行残す（黙って終わらない・D-119）
        onBrowserOff: (which) => {
          browserWasOff = true;
          progress("notice", { text: BROWSER_OFF_NOTICE[which] });
        },
        // 確認・問い合わせは画面に出して、本人の答えを待つ（D-093.3・D-104.5・D-104.14）。答えが無ければ許可しない
        ask: async (q) => {
          // 会話の無い仕事（記憶のまとめ）は答える画面が無い。道具は使わずに答えてもらう
          if (!job.conversation_id) return { allow: false, note: "この仕事では道具を使わず、文だけで答えてください" };
          const asked = await post<{ ok: boolean }>("/bridge/ask", {
            job_id: job.job_id,
            request_id: q.requestId,
            tool: q.tool,
            input: q.input,
            summary: q.summary,
          });
          if (!asked) return { allow: false };
          const until = Date.now() + ANSWER_WAIT_MS;
          while (Date.now() < until && !stopped) {
            const r = await post<{ answer: { allow?: unknown; note?: unknown; answers?: unknown } | null }>(
              "/bridge/answer2",
              { job_id: job.job_id, request_id: q.requestId },
            );
            if (r?.answer) return toAnswer(r.answer);
            await sleep(ANSWER_POLL_MS);
          }
          if (!stopped) progress("notice", { text: ASK_TIMEOUT_NOTICE });
          return { allow: false, note: "30 分答えが無かったので許可しませんでした" };
        },
      },
      undefined,
      dir ? [dir] : [],
      guard,
      job.tool_token ? prepareTools(d.apiBase) : null,
      dedicated,
    );
    if (guardTimer) clearInterval(guardTimer);
    readGuard();
    if (guard) {
      rmSync(guard.log, { force: true });
      rmSync(`${guard.log}.pages`, { force: true }); // 開いていたページ（D-119.5）はこの仕事の間だけ
    }
    controlling = false;
    if (partialTimer) clearTimeout(partialTimer);
    await control;
    if (dir) rmSync(dir, { recursive: true, force: true });
    await sent;
    // 使った量（D-100.1）は結末より先に届ける（結末の後は仕事が閉じて受け取られない）
    if (f.usage) await post("/bridge/progress", { job_id: job.job_id, seq: ++seq, kind: "usage", usage: f.usage });
    await post("/bridge/finish", {
      job_id: job.job_id,
      state: f.state,
      ...(f.state === "done" ? { result: f.result } : { reason: f.reason }),
      agent_session_id: f.agent_session_id,
    });
    state.working = null;
    d.onChange({ ...state });
    // ブラウザを使った仕事の後は、自己診断をすぐ送り直す（つながった・切れた を 60 秒待たせない・D-119.4・D-120.3）
    if (browser !== "off" || browserWasOff) void beat();
    void mirror(); // 写し漏れを記録から取り戻す（流れながら送れなかった文）
    return 0; // 終わったらすぐ次を聞く（続けて言われていることが多い）
  };

  /** 本人の PC の Claude Code の記録から、写し漏れた自分のAI の文を Kaname に入れる（D-112）。
   *  同じ id は Kaname が二度入れない。ファイルの大きさが前と同じなら読まない */
  const seenSize = new Map<string, number>();
  let mirroring: Promise<void> | null = null;
  const mirror = (): Promise<void> => {
    mirroring ??= (async () => {
      try {
        // 外から来た値なので配列でなければ何もしない（古い API・試験の偽の API は {} を返す）
        const got = await post<{ conversation_id: string; agent_session_id: string }[]>("/bridge/mirror-targets", {});
        const targets = Array.isArray(got) ? got : [];
        for (const t of targets) {
          if (stopped) return;
          const file = sessionFile(t.agent_session_id);
          if (!file) continue; // 別の PC の記録・消された記録
          const size = sizeOf(file);
          const key = `${t.conversation_id}:${t.agent_session_id}`;
          if (seenSize.get(key) === size) continue;
          const list = aiEntries(file);
          let ok = true;
          for (let i = 0; i < list.length; i += 200) {
            const r = await post("/bridge/entries", {
              conversation_id: t.conversation_id,
              entries: list.slice(i, i + 200),
            });
            if (r === null) ok = false;
          }
          if (ok) seenSize.set(key, size);
        }
      } finally {
        mirroring = null;
      }
    })();
    return mirroring;
  };

  /** 付けた資料を取りに行く。取れなかったものは名前と理由を文に添える（黙って落とさない） */
  const fetchAttachments = async (job: Job): Promise<{ dir: string | null; lines: string[] }> => {
    const list = job.attachments ?? [];
    if (!list.length) return { dir: null, lines: [] };
    const dir = join(tmpdir(), `kaname-${job.job_id}`);
    mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    for (const a of list) {
      const s = await post<{ url: string; name: string }>("/bridge/attachment", {
        job_id: job.job_id,
        attachment_id: a.id,
      });
      if (!s) {
        lines.push(`${a.name}（取りに行けませんでした）`);
        continue;
      }
      try {
        if (a.size > ATTACH_MAX) throw new Error("大きすぎます");
        const r = await fetch(s.url, { signal: abort.signal });
        if (!r.ok) throw new Error(`${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        // 名前は置き場の外に出られないように、ファイル名の部分だけにする
        // eslint-disable-next-line no-control-regex -- 制御文字をファイル名から外すための正規表現
        const safe = basename(s.name || a.name).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_") || a.id;
        const path = join(dir, `${a.id.slice(0, 8)}-${safe}`);
        writeFileSync(path, buf);
        lines.push(path);
      } catch (e) {
        lines.push(`${a.name}（取りに行けませんでした：${e instanceof Error ? e.message : "不明"}）`);
      }
    }
    return { dir, lines };
  };

  const run = async (): Promise<void> => {
    while (!stopped) {
      const wait = await tick();
      if (wait > 0 && !stopped) await sleep(wait);
    }
  };

  void beat();
  const h = setInterval(() => void beat(), HEARTBEAT_MS);
  void mirror(); // つながったら、まず記録から取り戻す
  void run();
  return () => {
    stopped = true;
    abort.abort();
    clearInterval(h);
  };
}

/** 画面の答えを CLI に返す形に。知らない形は「許可しない」 */
export function toAnswer(a: { allow?: unknown; note?: unknown; answers?: unknown }): Answer {
  const answers =
    a.answers && typeof a.answers === "object" && !Array.isArray(a.answers)
      ? Object.fromEntries(
          Object.entries(a.answers as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, String(v)]),
        )
      : null;
  return {
    allow: a.allow === true,
    note: typeof a.note === "string" && a.note.trim() ? a.note.trim() : null,
    answers: answers && Object.keys(answers).length ? answers : null,
  };
}
