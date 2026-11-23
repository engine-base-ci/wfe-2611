"use client";
// 1 つの書き込みを描く入れ物（K-392 が受ける物を広げ、「…」・☆・直す・消すの中身は K-394 が作る）。口は呼ばない（器 use-message.ts の値と関数を部品 views.tsx に渡す）。
//   「…」の出し分けは答えの can_edit・can_delete（見ている人ごとに口が返す）：両方 → 直す・消す…／消すだけ → 消す…（マネージャーが人の書き込み）／どちらも無い → 出さない。
//   直すのはその場（書き込みの箱が直す欄に替わる）。やめる・Esc は口を呼ばずに元の形へ。空白だけなら「直す」を押せない。直す欄でも @ の候補（K-393 の use-mention.ts）。
//   消すは確かめの小窓を通す。残る 1 行の名前は呼ばれ方（自分の物は書いた人・マネージャーのときの自分は見られる人の自分の行）。/me の表示名（ticket.me）は使わない。
//   ☆ は答えを待たずに替え、失敗したら元に戻してパネルに知らせる
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Callout, Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/k";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { callNameOf, mentionIds } from "./mention";
import type { PersonRow, TimelineItem, Who } from "./to-items";
import { useMention } from "./use-mention";
import { useMessage } from "./use-message";
import { useMeId } from "./use-post";
import { DeleteMessageConfirm, EditingPost, Post, type PostView } from "./views";

export interface MessageMenuProps {
  ticket: SlotTicket;
  item: TimelineItem;
  post: PostView;
  /** そのチケットを見られる人（直す欄の @ の候補） */
  people: PersonRow[];
  /** 「引用」を押したとき */
  onQuote: () => void;
  /** 「決定にする」の置き場 */
  decideSlot: ReactNode;
}

const MORE_LABEL = "この書き込みの操作";
/** 小窓が閉じきるまで待って「…」に焦点を戻す（小窓が自分で焦点を戻す動きの後に置く・何フレームか待つ） */
const FRAMES_TO_FOCUS = 10;
function focusMore(anchorId: string, left = FRAMES_TO_FOCUS): void {
  const open = document.querySelector('[role="alertdialog"]');
  const btn = document.getElementById(anchorId)?.querySelector<HTMLElement>(`[aria-label="${MORE_LABEL}"]`);
  if (!open && btn) btn.focus();
  else if (left > 0) requestAnimationFrame(() => focusMore(anchorId, left - 1));
}

/** 前から @ していた人を、字に残っているかを見る形にする */
const asRow = (w: Who): PersonRow => ({ ...w, label: "", is_assignee: false, is_approver: false });

export function MessageMenu({ ticket, item, post, people, onQuote, decideSlot }: MessageMenuProps): ReactNode {
  const anchorId = `msg-${item.id}`;
  const m = item.message;
  const meId = useMeId();
  const msg = useMessage(ticket.id, item.id);
  const mention = useMention(people, meId);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const caretAfter = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);

  // 直す欄を開いたら欄に焦点（打つ所は字の終わり）
  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [editing]);
  // @ の候補を入れた後の打つ所
  useEffect(() => {
    if (caretAfter.current === null) return;
    boxRef.current?.setSelectionRange(caretAfter.current, caretAfter.current);
    caretAfter.current = null;
  }, [text]);

  const own = Boolean(m?.can_edit && m.can_delete);
  const canDelete = Boolean(m?.can_delete);
  const author = item.actor ? callNameOf(item.actor) : "";
  const meRow = useMemo(() => people.find((p) => p.member_id === meId) ?? null, [people, meId]);
  // マネージャーが人の書き込みを消すときの残る 1 行（自分の名前が分かるまでは消す…を押せない）
  const managerLine = !own && meRow ? `マネージャーの ${callNameOf(meRow)} が ${author} の書き込みを消しました` : null;

  const closeEdit = () => {
    setEditing(false);
    setText("");
    mention.onInput("", 0);
    mention.reset();
    msg.clearErrors();
  };
  const startEdit = () => {
    msg.clearErrors();
    setText(m?.body ?? "");
    setEditing(true);
  };
  const onText = (s: string) => {
    setText(s);
    mention.onInput(s, boxRef.current?.selectionStart ?? s.length);
  };
  const blank = text.trim() === "";
  const save = async () => {
    if (blank || msg.saving) return;
    // 送る @ の人：選んだ人と、前から @ していた人のうち、字に残っている人
    const prev = mentionIds(text, (m?.mentions ?? []).map(asRow), people);
    const ids = [...new Set([...mention.idsIn(text), ...prev])];
    if (await msg.edit(text, ids)) closeEdit();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const r = mention.onKey(e);
    if (r !== null) {
      e.preventDefault();
      if (r !== "handled") {
        caretAfter.current = r.caret;
        setText(r.text);
      }
      return;
    }
    if (e.key === "Escape" && !msg.saving) {
      e.preventDefault();
      closeEdit();
    }
  };

  if (editing)
    return (
      <EditingPost
        post={post}
        text={m?.body ?? ""}
        value={text}
        onText={onText}
        onCancel={closeEdit}
        onSave={() => void save()}
        saving={msg.saving}
        saveDisabled={blank}
        {...(msg.editError ? { error: msg.editError } : {})}
        mentions={mention.options.map((p) => ({ name: p.display_name, sub: p.label }))}
        activeMention={mention.active}
        onPickMention={(i) => {
          const r = mention.pick(i);
          if (!r) return;
          caretAfter.current = r.caret;
          setText(r.text);
        }}
        textareaRef={boxRef}
        onKeyDown={onKeyDown}
      />
    );

  const menu = canDelete ? (
    <Menu>
      <MenuTrigger label={MORE_LABEL} className="k-talk-act k-talk-more-btn">
        …
      </MenuTrigger>
      <MenuPopup className="k-talk-menu">
        {own ? <MenuItem onSelect={startEdit}>直す</MenuItem> : null}
        <MenuItem
          className="k-talk-danger"
          disabled={!own && !managerLine}
          onSelect={() => {
            msg.clearErrors();
            setConfirming(true);
          }}
        >
          消す…
        </MenuItem>
      </MenuPopup>
    </Menu>
  ) : undefined;

  return (
    <>
      {msg.starError ? <Callout tone="danger">{msg.starError}</Callout> : null}
      <Post
        post={post}
        onQuote={onQuote}
        decideSlot={decideSlot}
        anchorId={anchorId}
        starBusy={msg.starring}
        onStar={() => void msg.star({ stars: m?.stars ?? 0, starred: m?.starred ?? false })}
        {...(menu ? { menuSlot: menu } : {})}
      />
      {canDelete ? (
        <DeleteMessageConfirm
          open={confirming}
          name={author}
          text={m?.body ?? ""}
          busy={msg.deleting}
          {...(msg.deleteError ? { error: msg.deleteError } : {})}
          {...(managerLine ? { line: managerLine } : {})}
          onOpenChange={(o) => {
            setConfirming(o);
            if (!o) focusMore(anchorId);
          }}
          onConfirm={() => {
            void msg.remove().then((done) => {
              if (done) setConfirming(false);
            });
          }}
        />
      ) : null}
    </>
  );
}
