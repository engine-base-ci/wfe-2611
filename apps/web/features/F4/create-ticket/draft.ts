// 書きかけの下書き（K-60・D-128.138・D-128.62）。サーバーに残し（どの端末でも続きが書ける）、この PC にも写しを置く。
//   写しとタブの下書きの id の鍵は「ワークスペース × 本人」（共有の PC で別の人に見せない・H1）。本人が分かるまでは読まない・書かない。
//   ログアウトとログイン切れで kaname.ticket-draft で始まる鍵は全部消す（lib/api/client の clearDraftCopies）。
//   タブごとに下書きの id を持つ（sessionStorage）。2 つのタブで上書きし合わない。作れたら消し、作った後に届く保存は送らない
import { call } from "@/lib/api/call";
import { DRAFT_COPY_PREFIX } from "@/lib/api/client";

export interface DraftBody {
  scope_id?: string | null;
  kind_id?: string | null;
  title?: string;
  assignee_member_id?: string | null;
  due_on?: string;
  start_on?: string;
  priority?: "mid" | "high";
  priority_reason?: string;
  parent_ticket_id?: string | null;
  sections?: Record<string, string>;
  notify_member_ids?: string[];
}
/** 誰の下書きか（ワークスペース＝会社の id・本人＝member の id） */
export interface DraftOwner {
  workspace: string;
  member: string;
}
/** 下書きをサーバーに残せたか（残せなかったら画面が知らせる・D-128.62） */
/** too_large：送る内容が 1MB を超えた（413・D-130.5）。書いたものは画面に残し、作るときと同じ文を出す */
export type SaveState = "saved" | "failed" | "expired" | "too_large";

const TAB_KEY = (o: DraftOwner) => `${DRAFT_COPY_PREFIX}-id:${o.workspace}:${o.member}`;
const COPY_KEY = (o: DraftOwner) => `${DRAFT_COPY_PREFIX}:${o.workspace}:${o.member}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );

const read = (k: string, store: () => Storage): string | null => {
  try {
    return store().getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null, store: () => Storage): void => {
  try {
    if (v === null) store().removeItem(k);
    else store().setItem(k, v);
  } catch {
    /* 残せない環境（非公開の窓）でも、サーバーの下書きは残る */
  }
};
const local = () => window.localStorage;
/** 作る口の前に下書きを残すのを待つ上限（ミリ秒）。越えたら残せなかったと知らせて作る */
const FLUSH_WAIT_MS = 5_000;
const session = () => window.sessionStorage;

/** 写しを読む。読めない JSON・形の違う中身は無いのと同じ（作る面は開く・K60-UI-035） */
function readCopy(o: DraftOwner): { id: string; body: DraftBody } | null {
  const raw = read(COPY_KEY(o), local);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const { id, body } = v as { id?: unknown; body?: unknown };
    if (typeof id !== "string" || !body || typeof body !== "object" || Array.isArray(body)) return null;
    return { id, body: body as DraftBody };
  } catch {
    return null;
  }
}

/** このタブの下書きの id（無ければ作る） */
export function tabDraftId(o: DraftOwner): string {
  const have = read(TAB_KEY(o), session);
  if (have && UUID.test(have)) return have;
  const id = uuid();
  write(TAB_KEY(o), id, session);
  return id;
}

/** 続きの下書き：サーバーのこのタブの id → この PC の写し（同じ id） → サーバーの一番新しいもの（新しいタブで開いたとき）。
 *  別のタブの下書きを続きとして出したら、その id を sourceId に返す（作る口が source_draft_id で消す・H2） */
export async function loadDraft(o: DraftOwner): Promise<{ body: DraftBody; sourceId: string | null } | null> {
  const id = tabDraftId(o);
  const copy = readCopy(o);
  // 一覧の口が通信の失敗で落ちても（例外）、この PC の写し（本人の鍵）があれば、それを出して作る面を開く（D-128.62）
  const r = await call("listMyTicketDrafts", { screenId: "tickets" }).catch(() => null);
  const list = r?.ok ? (r.data as unknown as { draft_id: string; body: DraftBody | null }[]) : [];
  const mine = list.find((d) => d.draft_id === id);
  if (mine?.body) return { body: mine.body, sourceId: null };
  if (copy && copy.id === id) return { body: copy.body, sourceId: null };
  const latest = list.find((d) => d.body && d.draft_id !== id);
  if (latest?.body) return { body: latest.body, sourceId: latest.draft_id };
  return copy ? { body: copy.body, sourceId: null } : null;
}

/** 1 つの作る面の下書き。書くたびに残し（この PC にはすぐ・サーバーには少し待ってから）、作る前にすぐ残し、作ったら閉じる */
export class DraftStore {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sealed = false;
  private seq = 0;
  constructor(
    private readonly o: DraftOwner,
    private readonly onState: (s: SaveState) => void,
    private readonly waitMs = 600,
  ) {}

  /** 書いた中身を残す（サーバーへは少し待ってから・まとめて 1 回） */
  save(body: DraftBody): void {
    if (this.sealed) return;
    const id = tabDraftId(this.o);
    write(COPY_KEY(this.o), JSON.stringify({ id, body }), local);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.send(body), this.waitMs);
  }

  /** 作る前に：待っている保存を止め、今の中身をすぐサーバーへ残して答えを待つ（ログイン切れでも続きが出る・H1） */
  async flush(body: DraftBody): Promise<SaveState> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const id = tabDraftId(this.o);
    write(COPY_KEY(this.o), JSON.stringify({ id, body }), local);
    // 作る口の前の保存は待ちすぎない（遅い・届かないときは「残せませんでした」と知らせて作る・D-128.62）
    return this.send(body, FLUSH_WAIT_MS);
  }

  /** 作る口を呼んだ：この後の保存は送らない（作った後に届く保存は捨てる・H2）。作れなかったら reopen で戻す */
  seal(): void {
    this.sealed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.seq++; // 送っている途中の保存の答えは読まない
  }
  reopen(): void {
    this.sealed = false;
  }

  /** 作れたら消す（サーバーの下書きは作る口が同じ処理で消す） */
  clear(): void {
    this.seal();
    write(COPY_KEY(this.o), null, local);
    write(TAB_KEY(this.o), null, session);
  }

  /** 画面を閉じた・離れた */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** 残す。断られた（429・500）・届かない（網が切れた）・待ちすぎた は「残せなかった」にして、呼び手は先へ進む（作る口は止めない） */
  private async send(body: DraftBody, timeoutMs?: number): Promise<SaveState> {
    if (this.sealed) return "saved";
    const mine = ++this.seq;
    let state: SaveState;
    // 待ちすぎたら打ち切る。打ち切りは setTimeout で数える（画面の時計で進められる・AbortSignal.timeout は使わない）
    const ac = timeoutMs ? new AbortController() : null;
    const stop = ac ? setTimeout(() => ac.abort(), timeoutMs) : undefined;
    try {
      const r = await call("saveMyTicketDraft", {
        body: { draft_id: tabDraftId(this.o), body: body as Record<string, unknown> },
        screenId: "tickets",
        ...(ac ? { signal: ac.signal } : {}),
      });
      state = r.ok
        ? "saved"
        : r.kind === "unauthenticated"
          ? "expired"
          : r.kind === "too_large"
            ? "too_large"
            : "failed";
    } catch {
      state = "failed";
    } finally {
      if (stop) clearTimeout(stop);
    }
    if (mine === this.seq && !this.sealed) this.onState(state);
    return state;
  }
}
