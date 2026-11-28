"use client";
// チケットの設定「種別」の入れ物（K-707・口は K-704）：一覧（?id= で選ぶ）・右の欄（名前・色・本文のひな形）・保存・足す・消す。
//   見た目は views.tsx の KindsPanel（モック /dev/mock/f9/set-kinds と同じ部品）に値と動きを渡すだけ。
//   出し分け：入力の確かめ（空・41 字以上）と 409 E-KND-001 は名前の欄の下／503・網の切れ・403・404 は欄の上の赤い箱／
//   消すの断り（E-KND-003・005）と失敗は一覧の上の帯。どれも書いた中身は残し、押し直せる
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import type { Doc } from "@kaname/contracts";
import { Button, ErrorState, NoticeBox, PAGE_ERROR, errorCodeOf, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import {
  kindDraftOf,
  kindPatch,
  nameProblem,
  pickKind,
  shapeKinds,
  trimName,
  type KindDraft,
  type KindAnswer,
  type TemplateDoc,
  type ToneKey,
} from "./kinds-shape";
import { DeleteConfirm, NameColorDialog } from "./settings-dialogs";
import { useUnsaved } from "./unsaved-guard";
import { useCreateKind, useDeleteKind, useKinds, useSaveKind } from "./use-kinds";
import { KindsPanel, SettingsLoading } from "./views";

/** 名前の上限（口 K-704 と同じ 40 字） */
const NAME_MAX = 40;
const LAST_ONE = "最後の 1 つの種別は消せません";
const RETRY = "もう一度読む";
const EMPTY_DOC: Doc = { type: "doc", content: [] };

/** タブの中身が受け取る物（K-708・K-709 も同じ形） */
export interface SettingsPanelProps {
  /** ?id= の値（無い・知らない id は先頭） */
  id: string | undefined;
  /** 一覧の行き先 */
  hrefOf: (id: string) => string;
  /** 一覧を押したとき（保存していない変更があれば確かめてから移る） */
  select: (id: string) => void;
  /** 口が 403 を返した（束を外された直後）：本文を「見る権限がありません」に替える */
  onForbidden: () => void;
}

const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 口の断り（網の切れは null）→ 正本の ID */
export function failureCode(err: CallErr | null): string {
  if (!err) return PAGE_ERROR.loadFailed;
  if (err.code in CATALOG) return err.code;
  if (err.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(err);
}
const failureText = (err: CallErr | null): string => msgOf(failureCode(err));

function deleteFailureText(err: CallErr | null): string {
  if (err?.code === "E-KND-003") {
    const n = (err.body["detail"] as { ticket_count?: unknown } | undefined)?.ticket_count;
    return typeof n === "number" ? `${msgOf("E-KND-003")}（${n} 枚）` : msgOf("E-KND-003");
  }
  return failureText(err);
}

interface Edit {
  id: string;
  draft: KindDraft;
}

export function KindsContainer({ id, hrefOf, select, onForbidden }: SettingsPanelProps) {
  const kinds = useKinds();
  const save = useSaveKind();
  const create = useCreateKind();
  const remove = useDeleteKind();
  const notify = useNotify();
  const { setDirty } = useUnsaved();

  const answers = useMemo(
    () => [...(kinds.data ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [kinds.data],
  );
  const rows = useMemo(() => shapeKinds(answers), [answers]);
  const current: KindAnswer | undefined = pickKind(answers, id);

  const [edit, setEdit] = useState<Edit | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [band, setBand] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTone, setAddTone] = useState<ToneKey>("indigo");
  const [addError, setAddError] = useState<string | undefined>();
  const [addNotice, setAddNotice] = useState<string | undefined>();
  const [addBusy, setAddBusy] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  const currentId = current?.id;
  // 種別が替わったら前の種別の直しと赤字を捨てる（前の種別の字を残さない）
  useEffect(() => {
    setEdit((e) => (e && e.id !== currentId ? null : e));
    setNameError(undefined);
  }, [currentId]);

  const forbidden = kinds.error?.result?.status === 403;
  useEffect(() => {
    if (forbidden) onForbidden();
  }, [forbidden, onForbidden]);

  const draft: KindDraft | undefined = current && (edit && edit.id === current.id ? edit.draft : kindDraftOf(current));
  const patch = current && draft ? kindPatch(current, draft) : {};
  const dirty = Object.keys(patch).length > 0;
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  if (kinds.isPending || forbidden) return <SettingsLoading />;
  if (kinds.isError && !kinds.data) {
    return (
      <div className="k-f9s-stack">
        <ErrorState code={failureCode(kinds.error.result ?? null)} />
        <div>
          <Button onClick={() => void kinds.refetch()}>{RETRY}</Button>
        </div>
      </div>
    );
  }
  if (!current || !draft) return null;

  const change = (p: Partial<KindDraft>) => setEdit({ id: current.id, draft: { ...draft, ...p } });

  const onSelect = (to: string) => {
    if (to === current.id) return;
    setBand(undefined);
    setNotice(undefined);
    select(to);
  };

  const onSave = async () => {
    if (saving.current || !dirty) return;
    const problem = nameProblem(draft.name, NAME_MAX);
    if (problem) return setNameError(problem);
    saving.current = true;
    setBusy(true);
    setNotice(undefined);
    setBand(undefined);
    const r = await save(current.id, patch);
    saving.current = false;
    setBusy(false);
    if (r.ok) {
      setEdit(null);
      notify(`種別「${trimName(draft.name)}」を保存しました`);
      return;
    }
    if (r.err?.code === "E-KND-001") return setNameError(msgOf("E-KND-001"));
    setNotice(failureText(r.err));
  };

  const openAdd = () => {
    setAddName("");
    setAddTone("indigo");
    setAddError(undefined);
    setAddNotice(undefined);
    setAddOpen(true);
  };
  const onAdd = async () => {
    if (addBusy) return;
    const problem = nameProblem(addName, NAME_MAX);
    if (problem) return setAddError(problem);
    setAddBusy(true);
    setAddError(undefined);
    setAddNotice(undefined);
    const name = trimName(addName);
    const r = await create(name, addTone);
    setAddBusy(false);
    if (r.ok) {
      setAddOpen(false);
      notify(`種別「${name}」を足しました`);
      if (r.data.id) select(r.data.id);
      return;
    }
    if (r.err?.code === "E-KND-001" || r.err?.code === "E-KND-002") return setAddError(msgOf(r.err.code));
    setAddNotice(failureText(r.err));
  };

  const onDelete = async () => {
    if (delBusy) return;
    setDelBusy(true);
    setBand(undefined);
    const name = current.name;
    const r = await remove(current.id);
    setDelBusy(false);
    setDelOpen(false);
    if (r.ok) return void notify(`種別「${name}」を消しました`);
    setBand(deleteFailureText(r.err));
  };

  const panel = (
    <KindsPanel
      kinds={rows}
      current={current.id}
      hrefOf={hrefOf}
      onSelect={onSelect}
      live={{
        name: draft.name,
        tone: draft.tone,
        template: (draft.template ?? EMPTY_DOC) as Doc,
        editorKey: current.id,
        nameError,
        notice,
        canSave: dirty && !busy,
        busy,
        deleteBlocked: rows.length <= 1 ? LAST_ONE : undefined,
        onName: (v) => {
          setNameError(undefined);
          change({ name: v });
        },
        onTone: (tone) => change({ tone }),
        onTemplate: (doc) => change({ template: doc as unknown as TemplateDoc }),
        onSave: () => void onSave(),
        onDelete: () => {
          setBand(undefined);
          setDelOpen(true);
        },
        onAdd: openAdd,
      }}
    />
  );

  return (
    <>
      {band ? (
        <div className="k-f9s-stack">
          <NoticeBox>{band}</NoticeBox>
          {panel}
        </div>
      ) : (
        panel
      )}
      <NameColorDialog
        open={addOpen}
        title="種別を足す"
        name={addName}
        tone={addTone}
        toneName="new_kind_tone"
        nameError={addError}
        notice={addNotice}
        busy={addBusy}
        onName={(v) => {
          setAddError(undefined);
          setAddName(v);
        }}
        onTone={setAddTone}
        onSubmit={() => void onAdd()}
        onClose={() => setAddOpen(false)}
      />
      <DeleteConfirm
        open={delOpen}
        what="種別"
        name={current.name}
        busy={delBusy}
        onConfirm={() => void onDelete()}
        onClose={() => setDelOpen(false)}
      />
    </>
  );
}
