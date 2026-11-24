"use client";
// 左のメニューの保存した条件（K-599 が置いた差し込み口を K-479 が本物にする）。Shell の belowGroups（グループの行の全部の下）に入る。
//   読みは外枠の口 getShell の答えの saved_views（外枠と同じ問い合わせ・口を増やさない）。無い・読めない形なら何も出さない。
//   保存した条件を持つグループごとに、グループ名の小さな見出しと並びを出す（グループの行は外枠の 1 つだけ・bare）。
//   押すと、列と行の高さを端末の覚えに書いてから一覧へ移る。今の URL と同じ条件に aria-current
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { notify } from "@/components/k";
import { scopeTone } from "@/features/F4/create-ticket/ticket-shell";
import { hrefOf, isCurrent, rememberLook, takeUnreadableFlag, type ViewRow } from "./open-view";
import { DeleteViewConfirm, RenameViewDialog } from "./saved-view-actions";
import { SavedViewNav } from "./saved-view-nav";
import { useAfterMount, useSavedViews, useUrlSearch } from "./use-saved-views";
import "./saved.css";

/** 本物（K-479） */
export const READY = true;

const UNREADABLE_TEXT = "この条件の中身を読めませんでした。絞りなしで開いています";

export interface SavedViewSlotProps {
  /** ログイン済みのとき true（ログイン前に口を呼ばない） */
  enabled: boolean;
}

type Acting = { kind: "rename" | "delete"; view: ViewRow } | null;

export function SavedViewSlot({ enabled }: SavedViewSlotProps): ReactNode {
  const { views, groups } = useSavedViews(enabled);
  const search = useUrlSearch();
  const mounted = useAfterMount();
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [acting, setActing] = useState<Acting>(null);

  // 読めない中身で開いて移ってきたら、1 回だけお知らせ
  useEffect(() => {
    if (enabled && mounted && takeUnreadableFlag()) notify(UNREADABLE_TEXT);
  }, [enabled, mounted]);

  const byGroup = useMemo(() => {
    if (!views) return [];
    const live = views.filter((v) => !gone.has(v.id));
    return groups.flatMap((g) => {
      const mine = live.filter((v) => v.scope_id === g.id);
      return mine.length ? [{ group: g, views: mine }] : [];
    });
  }, [views, groups, gone]);

  if (!enabled || byGroup.length === 0) return null;
  const find = (id: string): ViewRow | undefined => views?.find((v) => v.id === id);
  const onGone = (id: string) => setGone((s) => new Set([...s, id]));

  return (
    <>
      {byGroup.map(({ group, views: list }) => (
        <SavedViewNav
          key={group.id}
          bare
          group={{
            code: group.ticket_prefix || group.name.slice(0, 1),
            name: group.name,
            tone: scopeTone(groups, group.id),
          }}
          views={list.map((v) => ({
            id: v.id,
            name: v.name,
            shared: v.share === "group",
            canEdit: v.can_edit,
            href: hrefOf(v),
            current: isCurrent(v, search),
          }))}
          onOpen={(id) => {
            const v = find(id);
            if (v) rememberLook(v);
          }}
          onRename={(id) => {
            const v = find(id);
            if (v) setActing({ kind: "rename", view: v });
          }}
          onDelete={(id) => {
            const v = find(id);
            if (v) setActing({ kind: "delete", view: v });
          }}
        />
      ))}
      {acting?.kind === "rename" ? (
        <RenameViewDialog view={acting.view} onClose={() => setActing(null)} onGone={onGone} />
      ) : null}
      {acting?.kind === "delete" ? (
        <DeleteViewConfirm view={acting.view} onClose={() => setActing(null)} onGone={onGone} />
      ) : null}
    </>
  );
}
