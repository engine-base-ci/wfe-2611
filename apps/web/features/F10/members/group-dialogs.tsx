"use client";
// グループの小窓（段 11・F10）：足す・直す・並びを替える・層の名前と並びを直す。
//   前の形（old/段10-v1 の F9/groups）の小窓を写して直した版（言葉は「グループ」・つかんで動かす部品には頼らず「上へ・下へ」のボタンで）。
//   キャンバス EdGroup（グループを足す）。直す・並びを替える・層を直す・入力の誤り・口が断った は絵が無いので、画面に出る文は「仮」。
//   値は props で受け取って描くだけ。欄は readOnly か値つき・押す関数は渡さない（モック）。入れ物は任意の on*・layers・people・busy を渡して動かす（K-805）
import type React from "react";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { Button, Dialog, NoticeBox, Select, TextField } from "@/components/k";
import "@/features/F10/invite/invite.css";
import "./groups.css";

export type GroupTone = "teal" | "plum" | "indigo" | "amber" | "coral" | "sage";

const SWATCHES: readonly { tone: GroupTone; label: string }[] = [
  { tone: "teal", label: "青緑" },
  { tone: "plum", label: "赤紫" },
  { tone: "indigo", label: "藍" },
  { tone: "amber", label: "黄土" },
  { tone: "coral", label: "朱" },
  { tone: "sage", label: "若草" },
];
const LAYERS = ["営業", "受託開発", "経理"];
const MANAGERS = ["佐藤 花子", "高本 聖斗", "鈴木 一郎", "田中 美咲"];
const ADD_LAYER = "__add";
/** 層 ▾ の中の「層の名前と並びを直す」（D-154.53・層の一覧が読めないときは出さない・K-806） */
const EDIT_LAYERS = "__edit";

export interface GroupFormValues {
  name: string;
  /** 番号の頭（CS-1 の CS） */
  code: string;
  layer: string;
  manager: string;
  /** 足すメンバー（札になる）。足す小窓だけ。入れ物が people を渡すときは人の id */
  members: readonly string[];
  /** メンバーを名前で探す欄にいま打っている字 */
  query: string;
  tone: GroupTone;
}
export interface GroupFormErrors {
  name?: string;
  code?: string;
  /** 新しい層の名前の欄の下（空・E-GRP-013・019） */
  newLayer?: string;
}

function Swatches({ tone, onTone }: { tone: GroupTone; onTone?: ((t: GroupTone) => void) | undefined }) {
  return (
    <div className="k-f10m-field">
      <span className="k-label" id="grp-tone-label">
        色
      </span>
      <div className="k-f10m-swatches" role="radiogroup" aria-labelledby="grp-tone-label">
        {SWATCHES.map((s) => (
          <button
            key={s.tone}
            type="button"
            role="radio"
            className="k-f10m-swatch"
            data-tone={s.tone}
            aria-checked={s.tone === tone}
            aria-label={s.label}
            title={s.label}
            onClick={onTone ? () => onTone(s.tone) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** 小窓に渡す人（マネージャーの選び・メンバーの札の候補）。渡さなければモックの決めた人 */
export interface GroupPerson {
  id: string;
  name: string;
  /** 閲覧のみ（マネージャーには選べない・E-GRP-017） */
  viewer?: boolean;
}

function MemberPick({
  members,
  query,
  people,
  candidates,
  onQuery,
  onAddMember,
  onRemoveMember,
}: {
  members: readonly string[];
  query: string;
  /** 渡すと members は人の id（札は名前を引いて描く）。渡さなければ members は名前（モック） */
  people?: readonly GroupPerson[] | undefined;
  candidates?: readonly GroupPerson[] | undefined;
  onQuery?: ((q: string) => void) | undefined;
  onAddMember?: ((id: string) => void) | undefined;
  onRemoveMember?: ((member: string) => void) | undefined;
}) {
  const labelOf = (m: string) => people?.find((p) => p.id === m)?.name ?? m;
  const live = Boolean(onQuery);
  const list = live && query.trim() && candidates ? candidates : [];
  return (
    <div className="k-f10m-field">
      <label className="k-label" htmlFor="grp-member-search">
        メンバー
      </label>
      <div className="k-f10m-pick">
        {members.map((m) => (
          <span key={m} className="k-inv-chip">
            <span className="k-inv-chip-t">{labelOf(m)}</span>
            <button
              type="button"
              className="k-inv-chip-x"
              aria-label={`${labelOf(m)} を外す`}
              onClick={onRemoveMember ? () => onRemoveMember(m) : undefined}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id="grp-member-search"
          className="k-f10m-pick-input"
          type="search"
          value={query}
          placeholder="＋ 名前で探す"
          readOnly={!live}
          autoComplete="off"
          {...(live
            ? {
                role: "combobox",
                "aria-expanded": list.length > 0,
                "aria-controls": "grp-member-list",
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => onQuery?.(e.target.value),
                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const first = list[0];
                  if (first) onAddMember?.(first.id);
                },
              }
            : {})}
        />
      </div>
      {list.length > 0 ? (
        <ul id="grp-member-list" className="k-select-popup k-select-field" role="listbox" aria-label="メンバーの候補">
          {list.map((p) => (
            <li
              key={p.id}
              role="option"
              aria-selected={false}
              className="k-select-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onAddMember?.(p.id)}
            >
              {p.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface GroupDialogProps {
  /** add＝グループを足す（キャンバス EdGroup）・edit＝グループを直す（仮） */
  mode: "add" | "edit";
  open: boolean;
  values: GroupFormValues;
  errors?: GroupFormErrors;
  /** 口が断ったとき。書いた中身は消さない */
  notice?: string;
  /** 層の ▾ から「層を足す」を選んだ形（新しい層の名前の欄が出る） */
  newLayer?: string;
  /** 直す小窓：メンバーの人数（メンバーはメンバーの画面で足す・外す） */
  memberCount?: number;
  /** 層 ▾ の中の「層の名前と並びを直す」（D-154.53）：show＝出す（既定・下絵）・disabled＝押せない形・hide＝出さない（層の一覧が読めないとき） */
  editLayersOption?: "show" | "disabled" | "hide";
  // ---- ここから入れ物がつなぐときだけ渡す（K-805・渡さなければモックのまま描くだけ）
  /** 層の名前の並び（口 listLayers の順）。渡さなければモックの 3 つ */
  layers?: readonly string[];
  /** マネージャーの選び・メンバーの札の候補（兼ねる人も 1 度だけ）。values.manager は人の id */
  people?: readonly GroupPerson[];
  /** メンバーの札の候補（探した字に当たり、まだ札に無い人）。people から入れ物が作る */
  candidates?: readonly GroupPerson[];
  onName?: (v: string) => void;
  onCode?: (v: string) => void;
  onLayer?: (layer: string) => void;
  /** 層 ▾ で「＋ 層を足す」を選んだ・新しい層の名前を打った */
  onNewLayer?: (label: string) => void;
  onManager?: (id: string | null) => void;
  onQuery?: (q: string) => void;
  onAddMember?: (id: string) => void;
  /** 札を外す（people を渡したときは人の id） */
  onRemoveMember?: (member: string) => void;
  onTone?: (t: GroupTone) => void;
  onSubmit?: () => void;
  /** やめる・Esc・外側 */
  onCancel?: () => void;
  /** 答えを待つ間（「足す」を押せない） */
  busy?: boolean;
  /** 層 ▾ の「層の名前と並びを直す」を選んだ（K-806） */
  onEditLayers?: () => void;
  /** 「保存する」を押せない（直す小窓で何も変えていない・K-806） */
  saveDisabled?: boolean;
  /** マネージャーが 2 人以上のとき、選ばない 2 人目以降の数（「ほか N 人」・K-806） */
  managerMore?: number;
}

/** グループを足す・直す小窓。名前と短い名前を横に・層・マネージャー・メンバー（足すだけ）・色の段 */
export function GroupDialog({
  mode,
  open,
  values,
  errors = {},
  notice,
  newLayer,
  memberCount,
  editLayersOption = "show",
  layers,
  people,
  candidates,
  onName,
  onCode,
  onLayer,
  onNewLayer,
  onManager,
  onQuery,
  onAddMember,
  onRemoveMember,
  onTone,
  onSubmit,
  onCancel,
  busy,
  onEditLayers,
  saveDisabled,
  managerMore,
}: GroupDialogProps) {
  const add = mode === "add";
  const live = Boolean(onSubmit);
  const layerOptions = add
    ? [
        ...(layers ?? LAYERS).map((l) => ({ value: l, label: l })),
        { value: ADD_LAYER, label: "＋ 層を足す" },
        ...(editLayersOption === "hide"
          ? []
          : [{ value: EDIT_LAYERS, label: "層の名前と並びを直す", disabled: editLayersOption === "disabled" }]),
      ]
    : [{ value: values.layer, label: values.layer }];
  const managerOptions = people
    ? people.filter((p) => !p.viewer).map((p) => ({ value: p.id, label: p.name }))
    : MANAGERS.map((m) => ({ value: m, label: m }));
  const field = (f?: (v: string) => void) =>
    f
      ? { readOnly: false, onChange: (e: React.ChangeEvent<HTMLInputElement>) => f(e.target.value) }
      : { readOnly: true };
  const code = values.code.normalize("NFKC").trim().toUpperCase();
  const sample = code && !errors.code ? code : "CS";
  return (
    <Dialog
      title={add ? "グループを足す" : "グループを直す"}
      subtitle={add ? "グループは日々のチケットの置き場。チケットの番号の頭になる" : "名前・マネージャー・色を直せる"}
      size="connect"
      open={open}
      {...(onCancel ? { onOpenChange: (o: boolean) => (o ? undefined : onCancel()) } : {})}
      actions={
        <>
          <Button variant="outlined" onClick={onCancel}>
            やめる
          </Button>
          <Button onClick={onSubmit} disabled={live ? Boolean(busy) || Boolean(saveDisabled) : undefined}>
            {add ? "足す" : "保存する"}
          </Button>
        </>
      }
    >
      <form
        className="k-dialog-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) onSubmit?.();
        }}
      >
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <div className="k-f10m-pair">
          <TextField
            name="group-name"
            label="名前"
            value={values.name}
            placeholder="例：カスタマーサポート"
            error={errors.name}
            {...field(onName)}
          />
          <TextField
            name="group-code"
            label="短い名前"
            hint="番号の頭"
            value={values.code}
            placeholder="例：CS"
            description={add ? `${sample}-1、${sample}-2 …` : "作ったあとは変えられません"}
            error={errors.code}
            {...field(onCode)}
            disabled={!add}
          />
        </div>
        <Select
          name="group-layer"
          label="層"
          options={layerOptions}
          value={newLayer !== undefined ? ADD_LAYER : live ? values.layer || null : values.layer}
          description="層の守ること・やり方・承認の決まりが、このグループにも効く"
          disabled={!add}
          {...(onLayer || onNewLayer || onEditLayers
            ? {
                onValueChange: (v: string | null) => {
                  if (v === ADD_LAYER) onNewLayer?.("");
                  else if (v === EDIT_LAYERS) onEditLayers?.();
                  else if (v) onLayer?.(v);
                },
              }
            : {})}
        />
        {newLayer !== undefined ? (
          <TextField
            name="group-new-layer"
            label="新しい層の名前"
            value={newLayer}
            placeholder="例：カスタマー"
            description="足した層の守ること・やり方・承認の決まりは、あとで決められる"
            error={errors.newLayer}
            {...field(onNewLayer)}
          />
        ) : null}
        <Select
          name="group-manager"
          label="マネージャー"
          options={managerOptions}
          value={values.manager || null}
          placeholder="選ぶ"
          {...(managerMore ? { description: `ほか ${managerMore} 人` } : {})}
          {...(onManager ? { onValueChange: (v: string | null) => onManager(v) } : {})}
        />
        {add ? (
          <MemberPick
            members={values.members}
            query={values.query}
            people={people}
            candidates={candidates}
            onQuery={onQuery}
            onAddMember={onAddMember}
            onRemoveMember={onRemoveMember}
          />
        ) : (
          <p className="k-f10m-note">{`メンバー ${memberCount ?? 0} 人は、メンバーの画面で足す・外す`}</p>
        )}
        <Swatches tone={values.tone} onTone={onTone} />
      </form>
    </Dialog>
  );
}

export interface OrderRow {
  /** 口のグループの id（入れ物がつなぐとき・行の鍵。無ければ短い名前・モック） */
  id?: string;
  code: string;
  name: string;
  tone: GroupTone;
  count: number;
}

/** 小窓の足（やめる・保存する）。入れ物がつなぐときだけ押す関数と状態を渡す（K-806） */
export interface DialogActs {
  onSave?: () => void;
  onCancel?: () => void;
  busy?: boolean;
  /** 何も変えていない（保存するを押せない） */
  saveDisabled?: boolean;
  /** 口が断ったとき（小窓の上の赤い箱） */
  notice?: string;
}

function Acts({ onSave, onCancel, busy, saveDisabled }: DialogActs) {
  const live = Boolean(onSave);
  return (
    <>
      <Button variant="outlined" onClick={onCancel}>
        やめる
      </Button>
      <Button onClick={onSave} disabled={live ? Boolean(busy) || Boolean(saveDisabled) : undefined}>
        保存する
      </Button>
    </>
  );
}
const closeWith = (onCancel?: () => void) =>
  onCancel ? { onOpenChange: (o: boolean) => (o ? undefined : onCancel()) } : {};

/** グループの並びを替える小窓（仮）。上へ・下へのボタンで 1 つずつ動かす */
export function ReorderDialog({
  open,
  rows,
  onMove,
  ...acts
}: { open: boolean; rows: readonly OrderRow[]; onMove?: (i: number, by: -1 | 1) => void } & DialogActs) {
  const last = rows.length - 1;
  return (
    <Dialog
      title="グループの並びを替える"
      subtitle="左のメニューとメンバーの画面の並びが変わる"
      size="form"
      open={open}
      {...closeWith(acts.onCancel)}
      actions={<Acts {...acts} />}
    >
      {acts.notice ? <NoticeBox>{acts.notice}</NoticeBox> : null}
      <ul className="k-f10m-order">
        {rows.map((r, i) => (
          <li key={r.id ?? r.code} className="k-f10m-order-row">
            <GripVertical size={16} aria-hidden="true" />
            <span className="k-inv-code" data-tone={r.tone} aria-hidden="true">
              {r.code}
            </span>
            <span className="k-f10m-order-name">{r.name}</span>
            <span className="k-inv-sub">{`${r.count} 人`}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={i === 0}
              aria-label={`${r.name}を上へ`}
              onClick={onMove ? () => onMove(i, -1) : undefined}
            >
              <ChevronUp size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={i === last}
              aria-label={`${r.name}を下へ`}
              onClick={onMove ? () => onMove(i, 1) : undefined}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export interface LayerRow {
  name: string;
  /** その層にあるグループの数 */
  groups: number;
  /** 読み上げの名前に使う、口の今の名前（欄を直しても変えない・K-806。無ければ name） */
  label?: string;
  /** その層の欄の下の誤り（空・40 字・E-GRP-019） */
  error?: string;
}

/** 層の名前と並びを直す小窓（仮）。名前は欄で直し、並びは上へ・下へ。層を消すことはここではしない */
export function LayersDialog({
  open,
  rows,
  onName,
  onMove,
  onAddLayer,
  ...acts
}: {
  open: boolean;
  rows: readonly LayerRow[];
  onName?: (i: number, v: string) => void;
  onMove?: (i: number, by: -1 | 1) => void;
  /** 「＋ 層を足す」（足す小窓の新しい層の欄へ戻る・K-806） */
  onAddLayer?: () => void;
} & DialogActs) {
  const last = rows.length - 1;
  return (
    <Dialog
      title="層の名前と並びを直す"
      subtitle="層の守ること・やり方・承認の決まりは、層ごとに決めている"
      size="form"
      open={open}
      {...closeWith(acts.onCancel)}
      actions={<Acts {...acts} />}
    >
      <div className="k-dialog-stack">
        {acts.notice ? <NoticeBox>{acts.notice}</NoticeBox> : null}
        <ul className="k-f10m-order">
          {rows.map((r, i) => {
            const label = r.label ?? r.name;
            return (
              <li key={label} className="k-f10m-order-row">
                <input
                  className="k-input k-f10m-layer-input"
                  value={r.name}
                  readOnly={!onName}
                  onChange={onName ? (e) => onName(i, e.target.value) : undefined}
                  aria-label={`層の名前（${label}）`}
                  aria-invalid={r.error ? true : undefined}
                  aria-describedby={r.error ? `layer-err-${i}` : undefined}
                />
                <span className="k-inv-sub">{`${r.groups} グループ`}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  aria-label={`${r.name}を上へ`}
                  onClick={onMove ? () => onMove(i, -1) : undefined}
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === last}
                  aria-label={`${r.name}を下へ`}
                  onClick={onMove ? () => onMove(i, 1) : undefined}
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </Button>
                {r.error ? (
                  <span id={`layer-err-${i}`} className="k-err">
                    {r.error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button variant="outlined" size="sm" className="k-inv-link-btn" onClick={onAddLayer}>
          ＋ 層を足す
        </Button>
        <p className="k-f10m-note">層を消すことは、ここではできません</p>
      </div>
    </Dialog>
  );
}
