// 帯のすぐ下の 1 行・帯の上の知らせ・作業中に戻した後の箱の器（K-730・段 6 の画面の葉が積む）。
//   頁の中の store（チケットごと・その画面にいる間だけ持つ）。見ている部品が 0 になったら（頁を離れたら）少し遅らせてそのチケットの値を消す
//   （React の StrictMode の付け外しや、帯の持ち主の入れ替えで一瞬 0 になっても、その間に見直されれば消さない）。
//   葉は口の答えで pushTrail（1 行）・pushNotice（知らせ 1 つ・次で替わる）・pushBand（箱 1 つ）を呼ぶだけ。
//   描く部品（TicketTrail・TicketNotice）は slots.tsx に置く。ここは react 以外を import しない
//   （試験 K730-UI-014 が node --experimental-strip-types で直に読む：@/ の別名・拡張子なしの相対の import・JSX を使わない）
import { useCallback, useSyncExternalStore } from "react";

export interface TrailLine {
  /** 「MM/DD HH:MM」（日本時間） */
  time: string;
  text: string;
}
export interface TrailBand {
  title: string;
  sub?: string;
}

const JST_MS = 9 * 3600_000;
/** 見ている部品が 0 になってから値を消すまでの間（StrictMode の付け外し・帯の持ち主の入れ替えをまたぐため） */
const DROP_DELAY_MS = 0;

/** 日本時間の「MM/DD HH:MM」 */
export function trailStamp(now: number = Date.now()): string {
  const iso = new Date(now + JST_MS).toISOString();
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

/** チケットごとの値を持つ store。値が替わったときだけ新しい参照にする（useSyncExternalStore の決まり）。
 *  そのチケットを見ている部品が 0 になったら、少し遅らせて値を消す（頁を離れると消える・戻ってきたときに前の値を出さない） */
interface KeyedStore<T> {
  get: (id: string) => T | undefined;
  set: (id: string, value: T | undefined) => void;
  subscribe: (id: string, l: () => void) => () => void;
}

function keyedStore<T>(): KeyedStore<T> {
  const values = new Map<string, T>();
  const listeners = new Map<string, Set<() => void>>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const cancelDrop = (id: string) => {
    const t = pending.get(id);
    if (t === undefined) return;
    clearTimeout(t);
    pending.delete(id);
  };
  const scheduleDrop = (id: string) => {
    cancelDrop(id);
    pending.set(
      id,
      setTimeout(() => {
        pending.delete(id);
        if (!listeners.has(id)) values.delete(id);
      }, DROP_DELAY_MS),
    );
  };
  const emit = (id: string) => {
    for (const l of listeners.get(id) ?? []) l();
  };
  return {
    get: (id: string): T | undefined => values.get(id),
    set(id: string, value: T | undefined) {
      if (value === undefined) {
        if (!values.has(id)) return;
        values.delete(id);
      } else values.set(id, value);
      emit(id);
    },
    subscribe(id: string, l: () => void): () => void {
      cancelDrop(id);
      const set = listeners.get(id) ?? new Set<() => void>();
      set.add(l);
      listeners.set(id, set);
      return () => {
        set.delete(l);
        if (set.size > 0) return;
        listeners.delete(id);
        scheduleDrop(id);
      };
    },
  };
}

function useKeyed<T>(store: KeyedStore<T>, id: string): T | undefined {
  const sub = useCallback((l: () => void) => store.subscribe(id, l), [store, id]);
  const snap = useCallback(() => store.get(id), [store, id]);
  return useSyncExternalStore(sub, snap, () => undefined);
}

const EMPTY: readonly TrailLine[] = Object.freeze([]);
const trails = keyedStore<readonly TrailLine[]>();
const notices = keyedStore<string>();
const bands = keyedStore<TrailBand>();

/** 帯のすぐ下に 1 行積む（今の時刻を付ける） */
export function pushTrail(ticketId: string, text: string, now: number = Date.now()): void {
  const prev = trails.get(ticketId) ?? EMPTY;
  trails.set(ticketId, Object.freeze([...prev, { time: trailStamp(now), text }]));
}
export function clearTrail(ticketId: string): void {
  trails.set(ticketId, undefined);
}
/** そのチケットの帯の下の行（無ければ空の並び） */
export function useTrail(ticketId: string): readonly TrailLine[] {
  return useKeyed(trails, ticketId) ?? EMPTY;
}

/** 帯の上の知らせ（1 つだけ・次の知らせで替わる） */
export function pushNotice(ticketId: string, text: string): void {
  notices.set(ticketId, text);
}
export function clearNotice(ticketId: string): void {
  notices.set(ticketId, undefined);
}
export function useNotice(ticketId: string): string | null {
  return useKeyed(notices, ticketId) ?? null;
}

/** 作業中に戻した後の箱（任せる帯が任せる前の白い箱の代わりに出す） */
export function pushBand(ticketId: string, band: TrailBand): void {
  bands.set(ticketId, Object.freeze({ ...band }));
}
export function clearBand(ticketId: string): void {
  bands.set(ticketId, undefined);
}
export function useBand(ticketId: string): TrailBand | null {
  return useKeyed(bands, ticketId) ?? null;
}
