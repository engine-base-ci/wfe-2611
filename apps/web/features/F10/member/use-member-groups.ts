"use client";
// メンバーの 1 人のグループを移す・兼ねるグループを足す外す（K-820・行為 A61・D-154.15・.34）。小窓の入れ物（detail-dialogs.tsx）が使う。
//   選び：開くたびにグループの一覧を getWorkspaceMembers の groups[]（id・name）から 1 回読む（口を増やさない）。
//   送る：updateMemberGroups（K-812・PATCH /api/v1/members/<id>/groups）の体 { primary_scope_id? , add_scope_ids?, remove_scope_ids? }。role_key は送らない。
//   403・STEP_UP_REQUIRED → getMySecurity を 1 回読んで取り直しの小窓 → 通ったら同じ体で 1 回だけやり直す・やめたら何も送らない（K-363 と同じ形）。
//   失敗の出し分けは答えの code：E-MEM-002（もう居ない）→ 閉じて詳細を読み直す／E-MEM-006・007（グループが変わった）→ 赤い箱＋選びを読み直す／ほか → 赤い箱（中身は残る）
import { useCallback, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";

const SCREEN = "member-detail";
/** もう居ない（閉じて詳細を読み直す） */
const GONE = "E-MEM-002";
/** グループが変わった（赤い箱と選びの読み直し） */
const STALE = ["E-MEM-006", "E-MEM-007"];

/** その人のグループ（getMember・updateMemberGroups の答えの groups[]・主が先） */
export interface MemberGroupRef {
  id: string;
  name: string;
  code?: string | null;
  primary: boolean;
  role?: string | null;
}
/** 会社のグループ（選びの元） */
export interface ScopeChoice {
  id: string;
  name: string;
}
/** 送る体（K-812。1 つは要る） */
export interface GroupsBody {
  primary_scope_id?: string;
  add_scope_ids?: string[];
  remove_scope_ids?: string[];
}
interface GroupsAnswer {
  member_id: string;
  company_role?: string;
  groups: MemberGroupRef[];
}
interface StepUpNeed {
  withCode: boolean;
  withPasskey: boolean;
}

const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
const noticeOf = (r: CallErr): string => msgOf(r.code) || r.message || msgOf(errorCodeOf(r));

export interface UseMemberGroupsOpts {
  /** 成功：答えの groups で区画を差し替える */
  onChanged: (groups: MemberGroupRef[]) => void;
  /** もう居ない：小窓を閉じて詳細を読み直す */
  onGone: () => void;
}

export function useMemberGroups(id: string, { onChanged, onGone }: UseMemberGroupsOpts) {
  const [choices, setChoices] = useState<ScopeChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<StepUpNeed | null>(null);
  const sending = useRef(false);
  const pending = useRef<GroupsBody | null>(null);

  /** グループの一覧を 1 回読む（読めなければ選びは空のまま・赤い箱） */
  const loadChoices = useCallback(async (): Promise<void> => {
    try {
      const r = await call("getWorkspaceMembers", { screenId: SCREEN });
      if (!r.ok) return setError(noticeOf(r));
      const groups = ((r.data as { groups?: unknown }).groups ?? []) as ScopeChoice[];
      setChoices(groups.map((g) => ({ id: g.id, name: g.name })));
    } catch {
      setError(msgOf(PAGE_ERROR.offline));
    }
  }, []);

  /** 開くとき：前の失敗と取り直しを消して、選びを読み直す */
  const reset = useCallback(() => {
    setError(null);
    setStepUp(null);
    pending.current = null;
    setChoices(null);
    void loadChoices();
  }, [loadChoices]);

  const askStepUp = async (): Promise<void> => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = (s.ok ? s.data : {}) as { two_factor?: boolean; has_password?: boolean };
    setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
  };

  /** 送る。成功なら true（呼ぶ側が小窓を閉じて知らせを出す） */
  const send = async (body: GroupsBody, retried = false): Promise<boolean> => {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await call("updateMemberGroups", { params: { id }, body, screenId: SCREEN });
      if (r.ok) {
        pending.current = null;
        onChanged(((r.data as unknown as GroupsAnswer).groups ?? []) as MemberGroupRef[]);
        return true;
      }
      if (r.kind === "step_up" && !retried) {
        pending.current = body;
        await askStepUp();
        return false;
      }
      if (r.kind === "unauthenticated") return false; // call が入り直しへ送る
      if (r.code === GONE) {
        onGone();
        return false;
      }
      setError(noticeOf(r));
      if (STALE.includes(r.code)) void loadChoices();
      return false;
    } catch {
      setError(msgOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）：中身は残す
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  /** 取り直しが通った：止まった体で 1 回だけやり直す */
  const retry = async (): Promise<boolean> => {
    setStepUp(null);
    const body = pending.current;
    pending.current = null;
    return body ? send(body, true) : false;
  };
  /** 取り直しをやめた：何も送らない（小窓に戻る） */
  const cancelStepUp = () => {
    setStepUp(null);
    pending.current = null;
  };

  return { choices, busy, error, stepUp, reset, send, retry, cancelStepUp };
}
