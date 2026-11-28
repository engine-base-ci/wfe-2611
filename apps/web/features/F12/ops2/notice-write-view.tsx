"use client";
// お知らせを書く・書き直すの本番の欄（K-1015）。下絵 views-notices.tsx の NoticeNewPage と同じ部品・同じ並び・同じ字で、値と関数を受け取って描くだけ。
//   出した後（locked）は 種類・誰に・出す場所・いつ出すか を押せない形で出す（隠さない・aria-disabled・D-145.9）。
//   ［下書きにする］［出す］［書き直す］は、題か本文が空白だけ・送っている間は押せない形（aria-disabled・押しても関数を呼ばない）
import { useEffect, useRef, type ReactNode } from "react";
import {
  Band,
  Button,
  NoticeBox,
  PageBody,
  PageHeader,
  Select,
  TextArea,
  TextField,
  type BandTone,
} from "@/components/k";
import { Note } from "@/features/F12/ops/ops-parts";
import "@/features/F12/ops/ops.css";
import "./ops2.css";
import "../shared/choice.css";
import { canSend, KIND_LABEL, previewSub, shortLocal, type NoticeForm, type NoticeKind } from "./notice-form";

export interface NoticeWriteProps {
  form: NoticeForm;
  onForm: (next: NoticeForm) => void;
  /** 書き直す頁 */
  edit?: boolean;
  /** 出した後（種類・誰に・出す場所・いつ出すか を押せない形） */
  locked?: boolean;
  /** プランで選ぶ の選び肢 */
  plans: readonly { value: string; label: string }[];
  /** ワークスペースを選ぶ の候補（読めた物だけ・口の並びのまま） */
  workspaces: readonly { id: string; name: string }[];
  onDraft: () => void;
  onPublish?: () => void;
  onCancel?: () => void;
  /** ［出す］の字（日を決めたら「MM/DD HH:mm に出す」） */
  publishLabel: string;
  busy?: boolean;
  /** 口が断った・落ちたときの字（赤い箱） */
  error?: string | null;
  /** ワークスペースの候補が読めなかったときの字（赤い箱と［もう一度］） */
  workspacesError?: string | null;
  onRetryWorkspaces?: () => void;
}

const BAND_TONE: Readonly<Record<NoticeKind, BandTone>> = { maintenance: "wait", incident: "danger", release: "info" };
const KIND_OPTIONS = (["release", "incident", "maintenance"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }));

/** 押せない形の属性（押せない欄・ボタン） */
const inert = (off: boolean) => (off ? { "aria-disabled": true as const } : {});

function Choice({
  type,
  name,
  checked,
  title,
  desc,
  locked,
  onPick,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  title: ReactNode;
  desc?: ReactNode;
  locked?: boolean;
  onPick: (on: boolean) => void;
}) {
  return (
    <label className="k-op-choice">
      <input
        type={type}
        name={name}
        checked={checked}
        {...inert(Boolean(locked))}
        onChange={(e) => {
          if (!locked) onPick(e.currentTarget.checked);
        }}
      />
      <span className="k-op-choice-text">
        <b>{title}</b>
        {desc ? <span>{desc}</span> : null}
      </span>
    </label>
  );
}

/** プラン・ワークスペースの選び肢（選んでいない方は押せない＝下絵の PickChecks と同じ形） */
function Picks({
  label,
  items,
  chosen,
  on,
  locked,
  onChange,
}: {
  label: string;
  items: readonly { value: string; label: string }[];
  chosen: readonly string[];
  on: boolean;
  locked: boolean;
  onChange: (next: string[]) => void;
}) {
  if (items.length === 0) return null;
  const wide = items.some((t) => t.label.length > 6);
  return (
    <div className="k-op-checks" role="group" aria-label={label} {...(wide ? { "data-wide": true } : {})}>
      {items.map((t) => (
        <label key={t.value} className="k-op-choice">
          <input
            type="checkbox"
            checked={chosen.includes(t.value)}
            disabled={!on}
            {...inert(locked)}
            onChange={(e) => {
              if (locked) return;
              const add = e.currentTarget.checked;
              onChange(add ? [...chosen, t.value] : chosen.filter((v) => v !== t.value));
            }}
          />
          <span className="k-op-choice-text">
            <b>{t.label}</b>
          </span>
        </label>
      ))}
    </div>
  );
}

function Actions(p: NoticeWriteProps & { off: boolean }) {
  const guard = (fn?: () => void) => () => {
    if (!p.off) fn?.();
  };
  if (p.edit)
    return (
      <>
        <Button variant="outlined" onClick={() => p.onCancel?.()}>
          やめる
        </Button>
        <Button variant={p.locked ? "primary" : "outlined"} {...inert(p.off)} onClick={guard(p.onDraft)}>
          書き直す
        </Button>
        {p.locked ? null : (
          <Button {...inert(p.off)} onClick={guard(p.onPublish)}>
            {p.publishLabel}
          </Button>
        )}
      </>
    );
  return (
    <>
      <Button variant="outlined" {...inert(p.off)} onClick={guard(p.onDraft)}>
        下書きにする
      </Button>
      <Button {...inert(p.off)} onClick={guard(p.onPublish)}>
        {p.publishLabel}
      </Button>
    </>
  );
}

function Preview({ form }: { form: NoticeForm }) {
  return (
    <div className="k-op-form">
      <b>顧客にはこう見える</b>
      {form.band ? (
        <div className="k-oq-preview">
          <span>上の帯</span>
          <Band
            tone={BAND_TONE[form.kind]}
            title={form.title}
            sub={previewSub(form.body)}
            acts={
              <Button size="sm" variant="outlined" tabIndex={-1}>
                詳しく
              </Button>
            }
          />
        </div>
      ) : null}
      {form.list ? (
        <div className="k-oq-preview">
          <span>困ったとき・お知らせ の一覧</span>
          <b>
            {KIND_LABEL[form.kind]} ・ {form.title}
          </b>
        </div>
      ) : null}
    </div>
  );
}

export function NoticeWriteView(p: NoticeWriteProps) {
  const { form, onForm, locked = false, busy = false } = p;
  const set = (patch: Partial<NoticeForm>) => onForm({ ...form, ...patch });
  const off = busy || !canSend(form, locked);
  const maint = form.kind === "maintenance";
  const formRef = useRef<HTMLDivElement>(null);
  // 種類の ▾（部品の Select）にも押せない形の属性を付ける（部品は disabled だけを付けるため）
  useEffect(() => {
    const trigger = formRef.current?.querySelector('[role="combobox"]');
    if (!trigger) return;
    if (locked) trigger.setAttribute("aria-disabled", "true");
    else trigger.removeAttribute("aria-disabled");
  }, [locked]);
  const fixed = locked ? { disabled: true } : {};
  const wsItems = p.workspaces.map((w) => ({ value: w.id, label: w.name }));
  return (
    <PageBody labelledBy="oq-notice-new-title">
      <PageHeader
        id="oq-notice-new-title"
        title={p.edit ? "お知らせを書き直す" : "お知らせを書く"}
        {...(locked ? { sub: "出したお知らせ ・ 題・本文・影響・メンテの時間だけ直せます" } : {})}
        actions={<Actions {...p} off={off} />}
      />
      <div className="k-op-body">
        {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
        <div className="k-oq-grid2">
          <div className="k-op-form" ref={formRef}>
            <Select
              label="種類"
              name="kind"
              value={form.kind}
              {...fixed}
              onValueChange={(v) => {
                if (!locked && v) set({ kind: v as NoticeKind });
              }}
              options={KIND_OPTIONS}
            />
            <TextField label="題" name="title" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            <TextArea
              label="本文"
              name="body"
              rows={6}
              value={form.body}
              onChange={(e) => set({ body: e.target.value })}
            />
            {maint ? (
              <>
                <div className="k-oq-grid2">
                  <TextField
                    label="メンテの始まり"
                    name="starts_at"
                    type="datetime-local"
                    value={form.from}
                    onChange={(e) => set({ from: e.target.value })}
                    description="日本時間 ・ 種類がメンテのときだけ"
                  />
                  <TextField
                    label="メンテの終わり"
                    name="ends_at"
                    type="datetime-local"
                    value={form.to}
                    onChange={(e) => set({ to: e.target.value })}
                  />
                </div>
                <TextField
                  label="影響する部分"
                  name="impact"
                  value={form.impact}
                  maxLength={200}
                  onChange={(e) => set({ impact: e.target.value })}
                  description="200 字まで"
                />
              </>
            ) : null}
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>誰に</legend>
              <Choice
                type="radio"
                name="to"
                checked={form.audience === "all"}
                title="全部のワークスペース"
                locked={locked}
                onPick={() => set({ audience: "all" })}
              />
              <Choice
                type="radio"
                name="to"
                checked={form.audience === "plans"}
                title="プランで選ぶ"
                locked={locked}
                onPick={() => set({ audience: "plans" })}
              />
              <Picks
                label="プラン"
                items={p.plans}
                chosen={form.plans}
                on={form.audience === "plans"}
                locked={locked}
                onChange={(plans) => set({ plans })}
              />
              <Choice
                type="radio"
                name="to"
                checked={form.audience === "workspaces"}
                title="ワークスペースを選ぶ"
                locked={locked}
                onPick={() => set({ audience: "workspaces" })}
              />
              <Picks
                label="ワークスペース"
                items={wsItems}
                chosen={form.workspaces}
                on={form.audience === "workspaces"}
                locked={locked}
                onChange={(workspaces) => set({ workspaces })}
              />
              {form.audience === "workspaces" && p.workspacesError ? (
                <NoticeBox>
                  {p.workspacesError}
                  <Button size="sm" variant="outlined" onClick={() => p.onRetryWorkspaces?.()}>
                    もう一度
                  </Button>
                </NoticeBox>
              ) : null}
            </fieldset>
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>出す場所</legend>
              <div className="k-op-checks" data-wide>
                <Choice
                  type="checkbox"
                  name="list"
                  checked={form.list}
                  title="お知らせの一覧"
                  locked={locked}
                  onPick={(list) => set({ list })}
                />
                <Choice
                  type="checkbox"
                  name="band"
                  checked={form.band}
                  title="上の帯（閉じられる）"
                  locked={locked}
                  onPick={(band) => set({ band })}
                />
              </div>
              {maint ? (
                <Note>
                  メンテのときは、メンテの間はメンテナンス中の画面・ログインの画面にも出ます。使えなくなるメンテなので、各ワークスペースの管理者にメールでも届きます
                </Note>
              ) : null}
            </fieldset>
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>いつ出すか</legend>
              <Choice
                type="radio"
                name="at"
                checked={form.when === "now"}
                title="すぐ"
                locked={locked}
                onPick={() => set({ when: "now" })}
              />
              <Choice
                type="radio"
                name="at"
                checked={form.when === "date"}
                title="日を決める"
                desc={shortLocal(form.at) || undefined}
                locked={locked}
                onPick={() => set({ when: "date" })}
              />
              {form.when === "date" ? (
                <TextField
                  label="出す日時"
                  name="publish_at"
                  type="datetime-local"
                  value={form.at}
                  {...(locked ? { readOnly: true, "aria-disabled": true } : {})}
                  onChange={(e) => set({ at: e.target.value })}
                  description="日本時間"
                />
              ) : null}
            </fieldset>
          </div>
          <Preview form={form} />
        </div>
      </div>
    </PageBody>
  );
}
