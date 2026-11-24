"use client";
// 一覧（全部）とグループの一覧の、検索条件の箱と表の上の道具（K-252・キャンバス List・D-145.9）。K-478 で絞りを口の欄につないだ。
//   言葉の欄（題名か番号で絞る）：100 字まで・打ち終わってから 300ms で 1 回だけ口を呼ぶ（G-16）・打った字はそのまま渡す（そろえるのは口・K-92）。
//   かんたん：状態の札・親子・担当者・種別・AI に任せている を URL の絞りの組（extra）に出す（全部 AND・欄の名前は features/F7/saved/filter-params.ts）。
//     状態の札は押したとき段の口を 1 回だけ読み、名前から段の id を引く（開いたときは読まない・URL の stage_id は口にそのまま送り、札は押した形にしない）。
//   詳しく：条件を組む（features/F7/saved/condition-builder.tsx）。分類・節目・畳む・検索条件を保存 はまだなので押せない（aria-disabled・グレー）。
//   表の上の道具：件数は総数を返さない口なので空。まとめて操作・CSV で取り込むは押せない。表示設定は一覧の共通の部品（list-columns.tsx）に
//     1 行の高さ・並べ方（sort。既定の「更新が新しい順」と同じなら欄を付けない）を差し込む
import { useEffect, useRef, useState } from "react";
import { ConditionBuilder, ViewSettings } from "@/features/F7/saved/views";
import { COND_KEYS, without, withParams } from "@/features/F7/saved/filter-params";
import { useListDensity } from "@/features/F7/saved/use-list-density";
import { useListNames, useStageNames } from "@/features/F7/saved/use-list-names";
import { ColumnSettings, type Columns } from "./list-columns";
import type { ListExtra } from "./use-ticket-list";

/** URL の絞りの組と、その替え方（渡さないとき＝モックは、押しても何も起きない） */
type ExtraProps = { extra?: ListExtra; onExtra?: (next: ListExtra) => void };

/** 言葉の欄に入る字の上限（D-128.157） */
export const QUERY_MAX = 100;
/** 打ち終わってから口を呼ぶまで */
const QUERY_WAIT_MS = 300;

const ALL = "すべて";
const NOT_DONE = "完了以外";
const STATES = [ALL, "未着手", "作業中", "確認中", "承認待ち", "実行中", "渡し中", NOT_DONE] as const;
const FAMILY: readonly { label: string; parent: string | null }[] = [
  { label: ALL, parent: null },
  { label: "親だけ", parent: "none" },
  { label: "子だけ", parent: "any" },
];
/** 一覧の並べ方（K-473 の既定：一覧は更新が新しい順） */
export const ALL_SORTS = [
  { value: "due_on", label: "期限の近い順" },
  { value: "start_on", label: "開始日の近い順" },
  { value: "updated_at", label: "更新が新しい順" },
  { value: "created_at", label: "作った順" },
] as const;
const ALL_SORT_DEFAULT = "updated_at";
const NONE_EXTRA: ListExtra = {};
const AI_SAMPLE = "鈴木さん担当で今週期限の提案、終わってないもの";

/** 押せない字（まだ使えない）。Tab で止まらない・押しても何も起きない */
function Off({ className, children, label }: { className: string; children: string; label?: string }) {
  return (
    <span className={className} aria-disabled="true" title={`${label ?? children}（準備中）`}>
      {children}
    </span>
  );
}

/** 押せない形のボタン（button の役・Tab で止まらない・口を呼ばない） */
function OffButton({ className, children }: { className: string; children: string }) {
  return (
    <button type="button" className={className} aria-disabled="true" tabIndex={-1} title={`${children}（準備中）`}>
      {children}
    </button>
  );
}

/** 札の行（状態・親子） */
function ChipGroup({
  label,
  chips,
  current,
  onPick,
}: {
  label: string;
  chips: readonly string[];
  current: string | null;
  onPick: (chip: string) => void;
}) {
  return (
    <span className="k-list-search-group" role="group" aria-label={label}>
      <span className="k-list-search-label">{label}</span>
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          className="k-list-search-chip"
          aria-pressed={c === current}
          data-current={c === current || undefined}
          onClick={() => onPick(c)}
        >
          {c}
        </button>
      ))}
    </span>
  );
}

/** 字を 100 字（コードポイント）までに切る */
const clip = (v: string): string => {
  const chars = [...v];
  return chars.length > QUERY_MAX ? chars.slice(0, QUERY_MAX).join("") : v;
};

/** 言葉の欄の字（打ち終わってから 1 回だけ渡す） */
function useQueryText(onQuery: (q: string) => void): [string, (v: string) => void] {
  const [text, setText] = useState("");
  const sent = useRef("");
  useEffect(() => {
    if (text === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = text;
      onQuery(text);
    }, QUERY_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [text, onQuery]);
  return [text, (v) => setText(clip(v))];
}

/** 状態の札：押している札（URL の stage_id は段の名前が分かったときだけ押した形） */
function stateOf(extra: ListExtra, stages: readonly { id: string; name: string }[] | null): string | null {
  const id = extra["stage_id"];
  if (id) return stages?.find((s) => s.id === id)?.name ?? null;
  if (extra["done"] === "false") return NOT_DONE;
  return extra["done"] ? null : ALL;
}

/** 状態の札を押す：すべて・完了以外は段の口を読まない。ほかは段の名前から id を引く（まだなら読んでから） */
function useStatePick(extra: ListExtra, onExtra: (next: ListExtra) => void, live: boolean) {
  const names = useStageNames(false);
  const [wanted, setWanted] = useState<string | null>(null);
  const stages = names.stages;
  useEffect(() => {
    if (wanted === null || stages === null) return;
    setWanted(null);
    const hit = stages.find((s) => s.name === wanted);
    if (hit) onExtra(withParams(extra, { stage_id: hit.id, done: null }));
  }, [wanted, stages, extra, onExtra]);
  const pick = (chip: string) => {
    if (!live) return;
    if (chip === ALL) return onExtra(without(extra, ["stage_id", "done"]));
    if (chip === NOT_DONE) return onExtra(withParams(extra, { stage_id: null, done: "false" }));
    if (stages === null) names.load();
    setWanted(chip);
  };
  return { stages, pick, loadStages: names.load };
}

interface PickFieldProps {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}

function PickField({ name, value, options, onChange }: PickFieldProps) {
  return (
    <label className="k-list-search-field" data-live>
      {name}
      <select
        className="k-list-search-input"
        aria-label={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ListSearch({ onQuery, extra = NONE_EXTRA, onExtra }: { onQuery: (q: string) => void } & ExtraProps) {
  const live = onExtra !== undefined;
  const set = (next: ListExtra) => onExtra?.(next);
  const [text, setText] = useQueryText(onQuery);
  const [advanced, setAdvanced] = useState(false);
  const { people, kinds } = useListNames(live);
  const states = useStatePick(extra, set, live);
  const family = FAMILY.find((f) => f.parent === (extra["parent"] ?? null))?.label ?? null;
  const field = (key: string) => (v: string) => set(withParams(extra, { [key]: v }));
  return (
    <>
      <section className="k-list-search" aria-label="検索条件">
        <div className="k-list-search-row">
          <b>検索条件</b>
          <span className="k-list-search-seg">
            <button
              type="button"
              className="k-list-search-seg-item"
              aria-pressed={!advanced}
              onClick={() => setAdvanced(false)}
            >
              かんたん
            </button>
            <button
              type="button"
              className="k-list-search-seg-item"
              aria-pressed={advanced}
              onClick={() => setAdvanced(true)}
            >
              詳しく
            </button>
          </span>
          <span className="k-list-search-acts">
            <OffButton className="k-list-tool">検索条件を保存</OffButton>
            <Off className="k-list-tool" label="畳む">
              畳む ▴
            </Off>
          </span>
        </div>
        <div className="k-list-search-chips">
          <ChipGroup label="状態" chips={STATES} current={stateOf(extra, states.stages)} onPick={states.pick} />
          <ChipGroup
            label="親子"
            chips={FAMILY.map((f) => f.label)}
            current={family}
            onPick={(c) => set(withParams(extra, { parent: FAMILY.find((f) => f.label === c)?.parent ?? null }))}
          />
        </div>
        <div className="k-list-search-fields">
          <PickField
            name="種別"
            value={extra["kind_id"] ?? ""}
            options={[{ value: "", label: ALL }, ...kinds.map((k) => ({ value: k.id, label: k.name }))]}
            onChange={field("kind_id")}
          />
          {["分類", "節目"].map((name) => (
            <span key={name} className="k-list-search-field" aria-disabled="true" title={`${name}（準備中）`}>
              {name}
              <span className="k-list-search-input">{ALL} ▾</span>
            </span>
          ))}
          <PickField
            name="担当者"
            value={extra["assignee_id"] ?? ""}
            options={[{ value: "", label: ALL }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
            onChange={field("assignee_id")}
          />
          <PickField
            name="AI に任せている"
            value={extra["delegated"] ?? ""}
            options={[
              { value: "", label: "どちらも" },
              { value: "true", label: "任せている" },
            ]}
            onChange={field("delegated")}
          />
          <label className="k-list-search-field" data-live>
            言葉
            <input
              className="k-list-search-input"
              type="text"
              aria-label="題名か番号で絞る"
              placeholder="題名・番号"
              maxLength={QUERY_MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </div>
      </section>
      {advanced ? (
        <ConditionBuilder
          aiSample={AI_SAMPLE}
          choices={{ people, kinds, stages: states.stages }}
          onNeedStages={states.loadStages}
          onApply={(params) => set({ ...without(extra, COND_KEYS), ...params })}
          onBack={() => setAdvanced(false)}
        />
      ) : null}
    </>
  );
}

/** 表の上の道具（件数・まとめて操作・CSV で取り込む・表示設定） */
export function ListTools({ columns, extra = NONE_EXTRA, onExtra }: { columns: Columns } & ExtraProps) {
  const { density, setDensity } = useListDensity();
  const sort = extra["sort"] ?? ALL_SORT_DEFAULT;
  return (
    <div className="k-list-filter" role="group" aria-label="一覧の道具">
      <span className="k-list-dim" data-value />
      <span className="k-list-tools">
        <Off className="k-list-tool">まとめて操作</Off>
        <Off className="k-list-tool">CSV で取り込む</Off>
        <ColumnSettings
          columns={columns}
          title="一覧の見え方"
          after={
            <ViewSettings
              embedded
              columns={[]}
              density={density}
              onDensity={setDensity}
              groupBy="none"
              pendingGroup
              sort={sort}
              sortOptions={ALL_SORTS}
              onSort={(v) => onExtra?.(withParams(extra, { sort: v === ALL_SORT_DEFAULT ? null : v }))}
              asDefault={false}
              canSetDefault={false}
            />
          }
        />
      </span>
    </div>
  );
}
