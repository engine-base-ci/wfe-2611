"use client";
// グループを直す・並びを替える・層の名前と並びを直す小窓の入れ物（K-806）。
//   口は契約の口だけ（updateScope・listScopes・K-804／updateLayer・listLayers・K-803）。変えた欄・変えた層だけを送り、並びは先頭から違う位置を 1 つずつ送る
//   （口は毎回、兄弟を 1 から振り直す）。二度押しは useRef で止める
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PAGE_ERROR, errorText, useNotify } from "@/components/k";
import { MEMBERS_KEY } from "@/features/F10/invite/use-members";
import { call, type CallErr } from "@/lib/api/call";
import type { GroupFormErrors, GroupFormValues, GroupPerson, GroupTone, LayerRow, OrderRow } from "./group-dialogs";
import { NAME_REQUIRED } from "./use-group-add";
import { useLayers } from "./use-layers";
import { siblingsOf, useScopes, type ScopeRow } from "./use-scopes";

export const LAYER_TOO_LONG = "層の名前は 40 字までです";
export const ORDER_FAILED = "並びを保存できませんでした";
const LAYER_MAX = 40;

/** 正本の文（無ければ共通の 1 件）。人の名前は答えの detail から */
export function textOf(r: CallErr): string {
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

/** 字の数（書記素ごと・口と同じ数え方。絵文字や結合文字を 1 字に数える） */
export function charCount(v: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(v)].length;
  }
  return Array.from(v).length;
}

/** 送る体（契約 K-804・K-803 の欄。変えた欄だけ入る） */
type ScopeBody = { name?: string; color?: GroupTone; manager_member_ids?: string[]; position?: number };
type LayerBody = { label?: string; order_no?: number };

/** 並びの手順：口の並び（server）を、望む並び（desired）にするため、先頭から違う位置の物を 1 つずつその位置へ動かす */
export function orderSteps(server: readonly string[], desired: readonly string[]): { id: string; pos: number }[] {
  const cur = [...server];
  const steps: { id: string; pos: number }[] = [];
  desired.forEach((id, i) => {
    if (cur[i] === id) return;
    const from = cur.indexOf(id);
    if (from < 0) return;
    cur.splice(from, 1);
    cur.splice(i, 0, id);
    steps.push({ id, pos: i + 1 });
  });
  return steps;
}

/** 直す小窓の値 → 送る体（変えた欄だけ。何も変えていなければ null） */
export function diffScope(row: ScopeRow, v: { name: string; manager: string; tone: GroupTone }): ScopeBody | null {
  const body: ScopeBody = {};
  const name = v.name.trim();
  if (name !== row.name) body.name = name;
  if (v.tone !== row.color) body.color = v.tone;
  const first = row.managers[0]?.id ?? "";
  if (v.manager && v.manager !== first)
    body.manager_member_ids = [v.manager, ...row.managers.slice(1).map((m) => m.id)];
  return Object.keys(body).length ? body : null;
}

const move = <T>(list: readonly T[], i: number, by: -1 | 1): T[] => {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

interface LayerDraft {
  id: string;
  label: string;
  name: string;
  groups: number;
  error?: string;
}

export function useGroupEdit({
  people,
  onLayersClosed,
  onAddLayer,
}: {
  people: readonly GroupPerson[];
  /** 層の小窓を閉じた（やめる・保存した）→ 足す小窓へ戻る */
  /** 保存したときは名前を直した層の「前の名前 → 新しい名前」（足す小窓で選んでいた層を付け替える） */
  onLayersClosed: (renamed?: Readonly<Record<string, string>>) => void;
  /** 層の小窓の「＋ 層を足す」→ 足す小窓の新しい層の欄へ戻る */
  onAddLayer: () => void;
}) {
  const qc = useQueryClient();
  const notify = useNotify();
  const scopes = useScopes();
  const layers = useLayers();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pageNotice, setPageNotice] = useState<string | undefined>(undefined);

  // ---- 直す
  const [row, setRow] = useState<ScopeRow | null>(null);
  const [draft, setDraft] = useState<{ name: string; manager: string; tone: GroupTone }>({
    name: "",
    manager: "",
    tone: "teal",
  });
  const [errors, setErrors] = useState<GroupFormErrors>({});
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // ---- 並び
  const [orderOpen, setOrderOpen] = useState(false);
  const [order, setOrder] = useState<ScopeRow[]>([]);
  const [orderNotice, setOrderNotice] = useState<string | undefined>(undefined);
  // ---- 層
  const [layersOpen, setLayersOpen] = useState(false);
  const [layerRows, setLayerRows] = useState<LayerDraft[]>([]);
  const [layerNotice, setLayerNotice] = useState<string | undefined>(undefined);

  /** 書く手順を 1 本ずつ。網が切れたら（call が投げる）開いている小窓の赤い箱に正本の offline の文・中身は残す */
  const run = async (f: () => Promise<void>, onOffline: (text: string) => void) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await f();
    } catch {
      onOffline(errorText(PAGE_ERROR.offline).entry.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const reloadMembers = () => qc.invalidateQueries({ queryKey: MEMBERS_KEY });

  /** 「直す」：グループの鍵（groupKey＝口の id。id の無い行だけ短い名前）で行を引く */
  async function openEdit(key: string) {
    setPageNotice(undefined);
    const rows = await scopes.reload();
    const r = rows?.find((s) => s.id === key) ?? null;
    if (!r) {
      setPageNotice(errorText(rows ? PAGE_ERROR.notFound : PAGE_ERROR.down).entry.message);
      return;
    }
    setRow(r);
    setDraft({ name: r.name, manager: r.managers[0]?.id ?? "", tone: r.color });
    setErrors({});
    setNotice(undefined);
  }
  const closeEdit = () => {
    if (sending.current) return;
    setRow(null);
  };
  const changed = row ? diffScope(row, draft) : null;
  const saveEdit = () =>
    run(async () => {
      if (!row) return;
      if (!draft.name.trim()) {
        setErrors((e) => ({ ...e, name: NAME_REQUIRED }));
        return;
      }
      const body = diffScope(row, draft);
      if (!body) return;
      setNotice(undefined);
      const r = await call("updateScope", { params: { id: row.id }, body, screenId: "members" });
      if (!r.ok) {
        if (r.code === "E-GRP-011") setErrors((e) => ({ ...e, name: textOf(r) }));
        else if (r.code === "E-GRP-002") {
          setRow(null);
          setPageNotice(textOf(r));
          void reloadMembers();
          void scopes.reload();
        } else setNotice(textOf(r));
        return;
      }
      setRow(null);
      notify(`「${draft.name.trim()}」を直しました`);
      await reloadMembers();
    }, setNotice);

  const editValues: GroupFormValues = {
    name: draft.name,
    code: row?.ticket_prefix ?? "",
    layer: row?.layer?.label ?? "",
    manager: draft.manager,
    members: [],
    query: "",
    tone: draft.tone,
  };
  const more = (row?.managers.length ?? 0) - 1;

  // ---- 並び
  const server = siblingsOf(scopes.scopes);
  async function openOrder() {
    setPageNotice(undefined);
    const rows = await scopes.reload();
    if (!rows) {
      setPageNotice(errorText(PAGE_ERROR.down).entry.message);
      return;
    }
    setOrder(siblingsOf(rows));
    setOrderNotice(undefined);
    setOrderOpen(true);
  }
  const orderChanged = order.map((r) => r.id).join() !== server.map((r) => r.id).join();
  const saveOrder = () =>
    run(async () => {
      const steps = orderSteps(
        server.map((r) => r.id),
        order.map((r) => r.id),
      );
      setOrderNotice(undefined);
      for (const s of steps) {
        const body: ScopeBody = { position: s.pos };
        const r = await call("updateScope", { params: { id: s.id }, body, screenId: "members" });
        if (!r.ok) {
          setOrderNotice(ORDER_FAILED);
          const rows = await scopes.reload();
          if (rows) setOrder(siblingsOf(rows));
          return;
        }
      }
      setOrderOpen(false);
      notify("並びを替えました");
      await reloadMembers();
      void scopes.reload();
    }, setOrderNotice);

  // ---- 層
  async function openLayers() {
    let items = layers.layers;
    if (!items.length || layers.failed) {
      const r = await layers.reload();
      items = r.data ?? [];
    }
    setLayerRows(items.map((l) => ({ id: l.id, label: l.label, name: l.label, groups: l.groups })));
    setLayerNotice(undefined);
    setLayersOpen(true);
  }
  const layersChanged =
    layerRows.map((l) => l.id).join() !== layers.layers.map((l) => l.id).join() ||
    layerRows.some((l) => l.name !== l.label);
  const closeLayers = (back: () => void) => {
    if (sending.current) return;
    setLayersOpen(false);
    back();
  };
  const saveLayers = () =>
    run(async () => {
      const bad = layerRows.map((l) => {
        const v = l.name.trim();
        if (v === l.label) return undefined;
        if (!v) return NAME_REQUIRED;
        return charCount(v) > LAYER_MAX ? LAYER_TOO_LONG : undefined;
      });
      if (bad.some(Boolean)) {
        setLayerRows((rows) => rows.map((l, i) => ({ ...l, error: bad[i] })));
        return;
      }
      const steps = orderSteps(
        layers.layers.map((l) => l.id),
        layerRows.map((l) => l.id),
      );
      const bodies = new Map<string, LayerBody>();
      for (const s of steps) bodies.set(s.id, { order_no: s.pos });
      for (const l of layerRows) {
        const v = l.name.trim();
        if (v !== l.label) bodies.set(l.id, { label: v, ...(bodies.get(l.id) ?? {}) });
      }
      setLayerNotice(undefined);
      for (const [id, body] of bodies) {
        const r = await call("updateLayer", { params: { id }, body, screenId: "members" });
        if (!r.ok) {
          if (r.code === "E-GRP-019")
            setLayerRows((rows) => rows.map((l) => (l.id === id ? { ...l, error: textOf(r) } : l)));
          else setLayerNotice(textOf(r));
          if (r.status === 404) void layers.reload();
          return;
        }
      }
      const renamed: Record<string, string> = {};
      for (const l of layerRows) if (l.name.trim() !== l.label) renamed[l.label] = l.name.trim();
      await layers.reload();
      setLayersOpen(false);
      onLayersClosed(renamed);
    }, setLayerNotice);

  const orderRows: OrderRow[] = order.map((r) => ({
    id: r.id,
    code: r.ticket_prefix,
    name: r.name,
    tone: r.color,
    count: r.member_count,
  }));
  const layerView: LayerRow[] = layerRows.map((l) => ({
    name: l.name,
    label: l.label,
    groups: l.groups,
    ...(l.error ? { error: l.error } : {}),
  }));

  return {
    openEdit: (key: string) => void openEdit(key),
    openOrder: () => void openOrder(),
    openLayers: () => void openLayers(),
    /** 並びの上に出す赤い箱（もう無いグループを直そうとした・読めない） */
    pageNotice,
    edit: {
      mode: "edit" as const,
      open: row !== null,
      values: editValues,
      errors,
      ...(notice ? { notice } : {}),
      memberCount: row?.member_count ?? 0,
      ...(more > 0 ? { managerMore: more } : {}),
      people,
      busy,
      saveDisabled: !changed,
      onName: (v: string) => {
        setDraft((d) => ({ ...d, name: v }));
        setErrors((e) => ({ ...e, name: undefined }) as GroupFormErrors);
      },
      onManager: (id: string | null) => setDraft((d) => ({ ...d, manager: id ?? "" })),
      onTone: (t: GroupTone) => setDraft((d) => ({ ...d, tone: t })),
      onSubmit: () => void saveEdit(),
      onCancel: closeEdit,
    },
    order: {
      open: orderOpen,
      rows: orderRows,
      onMove: (i: number, by: -1 | 1) => setOrder((o) => move(o, i, by)),
      onSave: () => void saveOrder(),
      onCancel: () => {
        if (!sending.current) setOrderOpen(false);
      },
      busy,
      saveDisabled: !orderChanged,
      ...(orderNotice ? { notice: orderNotice } : {}),
    },
    layers: {
      open: layersOpen,
      rows: layerView,
      onName: (i: number, v: string) =>
        setLayerRows((rows) => rows.map((l, j) => (j === i ? { ...l, name: v, error: undefined } : l)) as LayerDraft[]),
      onMove: (i: number, by: -1 | 1) => setLayerRows((rows) => move(rows, i, by)),
      onAddLayer: () => closeLayers(onAddLayer),
      onSave: () => void saveLayers(),
      onCancel: () => closeLayers(() => onLayersClosed()),
      busy,
      saveDisabled: !layersChanged,
      ...(layerNotice ? { notice: layerNotice } : {}),
    },
  };
}
