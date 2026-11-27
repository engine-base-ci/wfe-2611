// ゲストのグループを読む・作る（K-874・口 listGuestGroups・createGuestGroup は K-876）・名前を直す・消す（K-928・口 updateGuestGroup・deleteGuestGroup は K-927）と、口の答えを部品の形（MemberGroup）に直す。
//   ゲストを 1 人だけ止める・戻す・外す（K-931・口 suspendMember・resumeMember は K-814・removeMember は K-848・体はどれも {}）：useGuestAct。
//     403 STEP_UP_REQUIRED → getMySecurity を 1 回読んで本人確認の取り直し（StepUp）→ 通ったら同じ口を同じ体で 1 回だけやり直す・やめたら何も送らない。
//     うまくいった・もう居ない（404）・もう止まっている／戻っている（409 E-MEM-009・010）は一覧を 1 回読み直す（答えの写しで書き換えない・G-02）
//   メンバーの画面を開いたとき、getWorkspaceMembers（use-members.ts）と並べて 1 回ずつ読む（タブの数を出すため・直列にしない）。
//   タブを押しても読み直さない。招いた・作ったあとは invalidate で 1 回だけ読み直す（鍵 GUEST_GROUPS_KEY）。
//   答えの形は K-876 の確定（K876-API-007・024・025）：groups[]（id・name・request_scope{id,name}|null・guests[]・invitations[]）・名前の順・ページ無し
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { call, type CallErr } from "@/lib/api/call";
import { SCREEN } from "./use-members";
import type { MemberGroup, MemberRow } from "./views";

export const GUEST_GROUPS_KEY = ["k874", "guest-groups"] as const;

/** 口の答え（K-876 の形） */
export interface GuestGroupAnswer {
  id: string;
  name: string;
  /** 依頼が届く社内のグループ（消えていれば null・グループは残る） */
  request_scope: { id: string; name: string } | null;
  guests: { id: string; name: string; email: string; suspended: boolean }[];
  invitations: { id: string; email: string; left_days: number }[];
}

export interface GuestGroupsView {
  /** ゲストのタブの並び（部品の形） */
  groups: MemberGroup[];
  /** 口の答えのまま（招くの小窓の選び肢・名前 → id・届け先） */
  raw: GuestGroupAnswer[];
  /** タブの数（ゲストの人数＋招待中・止めている人も数える） */
  count: number;
}

const TONES: MemberGroup["tone"][] = ["amber", "indigo", "teal", "plum"];

const guestRow = (g: GuestGroupAnswer["guests"][number]): MemberRow => ({
  id: g.id,
  name: g.name,
  email: g.email,
  role: "ゲスト",
  state: "",
  stateTone: "none",
  ...(g.suspended ? { suspended: true } : {}),
});
const invitedRow = (v: GuestGroupAnswer["invitations"][number]): MemberRow => ({
  id: v.id,
  name: "",
  email: v.email,
  role: "ゲスト",
  state: "",
  stateTone: "none",
  invitedLeft: `${v.left_days} 日`,
});

/** 口の答え → 部品の形。招待中の行は、そのグループのゲストの並びの後ろに付ける */
export function toGuestView(groups: readonly GuestGroupAnswer[]): GuestGroupsView {
  const view = groups.map((g, i): MemberGroup => ({
    id: g.id,
    code: g.name.slice(0, 1),
    name: g.name,
    tone: TONES[i % TONES.length]!,
    ...(g.request_scope ? { inbox: g.request_scope.name } : {}),
    rows: [...g.guests.map(guestRow), ...g.invitations.map(invitedRow)],
  }));
  const count = groups.reduce((n, g) => n + g.guests.length + g.invitations.length, 0);
  return { groups: view, raw: [...groups], count };
}

/** 読めなかったときの答え（403・503 を画面が出し分ける） */
export class GuestGroupsError extends Error {
  readonly result: CallErr;
  constructor(result: CallErr) {
    super(result.code);
    this.result = result;
  }
}

export function useGuestGroups() {
  return useQuery({
    queryKey: GUEST_GROUPS_KEY,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<GuestGroupsView> => {
      const r = await call("listGuestGroups", { screenId: SCREEN });
      if (!r.ok) throw new GuestGroupsError(r);
      return toGuestView((r.data as unknown as { groups: GuestGroupAnswer[] }).groups ?? []);
    },
  });
}

/** ゲストのグループを作る（K-876 の createGuestGroup）。答えは 201 { group: { id, name, request_scope } } */
export async function createGuestGroup(
  body: { name: string; request_scope_id: string },
  idempotencyKey: string,
): Promise<{ ok: true; group: { id: string; name: string } } | CallErr> {
  const r = await call("createGuestGroup", { body, idempotencyKey, screenId: SCREEN });
  if (!r.ok) return r;
  const group = (r.data as unknown as { group: { id: string; name: string } }).group;
  return { ok: true, group };
}

/** 直す・消すの結果。ok でなければ画面が知らせを出す（error の code・status から） */
export type EditResult = { ok: true } | { ok: false; error: CallErr };

/** 名前を直す・消す。どちらも答えが来たら（うまくいった・もう無かった）一覧を 1 回読み直す */
export function useGuestGroupEdit() {
  const qc = useQueryClient();
  const reload = useCallback(() => qc.invalidateQueries({ queryKey: GUEST_GROUPS_KEY }), [qc]);
  const rename = useCallback(
    async (id: string, name: string): Promise<EditResult> => {
      const r = await call("updateGuestGroup", { params: { id }, body: { name }, screenId: SCREEN });
      if (r.ok || r.status === 404) await reload();
      return r.ok ? { ok: true } : { ok: false, error: r };
    },
    [reload],
  );
  const remove = useCallback(
    async (id: string): Promise<EditResult> => {
      const r = await call("deleteGuestGroup", { params: { id }, screenId: SCREEN });
      if (r.ok || r.status === 404) await reload();
      return r.ok ? { ok: true } : { ok: false, error: r };
    },
    [reload],
  );
  return { rename, remove };
}

/** ゲストを 1 人だけ：一時的に止める・戻す・外す（K-931） */
export type GuestAct = "suspend" | "resume" | "remove";
const ACT_OP = { suspend: "suspendMember", resume: "resumeMember", remove: "removeMember" } as const;
/** 一覧を読み直す答え（うまくいった・もう居ない・もう止まっている／戻っている） */
const RELOAD_CODES = ["E-MEM-002", "E-MEM-009", "E-MEM-010"];

/** 結果。error が null は網が切れた（口に届かない） */
export type GuestActResult = { ok: true } | { ok: false; error: CallErr | null };
export interface StepUpAsk {
  withCode: boolean;
  withPasskey: boolean;
}

/** 止める・戻す・外すの送る所（3 つとも同じ形）。二度押しで 2 回送らない。結果の出し分けは呼ぶ側（guest-tab.tsx）が onResult で決める */
export function useGuestAct(onResult: (r: GuestActResult) => void) {
  const qc = useQueryClient();
  const sending = useRef(false); // 答えを待つ間の 2 回目を止める（押せない形の前に押された分も）
  const target = useRef<{ act: GuestAct; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpAsk | null>(null);

  const askStepUp = async (): Promise<void> => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = (s.ok ? s.data : {}) as { two_factor?: boolean; has_password?: boolean };
    setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
  };

  const run = async (retried: boolean): Promise<void> => {
    const t = target.current;
    if (!t || sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call(ACT_OP[t.act], { params: { id: t.id }, body: {} as never, screenId: SCREEN });
      if (r.ok || r.status === 404 || RELOAD_CODES.includes(r.code))
        await qc.invalidateQueries({ queryKey: GUEST_GROUPS_KEY });
      if (r.ok) return onResult({ ok: true });
      if (r.kind === "step_up" && !retried) return await askStepUp();
      onResult({ ok: false, error: r });
    } catch {
      onResult({ ok: false, error: null });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    stepUp,
    /** 「本人確認して〇〇」を押したとき */
    send: (act: GuestAct, id: string) => {
      if (sending.current) return;
      target.current = { act, id };
      void run(false);
    },
    /** 取り直しが通った：同じ口を同じ体で 1 回だけやり直す */
    stepUpDone: () => {
      setStepUp(null);
      void run(true);
    },
    /** 取り直しをやめた：何も送らず確かめの小窓に戻る */
    stepUpCancel: () => setStepUp(null),
  };
}
