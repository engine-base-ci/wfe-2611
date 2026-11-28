"use client";
// メンバーを外す入れ物（K-822）：外す前の下見（previewMemberRemoval・K-815）→ 小窓か上の赤い箱 → 外す（removeMember・POST・K-848）。
//   引き継ぎ先は管理者が選び、選んだ人にそのまま移る（D-154.6）。本人確認の取り直しは StepUp で 1 回だけやり直す（K-363 と同じ形）。
//   候補はメンバーの並び（getWorkspaceMembers・口を増やさない）から作る（D-154.39・D-154.15）
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PAGE_ERROR, errorText } from "@/components/k";
import { MEMBERS_KEY, useMembers } from "@/features/F10/invite/use-members";
import { call, type CallErr } from "@/lib/api/call";
import type { Heir, RemoveTicket } from "./dialog-remove";

const SCREEN = "member-detail";
export const CHANGED_TEXT = "担当しているチケットが変わりました。もう一度確かめてください";
export const BLOCKED_TITLE = "外せません";
export const PREVIEW_FAILED = "確かめられませんでした";

interface Person {
  id?: string;
  name?: string;
  role?: string;
  group_role?: string | null;
  primary?: boolean;
  suspended?: boolean;
}
interface Group {
  members?: readonly Person[];
}
interface PreviewTicket {
  id: string;
  number: string;
  title: string;
  stage: string;
  handing?: boolean;
}
interface Preview {
  member: { id: string; name: string };
  blocked_by: null | "self" | "last_admin";
  tickets: PreviewTicket[];
}

/** 引き継ぎ先の候補：有効で・閲覧のみ／依頼する側でなく・外す本人でない人。招待中は並びの groups に居ない。兼ねる人は 1 度だけ */
export function candidates(groups: readonly Group[] | null | undefined, targetId: string): Heir[] {
  const seen = new Map<string, Heir>();
  for (const g of groups ?? []) {
    for (const m of g.members ?? []) {
      if (!m.id || !m.name || m.id === targetId || m.suspended || seen.has(m.id)) continue;
      if (m.role === "viewer" || m.role === "requester") continue;
      seen.set(m.id, { id: m.id, name: m.name });
    }
  }
  return [...seen.values()];
}

/** 初めの引き継ぎ先：外す人の主のグループのマネージャー（候補にいれば）・いなければ先頭 */
export function firstHeir(
  groups: readonly Group[] | null | undefined,
  targetId: string,
  heirs: readonly Heir[],
): string {
  const home = (groups ?? []).find((g) => g.members?.some((m) => m.id === targetId && m.primary !== false));
  const mgr = home?.members?.find(
    (m) => m.group_role === "manager" && m.id !== targetId && heirs.some((h) => h.id === m.id),
  );
  return mgr?.id ?? heirs[0]?.id ?? "";
}

/** 外せない訳の文（D-154.6・仮） */
export function blockedText(by: "self" | "last_admin", name: string): string {
  return by === "self"
    ? "自分は外せません。抜けるのは自分の設定から"
    : `${name}は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、外してください`;
}

/** 正本の文（無ければ共通の 1 件）。人の名前は答えの detail から */
function textOf(r: CallErr): string {
  const detail = (r.body["detail"] ?? {}) as Record<string, unknown>;
  const who = typeof detail["名前"] === "string" ? detail["名前"] : null;
  let msg: string;
  try {
    msg = errorText(r.code).entry.message;
  } catch {
    msg = errorText(r.status === 503 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed).entry.message;
  }
  if (!who) return msg;
  return msg.includes("{名前}") ? msg.replaceAll("{名前}", who) : `${who}：${msg}`;
}

export interface PageNotice {
  title?: string;
  text: string;
}

export function useMemberRemove({
  memberId,
  memberName,
  onClose,
  onNotice,
  onRemoved,
}: {
  memberId: string;
  memberName: string;
  /** 小窓を閉じた（やめる・外せない・もう居ない） */
  onClose: () => void;
  /** 詳細の上の赤い箱（null で消す） */
  onNotice: (n: PageNotice | null) => void;
  /** 外せた（知らせの文） */
  onRemoved: (text: string) => void;
}) {
  const qc = useQueryClient();
  // メンバーの並びは K-818 の useMembers（鍵 MEMBERS_KEY・中身は MembersView）。候補は答えの groups から作る
  const members = useMembers();
  const groups: readonly Group[] = members.data?.answer.groups ?? [];
  const heirs = candidates(groups, memberId);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<"all" | "each">("all");
  const [heirAll, setHeirAll] = useState("");
  const [heirOf, setHeirOf] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const sending = useRef(false);
  const started = useRef(false);

  const heir = heirAll || firstHeir(groups, memberId, heirs);

  const offlineText = () => errorText(PAGE_ERROR.offline).entry.message;

  async function readPreview(): Promise<Preview | null> {
    let res;
    try {
      res = await call("previewMemberRemoval", { params: { id: memberId }, screenId: SCREEN });
    } catch {
      // 網が切れた（口に届かない）：小窓は開かず、上の箱に正本の offline の文
      onNotice({ title: PREVIEW_FAILED, text: offlineText() });
      onClose();
      return null;
    }
    if (res.ok) return res.data as unknown as Preview;
    if (res.status === 404) {
      onNotice({ text: errorText(PAGE_ERROR.notFound).entry.message });
      void qc.invalidateQueries({ queryKey: ["k819", "member", memberId] });
    } else onNotice({ title: PREVIEW_FAILED, text: textOf(res) });
    onClose();
    return null;
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onNotice(null);
    void readPreview().then((p) => {
      if (!p) return;
      if (p.blocked_by) {
        onNotice({ title: BLOCKED_TITLE, text: blockedText(p.blocked_by, p.member.name || memberName) });
        onClose();
        return;
      }
      setPreview(p);
    });
    // 開くたびに 1 回だけ（入れ物は開くときに部品を置き、閉じるときに外す）
  }, []);

  const tickets = preview?.tickets ?? [];
  const body = (): Record<string, unknown> => {
    if (tickets.length === 0) return {};
    if (mode === "all") return { transfer_to_member_id: heir };
    return { transfers: tickets.map((t) => ({ ticket_id: t.id, to_member_id: heirOf[t.id] ?? heir })) };
  };

  /** 外す。retried＝本人確認を取り直した後の送り直し（1 回だけ。2 回目の取り直しの求めは赤い箱に出して止める） */
  async function remove(sent: Record<string, unknown>, retried: boolean): Promise<void> {
    if (sending.current) return;
    if (!retried && needStepUp.current) {
      setNotice(undefined);
      setStepUp(needStepUp.current);
      return;
    }
    sending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      // 体は K-848 の契約（transfer_to_member_id か transfers・担当 0 件は {}）
      const res = await call("removeMember", { params: { id: memberId }, body: sent as never, screenId: SCREEN });
      if (res.ok || res.kind !== "step_up" || retried) needStepUp.current = null;
      if (res.ok) {
        setStepUp(null);
        const n = (res.data as unknown as { tickets_moved?: number }).tickets_moved ?? tickets.length;
        const moved =
          tickets.length === 0
            ? "担当のチケットはありませんでした"
            : mode === "all"
              ? `担当のチケット ${n} 件は ${heirs.find((h) => h.id === heir)?.name ?? ""} さんに移りました`
              : `担当のチケット ${n} 件の引き継ぎ先を選んだ人に移りました`;
        await qc.invalidateQueries({ queryKey: MEMBERS_KEY });
        onRemoved(`${memberName} さんを外しました。${moved}。30 日のあいだは、同じメールで招き直すと戻せます`);
        return;
      }
      if (res.kind === "step_up" && retried) {
        setStepUp(null);
        setNotice(textOf(res));
        return;
      }
      if (res.kind === "step_up") {
        const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
        const sec = (s.ok ? s.data : {}) as { two_factor?: boolean; has_password?: boolean };
        needStepUp.current = { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
        setStepUp(needStepUp.current);
        return;
      }
      setStepUp(null);
      if (res.kind === "unauthenticated") return; // call が入り直しへ送る
      if (res.code === "E-MEM-020") {
        const p = await readPreview();
        if (p) setPreview(p);
        setNotice(CHANGED_TEXT);
        return;
      }
      if (res.code === "E-MEM-021" || res.code === "E-MEM-022" || res.code === "E-MEM-023") {
        setNotice(textOf(res));
        await qc.invalidateQueries({ queryKey: MEMBERS_KEY });
        return;
      }
      if (res.code === "E-MEM-004" || res.code === "E-MEM-005") {
        onNotice({
          title: BLOCKED_TITLE,
          text: blockedText(res.code === "E-MEM-005" ? "self" : "last_admin", memberName),
        });
        onClose();
        return;
      }
      if (res.code === "E-MEM-002") {
        onNotice({ text: errorText(PAGE_ERROR.notFound).entry.message });
        void qc.invalidateQueries({ queryKey: ["k819", "member", memberId] });
        onClose();
        return;
      }
      setNotice(textOf(res));
    } catch {
      setStepUp(null);
      setNotice(offlineText()); // 網が切れた：小窓の赤い箱・選びは残る
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const lastBody = useRef<Record<string, unknown>>({});
  return {
    /** 下見を読み終えて小窓を出してよい */
    ready: preview !== null,
    stepUp,
    reason: `${memberName} をワークスペースから外す前に、本人か確かめます`,
    onStepUpDone: () => void remove(lastBody.current, true),
    onStepUpCancel: () => setStepUp(null),
    dialog: {
      name: preview?.member.name || memberName,
      mode: (tickets.length === 0 ? "none" : mode) as "all" | "each" | "none",
      tickets: tickets.map((t): RemoveTicket => ({
        id: t.id,
        code: t.number,
        title: t.title,
        status: t.stage,
        handing: Boolean(t.handing),
      })),
      heir,
      heirs,
      heirOf,
      busy,
      ...(notice ? { notice } : {}),
      onMode: (m: "all" | "each") => {
        setMode(m);
        setHeirOf({});
      },
      onHeirAll: (id: string) => setHeirAll(id),
      onHeirOf: (ticket: string, id: string) => setHeirOf((o) => ({ ...o, [ticket]: id })),
      onSubmit: () => {
        lastBody.current = body();
        void remove(lastBody.current, false);
      },
      onCancel: () => {
        if (!sending.current) onClose();
      },
    },
  };
}
