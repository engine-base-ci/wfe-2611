"use client";
// チケットの詳細と承認待ちの差し込み口の約束（K-380・段 7〔F6〕と段 9〔F8〕が後から中身を足す）。
//   AI が動いている・承認待ちの帯（承認・実行）は 1 つだけ（D-128.178・D-129.10）。任せる前・完了にする・止まった・完了の箱は数えず、渡し・保留の帯と並ぶ（K-620）。
//   並びの順はここ 1 か所 BAND_ORDER で決める：
//     承認・実行（F5 の帯・ApproveBand と DelegateBand）→ 渡し（段 9）→ 保留（段 7）。代表の答え ㉓
//   後ろの帯は、前に出ている帯があれば譲る（bandYieldTo）。譲るのは承認・実行の帯が data-busy を持つ間だけ。差し込み口の先は yieldTo が null でなければ描かない。
//   差し込み口に渡す値はどれも SlotTicket。getTicket の答えは detail にそのまま入れる（後の段が欄を足しても F4 の型を直さない）。
//   import は react だけ（試験が Playwright の中でこのファイルを直に読む・@/ の道を使わない）
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type RefCallback } from "react";

/** 題名の下の帯の順：承認・実行（F5）→ 渡し（段 9）→ 保留（段 7）・代表の答え ㉓ */
export const BAND_ORDER = ["approve", "handover", "hold"] as const;
export type BandKey = (typeof BAND_ORDER)[number];
/** 段 7・段 9 が「出したい」を知らせる帯（approve は F5 の帯を見張って決める） */
export type WantBandKey = Exclude<BandKey, "approve">;

/** 自分より前の、出ている帯（無ければ null＝自分の番） */
export function bandYieldTo(key: BandKey, shown: ReadonlySet<BandKey>): BandKey | null {
  const mine = BAND_ORDER.indexOf(key);
  return BAND_ORDER.slice(0, mine).find((k) => shown.has(k)) ?? null;
}

/** getTicket の答え（そのまま。差し込み口の先が自分の型で読む） */
export type SlotDetail = Readonly<Record<string, unknown>>;

export interface SlotTicket {
  /** チケットの id（道の id） */
  id: string;
  /** 頁の詳細か、一覧の右の詳細か（K-252） */
  layout: "page" | "side";
  /** 見ている人の表示名（読めるまで ""） */
  me: string;
  /** getTicket の答え */
  detail: SlotDetail;
  /** いま出ている（出したい）帯 */
  bands: ReadonlySet<BandKey>;
  /** 詳細を読み直す（段を変えた後など） */
  reload: () => Promise<void>;
}

export interface BandSlotProps {
  ticket: SlotTicket;
  /** 譲る先（前に出ている帯）。null でなければ描かない */
  yieldTo: BandKey | null;
  /** 出したい（true）・出さない（false）を知らせる */
  onWant: (want: boolean) => void;
}

export interface BandOrder {
  /** 帯の入れ物 .k-detail-bands に付ける */
  ref: RefCallback<HTMLDivElement>;
  /** いま出ている帯（BAND_ORDER の順） */
  shown: ReadonlySet<BandKey>;
  /** 鍵ごとに同じ関数を返す（差し込み口の onWant に渡す） */
  want: (key: WantBandKey) => (want: boolean) => void;
}

/** 画面の外（組み立ての時）では useEffect（useLayoutEffect は描いた直後の DOM を読むためだけ） */
const useDomEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** F5 の帯（ApproveBand・DelegateBand。どちらも section.k62-band）のうち、AI が動いている・承認待ちを出している間だけ付く印 data-busy を持つ帯が
 *  入れ物の直下に在るか（任せる前・完了にする・止まった・完了の箱は印が無く数えない・K-620。印を付ける側は F5 で、このファイルを import しない） */
const F5_BAND = ":scope > section.k62-band[data-busy]";
/** 見張る範囲：帯の出入りと、帯の section は状態が替わっても同じ要素なので data-busy の付け外し（K-620） */
const BAND_WATCH: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["data-busy"],
};

/** 帯の順の器：F5 の帯を見張って approve を、onWant で handover・hold を数える。値が変わらなければ描き直さない */
export function useBandOrder(): BandOrder {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const ref = useCallback<RefCallback<HTMLDivElement>>((node) => setEl(node), []);
  const [approve, setApprove] = useState(false);
  const [wants, setWants] = useState<Readonly<Record<WantBandKey, boolean>>>({ handover: false, hold: false });
  useDomEffect(() => {
    if (!el) {
      setApprove(false);
      return;
    }
    // 同じ値なら React は描き直さない（F5 の帯は自分の中の状態で出たり消えたりするので、答えの値からは決められない）
    const check = () => setApprove(el.querySelector(F5_BAND) !== null);
    check();
    const mo = new MutationObserver(check);
    mo.observe(el, BAND_WATCH);
    return () => mo.disconnect();
  }, [el]);
  const wantHandover = useCallback((w: boolean) => setWants((p) => (p.handover === w ? p : { ...p, handover: w })), []);
  const wantHold = useCallback((w: boolean) => setWants((p) => (p.hold === w ? p : { ...p, hold: w })), []);
  const want = useCallback(
    (key: WantBandKey) => (key === "handover" ? wantHandover : wantHold),
    [wantHandover, wantHold],
  );
  const shown = useMemo<ReadonlySet<BandKey>>(
    () => new Set(BAND_ORDER.filter((k) => (k === "approve" ? approve : wants[k]))),
    [approve, wants],
  );
  return { ref, shown, want };
}
