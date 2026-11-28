"use client";
// 自分で直す（K-743・D-153.9・D-153.28）。承認の帯の［自分で直す］→ 成果物のカードの場所に「成果物を直す」面 → 直す口 editApproval（K-742）。
//   正の絵は下絵 /dev/mock/f5/selfedit-*（features/F5/more/artifact.tsx の SelfEditSurface）。直すと新しい版になり承認待ちのまま。AI のチェックは外さない。
//   字は書いたとおりに送る（前後の空白も改行も削らない）。長さの上限は置かない（D-130.3）。文は全部文字として出す（HTML を作らない）
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/k";
import { call, type CallErr, type CallResult } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import { PAGE_ERROR } from "@/components/k/error-of";
import { catalogMessage, messageOf } from "@/features/F5/approve-complete/message";
import { pushNotice, pushTrail } from "@/features/F5/more/trail";
import { timelineKey } from "@/features/F6/thread/use-timeline";
import type { ArtifactAreaProps, SelfEditActProps } from "@/features/F5/more/slots";
import { selfEdit, useSelfEdit } from "./use-self-edit";

const MSG = {
  heading: (v: number) => `成果物を直す（版 ${v} をもとに）`,
  note: "直した物は新しい版になり、承認待ちのままです。AI のチェックは残ります",
  saving: "保存しています",
  edited: (who: string, v: number) => `成果物は ${who} が直しました（版 ${v}）`,
  trail: (who: string, v: number) => `${who}が成果物を直しました（版 ${v}）。AI のチェックは残っています`,
  // 口の文は版を持たないので画面の定数（下絵 selfedit-conflict）
  stale: (v: number) => `先にほかの人が成果物を直していました（版 ${v}）。開き直して、続きから直してください`,
} as const;
const SELF = "自分";
/** 前後の空白（半角・全角・タブ・改行）だけの字は送らない（口の 422 は最後の砦） */
const isBlank = (s: string): boolean => s.replace(/[\s\u3000]/g, "") === "";
const approvalKey = (id: string) => ["k63", "approval", id] as const;

/** 承認の帯の［自分で直す］。成果物が無いときは押しても面を開かない */
export function SelfEditAct({ approval, onChanged }: SelfEditActProps): ReactNode {
  const id = approval.id;
  const detail = useApprovalDetail(id);
  const st = useSelfEdit(id);
  useEffect(() => {
    selfEdit.setOnChanged(id, onChanged);
    return () => selfEdit.setOnChanged(id, null);
  }, [id, onChanged]);
  const open = () => {
    if (st.open || st.saving) return;
    const a = detail.data?.artifact_version ?? null;
    if (!a?.text) return;
    selfEdit.open(id, a);
  };
  return (
    <Button variant="outlined" ref={(el: HTMLButtonElement | null) => selfEdit.setButton(id, el)} onClick={open}>
      自分で直す
    </Button>
  );
}

/** 成果物の場所：開いている間はカードの代わりに直す面。直した後はカードの下に 1 行 */
export function ArtifactArea({ approvalId, ticketId, artifact, card }: ArtifactAreaProps): ReactNode {
  const st = useSelfEdit(approvalId);
  useEffect(() => () => selfEdit.forget(approvalId), [approvalId]);
  if (st.open && artifact?.text) return <EditSurface approvalId={approvalId} ticketId={ticketId} />;
  return (
    <>
      {card}
      {st.edited && card ? <p className="k-more-edited">{MSG.edited(st.edited.who, st.edited.version)}</p> : null}
    </>
  );
}

function useSave(approvalId: string, ticketId: string | undefined) {
  const qc = useQueryClient();
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const sending = useRef(false);
  const notice = (text: string) => {
    if (ticketId) pushNotice(ticketId, text);
  };
  const reloadApproval = () => qc.invalidateQueries({ queryKey: approvalKey(approvalId) });

  const failed = async (r: CallErr) => {
    if (r.code === "E-APR-020") {
      const v = Number(r.body["current_version"]);
      const version = Number.isFinite(v) && v > 0 ? v : selfEdit.get(approvalId).baseVersion;
      selfEdit.stale(approvalId, version);
      notice(MSG.stale(version));
      await reloadApproval();
      return;
    }
    if (r.code === "E-APR-021") {
      selfEdit.saving(approvalId, false);
      notice(catalogMessage("E-APR-021"));
      return;
    }
    if (r.code === "E-CONF-003") {
      selfEdit.close(approvalId);
      notice(messageOf(r));
      await selfEdit.onChanged(approvalId);
      return;
    }
    selfEdit.saving(approvalId, false); // 403・404・503：面は開いたまま書いた字が残る
    notice(messageOf(r));
  };

  return async () => {
    const s = selfEdit.get(approvalId);
    if (sending.current || s.stale || isBlank(s.text)) return;
    sending.current = true;
    selfEdit.saving(approvalId, true);
    try {
      let r: CallResult<"editApproval">;
      try {
        r = await call("editApproval", {
          params: { id: approvalId },
          body: { text: s.text, version: s.baseVersion },
          screenId: "tickets",
        });
      } catch {
        // 通信が切れた（call は fetch の失敗を投げる）：503 と同じく面は開いたまま書いた字が残る
        selfEdit.saving(approvalId, false);
        notice(catalogMessage(PAGE_ERROR.loadFailed));
        return;
      }
      if (!r.ok) return await failed(r);
      const name = who.data?.display_name || SELF;
      const version = Number((r.data as { version?: number }).version ?? s.baseVersion + 1);
      selfEdit.saved(approvalId, version, name);
      if (ticketId) pushTrail(ticketId, MSG.trail(name, version));
      await Promise.all([
        reloadApproval(),
        ticketId ? qc.invalidateQueries({ queryKey: timelineKey(ticketId) }) : Promise.resolve(),
      ]);
    } finally {
      sending.current = false;
      // 後の読み直しが投げても「保存しています」のまま残さない
      if (selfEdit.get(approvalId).saving) selfEdit.saving(approvalId, false);
    }
  };
}

function EditSurface({ approvalId, ticketId }: { approvalId: string; ticketId: string | undefined }) {
  const st = useSelfEdit(approvalId);
  const save = useSave(approvalId, ticketId);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);
  const note = st.saving ? MSG.saving : st.stale ? "" : MSG.note;
  return (
    <section aria-label="成果物を直す" className="k-more-edit">
      <h3>{MSG.heading(st.baseVersion)}</h3>
      <textarea
        ref={box}
        className="k-input"
        aria-label="成果物の字"
        rows={5}
        value={st.text}
        readOnly={st.saving}
        onChange={(e) => selfEdit.write(approvalId, e.target.value)}
      />
      <div className="k-more-edit-acts">
        <Button loading={st.saving} disabled={st.stale || isBlank(st.text)} onClick={() => void save()}>
          直して保存する
        </Button>
        <Button variant="outlined" disabled={st.saving} onClick={() => selfEdit.close(approvalId, true)}>
          やめる
        </Button>
        {note ? <span className="k-more-edit-note">{note}</span> : null}
      </div>
    </section>
  );
}
