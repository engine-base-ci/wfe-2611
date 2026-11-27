"use client";
// チケットの設定（管理者・ワークスペースの管理の中）：種別／状態／項目。段 10 の作り直し（2026-11-21）。
//   前の「チケットの形（区画を足す）」は無い（本文が自由な 1 枚になったので要らない）。
//   見た目だけ（値は props・口は呼ばない）
import { Check, GripVertical, Plus } from "lucide-react";
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Badge, Button, Loading, NoticeBox, Select, Tabs, TextField } from "@/components/k";
import type { Block, Doc } from "@kaname/contracts";
import { DocEditor } from "@/features/F4/doc/editor";
import "./settings.css";

const noop = (): void => undefined;

// 種別の本文のひな形の見本（段 5 の文書の木。薄い字は ghost の段落）
const heading = (text: string): Block => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const ghost = (text: string): Block => ({
  type: "paragraph",
  attrs: { ghost: true },
  content: [{ type: "text", text }],
});
const KIND_TEMPLATE: Doc = {
  type: "doc",
  content: [
    heading("目的"),
    ghost("どの取引先の・何月分の請求かを書きます"),
    heading("完了の条件"),
    ghost("どうなれば終わりかを書きます（例：請求書が届き、支払期日が合っている）"),
    heading("実施事項"),
    ghost("やることを、チェックの行で並べます"),
    heading("参考"),
    ghost("前の月の請求書や、取引先との決めごとがあれば書きます"),
  ],
};

/** 選べる色（正本の見分けの色 8 つ） */
export type Tone = "indigo" | "teal" | "amber" | "coral" | "sage" | "plum" | "lavender" | "teal-light";
const TONES: readonly { tone: Tone; name: string }[] = [
  { tone: "indigo", name: "藍" },
  { tone: "teal", name: "青緑" },
  { tone: "amber", name: "黄土" },
  { tone: "coral", name: "珊瑚" },
  { tone: "sage", name: "若草" },
  { tone: "plum", name: "葡萄" },
  { tone: "lavender", name: "藤" },
  { tone: "teal-light", name: "浅葱" },
];

/** 色を選ぶ（onChange を渡すと value で制御する。渡さない呼び方（モック）は既定の印だけ） */
export function ColorPick({ value, name, onChange }: { value: Tone; name: string; onChange?: (t: Tone) => void }) {
  return (
    <fieldset className="k-f9s-colors">
      <legend className="k-label">色</legend>
      <div className="k-f9s-swatches">
        {TONES.map((t) => (
          <label key={t.tone} className="k-f9s-swatch" data-tone={t.tone} title={t.name}>
            <input
              type="radio"
              name={name}
              aria-label={t.name}
              {...(onChange
                ? { checked: t.tone === value, onChange: () => onChange(t.tone) }
                : { defaultChecked: t.tone === value })}
            />
            <Check size={14} aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 読み込み中（読み上げの名前「読み込んでいます…」・すぐ出す） */
export function SettingsLoading() {
  return (
    <div role="status" aria-label="読み込んでいます…">
      <Loading delayMs={0} />
    </div>
  );
}

// ---------------------------------------------------------------- 画面の骨組み（見出しとタブ）
export type SettingsTab = "kinds" | "stages" | "fields";

export function TicketSettings({
  tab,
  children,
  onTab,
  inertTabs = [],
}: {
  tab: SettingsTab;
  children: ReactNode;
  /** タブを押したとき（渡さない呼び方（モック）は動かない） */
  onTab?: (t: SettingsTab) => void;
  /** 押せない形のタブ（中身がまだ無い） */
  inertTabs?: readonly SettingsTab[];
}) {
  const panel = (t: SettingsTab): ReactNode => (t === tab ? children : null);
  return (
    <section className="k-root k-page k-me-page k-f9s-page" aria-labelledby="tset-title">
      <header className="k-page-head">
        <h1 id="tset-title">チケットの設定</h1>
        <p className="k-page-sub">チケットの種別・状態・項目を、会社のやり方に合わせます</p>
      </header>
      <Tabs
        label="チケットの設定の中"
        value={tab}
        onValueChange={(v) => (onTab ?? noop)(v as SettingsTab)}
        items={(
          [
            { value: "kinds", label: "種別" },
            { value: "stages", label: "状態" },
            { value: "fields", label: "項目" },
          ] as const
        ).map((i) => ({
          ...i,
          panel: panel(i.value),
          ...(inertTabs.includes(i.value) ? { disabled: true } : {}),
        }))}
      />
    </section>
  );
}

// ---------------------------------------------------------------- 種別（名前・色・本文のひな形）
export interface KindRow {
  id: string;
  name: string;
  tone: Tone;
  hasTemplate: boolean;
}

/** 種別の右の欄の値と動き（渡さない呼び方（モック）は読むだけの見た目） */
export interface KindsLive {
  name: string;
  tone: Tone;
  template: Doc;
  /** 種別を替えたら作り直す（前の種別の字を残さない） */
  editorKey: string;
  /** 名前の欄の下の赤字 */
  nameError?: string | undefined;
  /** 欄の上の赤い箱（口の断りのうち欄に結べない物） */
  notice?: string | undefined;
  /** 保存できる（変えた所がある・答えを待っていない） */
  canSave: boolean;
  busy: boolean;
  /** 消せない訳（あれば「この種別を消す…」は押せない形） */
  deleteBlocked?: string | undefined;
  onName: (v: string) => void;
  onTone: (t: Tone) => void;
  onTemplate: (doc: Doc) => void;
  onSave: () => void;
  onDelete: () => void;
  onAdd: () => void;
}

export function KindsPanel({
  kinds,
  current,
  hrefOf,
  onSelect,
  live,
}: {
  kinds: readonly KindRow[];
  current: string;
  /** 一覧の行き先（渡さなければ #id） */
  hrefOf?: (id: string) => string;
  /** 一覧を押したとき（行き先へは移らず、呼ぶ側が移る） */
  onSelect?: (id: string) => void;
  live?: KindsLive;
}) {
  const k = kinds.find((x) => x.id === current) ?? kinds[0]!;
  const pick = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onSelect || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onSelect(id);
  };
  const guard = (ok: boolean, go: () => void) => () => {
    if (ok) go();
  };
  return (
    <div className="k-f9s-md">
      <div className="k-f9s-side">
        <ul className="k-f9s-list" aria-label="種別">
          {kinds.map((x) => (
            <li key={x.id}>
              <a
                href={hrefOf ? hrefOf(x.id) : `#${x.id}`}
                className="k-f9s-item"
                aria-current={x.id === k.id ? "true" : undefined}
                onClick={pick(x.id)}
              >
                <span className="k-f9s-dot" data-tone={x.tone} aria-hidden="true" />
                <span className="k-f9s-item-t">{x.name}</span>
                <small>{x.hasTemplate ? "ひな形あり" : "ひな形なし"}</small>
              </a>
            </li>
          ))}
        </ul>
        <Button variant="outlined" size="sm" icon={<Plus size={14} />} onClick={live?.onAdd}>
          種別を足す
        </Button>
      </div>
      <form
        className="k-f9s-form"
        aria-label={`種別「${k.name}」を直す`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (live?.canSave) live.onSave();
        }}
      >
        {live?.notice ? <NoticeBox>{live.notice}</NoticeBox> : null}
        {live ? (
          <TextField
            label="名前"
            name="kind_name"
            value={live.name}
            required
            error={live.nameError}
            onChange={(e) => live.onName(e.target.value)}
          />
        ) : (
          <TextField label="名前" name="kind_name" value={k.name} readOnly required />
        )}
        <ColorPick value={live ? live.tone : k.tone} name="kind_tone" {...(live ? { onChange: live.onTone } : {})} />
        <div className="k-field">
          <span className="k-label">本文のひな形</span>
          <p className="k-f9s-hint">
            チケットを作る面で、この種別を選ぶと本文に例として入ります。書く人は消しても、書き換えても構いません。
          </p>
          {live ? (
            <DocEditor key={live.editorKey} doc={live.template} onChange={live.onTemplate} ariaLabel="本文のひな形" />
          ) : (
            <DocEditor doc={KIND_TEMPLATE} onChange={noop} />
          )}
        </div>
        <div className="k-f9s-acts">
          <Button
            variant="outlined"
            {...(live?.deleteBlocked ? { "aria-disabled": true, title: live.deleteBlocked } : {})}
            onClick={live ? guard(!live.deleteBlocked && !live.busy, live.onDelete) : undefined}
          >
            この種別を消す…
          </Button>
          <Button
            {...(live && !live.canSave ? { "aria-disabled": true } : {})}
            onClick={live ? guard(live.canSave, live.onSave) : undefined}
          >
            保存する
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- 状態（名前・色・並び）
export interface StageRow {
  id: string;
  name: string;
  tone: Tone;
  /** 仕組みが使う状態（消せない）の訳 */
  locked?: string;
}

/** 直している行の値と動き（K-708 が渡す） */
export interface StageDraftLive {
  name: string;
  tone: Tone;
  /** 名前の欄の下の赤字 */
  nameError?: string | undefined;
  /** 保存できる（変えた所がある・答えを待っていない） */
  canSave: boolean;
  onName: (v: string) => void;
  onTone: (t: Tone) => void;
}

/** 状態の欄の動き（K-708 が渡す。渡さない呼び方（モック）は今の見た目のまま） */
export interface StagesLive {
  draft?: StageDraftLive | undefined;
  onEdit: (id: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  /** キーボードでつかんでいる行 */
  grabbed?: string | undefined;
  /** 並べ替えの答えを待つ間（つまみは押せない） */
  gripBusy: boolean;
  /** つまみの動き：Enter でつかむ・↑↓ で動かす・Enter で落とす・Esc で戻す */
  onGrab: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onDrop: (id: string) => void;
  onRelease: () => void;
  /** マウスで掴んで落とす（落とした行と、その下半分か） */
  onDragStart: (id: string) => void;
  onDropOn: (targetId: string, after: boolean) => void;
}

const GRIP_KEYS = new Set(["Enter", " ", "ArrowUp", "ArrowDown", "Escape"]);

function gripProps(s: StageRow, live: StagesLive | undefined) {
  if (!live) return {};
  if (s.locked) return { "aria-disabled": true as const, title: s.locked, draggable: false };
  const held = live.grabbed === s.id;
  return {
    "data-stage-grip": s.id,
    "aria-pressed": held,
    disabled: live.gripBusy,
    draggable: !live.gripBusy,
    onDragStart: (e: DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", s.id);
      live.onDragStart(s.id);
    },
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!GRIP_KEYS.has(e.key)) return;
      if (!held && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") return held ? live.onDrop(s.id) : live.onGrab(s.id);
      if (e.key === "Escape") return live.onRelease();
      live.onMove(s.id, e.key === "ArrowUp" ? -1 : 1);
    },
  };
}

function dropProps(id: string, live: StagesLive | undefined) {
  if (!live) return {};
  return {
    onDragOver: (e: DragEvent<HTMLLIElement>) => e.preventDefault(),
    onDrop: (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      live.onDropOn(id, e.clientY > r.top + r.height / 2);
    },
  };
}

function StageEdit({ s, live }: { s: StageRow; live: StagesLive | undefined }) {
  const d = live?.draft;
  if (!live || !d) {
    return (
      <div className="k-f9s-stage-edit">
        <TextField label="名前" name="stage_name" value={s.name} readOnly required />
        <ColorPick value={s.tone} name="stage_tone" />
        <div className="k-f9s-acts">
          <Button variant="outlined">やめる</Button>
          <Button>保存する</Button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="k-f9s-stage-edit"
      aria-label={`状態「${s.name}」を直す`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (d.canSave) live.onSave();
      }}
    >
      <TextField
        label="名前"
        name="stage_name"
        value={d.name}
        required
        error={d.nameError}
        onChange={(e) => d.onName(e.target.value)}
      />
      <ColorPick value={d.tone} name="stage_tone" onChange={d.onTone} />
      <div className="k-f9s-acts">
        <Button variant="outlined" onClick={live.onCancel}>
          やめる
        </Button>
        <Button type="submit" disabled={!d.canSave}>
          保存する
        </Button>
      </div>
    </form>
  );
}

export function StagesPanel({
  stages,
  editing,
  live,
}: {
  stages: readonly StageRow[];
  editing: string;
  live?: StagesLive | undefined;
}) {
  return (
    <div className="k-f9s-stack">
      <p className="k-f9s-hint">上から順に、チケットの状態を選ぶ所に並びます。左のつまみで並べ替えます。</p>
      <ol className="k-f9s-stages" aria-label="状態">
        {stages.map((s) => (
          <li
            key={s.id}
            className="k-f9s-stage"
            data-editing={s.id === editing || undefined}
            {...dropProps(s.id, live)}
          >
            <div className="k-f9s-stage-row">
              <button type="button" className="k-f9s-grip" aria-label={`${s.name}を並べ替える`} {...gripProps(s, live)}>
                <GripVertical size={16} aria-hidden="true" />
              </button>
              <span className="k-f9s-pill" data-tone={s.tone}>
                {s.name}
              </span>
              {s.locked ? <span className="k-f9s-lock">{s.locked}</span> : null}
              <span className="k-f9s-stage-acts">
                {s.id === editing ? null : (
                  <Button
                    variant="outlined"
                    size="sm"
                    aria-label={`${s.name}を直す`}
                    {...(live ? { onClick: () => live.onEdit(s.id) } : {})}
                  >
                    直す
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${s.name}を消す`}
                  {...(s.locked
                    ? { "aria-disabled": true, tabIndex: -1, title: s.locked }
                    : live
                      ? { onClick: () => live.onDelete(s.id) }
                      : {})}
                >
                  消す
                </Button>
              </span>
            </div>
            {s.id === editing ? <StageEdit s={s} live={live} /> : null}
          </li>
        ))}
      </ol>
      <div>
        <Button variant="outlined" size="sm" icon={<Plus size={14} />} {...(live ? { onClick: live.onAdd } : {})}>
          状態を足す
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 項目のマスタ（会社が足す項目）
export type FieldType = "1 行" | "複数行" | "数" | "日付" | "1 つ選ぶ" | "複数選ぶ" | "チェック";
const FIELD_TYPES: readonly FieldType[] = ["1 行", "複数行", "数", "日付", "1 つ選ぶ", "複数選ぶ", "チェック"];

export interface FieldRow {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  desc: string;
  /** どの種別で出すか（種別の id） */
  kinds: readonly string[];
  options?: readonly string[];
}

export function FieldsPanel({
  fields,
  current,
  kinds,
}: {
  fields: readonly FieldRow[];
  current: string;
  kinds: readonly KindRow[];
}) {
  const f = fields.find((x) => x.id === current) ?? fields[0]!;
  return (
    <div className="k-f9s-md">
      <div className="k-f9s-side">
        <ul className="k-f9s-list" aria-label="会社が足した項目">
          {fields.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="k-f9s-item" aria-current={x.id === f.id ? "true" : undefined}>
                <span className="k-f9s-item-t">{x.name}</span>
                {x.required ? <Badge tone="danger">必須</Badge> : null}
                <small>{x.type}</small>
              </a>
            </li>
          ))}
        </ul>
        <Button variant="outlined" size="sm" icon={<Plus size={14} />}>
          項目を足す
        </Button>
      </div>
      <form className="k-f9s-form" aria-label={`項目「${f.name}」を直す`}>
        <TextField label="名前" name="field_name" value={f.name} readOnly required />
        <Select
          label="型"
          name="field_type"
          options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
          value={f.type}
          onValueChange={noop}
        />
        {f.options ? (
          <fieldset className="k-f9s-options">
            <legend className="k-label">選ぶ物</legend>
            <ul>
              {f.options.map((o) => (
                <li key={o}>
                  <button type="button" className="k-f9s-grip" aria-label={`${o}を並べ替える`}>
                    <GripVertical size={16} aria-hidden="true" />
                  </button>
                  <input className="k-input" defaultValue={o} aria-label={`選ぶ物：${o}`} readOnly />
                  <Button variant="ghost" size="sm" aria-label={`${o}を外す`}>
                    外す
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="outlined" size="sm" icon={<Plus size={14} />}>
              選ぶ物を足す
            </Button>
          </fieldset>
        ) : null}
        <label className="k-f9s-check">
          <input type="checkbox" defaultChecked={f.required} />
          必須にする（入れないとチケットを作れません）
        </label>
        <TextField
          label="説明"
          name="field_desc"
          value={f.desc}
          readOnly
          description="入力の下に小さく出ます。AI もこの説明を読みます。"
        />
        <fieldset className="k-f9s-options">
          <legend className="k-label">どの種別で出すか</legend>
          <div className="k-f9s-kinds">
            {kinds.map((k) => (
              <label key={k.id} className="k-f9s-check">
                <input type="checkbox" defaultChecked={f.kinds.includes(k.id)} />
                <span className="k-f9s-dot" data-tone={k.tone} aria-hidden="true" />
                {k.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="k-f9s-acts">
          <Button variant="outlined">この項目を消す…</Button>
          <Button>保存する</Button>
        </div>
      </form>
    </div>
  );
}
