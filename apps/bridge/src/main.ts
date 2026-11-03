// Kaname Bridge ── 顧客 PC で動く実行器（D-015・D-055）。
// 作るのは 4 つだけ。AI そのものは作らない（本人のサブスクの Claude Code を起動する・D-047）:
//   1 つなぐ（接続コードを引き取って端末として登録）／2 受け取って返す（T-B-03）
//   3 見張る（bridge-guard・T-B-04）／4 鍵を解く（資格情報は参照 ID だけ受け取る・関門 C8・T-B-05）
// この版は 1 と 自己診断 まで。2〜4 は別チケット。
import { app, BrowserWindow, ipcMain, powerSaveBlocker, shell } from "electron";
import { createAwake } from "./awake";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { hostname } from "node:os";
import { startLocalServer } from "./local";
import { startLoop, type Browser, type LoopState } from "./loop";
import { stopCurrent, isRunning, findClaude, warmShellPath, chromeState } from "./runner";
import { brokenInstall, installClaude } from "./install-claude";
import { authStatus, cancelLogin, startLogin, submitCode } from "./login";
import { startUpdater, type Updater } from "./update";
import { browserCheck, findPlaywrightMcp } from "./browser";
import { version as VERSION } from "../package.json";

const run = promisify(execFile);
/** つなぎ先。既定はローカルの dev。配布版は環境変数か設定ファイルで差す */
const API_BASE = (process.env["KANAME_API_BASE"] ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const STATE_PATH = join(app.getPath("userData"), "bridge.json");
/** Kaname の画面。PC 版はこの窓に画面を出す（D-084.1）。段階 2 の本番の姿の最小形 */
const WEB_BASE = (process.env["KANAME_WEB_BASE"] ?? "http://127.0.0.1:3124").replace(/\/$/, "");

interface State {
  connected: boolean;
  deviceLabel: string;
  connectedAt?: string;
  /** claim で受け取った bridge の session。これを鍵に Kaname と話す（D-090） */
  sessionId?: string;
  /** AI が使うブラウザ（D-119.2）。既定は本人の Chrome（Claude in Chrome） */
  browser?: Browser;
}
const BROWSERS: readonly Browser[] = ["chrome", "dedicated", "off"];
let updater: Updater | null = null;
let loop: LoopState = { alive: false, lastBeatAt: null, working: null, lastError: null };
const readState = (): State => {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
  } catch {
    return { connected: false, deviceLabel: defaultLabel() };
  }
};
const writeState = (s: State): void => {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2), "utf8");
};
function defaultLabel(): string {
  const os = process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : process.platform;
  return `${hostname()}（${os}）`;
}

/** いま覚えている鍵が Kaname でまだ通るか（通れば、この PC は別のアカウントでつながったまま） */
async function stillConnected(sessionId: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/auth-ext/bridge/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": sessionId },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch {
    return false; // 確かめられないときは、つないでよい（Kaname に届かないならどのみち前の鍵は使えない）
  }
}

/** 1 つなぐ：接続コードを Kaname に渡して、この PC を端末として登録する。
 *  すでに別のアカウントでつながっている（前の鍵がまだ通る）なら、本人が「切り替える」を押したときだけつなぎ直す。
 *  黙って切り替えると、同じ PC のブラウザでログインした別のアカウントに Bridge が乗っ取られる（2026-09-28 実例） */
async function claim(
  code: string,
  allowSwitch = false,
): Promise<{ ok: true } | { ok: false; message: string; reason?: "other_account" }> {
  const st = readState();
  if (!allowSwitch && st.connected && st.sessionId && (await stillConnected(st.sessionId)))
    return {
      ok: false,
      reason: "other_account",
      message:
        "この PC の Bridge は、すでに別のアカウントでつながっています。このアカウントに切り替えるなら「このアカウントに切り替える」を押してください",
    };
  const res = await fetch(`${API_BASE}/api/auth-ext/bridge/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ code, device_label: st.deviceLabel }),
  }).catch((e: Error) => e);
  if (res instanceof Error) return { ok: false, message: `Kaname につながりません（${res.message}）` };
  const json = (await res.json().catch(() => ({}))) as { data?: { session_id?: string }; message?: string };
  if (!res.ok) return { ok: false, message: json.message ?? `うまくいきませんでした（${res.status}）` };
  writeState({
    ...st,
    connected: true,
    connectedAt: new Date().toISOString(),
    ...(json.data?.session_id ? { sessionId: json.data.session_id } : {}),
  });
  return { ok: true };
}

/** 自己診断：Bridge が仕事をできる状態かを自分で確かめて、結果を画面に返す（手順 4） */
interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** 直し方（人に見せるボタンの言葉が変わる）。install＝入れる／repair＝取り直す */
  fix?: "install" | "repair" | "login" | null;
}
/** ログインできているか。claude 自身に聞くので速く、本人のサブスクを消費しない */
async function loggedIn(bin: string): Promise<Check> {
  const name = "Claude Code にログインできている";
  if (!bin) return { name, ok: false, detail: "先に Claude Code を入れてください", fix: "install" };
  const st = await authStatus();
  return {
    name,
    ok: st.loggedIn,
    detail: st.loggedIn
      ? "できています"
      : "まだログインしていません。下の「ログインする」を押してください（ターミナルは開きません）",
    fix: st.loggedIn ? null : "login",
  };
}

async function selfCheck(): Promise<Check[]> {
  const out: Check[] = [];
  const which = async (cmd: string) => {
    try {
      const r = await run(process.platform === "win32" ? "where" : "which", [cmd]);
      return r.stdout.trim().split("\n")[0] ?? "";
    } catch {
      return "";
    }
  };
  // 「無い」と「入っているが壊れている」は直し方が違う。人に同じ文言を見せない。
  // 実例：npm の claude が 500 バイトのエラー用の紙だけ残り、本体が落ちてきていない（取り直しで直る）
  const claude = (await findClaude()) ?? "";
  const broken = claude ? null : await brokenInstall();
  out.push({
    name: "本人のサブスクの Claude Code がある",
    ok: !!claude,
    detail: claude
      ? claude
      : broken
        ? `入ってはいますが、本体が落ちてきていません（${broken.replace("/install.cjs", "")}）。下の「Claude Code を取り直す」で直ります`
        : "この PC にありません。下の「Claude Code を入れる」で入れられます（置き場が違うなら KANAME_CLAUDE_BIN で指せます）",
    fix: claude ? null : broken ? "repair" : "install",
  });
  out.push(await loggedIn(claude));
  const chrome =
    process.platform === "darwin"
      ? existsSync("/Applications/Google Chrome.app")
      : !!(await which("chrome")) || !!(await which("google-chrome"));
  out.push({
    name: "Chrome がある（本人のログイン済みプロファイルを使う）",
    ok: chrome,
    detail: chrome ? "あり" : "見つかりません",
  });
  out.push(browserCheck(readState().browser ?? "chrome", chrome, chromeState(), findPlaywrightMcp() !== null));
  out.push({ name: "Kaname につながる", ok: await reachable(), detail: API_BASE });
  out.push({
    name: "資格情報を直接読まない",
    ok: true,
    detail: "預かり先の参照 ID だけを受け取る（関門 C8・実装は T-B-05）",
  });
  return out;
}
async function reachable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 560,
    height: 880,
    minWidth: 480,
    minHeight: 560,
    title: "Kaname Bridge",
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} KanameBridge/${VERSION}`); // アプリの中だと画面が分かる印
  void win.loadFile(join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url); // 外は既定のブラウザで開く（窓の中で外部サイトを開かない）
    return { action: "deny" };
  });
}

/** Kaname の画面をこの窓で開く（D-084.1）。UA に印が付くので、画面は「アプリの中」と分かる */
function openKaname(): void {
  const win = new BrowserWindow({ width: 1280, height: 860, title: "Kaname" });
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} KanameBridge/${VERSION}`);
  void win.loadURL(`${WEB_BASE}/setup/bridge`);
}
ipcMain.handle("bridge:open-kaname", () => openKaname());
ipcMain.handle("bridge:state", () => ({ ...readState(), apiBase: API_BASE, loop, running: isRunning() }));
ipcMain.handle("bridge:stop", () => stopCurrent());
ipcMain.handle("bridge:claim", (_e, code: string) => claim(String(code ?? "")));
ipcMain.handle("bridge:check", () => selfCheck());
ipcMain.handle("bridge:set-browser", async (_e, b: string) => {
  if (!BROWSERS.includes(b as Browser)) return { ok: false };
  // Kaname が正本（D-120.1）。先に Kaname に送り、通ったら窓の値も変える。つながっていなければ変えない（どちらが本当か分からなくしない）
  const sid = readState().sessionId;
  if (!sid) return { ok: false, message: "Kaname につないでから選んでください" };
  try {
    const r = await fetch(`${API_BASE}/api/auth-ext/bridge/browser`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": sid },
      body: JSON.stringify({ browser: b }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, message: `Kaname に届きませんでした（${r.status}）` };
  } catch {
    return { ok: false, message: "Kaname に届きませんでした" };
  }
  writeState({ ...readState(), browser: b as Browser });
  return { ok: true };
});
ipcMain.handle("bridge:install-claude", () =>
  installClaude((st) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send("bridge:install-step", st);
  }),
);
ipcMain.handle("bridge:login-start", () => startLogin());
ipcMain.handle("bridge:login-code", (_e, code: string) => submitCode(code));
ipcMain.handle("bridge:login-cancel", () => {
  cancelLogin();
  return { ok: true };
});

// 画面のボタン 1 つで起こせるようにする（kaname-bridge://）。インストーラが OS に登録し、ここで受ける
const SCHEME = "kaname-bridge";
if (!app.requestSingleInstanceLock()) {
  app.quit(); // 2 つ目は立てない。1 つ目を前に出す
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    } else createWindow();
  });
  app.on("open-url", (e) => {
    e.preventDefault(); // macOS：画面から起こされた。もう動いているので、前に出すだけ
    const w = BrowserWindow.getAllWindows()[0];
    if (w) w.focus();
    else createWindow();
  });
}

/** PC を立ち上げたら Bridge も立ち上がる（D-015.8）。人に「開いてください」と言わないための本命 */
void warmShellPath(); // 本人のシェルの PATH を先に聞いておく（待たない）

function keepRunning(): void {
  if (!app.isPackaged) return; // 開発中は勝手に登録しない
  try {
    app.setAsDefaultProtocolClient(SCHEME);
    const s = app.getLoginItemSettings();
    if (!s.openAtLogin) app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  } catch {
    /* 登録できなくても本体は動く（画面から起こす道は残る） */
  }
}

void app.whenReady().then(() => {
  keepRunning();
  // この PC の中だけの口を開く。Kaname の画面はこれで「Bridge が入っている」を知る（D-089.8）
  startLocalServer({
    version: VERSION,
    deviceLabel: () => readState().deviceLabel,
    connected: () => readState().connected,
    claim,
    check: () => selfCheck(),
    // 入れるところまで Bridge がやる（D-091）。進み具合は窓にも流す
    installClaude: () =>
      installClaude((st) => {
        for (const w of BrowserWindow.getAllWindows()) w.webContents.send("bridge:install-step", st);
      }),
    loginStart: () => startLogin(),
    loginCode: (code: string) => submitCode(code),
    loginCancel: () => cancelLogin(),
  });
  // 仕事の間だけ OS に「寝ないで」を頼む（D-124.1）。画面は消えてよい・ふたを閉じたら従う・電源の設定は変えない
  const awake = createAwake(powerSaveBlocker);
  // 受け取って返す輪（T-B-03）。生存の知らせ・仕事の受け取り・結末の返送
  startLoop({
    apiBase: API_BASE,
    sessionId: () => readState().sessionId ?? null,
    onGone: () => {
      // 口座が消えた・停止された・つなぎ直された。覚えている鍵を捨てて、つなぎ直しを促す
      const st = readState();
      if (!st.connected && !st.sessionId) return;
      const rest = { ...st, connected: false };
      delete rest.sessionId; // 覚えている鍵を捨てる
      delete rest.connectedAt;
      writeState(rest);
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send("bridge:state", { connected: false });
    },
    health: async () => await selfCheck(),
    browser: () => readState().browser ?? "chrome",
    onBrowser: (b) => {
      if (readState().browser === b) return;
      writeState({ ...readState(), browser: b });
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send("bridge:browser", b);
    },
    dataDir: app.getPath("userData"),
    onOutdated: () => void updater?.checkNow(),
    onChange: (s) => {
      loop = s;
      awake(s.working); // 仕事の間だけ PC を寝かせない（D-124.1）。終わったら解く
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send("bridge:loop", s);
    },
  });
  createWindow();
  // 新しい版は自分で受け取り、指紋を確かめて、仕事をしていない間に入れ替える（顧客は何もしない・D-109）
  updater = startUpdater({
    apiBase: API_BASE,
    currentVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    isPackaged: app.isPackaged,
    dir: join(app.getPath("userData"), "updates"),
    isBusy: isRunning,
    onNote: (t) => {
      for (const w of BrowserWindow.getAllWindows())
        w.webContents.send("bridge:install-step", { text: t, state: "done" });
    },
    quit: () => app.quit(),
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
