"use client";
// ひな形の新しい版の中身を直す頁（/ops/skills/templates/[id]/new・K-1111）。外枠の答え（caps）を見て → 1 つの口（getOpsTemplate）を 1 回読み →
//   今の版を写して直す（直しは Edits だけを持つ・口は呼ばない）→［下書きにする］でこの PC に残す →［v<N> を出す］で下書き（dry_run）を読み
//   → 出す確かめ →［本人確認をして出す］で出す → 配るもの › ひな形に戻り「v<N> を出しました」。
//   caps に distribute が無ければ「見る権限がありません」で、ひな形の口を呼ばない。403 STEP_UP_REQUIRED は 1 回だけ取り直して同じ体でやり直す。
//   送っている間は 2 回目を送らない。断り・落ちたは赤い箱で、直した中身は残す
import type { Route } from "next";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";
import { useSession } from "@/lib/auth/session";
import { StepUp } from "@/features/F1/security/step-up";
import { useOpsCrumbs } from "@/features/F12/ops/ops-frame";
import { capsOf, useOpsShellCaps } from "@/features/F12/ops/use-ops-workspace";
import { plansHrefs } from "./plans-screen";
import {
  addItem,
  bodySummary,
  deleteItem,
  diffLines,
  editItem,
  emptyEdits,
  hasChanges,
  itemsOf,
  KIND_LIMIT,
  liveCount,
  loadDraft,
  newKey,
  PART_NAME,
  partOf,
  reasonOf,
  rowsOf,
  subOf,
  undoDelete,
  type Draft,
  type Edits,
  type EditRowOf,
  type TemplateItem,
} from "./template-edit-shape";
import { fieldTypeName, TemplateItemDialog, toneName } from "./template-item-dialog";
import {
  draftStore,
  releaseTemplate,
  setTemplateFlash,
  stepUpShape,
  templateKey,
  TEMPLATES_PATH,
  useTemplateOne,
  type ReleaseBody,
  type ReleaseWrite,
  type TemplateOne,
} from "./use-template-edit";
import { TemplateEditPage, TemplateReleaseConfirm, type EditRow, type TemplateAlert } from "./views-skills";

const STEP_UP_REASON = "ひな形の新しい版を出す前に、本人か確かめます"; // （仮）
const DRAFT_FAILED = "この PC に下書きを残せませんでした。もう一度押してください"; // （仮）
const FORBIDDEN_SUB = "見る権限がありません";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const failText = (r: CallErr): string =>
  r.message ?? (textOf(r.code) || textOf(errorCodeOf(r)) || textOf(PAGE_ERROR.loadFailed));
/** 409（口が断った）は字だけ。ほかの失敗は［もう一度］つき */
const alertOf = (r: CallErr, retry: () => void): TemplateAlert =>
  r.status === 409 ? { text: failText(r) } : { text: failText(r), retry };
const offline = (retry: () => void): TemplateAlert => ({ text: textOf(PAGE_ERROR.loadFailed), retry });
/** E-OPS-024 の detail.key（どの 1 つが合わないか） */
const invalidKeyOf = (r: CallErr): string | null => {
  const d = r.body["detail"];
  const k = d !== null && typeof d === "object" ? (d as { key?: unknown }).key : undefined;
  return r.code === "E-OPS-024" && typeof k === "string" ? k : null;
};

function Frame({ sub, children }: { sub?: string; children: ReactNode }) {
  return (
    <PageBody labelledBy="oq-template-edit-title">
      <PageHeader id="oq-template-edit-title" title="ひな形の新しい版" {...(sub ? { sub } : {})} />
      {children}
    </PageBody>
  );
}

export function TemplateEditScreen({ id }: { id: string }) {
  const shell = useOpsShellCaps();
  if (shell.isPending) return null;
  if (!capsOf(shell.data).includes("distribute"))
    return (
      <Frame sub={FORBIDDEN_SUB}>
        <NoAccess />
      </Frame>
    );
  return <EditBody id={id} />;
}

function EditBody({ id }: { id: string }) {
  const router = useRouter();
  const one = useTemplateOne(id, true);
  const res = one.data;
  const name = res?.kind === "ok" ? res.data.name : "";
  useOpsCrumbs([
    { label: "配るもの", href: "/ops/skills" },
    { label: "ひな形", href: TEMPLATES_PATH },
    { label: name ? `${name}の新しい版` : "新しい版" },
  ]);
  const relogin = res?.kind === "login";
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(window.location.pathname)}` as Route);
  }, [relogin, router]);

  if (one.isPending || relogin) return null;
  if (res?.kind === "forbidden")
    return (
      <Frame sub={FORBIDDEN_SUB}>
        <NoAccess />
      </Frame>
    );
  if (res?.kind === "missing")
    return (
      <Frame>
        <ErrorState code={PAGE_ERROR.notFound} acts={[TEMPLATES_PATH]} />
      </Frame>
    );
  if (res?.kind !== "ok")
    return (
      <Frame>
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void one.refetch()]} />
      </Frame>
    );
  return <Editor key={`${res.data.id}:${res.data.version}`} t={res.data} />;
}

/** 開いたときの下書き（今の版と base が違う古い下書きは捨てる） */
function initialDraft(t: TemplateOne): Draft | null {
  const raw = draftStore.read(t.id);
  const d = loadDraft(raw, t.version);
  if (raw !== null && d === null) draftStore.remove(t.id);
  return d;
}

const rowOf = (part: ReturnType<typeof partOf>, r: EditRowOf, invalid: string | null): EditRow => ({
  id: r.item.key,
  name: r.item.name,
  ...(part === "field"
    ? {
        type: fieldTypeName(r.item.field_type),
        required: r.item.required === true,
        ...(r.item.description ? { body: r.item.description } : {}),
      }
    : { color: toneName(r.item.color_key) }),
  ...(part === "kind" ? { body: bodySummary(r.item.body_template) } : {}),
  ...(r.change ? { change: r.change } : {}),
  ...(r.item.key === invalid ? { invalid: true } : {}),
});

type ItemDialog = { item: TemplateItem | null; key: string; seq: number } | null;
type Release = { using: number; offered: number; error: TemplateAlert | null } | null;
type StepUpState = { withCode: boolean; withPasskey: boolean } | null;

function Editor({ t }: { t: TemplateOne }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const part = partOf(t.key);
  const partName = PART_NAME[part];
  const [draft, setDraft] = useState<Draft | null>(() => initialDraft(t));
  const [edits, setEdits] = useState<Edits>(() => draft?.edits ?? emptyEdits(t.version));
  const [dialog, setDialog] = useState<ItemDialog>(null);
  const [release, setRelease] = useState<Release>(null);
  const [pageError, setPageError] = useState<TemplateAlert | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpState>(null);
  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<StepUpState>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const sending = useRef(false);
  const seq = useRef(0);

  const rows = useMemo(() => rowsOf(t.items, edits), [t.items, edits]);
  const diff = useMemo(() => diffLines(partName, t.items, edits), [partName, t.items, edits]);
  const body: ReleaseBody = { items: itemsOf(t.items, edits), change_reason: reasonOf(diff) };
  const changed = hasChanges(edits);

  const guarded = async (run: () => Promise<void>, onOffline: () => void) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await run();
    } catch {
      onOffline(); // 網が切れた
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  /** 書く口を呼ぶ。取り直しが要れば 1 回だけ取り直してから同じ体でやり直す */
  const send = (
    b: ReleaseBody,
    done: (w: ReleaseWrite) => Promise<void> | void,
    onOffline: () => void,
    retried = false,
  ): Promise<void> =>
    guarded(async () => {
      if (!retried && needStepUp.current) {
        pending.current = () => send(b, done, onOffline, true);
        setStepUp(needStepUp.current);
        return;
      }
      const w = await releaseTemplate(t.id, b);
      if (w.ok || w.err.kind !== "step_up") needStepUp.current = null;
      if (!w.ok && w.err.kind === "step_up" && !retried) {
        pending.current = () => send(b, done, onOffline, true);
        needStepUp.current = await stepUpShape();
        setStepUp(needStepUp.current);
        return;
      }
      if (!w.ok && w.err.status === 401) {
        router.replace(`/ops/login?next=${encodeURIComponent(window.location.pathname)}` as Route);
        return;
      }
      await done(w);
    }, onOffline);

  const openDialog = (item: TemplateItem | null) => {
    seq.current += 1;
    const taken = new Set([...t.items.map((i) => i.key), ...edits.added.map((i) => i.key)]);
    setDialog({ item, key: item ? item.key : newKey(taken), seq: seq.current });
  };
  const itemByKey = (key: string): TemplateItem | null => rows.find((r) => r.item.key === key)?.item ?? null;
  const onSave = (item: TemplateItem): string | null => {
    const adding = dialog?.item === null;
    if (adding && part === "kind" && liveCount(t.items, edits) >= KIND_LIMIT) return textOf("E-KND-002");
    setEdits((cur) => (adding ? addItem(cur, item) : editItem(t.items, cur, item)));
    setDialog(null);
    return null;
  };

  const onDraft = () => {
    const d: Draft = {
      edits,
      saved_at: new Date().toISOString(),
      by: session?.user.name || session?.user.email || "",
    };
    if (!draftStore.write(t.id, d)) return setPageError({ text: DRAFT_FAILED });
    setPageError(null);
    setDraft(d);
  };

  const onRelease = () => {
    if (!changed) return;
    setPageError(null);
    setInvalid(null); // 押し直したら前の印を消す
    const retry = () => onRelease();
    void send(
      { ...body, dry_run: true },
      (w) => {
        if (!w.ok) {
          setInvalid(invalidKeyOf(w.err)); // 下書きの時点で口が断った 1 つにも印（D-156.85）
          return setPageError(alertOf(w.err, retry));
        }
        setRelease({ using: w.using, offered: w.offered, error: null });
      },
      () => setPageError(offline(retry)),
    );
  };
  const setReleaseError = (error: TemplateAlert) => setRelease((cur) => (cur ? { ...cur, error } : cur));
  const onConfirm = () => {
    const retry = () => onConfirm();
    void send(
      body,
      async (w) => {
        if (!w.ok) {
          setInvalid(invalidKeyOf(w.err)); // 断った 1 つに印（ほかの断りなら印を消す）
          return setReleaseError(alertOf(w.err, retry));
        }
        draftStore.remove(t.id);
        setTemplateFlash(`v${w.version ?? t.version + 1} を出しました`);
        qc.removeQueries({ queryKey: templateKey(t.id) });
        router.push(TEMPLATES_PATH as Route);
      },
      () => setReleaseError(offline(retry)),
    );
  };

  const keyOf = (r: EditRow) => r.id;
  const hidden = stepUp !== null; // 取り直しの間は確かめを下げて値を持つ
  return (
    <>
      <TemplateEditPage
        name={t.name}
        version={t.version}
        sub={subOf(t.version, draft)}
        part={part}
        rows={rows.map((r) => rowOf(part, r, invalid))}
        diff={diff}
        onEdit={(r) => openDialog(itemByKey(keyOf(r)))}
        onDelete={(r) => setEdits((cur) => deleteItem(t.items, cur, keyOf(r)))}
        onUndo={(r) => setEdits((cur) => undoDelete(cur, keyOf(r)))}
        onAdd={() => openDialog(null)}
        onDraft={onDraft}
        onRelease={onRelease}
        canRelease={changed}
        busy={busy}
        error={pageError}
        nav={plansHrefs(null).nav ?? {}}
      />
      {dialog ? (
        <TemplateItemDialog
          key={dialog.seq}
          open
          part={part}
          partName={partName}
          item={dialog.item}
          newKey={dialog.key}
          onSave={onSave}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {release ? (
        <TemplateReleaseConfirm
          open={!hidden}
          name={t.name}
          version={t.version + 1}
          using={release.using}
          offered={release.offered}
          error={release.error}
          busy={busy}
          onConfirm={onConfirm}
          onClose={() => setRelease(null)}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId="ops-skills"
        onDone={() => {
          setStepUp(null);
          const again = pending.current;
          pending.current = null;
          if (again) void again();
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null; // やめた：何も送らず、直した中身のまま戻す
        }}
      />
    </>
  );
}
