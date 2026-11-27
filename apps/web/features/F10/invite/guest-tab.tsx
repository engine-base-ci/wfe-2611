"use client";
// ゲストのタブの中身の入れ物（K-874）：並びのほかの 3 つの形（空・読めない・権限が無い）。並びそのものは MembersBody（views.tsx）が描く。
//   空：「ゲストのグループがまだありません」（作るボタンは見出しの行の 1 つだけ・K874-UI-004）
//   読めない（503 など）：文「読めませんでした」＋［再読み込み］（K874-UI-005）。メンバーのタブはそのまま出る
//   権限が無い（403）：NoAccess（E-PAGE-002）。画面は役の名前で出し分けない（読めるかは口が決める）
// グループの行の「⋯」から名前を直す・消す（K-928・口は K-927）：useGuestGroupEditing が小窓の開け閉めと送るを持つ。
//   名前を直す：毎回今の名前で開く・前後の空白を取って送る・変えなければ口を呼ばず閉じる・空は「名前を入れてください」。
//   消す：確かめに中のゲストの数（止めている人も数える）・送っている間は 2 回目を呼ばない。
//   失敗：404・E-GST-001 は知らせ＋小窓を閉じて読み直す／409・E-GST-002 は欄の下（文は正本の番号で引く）／403・503 などは小窓の中の赤の知らせ（値は残る）。
//   画面は役の名前で出し分けない（直せるか・消せるかは口の 403 が決める）
import { useRef, useState, type ReactNode } from "react";
import { Button, Empty, NoAccess, PAGE_ERROR, errorText, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { GuestGroupDeleteConfirm, GuestGroupRenameDialog } from "./guest-group-views";
import { useGuestGroupEdit, type GuestGroupAnswer } from "./use-guest-groups";

export type GuestTabState = "empty" | "failed" | "forbidden";

export function GuestTabContent({ state, onRetry }: { state: GuestTabState; onRetry: () => void }) {
  if (state === "forbidden") return <NoAccess />;
  if (state === "failed")
    return (
      <section className="k-state" data-state="error" aria-label="ゲストのグループ">
        <p className="k-state-title">読めませんでした</p>
        <div className="k-state-actions">
          <Button variant="outlined" onClick={onRetry}>
            再読み込み
          </Button>
        </div>
      </section>
    );
  return <Empty title="ゲストのグループがまだありません" />;
}

const E_NOT_FOUND = "E-GST-001";
const E_DUP_NAME = "E-GST-002";
const EMPTY_NAME = "名前を入れてください";

/** 正本の文（番号で引く）。正本に無い番号は落とさず番号の字を出す */
function catalogMessage(code: string): string {
  try {
    return errorText(code).entry.message;
  } catch {
    return code;
  }
}

/** 小窓の中の赤の知らせの字：403 は権限の文の頭、ほかは読めない・送れない共通の文の頭 */
function alertOf(e: CallErr): string {
  return errorText(e.status === 403 ? PAGE_ERROR.forbidden : PAGE_ERROR.down).title;
}

/** 前後の空白（全角も・String.prototype.trim は U+3000 も取る）を取る */
const trimName = (s: string): string => s.trim();

type Editing =
  | { kind: "rename"; group: GuestGroupAnswer; name: string; error?: string; alert?: string; saving: boolean }
  | { kind: "delete"; group: GuestGroupAnswer; alert?: string; busy: boolean };

/** グループの「⋯」の名前を直す・消す（K-928）。startRename・startDelete で開き、dialogs を画面に置く */
export function useGuestGroupEditing(): {
  startRename: (g: GuestGroupAnswer) => void;
  startDelete: (g: GuestGroupAnswer) => void;
  dialogs: ReactNode;
} {
  const { rename, remove } = useGuestGroupEdit();
  const notify = useNotify();
  const [editing, setEditing] = useState<Editing | null>(null);
  const sending = useRef(false); // 答えを待つ間の 2 回目を止める（押せない形の前に押された分も）

  const submitRename = async (): Promise<void> => {
    if (editing?.kind !== "rename" || sending.current) return;
    const name = trimName(editing.name);
    if (!name) {
      setEditing({ ...editing, error: EMPTY_NAME });
      return;
    }
    if (name === editing.group.name) {
      setEditing(null); // 変えていなければ口を呼ばない
      return;
    }
    sending.current = true;
    setEditing({ ...editing, saving: true });
    const r = await rename(editing.group.id, name);
    sending.current = false;
    if (r.ok) {
      setEditing(null);
      notify("ゲストのグループの名前を直しました");
    } else if (r.error.code === E_NOT_FOUND || r.error.status === 404) {
      setEditing(null);
      notify(catalogMessage(E_NOT_FOUND), { type: "error" });
    } else if (r.error.code === E_DUP_NAME) {
      setEditing({ ...editing, saving: false, error: catalogMessage(E_DUP_NAME) });
    } else {
      setEditing({ ...editing, saving: false, alert: alertOf(r.error) });
    }
  };

  const submitDelete = async (): Promise<void> => {
    if (editing?.kind !== "delete" || sending.current) return;
    const { group } = editing;
    sending.current = true;
    setEditing({ ...editing, busy: true });
    const r = await remove(group.id);
    sending.current = false;
    if (r.ok) {
      setEditing(null);
      notify(`ゲストのグループ「${group.name}」を消しました`);
    } else if (r.error.code === E_NOT_FOUND || r.error.status === 404) {
      setEditing(null);
      notify(catalogMessage(E_NOT_FOUND), { type: "error" });
    } else {
      setEditing({ ...editing, busy: false, alert: alertOf(r.error) });
    }
  };

  const dialogs = (
    <>
      {editing?.kind === "rename" ? (
        <GuestGroupRenameDialog
          name={editing.name}
          saving={editing.saving}
          {...(editing.error ? { error: editing.error } : {})}
          {...(editing.alert ? { alert: editing.alert } : {})}
          onChange={(name) =>
            setEditing({
              kind: "rename",
              group: editing.group,
              name,
              saving: editing.saving,
              ...(editing.alert ? { alert: editing.alert } : {}),
            })
          }
          onSubmit={() => void submitRename()}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      {editing?.kind === "delete" ? (
        <GuestGroupDeleteConfirm
          name={editing.group.name}
          guests={editing.group.guests.length}
          invited={editing.group.invitations.length}
          busy={editing.busy}
          {...(editing.alert ? { alert: editing.alert } : {})}
          onOpenChange={(o) => (o ? undefined : setEditing(null))}
          onConfirm={() => void submitDelete()}
        />
      ) : null}
    </>
  );
  return {
    startRename: (g) => setEditing({ kind: "rename", group: g, name: g.name, saving: false }),
    startDelete: (g) => setEditing({ kind: "delete", group: g, busy: false }),
    dialogs,
  };
}
