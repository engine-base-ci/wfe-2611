"use client";
// 差し込み口の先：続けて裁く（持ち主の葉 K-752。器 slots.tsx と承認待ちのファイルは触らない）。
//   見出しの［続けて裁く（N 件）］（N は承認待ち全部の数・下絵のとおり）。今の一覧の行に AI の成果物が 1 件も無ければ押せない形。
//   押すと道に ?focus=1 を付けて全画面の層（focus/focus-view.tsx）を開く。?focus=1 で開いた画面は層が開いた形で始まる。
//   閉じると ?focus を消し、一覧を読み直す（queueKey）。この先は一覧を読み終えた後にだけ描かれる（承認待ちの画面が一覧の後に置く）
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/k";
import { queueKey } from "@/features/F5/approve-complete/queue";
import { FocusView } from "../focus/focus-view";
import type { QueueFocusProps } from "../slots";

const FOCUS_PARAM = "focus";
const NOTHING = "1 件ずつ決めるものがありません";

const focusInUrl = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get(FOCUS_PARAM) === "1";

function setFocusInUrl(on: boolean): void {
  const u = new URL(window.location.href);
  if (on) u.searchParams.set(FOCUS_PARAM, "1");
  else u.searchParams.delete(FOCUS_PARAM);
  window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
}

export function QueueFocusFill({ rows, total }: QueueFocusProps): ReactNode {
  const qc = useQueryClient();
  const [open, setOpen] = useState(focusInUrl);
  const hasArtifact = rows.some((r) => r.kind === "artifact");
  const text = `続けて裁く（${total} 件）`;
  const close = () => {
    setOpen(false);
    setFocusInUrl(false);
    void qc.invalidateQueries({ queryKey: queueKey });
  };
  return (
    <>
      {hasArtifact ? (
        <Button
          className="k-ap-next"
          onClick={() => {
            setFocusInUrl(true);
            setOpen(true);
          }}
        >
          {text}
        </Button>
      ) : (
        <Button className="k-ap-next" aria-disabled="true" tabIndex={-1} title={NOTHING}>
          {text}
        </Button>
      )}
      {open && typeof document !== "undefined" ? createPortal(<FocusView onClose={close} />, document.body) : null}
    </>
  );
}
