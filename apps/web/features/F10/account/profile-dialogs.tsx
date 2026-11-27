"use client";
// 自分の設定の小窓の登録口（K-839）。K-840 がメールを変える小窓、K-841 がワークスペースから抜ける小窓を足す。
//   登録の無い操作（「変える」「抜ける」）は押せない形（aria-disabled・title「まだ使えません」）で出す。試験は登録の行を字で読む
import { useState, type ComponentType, type ReactNode } from "react";
import { LeaveWorkspace } from "./leave-workspace";
import type { MeAnswer, MeWorkspace } from "./me-shape";

export type ProfileDialogKey = "email" | "leave";
export interface ProfileDialogProps {
  me: MeAnswer;
  /** 抜けるワークスペース（leave のとき） */
  workspace?: MeWorkspace;
  onClose: () => void;
  /** 答えの差し替え（口の答えで今の画面を直す） */
  replace: (fn: (now: MeAnswer) => MeAnswer) => void;
  /** 読み直し */
  reload: () => Promise<void>;
}

export const PROFILE_DIALOGS: Partial<Record<ProfileDialogKey, ComponentType<ProfileDialogProps>>> = {
  // K-840 が email、K-841 が leave を 2 字下げの キー: 部品, の形で 1 行ずつ足す
  leave: LeaveWorkspace,
};

/** 登録が無い操作（押せない形にする） */
export const inertDialogs = (): ProfileDialogKey[] => (["email", "leave"] as const).filter((k) => !PROFILE_DIALOGS[k]);

interface Open {
  key: ProfileDialogKey;
  workspace?: MeWorkspace;
}

/** 小窓を開く。node は画面に置く物（開いていなければ null） */
export function useOpenDialog(
  me: MeAnswer | undefined,
  tools: Pick<ProfileDialogProps, "replace" | "reload">,
): { open: (key: ProfileDialogKey, workspace?: MeWorkspace) => void; node: ReactNode } {
  const [now, setNow] = useState<Open | null>(null);
  const Dialog = now ? PROFILE_DIALOGS[now.key] : undefined;
  const node =
    Dialog && me && now ? (
      <Dialog
        me={me}
        {...(now.workspace ? { workspace: now.workspace } : {})}
        onClose={() => setNow(null)}
        replace={tools.replace}
        reload={tools.reload}
      />
    ) : null;
  return {
    open: (key, workspace) => {
      if (PROFILE_DIALOGS[key]) setNow({ key, ...(workspace ? { workspace } : {}) });
    },
    node,
  };
}
