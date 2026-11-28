"use client";
// 詳細の本文を直す差し込み（K-447）。読む形：本文（children）の前に右寄せの「本文を直す」（完了したチケット・前の形のチケットでは出さない）。
//   押すと本文の場所が、上の帯（印・やめる・書き終える）・先に直された／ログイン切れの帯・口の断りの赤い箱・編集の部品（DocEditor）に替わる。
//   編集の部品は押すまで描かない（動的読み込みなので取り込みも押したときだけ）。編集の間は最も近い .k-detail-card に
//   data-body-editing="true" を付け、題の行のボタン（.k-page-acts）を CSS で引っ込める（ticket-detail.tsx に触らない）
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { DocEditor } from "@/features/F4/doc/editor";
import { versionsHref } from "@/features/F4/versions/versions-href";
import type { BodySlotProps, Detail } from "@/features/F4/create-ticket/detail-types";
import { useBodyEdit, canEditBody } from "./use-body-edit";
import { BodyEditBand, ConflictBand, DiscardDialog, EditFailBox, EnterButton, SessionLostBand } from "./edit-views";
import "@/features/F4/doc/doc.css";
import "@/features/F4/doc/extra.css";
import "./body-edit.css";

const CARD = ".k-detail-card";
const EDITING_ATTR = "data-body-editing";
const TEXTBOX = '[role="textbox"]';

/** 編集の部品が出たら本文に焦点を移す（部品は遅く読むので、出るまで待つ） */
function useFocusWhenReady(root: HTMLElement | null, want: boolean, done: () => void): void {
  useEffect(() => {
    if (!root || !want) return;
    const tryFocus = (): boolean => {
      const el = root.querySelector<HTMLElement>(TEXTBOX);
      if (!el) return false;
      el.focus();
      done();
      return true;
    };
    if (tryFocus()) return;
    const ob = new MutationObserver(() => {
      if (tryFocus()) ob.disconnect();
    });
    ob.observe(root, { childList: true, subtree: true });
    return () => ob.disconnect();
  }, [root, want, done]);
}

export function BodyEditSlot({ ticket, children }: BodySlotProps): ReactNode {
  const detail = ticket.detail as unknown as Detail;
  const edit = useBodyEdit(ticket);
  const { state } = edit;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wantFocus, setWantFocus] = useState(false);

  // 編集の間だけ、題の行のボタンを引っ込める印を詳細のカードに付ける
  useEffect(() => {
    const card = rootRef.current?.closest(CARD);
    if (!card || !state.open) return;
    card.setAttribute(EDITING_ATTR, "true");
    return () => card.removeAttribute(EDITING_ATTR);
  }, [state.open]);

  const doneFocus = useCallback(() => setWantFocus(false), []);
  useFocusWhenReady(rootRef.current, state.open && wantFocus, doneFocus);

  if (!state.open) {
    return (
      <div className="k-f4d-bodyedit" ref={rootRef}>
        {canEditBody(detail) ? (
          <EnterButton
            onEnter={() => {
              setWantFocus(true);
              edit.begin();
            }}
          />
        ) : null}
        {children}
      </div>
    );
  }

  const target = `${detail.ticket.number} ${detail.ticket.title}`;
  return (
    <div className="k-f4d-bodyedit" ref={rootRef}>
      <BodyEditBand
        savedAt={state.savedAt}
        saveFailed={state.saveFailed}
        busy={state.busy}
        onCancel={edit.cancel}
        onFinish={() => void edit.finish()}
      />
      {state.stale ? <ConflictBand compareHref={versionsHref(ticket.id)} onReread={edit.reread} /> : null}
      {state.lost ? <SessionLostBand onRelogin={edit.relogin} /> : null}
      {state.fail ? <EditFailBox text={state.fail} /> : null}
      <section className="k-f4d-body-wrap" aria-label="本文">
        <DocEditor doc={state.doc} onChange={edit.change} ariaLabel="本文" />
      </section>
      {state.confirm ? <DiscardDialog target={target} onKeep={edit.keepWriting} onDiscard={edit.discard} /> : null}
    </div>
  );
}
