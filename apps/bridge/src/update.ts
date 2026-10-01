// 自動更新（T-B-06・D-109）。署名が入るまでの間、Bridge が自分で新しい版を受け取って入れ替える。顧客は何もしない。
//   いつ見るか：起動時・1 時間ごと・Kaname に「この Bridge は古い」と言われたとき（checkNow）
//   受け取る：Kaname に聞いた場所から裏で受け取り、指紋（sha256）と大きさが目録と合うときだけ使う。合わなければ捨てる
//   入れ替える：仕事を動かしていない間だけ。mac は .app を丸ごと入れ替えて立ち上げ直す／win はインストーラを黙って走らせる
//   入れ替えられない（書けない場所・配布物でない起動）なら、入れ替えず「入れ直してください」と案内する
//   Apple の署名が入ったら electron-updater の正式な方式に戻す（D-109.7）
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { accessSync, constants, createWriteStream, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { ask } from "./proc";

export const BUNDLE_ID = "com.enginebase.kaname.bridge";
const HOUR_MS = 60 * 60_000;
const IDLE_POLL_MS = 5_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export interface UpdateInfo {
  version: string;
  name: string;
  url: string;
  sha256: string;
  size: number;
}

/** 版の番号を数として比べる（0.260928.1530 > 0.1.0）。a が新しければ true */
export function newer(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10));
  const pb = b.split(".").map((x) => Number.parseInt(x, 10));
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Kaname に聞く。新しい版が無い・配布していない・その OS の中身が無いなら null */
export async function fetchLatest(apiBase: string, os: "mac" | "win", arch: "arm64" | "x64", current: string): Promise<UpdateInfo | null> {
  const r = await fetch(`${apiBase}/api/auth-ext/bridge/latest?os=${os}&arch=${arch}`, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Kaname が ${r.status}`);
  const j = (await r.json()) as { data?: { released?: boolean; version?: string; update?: Omit<UpdateInfo, "version"> | null } };
  const d = j.data;
  if (!d?.released || !d.version || !d.update || !newer(d.version, current)) return null;
  const u = d.update;
  if (!/^[0-9a-f]{64}$/.test(u.sha256) || !Number.isInteger(u.size) || u.size <= 0 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(u.name)) return null;
  return { version: d.version, name: u.name, url: new URL(u.url, `${apiBase}/`).toString(), sha256: u.sha256, size: u.size };
}

/**
 * 受け取って指紋と大きさを確かめる。合えば置いた場所を返す。合わなければ消して投げる（中途半端なものを残さない）
 */
export async function download(u: UpdateInfo, dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, u.name);
  const part = `${dest}.part`;
  rmSync(part, { force: true });
  const r = await fetch(u.url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!r.ok || !r.body) throw new Error(`受け取れませんでした（${r.status}）`);
  const hash = createHash("sha256");
  let size = 0;
  const out = createWriteStream(part);
  try {
    for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > u.size) throw new Error("大きさが目録と合いません");
      hash.update(chunk);
      if (!out.write(chunk)) await new Promise<void>((res) => out.once("drain", () => res()));
    }
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
    if (size !== u.size) throw new Error("大きさが目録と合いません");
    if (hash.digest("hex") !== u.sha256) throw new Error("指紋が目録と合いません");
  } catch (e) {
    out.destroy();
    rmSync(part, { force: true });
    throw e;
  }
  renameSync(part, dest);
  return dest;
}

/** 動いている .app の場所（…/Kaname Bridge.app）。配布物でない起動（electron dist/main.js）なら null */
export function appBundleOf(execPath: string): string | null {
  const macos = dirname(execPath);
  const contents = dirname(macos);
  const bundle = dirname(contents);
  return basename(macos) === "MacOS" && basename(contents) === "Contents" && bundle.endsWith(".app") ? bundle : null;
}

/** その場所を丸ごと入れ替えられるか（親に書けて、中身にも書ける） */
export function canReplace(bundle: string): boolean {
  try {
    accessSync(dirname(bundle), constants.W_OK);
    accessSync(bundle, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** 受け取った zip を展開し、中の .app が Kaname Bridge のその版であることを確かめる。展開した .app の場所を返す */
export async function unpackMac(zip: string, version: string, into: string): Promise<string> {
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  const x = await ask("/usr/bin/ditto", ["-x", "-k", zip, into], { timeoutMs: 120_000 });
  if (x.code !== 0) throw new Error("受け取った中身を開けませんでした");
  const app = readdirSync(into).find((f) => f.endsWith(".app"));
  if (!app) throw new Error("受け取った中身に Bridge がありません");
  const path = join(into, app);
  const plist = join(path, "Contents", "Info.plist");
  const read = async (key: string) => (await ask("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist], { timeoutMs: 10_000 })).stdout.trim();
  if ((await read("CFBundleIdentifier")) !== BUNDLE_ID) throw new Error("受け取った中身が Kaname Bridge ではありません");
  if ((await read("CFBundleShortVersionString")) !== version) throw new Error("受け取った中身の版が目録と合いません");
  return path;
}

const q = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

/**
 * いまの Bridge が終わるのを待って .app を入れ替え、立ち上げ直す手順（sh）。
 * 入れ替えに失敗したら元に戻して元の版を立ち上げる（Bridge が無くなる状態を作らない）
 */
export function replaceScript(o: { pid: number; target: string; source: string; backup: string; relaunch: string[] }): string {
  const relaunch = o.relaunch.map(q).join(" ");
  return [
    "#!/bin/sh",
    `PID=${o.pid}; OLD=${q(o.target)}; NEW=${q(o.source)}; BAK=${q(o.backup)}`,
    // 終わるのを待つ（最大 60 秒。終わらなければ何もしない＝いまの版が動き続ける）。ゾンビは終わったものとみなす
    'alive() { kill -0 "$PID" 2>/dev/null && [ "$(ps -o stat= -p "$PID" 2>/dev/null | cut -c1)" != "Z" ]; }',
    'i=0; while alive; do sleep 0.2; i=$((i+1)); [ "$i" -gt 300 ] && exit 1; done',
    // 新しい版は先に元の版の隣（同じディスク）へ全部写し、写し終えてから名前の付け替え 2 回で入れ替える。
    // 写している途中で止まっても元の版は手つかず（欠けた .app を残さない）。付け替えに失敗したら退けた版を戻す
    'STAGE="$OLD.incoming"; rm -rf "$STAGE" "$BAK"',
    'if /usr/bin/ditto "$NEW" "$STAGE"; then',
    '  mv "$OLD" "$BAK" && mv "$STAGE" "$OLD" && rm -rf "$BAK" "$NEW"',
    '  [ -d "$OLD" ] || mv "$BAK" "$OLD"',
    'else rm -rf "$STAGE"; fi',
    relaunch,
    "",
  ].join("\n");
}

export interface UpdaterDeps {
  apiBase: string;
  currentVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  execPath: string;
  isPackaged: boolean;
  /** 受け取ったものを置く場所（userData の下） */
  dir: string;
  /** 仕事を動かしているか（動かしている間は入れ替えない） */
  isBusy: () => boolean;
  onNote: (text: string) => void;
  /** 入れ替えの手順を走らせたあと、自分を終える */
  quit: () => void;
  /** 入れ替えの後に立ち上げ直す手順（既定は open）。テストで差す */
  relaunch?: (bundle: string) => string[];
  /** 入れ替えを待つ相手の pid（既定は自分）。テストで差す */
  pid?: number;
}

export interface Updater {
  checkNow: () => Promise<void>;
  stop: () => void;
}

export function startUpdater(d: UpdaterDeps): Updater {
  const os = d.platform === "darwin" ? "mac" : d.platform === "win32" ? "win" : null;
  const arch = d.arch === "arm64" ? "arm64" : "x64";
  let checking: Promise<void> | null = null;
  let staged: string | null = null; // 受け取って確かめ済みの版
  let told = new Set<string>();
  let stopped = false;
  const note = (key: string, text: string) => {
    if (told.has(key)) return;
    told.add(key);
    d.onNote(text);
  };
  const waitIdle = async () => {
    while (!stopped && d.isBusy()) await new Promise((r) => setTimeout(r, IDLE_POLL_MS));
  };

  /** 入れ替えられないなら理由（受け取りにも行かない） */
  const blocker = (u: UpdateInfo): string | null => {
    if (!d.isPackaged) return `新しい版（${u.version}）があります。開発中の起動なので入れ替えません`;
    if (os !== "mac") return null;
    const bundle = appBundleOf(d.execPath);
    if (!bundle) return `新しい版（${u.version}）があります。開発中の起動なので入れ替えません`;
    if (!canReplace(bundle)) return `新しい版（${u.version}）があります。この場所には書けないので、Kaname の画面から入れ直してください`;
    return null;
  };

  /** 受け取って確かめたものを、仕事をしていない間に入れ替える */
  const apply = async (u: UpdateInfo, file: string): Promise<void> => {
    const bundle = appBundleOf(d.execPath);
    const source = os === "mac" && bundle ? await unpackMac(file, u.version, join(d.dir, `app-${u.version}`)) : null;
    staged = u.version;
    await waitIdle();
    if (stopped) return;
    d.onNote(`新しい版（${u.version}）に入れ替えます。すぐに立ち上がり直します`);
    if (source && bundle) {
      const script = join(d.dir, "replace.sh");
      const relaunch = (d.relaunch ?? ((b) => ["/usr/bin/open", "-n", b]))(bundle);
      // 退ける先は元の版の隣（同じディスク＝名前の付け替えで済む。受け取りの置き場は起動のたびに消すので使わない）
      writeFileSync(script, replaceScript({ pid: d.pid ?? process.pid, target: bundle, source, backup: `${bundle}.previous`, relaunch }), { mode: 0o755 });
      spawn("/bin/sh", [script], { detached: true, stdio: "ignore" }).unref();
    } else {
      // 1 クリックのインストーラ（人に選ばせない・管理者権限なし）を黙って走らせ、終わったら立ち上げさせる
      spawn(file, ["/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
    }
    d.quit();
  };

  const check = async (): Promise<void> => {
    if (!os || stopped) return;
    try {
      const u = await fetchLatest(d.apiBase, os, arch, d.currentVersion);
      if (!u || staged === u.version || stopped) return;
      const why = blocker(u);
      if (why) return note(`skip-${u.version}`, why);
      let file: string;
      try {
        file = await download(u, d.dir); // 受け取るたびに指紋と大きさを確かめる
      } catch (e) {
        const m = e instanceof Error ? e.message : "不明";
        if (/指紋|大きさ|Kaname Bridge ではありません|版が目録|開けません/.test(m)) throw e;
        // 新しい版があると分かってから受け取りが途中で切れた。黙って次の機会を待たず、1 回知らせる（G-15）
        return note(`cut-${u.version}`, `新しい版（${u.version}）の受け取りが途中で止まりました。いまの版のまま動き、次の機会にもう一度受け取ります（${m}）`);
      }
      await apply(u, file);
    } catch (e) {
      // つながらないだけなら黙って次の機会に（起動も仕事も止めない）。確かめられなかったことは 1 回知らせる
      const m = e instanceof Error ? e.message : "不明";
      if (/指紋|大きさ|Kaname Bridge ではありません|版が目録|開けません/.test(m)) note(`bad-${m}`, `新しい版を受け取りましたが、確かめられなかったので使いませんでした（${m}）`);
    }
  };
  const checkNow = (): Promise<void> => {
    if (!checking) checking = check().finally(() => (checking = null));
    return checking;
  };
  // 立ち上がった＝前の入れ替えは済んだか諦めた。受け取った残り（zip・展開したもの・手順）を片づける（約 100MB を残さない）
  rmSync(d.dir, { recursive: true, force: true });
  // 前の入れ替えの途中で止まった残り（写しかけの .incoming・退けた .previous）も片づける。いま動いている版が正
  const running = os === "mac" ? appBundleOf(d.execPath) : null;
  if (running && d.isPackaged) for (const x of [`${running}.incoming`, `${running}.previous`]) rmSync(x, { recursive: true, force: true });
  void checkNow();
  const t = setInterval(() => void checkNow(), HOUR_MS);
  return {
    checkNow,
    stop: () => {
      stopped = true;
      clearInterval(t);
      told = new Set();
    },
  };
}
