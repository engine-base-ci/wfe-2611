"use client";
// チケットの設定（管理者・ワークスペースの管理の中）：種別／状態／項目。段 10 の作り直し（2026-11-21）。
//   前の「チケットの形（区画を足す）」は無い（本文が自由な 1 枚になったので要らない）。
//   見た目だけ（値は props・口は呼ばない）
import { Check, GripVertical, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Select, Tabs, TextField } from "@/components/k";
import { DocEditor, Ghost } from "@/features/F9/knowledge/doc-temp";
import "./settings.css";

const noop = (): void => undefined;

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

function ColorPick({ value, name }: { value: Tone; name: string }) {
  return (
    <fieldset className="k-f9s-colors">
      <legend className="k-label">色</legend>
      <div className="k-f9s-swatches">
        {TONES.map((t) => (
          <label key={t.tone} className="k-f9s-swatch" data-tone={t.tone} title={t.name}>
            <input type="radio" name={name} defaultChecked={t.tone === value} aria-label={t.name} />
            <Check size={14} aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- 画面の骨組み（見出しとタブ）
export type SettingsTab = "kinds" | "stages" | "fields";

export function TicketSettings({ tab, children }: { tab: SettingsTab; children: ReactNode }) {
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
        onValueChange={noop}
        items={[
          { value: "kinds", label: "種別", panel: panel("kinds") },
          { value: "stages", label: "状態", panel: panel("stages") },
          { value: "fields", label: "項目", panel: panel("fields") },
        ]}
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

export function KindsPanel({ kinds, current }: { kinds: readonly KindRow[]; current: string }) {
  const k = kinds.find((x) => x.id === current) ?? kinds[0]!;
  return (
    <div className="k-f9s-md">
      <div className="k-f9s-side">
        <ul className="k-f9s-list" aria-label="種別">
          {kinds.map((x) => (
            <li key={x.id}>
              <a href={`#${x.id}`} className="k-f9s-item" aria-current={x.id === k.id ? "true" : undefined}>
                <span className="k-f9s-dot" data-tone={x.tone} aria-hidden="true" />
                <span className="k-f9s-item-t">{x.name}</span>
                <small>{x.hasTemplate ? "ひな形あり" : "ひな形なし"}</small>
              </a>
            </li>
          ))}
        </ul>
        <Button variant="outlined" size="sm" icon={<Plus size={14} />}>
          種別を足す
        </Button>
      </div>
      <form className="k-f9s-form" aria-label={`種別「${k.name}」を直す`}>
        <TextField label="名前" name="kind_name" value={k.name} readOnly required />
        <ColorPick value={k.tone} name="kind_tone" />
        <div className="k-field">
          <span className="k-label">本文のひな形</span>
          <p className="k-f9s-hint">
            チケットを作る面で、この種別を選ぶと本文に例として入ります。書く人は消しても、書き換えても構いません。
          </p>
          <DocEditor>
            <h2>目的</h2>
            <Ghost>どの取引先の・何月分の請求かを書きます</Ghost>
            <h2>完了の条件</h2>
            <Ghost>どうなれば終わりかを書きます（例：請求書が届き、支払期日が合っている）</Ghost>
            <h2>実施事項</h2>
            <Ghost>やることを、チェックの行で並べます</Ghost>
            <h2>参考</h2>
            <Ghost>前の月の請求書や、取引先との決めごとがあれば書きます</Ghost>
          </DocEditor>
        </div>
        <div className="k-f9s-acts">
          <Button variant="outlined">この種別を消す…</Button>
          <Button>保存する</Button>
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

export function StagesPanel({ stages, editing }: { stages: readonly StageRow[]; editing: string }) {
  return (
    <div className="k-f9s-stack">
      <p className="k-f9s-hint">上から順に、チケットの状態を選ぶ所に並びます。左のつまみで並べ替えます。</p>
      <ol className="k-f9s-stages" aria-label="状態">
        {stages.map((s) => (
          <li key={s.id} className="k-f9s-stage" data-editing={s.id === editing || undefined}>
            <div className="k-f9s-stage-row">
              <button type="button" className="k-f9s-grip" aria-label={`${s.name}を並べ替える`}>
                <GripVertical size={16} aria-hidden="true" />
              </button>
              <span className="k-f9s-pill" data-tone={s.tone}>
                {s.name}
              </span>
              {s.locked ? <span className="k-f9s-lock">{s.locked}</span> : null}
              <span className="k-f9s-stage-acts">
                {s.id === editing ? null : (
                  <Button variant="outlined" size="sm" aria-label={`${s.name}を直す`}>
                    直す
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${s.name}を消す`}
                  {...(s.locked ? { "aria-disabled": true, tabIndex: -1, title: s.locked } : {})}
                >
                  消す
                </Button>
              </span>
            </div>
            {s.id === editing ? (
              <div className="k-f9s-stage-edit">
                <TextField label="名前" name="stage_name" value={s.name} readOnly required />
                <ColorPick value={s.tone} name="stage_tone" />
                <div className="k-f9s-acts">
                  <Button variant="outlined">やめる</Button>
                  <Button>保存する</Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div>
        <Button variant="outlined" size="sm" icon={<Plus size={14} />}>
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
