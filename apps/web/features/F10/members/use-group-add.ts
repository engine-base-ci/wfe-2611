"use client";
// グループを足す小窓の入れ物（K-805）：入力の整え・確かめ・口の順（必要なら createLayer → createScope）・途中で落ちた回の続き・失敗の出し分け。
//   口は契約の口だけを呼ぶ（createScope・K-802／createLayer・listLayers・K-803）。上のグループ parent_id は送らない（D-154.31）
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { PAGE_ERROR, errorText, useNotify } from "@/components/k";
import { MEMBERS_KEY } from "@/features/F10/invite/use-members";
import { call, type CallErr } from "@/lib/api/call";
import type { GroupFormErrors, GroupFormValues, GroupPerson, GroupTone } from "./group-dialogs";
import { useLayers } from "./use-layers";

export const NAME_REQUIRED = "名前を入れてください";
/** 短い名前の形（仮・K-802 の正本の確かめと同じ） */
export const CODE_INVALID = "短い名前は、英字で始まる 1〜8 字で入れてください（T だけは使えません）";
export const CODE_TAKEN = "この短い名前は、もう使われています";

const EMPTY: GroupFormValues = { name: "", code: "", layer: "", manager: "", members: [], query: "", tone: "teal" };

/** 名前の整え：前後の空白（全角も）を削る */
export const cleanName = (v: string): string => v.trim();
/** 短い名前の整え：NFKC（全角 → 半角）・前後の空白を削る・大文字 */
export const cleanCode = (v: string): string => v.normalize("NFKC").trim().toUpperCase();
export const codeOk = (code: string): boolean => /^[A-Z][A-Z0-9]{0,7}$/.test(code) && code !== "T";

interface Member {
  id?: string;
  name?: string;
  role?: string;
  group_role?: string | null;
  suspended?: boolean;
}
interface Group {
  members?: readonly Member[];
}

/** 並び（getWorkspaceMembers）→ 小窓の人。兼ねる人は 1 度だけ（D-154.15）・止めた人は出さない・招待中は並びの groups に居ないので出ない */
export function peopleOf(groups: readonly Group[] | null | undefined): GroupPerson[] {
  const seen = new Map<string, GroupPerson>();
  for (const g of groups ?? []) {
    for (const m of g.members ?? []) {
      if (!m.id || !m.name || m.suspended || seen.has(m.id)) continue;
      const viewer = m.role === "viewer" || m.role === "requester";
      seen.set(m.id, { id: m.id, name: m.name, viewer });
    }
  }
  return [...seen.values()];
}

/** 正本の 1 件の文（無ければ共通の読めなかった文） */
function catalogText(code: string): string {
  try {
    return errorText(code).entry.message;
  } catch {
    return errorText(PAGE_ERROR.loadFailed).entry.message;
  }
}

/** 正本の文（無ければ共通の 1 件）。人の名前は答えの detail から */
function textOf(r: CallErr): string {
  const detail = (r.body["detail"] ?? {}) as Record<string, unknown>;
  const who = typeof detail["名前"] === "string" ? detail["名前"] : null;
  let msg: string;
  try {
    msg = errorText(r.code).entry.message;
  } catch {
    msg = errorText(r.status === 503 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed).entry.message;
  }
  if (!who) return msg;
  return msg.includes("{名前}") ? msg.replaceAll("{名前}", who) : `${who}：${msg}`;
}

export function useGroupAdd({ people }: { people: readonly GroupPerson[] }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const layers = useLayers();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<GroupFormValues>(EMPTY);
  /** 人の id（札は名前で描く） */
  const [memberIds, setMemberIds] = useState<readonly string[]>([]);
  const [newLayer, setNewLayer] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<GroupFormErrors>({});
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  /** 網が切れた（口に届かない）：赤い箱に正本の文・書いた中身は残す */
  const offline = () => setNotice(errorText(PAGE_ERROR.offline).entry.message);
  /** 層は足せたがグループが落ちた回：足せた層（同じ名前で押し直したら createLayer を呼ばない） */
  const madeLayer = useRef<{ label: string; id: string } | null>(null);

  const visibleLayers = layers.failed ? [] : layers.layers;
  const candidates = useMemo(() => {
    const q = values.query.trim().replace(/\s+/g, "");
    if (!q) return [];
    return people.filter((p) => !memberIds.includes(p.id) && p.name.replace(/\s+/g, "").includes(q));
  }, [people, memberIds, values.query]);

  const reset = () => {
    setValues(EMPTY);
    setMemberIds([]);
    setNewLayer(undefined);
    setErrors({});
    setNotice(undefined);
    madeLayer.current = null;
  };
  const set = (patch: Partial<GroupFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const clearError = (k: keyof GroupFormErrors) =>
    setErrors((e) => {
      if (!e[k]) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const reloadAll = () => {
    void layers.reload();
    void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
  };

  /** 送る前の確かめ。入力の誤りがあれば欄の下に出し、口を呼ばない（前に口が断った字は、その欄を直すまで残す） */
  function check(): { name: string; code: string } | null {
    const name = cleanName(values.name);
    const code = cleanCode(values.code);
    const bad: GroupFormErrors = {};
    if (!name) bad.name = NAME_REQUIRED;
    if (!codeOk(code)) bad.code = CODE_INVALID;
    if (newLayer !== undefined && !cleanName(newLayer)) bad.newLayer = NAME_REQUIRED;
    if (Object.keys(bad).length === 0) return { name, code };
    setErrors((e) => ({ ...e, ...bad }));
    return null;
  }

  /** 新しい層の id（足せた層があればそれ・無ければ足す）。足せなければ null */
  async function layerIdForNew(label: string): Promise<string | null> {
    if (madeLayer.current && madeLayer.current.label === label) return madeLayer.current.id;
    const res = await call("createLayer", { body: { label } as never, screenId: "members" });
    if (res.ok) {
      const id = String((res.data as unknown as { id: string }).id);
      madeLayer.current = { label, id };
      return id;
    }
    if (res.code === "E-GRP-013" || res.code === "E-GRP-019") setErrors((e) => ({ ...e, newLayer: textOf(res) }));
    else setNotice(textOf(res));
    return null;
  }

  function onScopeError(r: CallErr) {
    if (r.code === "E-GRP-010") return setErrors((e) => ({ ...e, code: CODE_TAKEN }));
    if (r.code === "E-GRP-011") return setErrors((e) => ({ ...e, name: textOf(r) }));
    setNotice(textOf(r));
    if (r.status === 404) reloadAll();
  }

  async function submit() {
    if (sending.current) return;
    const ok = check();
    if (!ok) return;
    sending.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      let layerId: string | null = null;
      if (newLayer !== undefined) {
        layerId = await layerIdForNew(cleanName(newLayer));
        if (!layerId) return;
      } else if (values.layer) {
        layerId = visibleLayers.find((l) => l.label === values.layer)?.id ?? null;
        if (!layerId) {
          // 選んだ層が一覧に無い（別の所で直された・消えた）：黙って層なしで送らず、読み直して選び直してもらう
          set({ layer: "" });
          setNotice(catalogText("E-GRP-020"));
          void layers.reload();
          return;
        }
      }
      const body: Record<string, unknown> = { name: ok.name, ticket_prefix: ok.code };
      if (layerId) body["layer_id"] = layerId;
      if (values.manager) body["manager_member_ids"] = [values.manager];
      if (memberIds.length) body["member_ids"] = [...memberIds];
      body["color"] = values.tone;
      const r = await call("createScope", { body: body as never, screenId: "members" });
      if (!r.ok) return onScopeError(r);
      setOpen(false);
      reset();
      notify(`「${ok.name}」を足しました`);
      await qc.invalidateQueries({ queryKey: MEMBERS_KEY });
    } catch {
      offline();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return {
    open: () => {
      reset();
      setOpen(true);
      void layers.reload();
    },
    dialog: {
      mode: "add" as const,
      open,
      values: { ...values, members: memberIds },
      errors,
      ...(notice ? { notice } : layers.failed ? { notice: textOf(layerFail) } : {}),
      ...(newLayer !== undefined ? { newLayer } : {}),
      editLayersOption: layers.failed ? ("hide" as const) : ("disabled" as const),
      layers: visibleLayers.map((l) => l.label),
      people,
      candidates,
      busy,
      onName: (v: string) => {
        set({ name: v });
        clearError("name");
      },
      onCode: (v: string) => {
        set({ code: v });
        clearError("code");
      },
      onLayer: (v: string) => {
        set({ layer: v });
        setNewLayer(undefined);
        clearError("newLayer");
      },
      onNewLayer: (v: string) => {
        setNewLayer(v);
        clearError("newLayer");
      },
      onManager: (id: string | null) => set({ manager: id ?? "" }),
      onQuery: (q: string) => set({ query: q }),
      onAddMember: (id: string) => {
        setMemberIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
        set({ query: "" });
      },
      onRemoveMember: (id: string) => setMemberIds((ids) => ids.filter((x) => x !== id)),
      onTone: (t: GroupTone) => set({ tone: t }),
      onSubmit: () => void submit(),
      onCancel: () => {
        if (sending.current) return;
        setOpen(false);
        reset();
      },
    },
  };
}

/** 層の一覧が読めなかったときの赤い箱の文（503 の正本） */
const layerFail: CallErr = {
  ok: false,
  status: 503,
  kind: "failed",
  code: PAGE_ERROR.down,
  message: null,
  fields: {},
  retryAfterSec: null,
  body: {},
};
