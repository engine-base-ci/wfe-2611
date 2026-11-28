"use client";
// 会社の側の「ひな形がこう変わります」（K-1016・画面 masters・道 /settings/template-updates・行為 A120）。外枠（TicketShell）の中に、
//   届いた版の差（手を付けていない所だけ）と「変える」「そのままにする」。見た目はモック /dev/mock/f12-ops2 の oq-template-update と同じ部品（views-skills.tsx）。
//   届いた版が 2 つ以上なら部の順（種別・状態・項目）の最初の 1 つを出し、選ぶと次が出る。選んだ版は読み直しの答えに残っていても出さない。
//   読む口は 1 回。403 は「この権限では見えない」（E-PAGE-002）、ほかの失敗は「読めなかった」（E-PAGE-007・「もう一度」で読み直す）
import { useRef, useState } from "react";
import { ErrorState, Loading, NoAccess, PAGE_ERROR, PageBody, errorCodeOf, errorText } from "@/components/k";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { diffRow, firstUpdate, updateHead } from "./template-update-shape";
import { UpdatesReadError, useApplyUpdate, useTemplateUpdates } from "./use-template-updates";
import { TemplateUpdateEmpty, TemplateUpdatePage, type TemplateChoice } from "./views-skills";

/** 上の帯の「設定」の行き先（段 11 の設定の画面） */
const SETTINGS_HREF = "/settings/company";
export const TEMPLATE_UPDATE_CRUMBS = [
  { label: "ワークスペースの管理" },
  { label: "設定", href: SETTINGS_HREF },
  { label: "ひな形" },
];
/** 選んだ後の字（仮・申し送り (2)） */
const DONE_TEXT: Record<TemplateChoice, string> = {
  change: "新しい既定に変えました",
  keep: "今のまま使います",
};
/** 網が切れて送れなかったとき（正本の「読めなかった」の 1 件の字） */
const SEND_FAILED = PAGE_ERROR.loadFailed;

export function TemplateUpdateScreen() {
  const q = useTemplateUpdates();
  const apply = useApplyUpdate();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [done, setDone] = useState<string | undefined>(undefined);
  const [alert, setAlert] = useState<string | undefined>(undefined);

  const onApply = async (id: string, choice: TemplateChoice): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setDone(undefined);
    setAlert(undefined);
    const r = await apply(id, choice);
    sending.current = false;
    setBusy(false);
    if (r.ok) {
      setChosen((xs) => [...xs, id]);
      setDone(DONE_TEXT[choice]);
      return;
    }
    // もう選んだ（409）・無い（404）は、この版を出さない
    if (r.err && (r.err.status === 409 || r.err.status === 404)) setChosen((xs) => [...xs, id]);
    // 目録の文を全部出す（E-OPS-025 は「この版はもう選んであります。別の版を選んでください」の 2 文で 1 つ・answer=f0c82aceaa62）
    setAlert(errorText(r.err ? errorCodeOf(r.err) : SEND_FAILED).entry.message);
  };

  const body = (() => {
    if (q.isError) {
      const forbidden = q.error instanceof UpdatesReadError && q.error.forbidden;
      return (
        <PageBody labelledBy={forbidden ? "noaccess" : "template-update-error"}>
          {forbidden ? (
            <NoAccess acts={["/tickets"]} />
          ) : (
            <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void q.refetch()]} />
          )}
        </PageBody>
      );
    }
    if (!q.data) return <Loading />;
    const u = firstUpdate(q.data.filter((x) => !chosen.includes(x.id)));
    const notes = { ...(done ? { done } : {}), ...(alert ? { alert } : {}) };
    if (!u) return <TemplateUpdateEmpty {...notes} />;
    return (
      <TemplateUpdatePage
        sub={updateHead(u)}
        rows={u.diffs.map(diffRow)}
        onApply={(choice) => void onApply(u.id, choice)}
        busy={busy}
        {...notes}
      />
    );
  })();

  return (
    <TicketShell screen="masters" crumbs={TEMPLATE_UPDATE_CRUMBS}>
      {body}
    </TicketShell>
  );
}
