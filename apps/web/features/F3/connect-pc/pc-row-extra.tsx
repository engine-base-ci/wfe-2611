"use client";
// 「PC と使った量」の行の本文の最後に差す物の置き場（K-349）。
//   K-361 → K-368 → K-375 がこの順に分かれ道を足す。mine の見分け・この PC の口の読みもこの hook の中。
//   1 台ぶんの出す物を上から順に並べて返す。出す物が無い行は null（行は今の形のまま）
//   K-361：Claude Code の足りない物と直し方（claude-code.tsx）と、ログインが済んだ知らせ（区画が消えた後も行に残す）
//   K-368：AI が使うブラウザの選ぶ欄と一手（browser-row.tsx）。Claude Code の直し方が出ている行には出さない（先に直す物だけ・A-3）
//   K-375：Bridge が古い行（自己診断の fix=update の ✗）には入れ直す区画だけを出す（bridge-reinstall.tsx）。入れ直した後に上の 2 つが出る
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { localChecks, type Check, type Where0 } from "@/lib/bridge-presence";
import { BridgeReinstallRow, isOutdated } from "./bridge-reinstall";
import { BrowserRow, browserOf } from "./browser-row";
import { ClaudeCodeFix, claudeFixOf, LOGGED_IN_TEXT } from "./claude-code";
import type { Device } from "./devices";
import { RowNote } from "./pc-row-parts";

export interface PcRowCtx {
  devices: Device[];
  where: Where0["where"];
  bridge: Where0["bridge"];
  reload: () => Promise<void>;
  /** この端末に Bridge を入れられるか（K-373：読む所は画面の hook use-connect-pc.ts の 1 つだけ） */
  canPair: boolean;
}

export function usePcRowExtra(ctx: PcRowCtx): ((d: Device) => ReactNode) | undefined {
  const { where, bridge } = ctx;
  // この PC の行：この PC の Bridge の /ping の device_id と行の id が同じ（名前で見分けない・D-128.174）。
  //   useWhere は並べる側が 1 回だけ呼ぶ（ここで呼び直すと /ping の読みが二重になる）
  const thisId = (where === "installed" || where === "app") && bridge?.device_id ? bridge.device_id : null;
  const hasMine = thisId !== null && ctx.devices.some((d) => d.id === thisId);
  /** この PC の口の /check（undefined＝まだ読んでいない・null＝読めなかった） */
  const [checks, setChecks] = useState<Check[] | null | undefined>(undefined);
  /** ログインが済んだ PC の id（区画が消えた後も知らせを残す） */
  const [loggedIn, setLoggedIn] = useState<readonly string[]>([]);
  const recheck = useCallback(async (): Promise<void> => {
    setChecks(await localChecks());
  }, []);
  useEffect(() => {
    if (hasMine) void recheck(); // 開いたとき（mine の行があるときだけ）
  }, [hasMine, recheck]);
  const onLoggedIn = useCallback(
    (id: string): void => {
      setLoggedIn((xs) => (xs.includes(id) ? xs : [...xs, id]));
      void recheck();
    },
    [recheck],
  );

  if (where === "loading") return undefined; // どの行がこの PC か分かるまで出さない

  return (d: Device): ReactNode => {
    // Bridge が古い行は入れ直す区画だけ（古い Bridge には仕事を渡さないので、先に直す物だけ・眠っている行でも出す）
    if (isOutdated(d.health)) return <BridgeReinstallRow key={d.id} canInstall={ctx.canPair} />;
    const mine = d.id === thisId;
    // この PC の行は、この PC の口の新しい自己診断を先に使う（読む前は出さない・読めなければ一覧の health）
    const local = mine ? (checks ?? null) : null;
    const known = !mine || checks !== undefined;
    const needClaude = known && claudeFixOf(local ?? d.health) !== null;
    const claude = needClaude ? (
      <ClaudeCodeFix device={d} mine={mine} local={local} onRecheck={recheck} onLoggedIn={() => onLoggedIn(d.id)} />
    ) : null;
    // 直し方が出ない行にだけ、ブラウザの欄（一覧に browser が無い行は BrowserRow が何も出さない）
    const browser = known && !needClaude && browserOf(d) ? <BrowserRow device={d} onReload={ctx.reload} /> : null;
    const done = loggedIn.includes(d.id) ? <RowNote tone="ok">{LOGGED_IN_TEXT}</RowNote> : null;
    if (!claude && !browser && !done) return null;
    return (
      <>
        {claude}
        {browser}
        {done}
      </>
    );
  };
}
