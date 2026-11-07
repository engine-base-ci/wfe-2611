"use client";
// この画面が「どこで開かれているか」と「Bridge が入っているか」を見る（D-089.8）。
// 由来：ダウンロードの案内は インストール動線 であって、つなぐ手順の中身ではない。
// Bridge のアプリの中で開いている人に「macOS 版をダウンロード」と出すのは明らかにおかしい（もう入っている）。
// user「アプリの時とブラウザの時で分けれないの？ いるとするとアプリのインストール動線じゃない？」
import { useEffect, useState } from "react";
import { fetchFile } from "@/lib/api/call";

/** この PC の Bridge を起こす（D-015.8）。インストーラが OS に登録した kaname-bridge:// を叩く。
 *  入っていなければ何も起きないので、呼んだ側が数秒見て「見つからない」と言う（黙って待たせない） */
const SEEN = "kaname.bridge.seen";
/** この PC で Bridge を一度でも見たか。見たことが無ければ「起こす」は出さない（押しても何も起きないため） */
export function everSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}
const remember = (): void => {
  try {
    window.localStorage.setItem(SEEN, "1");
  } catch {
    /* 覚えられなくても動く */
  }
};

export function wake(): void {
  try {
    const f = document.createElement("iframe"); // 画面を離れずに叩く（window.location だと戻れないことがある）
    f.style.display = "none";
    f.src = "kaname-bridge://open";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 4000);
  } catch {
    /* 叩けなくても、入れる道は残る */
  }
}

/** インストーラを受け取る（契約の口 downloadBridgeRelease・K-57・D-128.153）。
 *  置き場が外なら短い期限の署名 URL を普通のリンクとして開く。手元のフォルダなら中身をそのまま保存させる。
 *  受け取れなければ正本のエラー ID を返す（押しても何も起きない、を作らない） */
export async function getInstaller(
  os: "mac" | "win",
): Promise<{ ok: true } | { ok: false; status: number; code: string }> {
  const r = await fetchFile("downloadBridgeRelease", { name: os });
  if (!r.ok) return r;
  const a = document.createElement("a");
  if (r.kind === "link") {
    a.href = r.url;
    a.rel = "noopener";
  } else {
    a.href = URL.createObjectURL(r.blob);
    a.download = os === "mac" ? "Kaname-Bridge.dmg" : "Kaname-Bridge-Setup.exe";
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { ok: true };
}

/** Bridge がこの PC の中だけで開いている口（apps/bridge/src/local.ts と同じ番号） */
const LOCAL = "http://127.0.0.1:38617";

export type Where =
  | "loading"
  | "app" // Bridge のアプリの窓の中。もう入っているし、同じ PC なので自動でつながる
  | "installed" // ブラウザだが Bridge は動いている。ダウンロードは要らない
  | "web"; // ブラウザで、Bridge が見つからない。インストール動線を出す

/** Bridge の窓から開いたか（窓が UA に印を付ける） */
export const inBridgeApp = (): boolean =>
  typeof navigator !== "undefined" && / KanameBridge\//.test(navigator.userAgent);

interface Ping {
  app: string;
  version: string;
  device_label: string;
  connected: boolean;
}
/** この PC で Bridge が動いているか。動いていなければ null（他所のサイトからは 403 で見えない） */
async function ping(signal: AbortSignal): Promise<Ping | null> {
  try {
    const r = await fetch(`${LOCAL}/ping`, { signal });
    if (!r.ok) return null;
    const j = (await r.json()) as Ping;
    return j.app === "kaname-bridge" ? j : null;
  } catch {
    return null;
  }
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** 直し方。install＝入れる／repair＝取り直す／login＝ログインする（何を出すかをこれで決める） */
  fix?: "install" | "repair" | "login" | null;
}
/** この PC の Bridge が確かめた結果（何が足りないか）。つながる前でも読める */
export async function localChecks(): Promise<Check[] | null> {
  try {
    const r = await fetch(`${LOCAL}/check`);
    return r.ok ? ((await r.json()) as { checks: Check[] }).checks : null;
  } catch {
    return null;
  }
}
/** Claude Code を入れる（D-091）。押すのは人、やるのは Bridge。この PC の中だけの口なので他所からは押せない */
export async function installClaude(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${LOCAL}/install-claude`, { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    return { ok: r.ok, message: j.message ?? (r.ok ? "入りました" : `うまくいきませんでした（${r.status}）`) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bridge に届きません" };
  }
}
/** ログインの窓を開く。承認するのは本人（D-091.3） */
export async function loginClaude(): Promise<{ ok: boolean; url?: string; message: string }> {
  try {
    const r = await fetch(`${LOCAL}/login-claude`, { method: "POST" });
    const j = (await r.json().catch(() => ({}))) as { message?: string; url?: string };
    return { ok: r.ok, ...(j.url ? { url: j.url } : {}), message: j.message ?? "ブラウザで承認してください" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bridge に届きません" };
  }
}
/** 始めたログインを止める（画面を離れる・やり直す） */
export async function loginCancel(): Promise<void> {
  try {
    await fetch(`${LOCAL}/login-cancel`, { method: "POST" });
  } catch {
    /* 届かないなら、そもそも動いていない */
  }
}
/** ブラウザに出たコードを Bridge に渡す。入れたかどうかは Bridge が claude に聞いて確かめる */
export async function loginCode(code: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${LOCAL}/login-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    return { ok: r.ok, message: j.message ?? (r.ok ? "ログインできました" : "ログインできませんでした") };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bridge に届きません" };
  }
}

/** Bridge に「この接続コードでつないで」と頼む。人がコードを打ち直さなくて済む */
/** この PC の Bridge につなぐ。別のアカウントでつながっている Bridge は、switch（本人が「切り替える」を押した）のときだけ切り替わる */
export async function pairViaLocal(
  code: string,
  allowSwitch = false,
): Promise<{ ok: true } | { ok: false; message: string; otherAccount?: boolean }> {
  try {
    const r = await fetch(`${LOCAL}/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, ...(allowSwitch ? { switch: true } : {}) }),
    });
    const j = (await r.json().catch(() => ({}))) as { message?: string; reason?: string };
    if (r.ok) return { ok: true };
    return {
      ok: false,
      message: j.message ?? `うまくいきませんでした（${r.status}）`,
      ...(j.reason === "other_account" ? { otherAccount: true } : {}),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bridge に届きません" };
  }
}

export interface Where0 {
  where: Where;
  bridge: Ping | null;
  /** いま見に行っている最中（押した直後に「何も起きない」と思わせない） */
  checking: boolean;
  /** 最後に見に行った時刻。押した結果が変わったかどうかを人に見せるため */
  checkedAt: number | null;
  recheck: () => void;
}
/** この PC に Bridge が居るかを見続ける。人が「もう一度確かめる」を押さなくても、
 *  起動した数秒後には画面が自分で気づく（D-089.10）。押したときはすぐ見に行く */
export function useWhere(pollMs = 3000): Where0 {
  const [where, setWhere] = useState<Where>("loading");
  const [bridge, setBridge] = useState<Ping | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wait = pollMs;
    const look = async (): Promise<void> => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 1500); // 居ない人を 1.5 秒以上待たせない
      setChecking(true);
      const p = await ping(ac.signal);
      clearTimeout(t);
      if (!alive) return;
      if (p) remember();
      setBridge(p);
      setWhere(inBridgeApp() ? "app" : p ? "installed" : "web");
      setChecking(false);
      setCheckedAt(Date.now());
      // 起動されたら自分で気づく。見つからない間は間隔を広げる（3 → 6 → 12 秒。最大 12 秒）
      wait = p ? pollMs : Math.min(wait * 2, pollMs * 4);
      timer = setTimeout(() => void look(), p ? pollMs : wait);
    };
    void look();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [n, pollMs]);
  return { where, bridge, checking, checkedAt, recheck: () => setN((x) => x + 1) };
}
