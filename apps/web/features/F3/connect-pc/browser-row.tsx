"use client";
// PC の行の「AI が使うブラウザ」の選ぶ欄と、Chrome とつながらないときのその場の一手（K-368・口は K-364・K-365）。
//   見た目は下絵の部品 pc-row-parts.tsx の BrowserChoice・BrowserFix（K-369）。ここは値と押した結果をつなぐ。
//   行ごとに持つ：選んだ直後の値（一覧が追いつくまでの上書き）・選ぶ口を待つ間・選ぶ欄の知らせ・確かめ中・一手の結果
import { useEffect, useState } from "react";
import {
  checkDeviceBrowser,
  CHROME_CHECK,
  deviceBrowserErrorText,
  setDeviceBrowser,
  type AgentBrowserValue,
} from "@/lib/device-browser";
import type { Device } from "./devices";
import { BrowserChoice, BrowserFix } from "./pc-row-parts";

const SCREEN_ID = "bridge-setup";
const SAVED_TEXT = "変えました。次の仕事から使います";
const OK_TEXT = "つながりました。AI は Chrome を使えます";
const STILL_TEXT = "まだつながっていません。上の手順を見直してから、もう一度押してください";
const TIMEOUT_TEXT = "結果が返ってきませんでした。PC の Bridge が動いているか確かめてください";

type Note = { tone: "ok" | "danger"; text: string } | null;
type FixResult = { tone: "info" | "danger"; text: string } | null;

/** 一覧の browser が chrome・dedicated・off のどれかのときだけ今の値が分かる（無い・知らない値は無いのと同じ） */
export const browserOf = (d: Device): AgentBrowserValue | null =>
  d.browser === "chrome" || d.browser === "dedicated" || d.browser === "off" ? d.browser : null;

/** 自己診断に Chrome の行が在って ✗ か（行が無い・✓・「まだ使っていません」は ✗ ではない） */
const chromeIsBad = (health: unknown): boolean =>
  Array.isArray(health) &&
  (health as { name?: string; ok?: boolean }[]).some((h) => h?.name === CHROME_CHECK && h.ok === false);

export function BrowserRow({ device, onReload }: { device: Device; onReload: () => Promise<void> | void }) {
  const [picked, setPicked] = useState<AgentBrowserValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FixResult>(null);
  /** 「つながりました」を出した時点の自己診断の時刻（一覧が新しくなるまで一手を戻さない） */
  const [okBase, setOkBase] = useState<{ at: string | null } | null>(null);
  const listed = browserOf(device);

  // 一覧が追いついたら上書きを外す
  useEffect(() => {
    if (picked && listed === picked) setPicked(null);
  }, [picked, listed]);

  const value = picked ?? listed;
  if (!value) return null; // 今の値が分からないのに印を付けない

  const choose = async (next: AgentBrowserValue): Promise<void> => {
    if (busy || next === value) return;
    setBusy(true);
    setNote(null);
    const r = await setDeviceBrowser(device.id, next, SCREEN_ID);
    setBusy(false);
    if (r.ok) {
      setPicked(next);
      setResult(null);
      setNote({ tone: "ok", text: SAVED_TEXT });
      void onReload();
    } else if (r.kind !== "unauthenticated") {
      setNote({ tone: "danger", text: deviceBrowserErrorText(r) });
    }
  };

  const check = async (): Promise<void> => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    const before = device.health_at ?? null;
    const o = await checkDeviceBrowser(device.id, before, SCREEN_ID);
    setChecking(false);
    if (o.kind === "ok") {
      setOkBase({ at: before });
      setNote({ tone: "ok", text: OK_TEXT });
      void onReload();
    } else if (o.kind === "still") setResult({ tone: "danger", text: STILL_TEXT });
    else if (o.kind === "timeout") setResult({ tone: "danger", text: TIMEOUT_TEXT });
    else if (o.err.kind !== "unauthenticated") setResult({ tone: "danger", text: deviceBrowserErrorText(o.err) });
  };

  const cleared = okBase !== null && (device.health_at ?? null) === okBase.at;
  const showFix = value === "chrome" && chromeIsBad(device.health) && !cleared;

  return (
    <>
      <BrowserChoice deviceId={device.id} value={value} busy={busy} note={note} onChange={(v) => void choose(v)} />
      {showFix ? (
        <BrowserFix
          checking={checking}
          result={result}
          onCheck={() => void check()}
          onDedicated={() => void choose("dedicated")}
        />
      ) : null}
    </>
  );
}
