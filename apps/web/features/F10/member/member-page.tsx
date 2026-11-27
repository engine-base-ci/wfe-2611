"use client";
// メンバーの 1 人の画面の入れ物（K-819 → K-820 → K-821 → この葉 K-822）。
//   この枝には前の葉（K-819〜K-821）の入れ物がまだ無いので、K-822 の分だけを K-819 の名前（AdminBody・useMember の MemberAnswer・
//   DO_DIALOGS・unregistered・useDoParam・MemberPage の disabledActions／onAction）どおりに書いた。
//   段の枝で合わせるときは K-819〜K-821 の版を取り、disabledActions を「K-822」の印の行の形（自分なら remove を足す）に替える。
//   外す小窓の中身（下見・外す・知らせ・/members への移動）は detail-dialogs.tsx の RemoveBox が持つ（DoDialogProps で受ける）
import { useCallback, useState, type ReactNode } from "react";
import { DO_DIALOGS, unregistered, useDoParam } from "./detail-dialogs";
import { toDetailData } from "./member-shape";
import { useMember } from "./use-member";
import { MemberPage, type Action } from "./views";

export function AdminBody({ id }: { id: string }) {
  const member = useMember(id, true);
  const [open, setOpen] = useState<Action | null>(null);
  const [notice, setNotice] = useState<ReactNode | null>(null);
  const openDialog = useCallback((a: Action) => setOpen(a), []);
  useDoParam(openDialog);
  const Dialog = open ? DO_DIALOGS[open] : undefined;
  const self = Boolean(member.data?.member.self);
  // K-822：自分は外せない（押せない形・title は部品の「自分は外せません…」）。登録の無い操作に足して渡す
  const disabled: Action[] = [
    ...unregistered(),
    ...(self && !unregistered().includes("remove") ? (["remove"] as const) : []),
  ];
  return (
    <>
      {member.data ? (
        <MemberPage
          d={toDetailData(member.data)}
          notice={notice}
          disabledActions={disabled /* K-822 */}
          onAction={(a: Action) => {
            if (DO_DIALOGS[a]) setOpen(a);
          }}
        />
      ) : null}
      {Dialog && member.data ? (
        <Dialog id={id} answer={member.data} onClose={() => setOpen(null)} onNotice={setNotice} />
      ) : null}
    </>
  );
}
