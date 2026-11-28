"use client";
// 書き込みを直す・消す・☆ の器（K-394）。この 3 つの口を呼ぶのはこのファイルだけ（区画のファイル message-menu.tsx は口を呼ばず、ここの値と関数を使う）。
//   口の入力と答えの正は口の葉 K-386（updateTicketMessage・deleteTicketMessage・starTicketMessage）。
//   どれも送っている間は同じ書き込みの 2 本目を送らない。直した・消した答え（読む口と同じ 1 件）で一覧のその行を替え、読み直さない（replaceItem）。
//   ☆ は答えを待たずに押した形と数を替え（楽観の更新・setStar）、答えの数で直す。失敗したら元に戻す。
//   失敗の文：直すの網の切れ・5xx（正本に無い番号）は書く欄と同じ字・正本の番号はその文・422 は本文の理由。消すと ☆ は errorText(errorCodeOf(…))。
//   401 は前からの共通の扱い（call が入り直しへ送る）で、ここでは何も出さない
import { useQueryClient } from "@tanstack/react-query";
import { CATALOG } from "@kaname/errors/catalog";
import { useRef, useState } from "react";
import { errorCodeOf, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import type { TimelineItem } from "./to-items";
import { replaceItem, setStar } from "./use-timeline";

const SCREEN = "tickets";
/** 直すの網の切れ・5xx（正本に無い番号）の字（書く欄の部品 Composer の既定と同じ字） */
export const EDIT_FAILED_TEXT = "送れませんでした。もう一度お試しください（書いた字は残っています）";
/** 答えが届かなかった（網の切れ）ときの答えの種類。正本の番号は errorCodeOf が選ぶ */
const NO_REPLY: Pick<CallErr, "kind" | "code" | "status"> = { kind: "failed", code: "", status: 0 };

/** 正本の番号の文（正本に無ければ答えの種類から選ぶ） */
const catalogText = (r: Pick<CallErr, "kind" | "code" | "status">): string => errorText(errorCodeOf(r)).entry.message;

/** 直す口の失敗の字（401 は null＝出さない） */
function editErrorOf(r: CallErr): string | null {
  if (r.status === 401) return null;
  if (r.status === 422) return r.fields["body"] ?? Object.values(r.fields)[0] ?? catalogText(r);
  if (r.status >= 500 && !(r.code in CATALOG)) return EDIT_FAILED_TEXT;
  return catalogText(r);
}

export interface MessageState {
  /** 直す口を送っている間 */
  saving: boolean;
  /** 直す欄の上の知らせ（無ければ null） */
  editError: string | null;
  /** 消す口を送っている間 */
  deleting: boolean;
  /** 消す確かめの小窓の中の知らせ */
  deleteError: string | null;
  /** ☆ の口を送っている間 */
  starring: boolean;
  /** ☆ が失敗したときのパネルの知らせ */
  starError: string | null;
  /** 直す。直せたら true（一覧のその行は答えで替えてある） */
  edit: (body: string, mentionIds: string[]) => Promise<boolean>;
  /** 消す。消せたら true（その行は消した跡の 1 行に替えてある） */
  remove: () => Promise<boolean>;
  /** ☆ を付け外しする（今の数と押しているかから、答えを待たずに替える） */
  star: (now: { stars: number; starred: boolean }) => Promise<void>;
  /** 知らせを消す（直す欄・小窓を閉じたとき） */
  clearErrors: () => void;
}

/** 1 つの書き込みの器（詳細のチケットの id と書き込みの id） */
export function useMessage(ticketId: string, messageId: string): MessageState {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [starring, setStarring] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  // 送っている間の 2 本目を止める（state は描き直すまで古いので、印は ref で持つ）
  const busy = useRef({ edit: false, remove: false, star: false });

  const edit = async (body: string, mentionIds: string[]): Promise<boolean> => {
    if (busy.current.edit) return false;
    busy.current.edit = true;
    setSaving(true);
    try {
      const r = await call("updateTicketMessage", {
        params: { id: messageId },
        body: { body, mention_member_ids: mentionIds },
        screenId: SCREEN,
      });
      if (r.ok) {
        setEditError(null);
        replaceItem(qc, ticketId, messageId, r.data as unknown as TimelineItem);
        return true;
      }
      setEditError(editErrorOf(r));
      return false;
    } catch {
      setEditError(EDIT_FAILED_TEXT);
      return false;
    } finally {
      busy.current.edit = false;
      setSaving(false);
    }
  };

  const remove = async (): Promise<boolean> => {
    if (busy.current.remove) return false;
    busy.current.remove = true;
    setDeleting(true);
    try {
      const r = await call("deleteTicketMessage", { params: { id: messageId }, screenId: SCREEN });
      if (r.ok) {
        setDeleteError(null);
        replaceItem(qc, ticketId, messageId, r.data as unknown as TimelineItem);
        return true;
      }
      setDeleteError(r.status === 401 ? null : catalogText(r));
      return false;
    } catch {
      setDeleteError(catalogText(NO_REPLY));
      return false;
    } finally {
      busy.current.remove = false;
      setDeleting(false);
    }
  };

  const star = async (now: { stars: number; starred: boolean }): Promise<void> => {
    if (busy.current.star) return;
    busy.current.star = true;
    setStarring(true);
    setStarError(null);
    const back = () => setStar(qc, ticketId, messageId, now.stars, now.starred);
    setStar(qc, ticketId, messageId, Math.max(0, now.stars + (now.starred ? -1 : 1)), !now.starred);
    try {
      const r = await call("starTicketMessage", { params: { id: messageId }, body: {}, screenId: SCREEN });
      if (r.ok) {
        const d = r.data;
        if (typeof d.stars === "number" && typeof d.starred === "boolean")
          setStar(qc, ticketId, messageId, d.stars, d.starred);
        return;
      }
      back();
      setStarError(r.status === 401 ? null : catalogText(r));
    } catch {
      back();
      setStarError(catalogText(NO_REPLY));
    } finally {
      busy.current.star = false;
      setStarring(false);
    }
  };

  return {
    saving,
    editError,
    deleting,
    deleteError,
    starring,
    starError,
    edit,
    remove,
    star,
    clearErrors: () => {
      setEditError(null);
      setDeleteError(null);
    },
  };
}
