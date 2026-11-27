"use client";
// メンバーの画面の「ゲスト」のタブの入れ物（K-874）と、グループの行の「⋯」から名前を直す・消す（K-928・口は K-927）。
//   読むのは use-guest-groups（listGuestGroups）。空・読めない（503）・権限が無い（403）は K-874 の形。
//   名前を直す：毎回今の名前で開く・前後の空白を取って送る・変えなければ口を呼ばず閉じる・空は「名前を入れてください」。
//   消す：確かめに中のゲストの数（止めている人も数える）・送っている間は 2 回目を呼ばない。
//   失敗：404・E-GST-001 は知らせ＋小窓を閉じて読み直す／409・E-GST-002 は欄の下（文は正本の番号で引く）／403・503 などは小窓の中の赤の知らせ（値は残る）。
//   画面は役の名前で出し分けない（直せるか・消せるかは口の 403 が決める）
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  NoAccess,
  PAGE_ERROR,
  errorText,
  useNotify,
} from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { GuestGroupDeleteConfirm, GuestGroupRenameDialog } from "./guest-group-views";
import { useGuestGroupEdit, useGuestGroups, type GuestGroupAnswer } from "./use-guest-groups";

const E_NOT_FOUND = "E-GST-001";
const E_DUP_NAME = "E-GST-002";
const EMPTY_NAME = "名前を入れてください";
const TONES = ["amber", "indigo", "teal", "plum"] as const;
const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

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

function GuestPerson({ p }: { p: GuestGroupAnswer["guests"][number] }) {
  return (
    <li className="k-inv-row" data-guest>
      <span className="k-inv-avatar" aria-hidden="true">
        {p.name.slice(0, 1)}
      </span>
      <span className="k-inv-who">
        <span className="k-inv-name">{p.name}</span>
        <span className="k-inv-sub">{p.email}</span>
      </span>
      <span className="k-inv-role-cell">
        <button type="button" className="k-inv-role" {...inert}>
          ゲスト ▾
        </button>
      </span>
      <span className="k-inv-state" data-tone={p.suspended ? "warn" : "none"}>
        {p.suspended ? "一時的に止まっている" : ""}
      </span>
      <span className="k-inv-more">
        {/* 一時的に止める・戻す・外すを押せる形にするのは K-931（answer=03b52b9684c4） */}
        <Menu>
          <MenuTrigger className="k-btn" label={`${p.name}のほかの操作`}>
            ⋯
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem disabled>{p.suspended ? "戻す" : "一時的に止める"}</MenuItem>
            <MenuItem disabled>外す</MenuItem>
          </MenuPopup>
        </Menu>
      </span>
    </li>
  );
}

function GuestInvited({ i }: { i: GuestGroupAnswer["invitations"][number] }) {
  return (
    <li className="k-inv-row">
      <span className="k-inv-avatar" data-invited aria-hidden="true">
        ？
      </span>
      <span className="k-inv-who">
        <span className="k-inv-name">{i.email}</span>
        <span className="k-inv-sub">{`招待中 ・ あと ${i.left_days} 日`}</span>
      </span>
      <span className="k-inv-role-cell">
        <Badge tone="progress">招待中</Badge>
      </span>
      <span className="k-inv-state" data-tone="none" />
      <span className="k-inv-more">
        <Button variant="outlined" size="sm" {...inert}>
          送り直す
        </Button>
      </span>
    </li>
  );
}

function GuestGroupSection({
  g,
  index,
  onInvite,
  onRename,
  onDelete,
}: {
  g: GuestGroupAnswer;
  index: number;
  onInvite?: (groupId: string) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const head = `ggrp-${g.id}`;
  const invited = g.invitations.length;
  return (
    <section className="k-inv-group" aria-labelledby={head}>
      <div className="k-inv-group-head">
        <span className="k-inv-code" data-tone={TONES[index % TONES.length]} aria-hidden="true">
          {g.name.slice(0, 1)}
        </span>
        <h2 id={head} className="k-inv-group-name">
          {g.name}
        </h2>
        <span className="k-inv-sub">{`${g.guests.length} 人${invited ? ` ＋ 招待中 ${invited}` : ""}`}</span>
        {g.request_scope ? <span className="k-inv-sub">{`依頼は ${g.request_scope.name} に届く`}</span> : null}
        <Button
          variant="ghost"
          size="sm"
          className="k-inv-group-invite"
          {...(onInvite ? { onClick: () => onInvite(g.id) } : inert)}
        >
          ＋ このゲストのグループに招く
        </Button>
        <Menu>
          <MenuTrigger className="k-btn" label={`${g.name}のほかの操作`}>
            ⋯
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onSelect={onRename}>名前を直す</MenuItem>
            <MenuItem onSelect={onDelete}>消す</MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      <ul className="k-inv-rows">
        {g.guests.map((p) => (
          <GuestPerson key={p.id} p={p} />
        ))}
        {g.invitations.map((i) => (
          <GuestInvited key={i.id} i={i} />
        ))}
      </ul>
    </section>
  );
}

/** ゲストのタブの本文。onInvite はグループの行の「＋ このゲストのグループに招く」（招くの小窓を開く・K-874） */
export function GuestTab({ onInvite }: { onInvite?: (groupId: string) => void }) {
  const q = useGuestGroups();
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

  if (q.isPending) return null;
  if (q.isError) {
    if (q.error.status === 403) return <NoAccess />;
    return <ErrorState code={PAGE_ERROR.down} acts={[() => void q.refetch()]} />;
  }
  const groups = q.data;
  return (
    <div className="k-inv-body">
      {groups.length === 0 ? <Empty title="ゲストのグループがまだありません" /> : null}
      {groups.map((g, i) => (
        <GuestGroupSection
          key={g.id}
          g={g}
          index={i}
          {...(onInvite ? { onInvite } : {})}
          onRename={() => setEditing({ kind: "rename", group: g, name: g.name, saving: false })}
          onDelete={() => setEditing({ kind: "delete", group: g, busy: false })}
        />
      ))}
      <p className="k-inv-sub">
        ゲストのグループは見せ方のまとまりだけ（決まりやページは持たない）。グループの依頼とそのチケット、見せる相手にグループが選ばれたチケットを、グループのゲスト全員が見る。別のゲストのグループどうしは互いに見えない
      </p>
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
    </div>
  );
}
