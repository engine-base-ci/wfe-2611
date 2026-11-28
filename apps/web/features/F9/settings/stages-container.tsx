"use client";
// チケットの設定「状態」の入れ物（K-708・口は K-705）：一覧（仕組みの状態は出さない）・直す行（1 行だけ）・足す・消す・つまみで並べ替える。
//   見た目は views.tsx の StagesPanel（モック /dev/mock/f9/set-stages と同じ部品）に値と動きを渡すだけ。
//   出し分け：入力の確かめ（空・21 字以上）と 409 E-STG-001 は名前の欄の下／保存・消す・並べ替えの断りと失敗は一覧の上の帯（赤い箱）／
//   足すの断り（E-STG-001・002）は小窓の中の赤字・そのほかの失敗は小窓の上の赤い箱。どれも書いた中身は残し、押し直せる
import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, ErrorState, NoticeBox, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { failureCode, type SettingsPanelProps } from "./kinds-container";
import { trimName, type ToneKey } from "./kinds-shape";
import { DeleteConfirm, NameColorDialog } from "./settings-dialogs";
import {
  moveStage,
  shapeStages,
  stageDraftOf,
  stagePatch,
  stageProblem,
  type StageAnswer,
  type StageDraft,
} from "./stages-shape";
import { useUnsaved } from "./unsaved-guard";
import { useCreateStage, useDeleteStage, useReorderStages, useSaveStage, useStages } from "./use-stages";
import { SettingsLoading, StagesPanel, type StagesLive } from "./views";

const RETRY = "もう一度読む";
const NAME_TAKEN = "E-STG-001";
const ADD_INLINE = new Set(["E-STG-001", "E-STG-002"]);
const IN_USE = "E-STG-005";

const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
const failureText = (err: CallErr | null): string => msgOf(failureCode(err));

function deleteFailureText(err: CallErr | null): string {
  if (err?.code === IN_USE) {
    const n = (err.body["detail"] as { ticket_count?: unknown } | undefined)?.ticket_count;
    return typeof n === "number" ? `${msgOf(IN_USE)}（${n} 枚）` : msgOf(IN_USE);
  }
  return failureText(err);
}

interface Edit {
  id: string;
  draft: StageDraft;
}
/** キーボードでつかんでいる間の並び（一覧の id） */
interface Grab {
  id: string;
  order: readonly string[];
}

/** つかんでいる行のつまみに焦点を戻す（並びが替わって作り直されても） */
function focusGrip(id: string): void {
  const el = document.querySelector<HTMLButtonElement>(`button[data-stage-grip="${CSS.escape(id)}"]`);
  if (el && document.activeElement !== el) el.focus();
}

export function StagesContainer({ onForbidden }: SettingsPanelProps) {
  const stages = useStages();
  const save = useSaveStage();
  const create = useCreateStage();
  const remove = useDeleteStage();
  const reorder = useReorderStages();
  const notify = useNotify();
  const { setDirty, confirmLeave } = useUnsaved();

  const answer: readonly StageAnswer[] = useMemo(() => stages.data ?? [], [stages.data]);
  const rows = useMemo(() => shapeStages(answer), [answer]);

  const [edit, setEdit] = useState<Edit | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const [band, setBand] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addTone, setAddTone] = useState<ToneKey>("indigo");
  const [addError, setAddError] = useState<string | undefined>();
  const [addNotice, setAddNotice] = useState<string | undefined>();
  const [addBusy, setAddBusy] = useState(false);

  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const [grab, setGrab] = useState<Grab | null>(null);
  const [gripBusy, setGripBusy] = useState(false);
  const dragging = useRef<string | null>(null);
  const ordering = useRef(false);

  const forbidden = stages.error?.result?.status === 403;
  useEffect(() => {
    if (forbidden) onForbidden();
  }, [forbidden, onForbidden]);

  const base = edit ? answer.find((s) => s.id === edit.id) : undefined;
  const patch = base && edit ? stagePatch(base, edit.draft) : {};
  const dirty = Object.keys(patch).length > 0;
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  // キーボードで動かしたら、作り直されたつまみに焦点を戻す
  useEffect(() => {
    if (grab) focusGrip(grab.id);
  }, [grab]);

  if (stages.isPending || forbidden) return <SettingsLoading />;
  if (stages.isError && !stages.data) {
    return (
      <div className="k-f9s-stack">
        <ErrorState code={failureCode(stages.error.result ?? null)} />
        <div>
          <Button onClick={() => void stages.refetch()}>{RETRY}</Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- 直す
  const openEdit = (id: string) => {
    const s = answer.find((x) => x.id === id);
    if (!s || edit?.id === id) return;
    confirmLeave(() => {
      setDirty(false);
      setNameError(undefined);
      setEdit({ id, draft: stageDraftOf(s) });
    });
  };
  const cancelEdit = () => {
    setEdit(null);
    setNameError(undefined);
  };
  const change = (p: Partial<StageDraft>) => setEdit((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));

  const onSave = async () => {
    if (saving.current || !edit || !base || !dirty) return;
    const problem = stageProblem(edit.draft.name);
    if (problem) return setNameError(problem);
    saving.current = true;
    setBusy(true);
    setBand(undefined);
    const name = trimName(edit.draft.name) || base.name;
    const r = await save(edit.id, patch);
    saving.current = false;
    setBusy(false);
    if (r.ok) {
      setEdit(null);
      notify(`状態「${name}」を保存しました`);
      return;
    }
    if (r.err?.code === NAME_TAKEN) return setNameError(msgOf(NAME_TAKEN));
    setBand(failureText(r.err));
  };

  // ---------------------------------------------------------------- 足す
  const openAdd = () => {
    setAddName("");
    setAddTone("indigo");
    setAddError(undefined);
    setAddNotice(undefined);
    setAddOpen(true);
  };
  const onAdd = async () => {
    if (addBusy) return;
    const problem = stageProblem(addName);
    if (problem) return setAddError(problem);
    setAddBusy(true);
    setAddError(undefined);
    setAddNotice(undefined);
    const name = trimName(addName);
    const r = await create(name, addTone);
    setAddBusy(false);
    if (r.ok) {
      setAddOpen(false);
      notify(`状態「${name}」を足しました`);
      return;
    }
    if (r.err && ADD_INLINE.has(r.err.code)) return setAddError(msgOf(r.err.code));
    setAddNotice(failureText(r.err));
  };

  // ---------------------------------------------------------------- 消す
  const openDelete = (id: string) => {
    const s = rows.find((x) => x.id === id);
    if (!s || s.locked) return;
    setBand(undefined);
    setDel({ id, name: s.name });
  };
  const onDelete = async () => {
    if (delBusy || !del) return;
    setDelBusy(true);
    setBand(undefined);
    const { id, name } = del;
    const r = await remove(id);
    setDelBusy(false);
    setDel(null);
    if (r.ok) {
      if (edit?.id === id) setEdit(null);
      return void notify(`状態「${name}」を消しました`);
    }
    setBand(deleteFailureText(r.err));
  };

  // ---------------------------------------------------------------- 並べ替え
  const runReorder = async (id: string, toIndex: number) => {
    const ids = moveStage(answer, id, toIndex);
    if (!ids || ordering.current) return;
    ordering.current = true;
    setGripBusy(true);
    setBand(undefined);
    const r = await reorder(ids);
    ordering.current = false;
    setGripBusy(false);
    if (!r.ok) setBand(failureText(r.err));
  };
  const listIds = rows.map((s) => s.id);
  const live: StagesLive = {
    ...(edit && base
      ? {
          draft: {
            name: edit.draft.name,
            tone: edit.draft.tone,
            nameError,
            canSave: dirty && !busy,
            onName: (v: string) => {
              setNameError(undefined);
              change({ name: v });
            },
            onTone: (tone) => change({ tone }),
          },
        }
      : {}),
    onEdit: openEdit,
    onCancel: cancelEdit,
    onSave: () => void onSave(),
    onDelete: openDelete,
    onAdd: openAdd,
    grabbed: grab?.id,
    gripBusy,
    onGrab: (id) => {
      if (!gripBusy) setGrab({ id, order: listIds });
    },
    onMove: (id, by) =>
      setGrab((g) => {
        if (!g || g.id !== id) return g;
        const from = g.order.indexOf(id);
        const to = from + by;
        // 始め（先頭）の上・終わり（最後）の下へは動かさない
        if (to <= 0 || to >= g.order.length - 1) return g;
        const rest = g.order.filter((x) => x !== id);
        return { id, order: [...rest.slice(0, to), id, ...rest.slice(to)] };
      }),
    onDrop: (id) => {
      const g = grab;
      setGrab(null);
      if (g && g.id === id) void runReorder(id, g.order.indexOf(id));
    },
    onRelease: () => setGrab(null),
    onDragStart: (id) => {
      dragging.current = id;
    },
    onDropOn: (targetId, after) => {
      const id = dragging.current;
      dragging.current = null;
      if (!id || id === targetId) return;
      const from = listIds.indexOf(id);
      const t = listIds.indexOf(targetId);
      if (from < 0 || t < 0) return;
      const at = after ? t + 1 : t;
      void runReorder(id, from < at ? at - 1 : at);
    },
  };

  const shown = grab ? grab.order.map((id) => rows.find((s) => s.id === id)!).filter(Boolean) : rows;
  const editingId = edit && base ? edit.id : "";

  const panel = <StagesPanel stages={shown} editing={editingId} live={live} />;
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
        title="状態を足す"
        name={addName}
        tone={addTone}
        toneName="new_stage_tone"
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
        open={del !== null}
        what="状態"
        name={del?.name ?? ""}
        busy={delBusy}
        onConfirm={() => void onDelete()}
        onClose={() => setDel(null)}
      />
    </>
  );
}
