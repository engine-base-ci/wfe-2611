"use client";
// グループの小窓（段 11・F10）：足す・直す・並びを替える・層の名前と並びを直す。
//   前の形（old/段10-v1 の F9/groups）の小窓を写して直した版（言葉は「グループ」・つかんで動かす部品には頼らず「上へ・下へ」のボタンで）。
//   キャンバス EdGroup（グループを足す）。直す・並びを替える・層を直す・入力の誤り・口が断った は絵が無いので、画面に出る文は「仮」。
//   値は props で受け取って描くだけ。欄は readOnly か値つき・押す関数は渡さない
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
  /** 足すメンバー（札になる）。足す小窓だけ */
  members: readonly string[];
  /** メンバーを名前で探す欄にいま打っている字 */
  query: string;
  tone: GroupTone;
}
export interface GroupFormErrors {
  name?: string;
  code?: string;
}

function Swatches({ tone }: { tone: GroupTone }) {
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
          />
        ))}
      </div>
    </div>
  );
}

function MemberPick({ members, query }: { members: readonly string[]; query: string }) {
  return (
    <div className="k-f10m-field">
      <label className="k-label" htmlFor="grp-member-search">
        メンバー
      </label>
      <div className="k-f10m-pick">
        {members.map((m) => (
          <span key={m} className="k-inv-chip">
            <span className="k-inv-chip-t">{m}</span>
            <button type="button" className="k-inv-chip-x" aria-label={`${m} を外す`}>
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
          readOnly
        />
      </div>
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
}: GroupDialogProps) {
  const add = mode === "add";
  const layerOptions = add
    ? [
        ...LAYERS.map((l) => ({ value: l, label: l })),
        { value: ADD_LAYER, label: "＋ 層を足す" },
        ...(editLayersOption === "hide"
          ? []
          : [{ value: EDIT_LAYERS, label: "層の名前と並びを直す", disabled: editLayersOption === "disabled" }]),
      ]
    : [{ value: values.layer, label: values.layer }];
  return (
    <Dialog
      title={add ? "グループを足す" : "グループを直す"}
      subtitle={add ? "グループは日々のチケットの置き場。チケットの番号の頭になる" : "名前・マネージャー・色を直せる"}
      size="connect"
      open={open}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>{add ? "足す" : "保存する"}</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <div className="k-f10m-pair">
          <TextField
            name="group-name"
            label="名前"
            value={values.name}
            placeholder="例：カスタマーサポート"
            error={errors.name}
            readOnly
          />
          <TextField
            name="group-code"
            label="短い名前"
            hint="番号の頭"
            value={values.code}
            placeholder="例：CS"
            description={
              add
                ? `${values.code && !errors.code ? values.code : "CS"}-1、${values.code && !errors.code ? values.code : "CS"}-2 …`
                : "作ったあとは変えられません"
            }
            error={errors.code}
            readOnly
            disabled={!add}
          />
        </div>
        <Select
          name="group-layer"
          label="層"
          options={layerOptions}
          value={newLayer !== undefined ? ADD_LAYER : values.layer}
          description="層の守ること・やり方・承認の決まりが、このグループにも効く"
          disabled={!add}
        />
        {newLayer !== undefined ? (
          <TextField
            name="group-new-layer"
            label="新しい層の名前"
            value={newLayer}
            placeholder="例：カスタマー"
            description="足した層の守ること・やり方・承認の決まりは、あとで決められる"
            readOnly
          />
        ) : null}
        <Select
          name="group-manager"
          label="マネージャー"
          options={MANAGERS.map((m) => ({ value: m, label: m }))}
          value={values.manager || null}
          placeholder="選ぶ"
        />
        {add ? (
          <MemberPick members={values.members} query={values.query} />
        ) : (
          <p className="k-f10m-note">{`メンバー ${memberCount ?? 0} 人は、メンバーの画面で足す・外す`}</p>
        )}
        <Swatches tone={values.tone} />
      </div>
    </Dialog>
  );
}

export interface OrderRow {
  code: string;
  name: string;
  tone: "teal" | "plum" | "amber" | "indigo";
  count: number;
}

/** グループの並びを替える小窓（仮）。上へ・下へのボタンで 1 つずつ動かす */
export function ReorderDialog({ open, rows }: { open: boolean; rows: readonly OrderRow[] }) {
  const last = rows.length - 1;
  return (
    <Dialog
      title="グループの並びを替える"
      subtitle="左のメニューとメンバーの画面の並びが変わる"
      size="form"
      open={open}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>保存する</Button>
        </>
      }
    >
      <ul className="k-f10m-order">
        {rows.map((r, i) => (
          <li key={r.code} className="k-f10m-order-row">
            <GripVertical size={16} aria-hidden="true" />
            <span className="k-inv-code" data-tone={r.tone} aria-hidden="true">
              {r.code}
            </span>
            <span className="k-f10m-order-name">{r.name}</span>
            <span className="k-inv-sub">{`${r.count} 人`}</span>
            <Button variant="ghost" size="sm" disabled={i === 0} aria-label={`${r.name}を上へ`}>
              <ChevronUp size={16} aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" disabled={i === last} aria-label={`${r.name}を下へ`}>
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
}

/** 層の名前と並びを直す小窓（仮）。名前は欄で直し、並びは上へ・下へ。層を消すことはここではしない */
export function LayersDialog({ open, rows }: { open: boolean; rows: readonly LayerRow[] }) {
  const last = rows.length - 1;
  return (
    <Dialog
      title="層の名前と並びを直す"
      subtitle="層の守ること・やり方・承認の決まりは、層ごとに決めている"
      size="form"
      open={open}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>保存する</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <ul className="k-f10m-order">
          {rows.map((r, i) => (
            <li key={r.name} className="k-f10m-order-row">
              <input
                className="k-input k-f10m-layer-input"
                value={r.name}
                readOnly
                aria-label={`層の名前（${r.name}）`}
              />
              <span className="k-inv-sub">{`${r.groups} グループ`}</span>
              <Button variant="ghost" size="sm" disabled={i === 0} aria-label={`${r.name}を上へ`}>
                <ChevronUp size={16} aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" disabled={i === last} aria-label={`${r.name}を下へ`}>
                <ChevronDown size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button variant="outlined" size="sm" className="k-inv-link-btn">
          ＋ 層を足す
        </Button>
        <p className="k-f10m-note">層を消すことは、ここではできません</p>
      </div>
    </Dialog>
  );
}
