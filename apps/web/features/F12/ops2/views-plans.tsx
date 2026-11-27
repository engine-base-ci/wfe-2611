"use client";
// 配るもの › プラン：いまのプラン・値段を変える案・決める人の画面・値段の記録（段 13・領域 ops2・キャンバス OpPlans・OpPlanEdit・OpPlanReview・OpPlanLog）。
//   値を受け取って描くだけ。値段は仮。業務の型は描かない（段 10 の決め）
//   本番（K-991）は任意の props で値と押したときの関数を渡す。渡さない呼び方（モック）は下絵の見た目のまま
import type { Route } from "next";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { Band, Button, Callout, PageBody, PageHeader, TextArea, TextField } from "@/components/k";
import {
  Card,
  Chip,
  Facts,
  Feed,
  Note,
  RadioChoice,
  Stat,
  StatGrid,
  StatusBadge,
  type FeedItem,
} from "@/features/F12/ops/ops-parts";
import { IMPACT_ROWS, type ImpactRow } from "./ops2-sample";
import "@/features/F12/ops/ops.css";
import "./ops2.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

export type SkillsTab = "ops" | "templates" | "plans";
const TABS: readonly (readonly [SkillsTab, string, number, string])[] = [
  ["ops", "操作", 1, "/dev/mock/f12-ops2/oq-operations"],
  ["templates", "ひな形", 3, "/dev/mock/f12-ops2/oq-templates"],
  ["plans", "プラン", 3, "/dev/mock/f12-ops2/oq-plans"],
];

/** 配るものの中の行き先（操作・ひな形・プラン）。配るものは全部のワークスペースに効く。hrefs を渡すと本番の道 */
export function SkillsNav({ on, hrefs }: { on: SkillsTab; hrefs?: Partial<Record<SkillsTab, string>> }) {
  return (
    <nav aria-label="配るものの中">
      <ul className="k-oq-subnav">
        {TABS.map(([k, label, n, href]) => (
          <li key={k}>
            <a href={hrefs?.[k] ?? href} {...(k === on ? { "aria-current": "page" as const } : {})}>
              {label}
              <StatusBadge tone="neutral">{n}</StatusBadge>
            </a>
          </li>
        ))}
        <li>
          <Note>配るものは全部のワークスペースに効く。版で持ち、前の版に戻せる</Note>
        </li>
      </ul>
    </nav>
  );
}

export type PlansView = "now" | "proposal" | "log";
/** 本番の行き先（配るものの中・プランの見方の札） */
export interface PlansHrefs {
  nav?: Partial<Record<SkillsTab, string>>;
  chips?: Partial<Record<PlansView, string>>;
}
export function PlansChips({
  on,
  hrefs,
  count = 1,
}: {
  on: PlansView;
  hrefs?: Partial<Record<PlansView, string>>;
  count?: number;
}) {
  const router = useRouter();
  const go = (v: PlansView) => {
    const href = hrefs?.[v];
    return href ? () => router.push(href as Route) : undefined;
  };
  return (
    <div className="k-op-chips" role="group" aria-label="プランの見方">
      <Chip on={on === "now"} onClick={go("now")}>
        いまのプラン
      </Chip>
      <Chip on={on === "proposal"} count={count} onClick={go("proposal")}>
        変える案
      </Chip>
      <Chip on={on === "log"} onClick={go("log")}>
        記録
      </Chip>
    </div>
  );
}

export interface PlanBox {
  /** 本番の箱の鍵（plan_key）。モックは名前 */
  key?: string;
  name: string;
  ver: string;
  places: number;
  price: string;
  rows: readonly (readonly [string, string])[];
  proposal?: string;
}
const PLAN_BOXES: readonly PlanBox[] = [
  {
    name: "無料",
    ver: "v1",
    places: 21,
    price: "¥0",
    rows: [
      ["人数", "3 人まで"],
      ["使えるもの", "チケット・承認・ナレッジ"],
    ],
  },
  {
    name: "チーム",
    ver: "v1",
    places: 19,
    price: "¥15,000",
    rows: [
      ["人数", "10 人まで"],
      ["使えるもの", "＋ ゲストを招く"],
      ["無料期間", "なし"],
    ],
    proposal: "v2 ¥18,000 ・ 決める人を待っている",
  },
  {
    name: "ビジネス",
    ver: "v1",
    places: 8,
    price: "¥40,000",
    rows: [
      ["人数", "30 人まで"],
      ["使えるもの", "＋ ゲストのグループ"],
      ["無料期間", "なし"],
    ],
  },
];

export interface PlansPageProps {
  plans?: readonly PlanBox[];
  onPropose?: (key: string) => void;
  hrefs?: PlansHrefs;
  /** 変える案の数（札の数） */
  proposals?: number;
  /** 決めた・差し戻した後の知らせ（role=status） */
  status?: string | null;
  /** 読めない・見えないときの中身（箱の代わり） */
  fallback?: ReactNode;
}
/** プラン：版・使っている会社の数・変える案 */
export function PlansPage({ plans = PLAN_BOXES, onPropose, hrefs, proposals, status, fallback }: PlansPageProps) {
  return (
    <PageBody labelledBy="oq-plans-title">
      <PageHeader
        id="oq-plans-title"
        title="プラン"
        sub="値段と中身。変えるときは新しい版の案を作り、別の人が決める"
        actions={
          <Button icon={<Plus size={14} />} aria-disabled="true" tabIndex={-1} title="まだ使えません">
            プランを足す
          </Button>
        }
      />
      <div className="k-op-body">
        <SkillsNav on="plans" {...(hrefs?.nav ? { hrefs: hrefs.nav } : {})} />
        <PlansChips on="now" {...(hrefs?.chips ? { hrefs: hrefs.chips } : {})} count={proposals ?? 1} />
        {status ? (
          <p role="status" className="k-op-note-text">
            {status}
          </p>
        ) : (
          <Callout tone="info" title="仮">
            値段はまだ仮です。決めたら新しい版として出します（顧客の「プランを変える」と請求書に出る値段もここから）
          </Callout>
        )}
        {fallback ?? (
          <div className="k-oq-plans">
            {plans.map((p) => (
              <Card key={p.key ?? p.name} title={p.name} aside={`${p.ver} ・ ${p.places} か所`}>
                <p className="k-op-price">
                  <b>{p.price}</b>
                  {p.price === "¥0" ? "" : " ／月・税別"}
                </p>
                <Facts rows={p.rows} />
                {p.proposal ? <Note>案 ・ {p.proposal}</Note> : null}
                <div className="k-oq-acts">
                  <Button
                    size="sm"
                    variant="outlined"
                    {...(onPropose ? { onClick: () => onPropose(p.key ?? p.name) } : {})}
                  >
                    変える案を作る
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
        <Note>
          変える流れ：「値段の案」ができる人が案を作る → 「値段を決める」ができる別の人が影響を見て決める →
          いまの顧客へのお知らせが自動で出る → 決めた日に効く。すべて「記録」に残る
        </Note>
      </div>
    </PageBody>
  );
}

const IMPACT_COLS: RespColumn<ImpactRow>[] = [
  { key: "ws", header: "ワークスペース", cell: (r) => r.ws },
  { key: "people", header: "人数", num: true, cell: (r) => r.people },
  { key: "now", header: "いま", cell: (r) => <span className="k-oq-from">{r.now}</span> },
  { key: "after", header: "変わったあと", cell: (r) => <span className="k-oq-to">{r.after}</span> },
];

export interface ImpactStat {
  label: string;
  value: string;
  sub?: string;
}
export interface ImpactData {
  /** 区画の右の字（いまの <プラン> の顧客） */
  label: string;
  stats: readonly ImpactStat[];
  rows: readonly (ImpactRow & { key?: string })[];
  rest: string | null;
}
const IMPACT_MOCK: ImpactData = {
  label: "いまのチームの顧客",
  stats: [
    { label: "いまのチームの顧客", value: "19 か所", sub: "止めている 1 を含む" },
    { label: "月の売上（税別）", value: "+ ¥57,000", sub: "2027 年 2 月分から" },
    { label: "新しく入る人", value: "12/01 から", sub: "¥18,000 で始まる" },
  ],
  rows: IMPACT_ROWS,
  rest: "ほか 15 か所も同じ",
};

/** 影響（案を作る画面と決める画面で同じ）。null は案ができる前（下書きにすると出る） */
export function Impact({ data = IMPACT_MOCK, note }: { data?: ImpactData | null; note?: string }) {
  if (data === null)
    return (
      <Card title="影響">
        <Note>{note ?? "下書きにすると影響が出ます"}</Note>
      </Card>
    );
  return (
    <Card title="影響" aside={data.label}>
      <StatGrid>
        {data.stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} {...(s.sub ? { sub: s.sub } : {})} />
        ))}
      </StatGrid>
      <RespTable
        caption="影響を受けるワークスペース"
        columns={IMPACT_COLS}
        rows={[...data.rows]}
        rowKey={(r) => (r as ImpactRow & { key?: string }).key ?? r.ws}
      />
      {data.rest ? <Note>{data.rest}（すべて見る）</Note> : null}
    </Card>
  );
}

const NUM = new Intl.NumberFormat("ja-JP");
const yenOf = (n: number) => `¥${NUM.format(n)}`;
const mmdd = (date: string) => date.replace(/^\d{4}-(\d{2})-(\d{2}).*$/, "$1/$2");

/** 案を作る形の値（欄は字のまま持つ） */
export interface PlanEditForm {
  planName: string;
  fromVer: number;
  toVer: number;
  proposer: string;
  places: number;
  now: { price: number; members: number; trial: number };
  price: string;
  members: string;
  trial: string;
  policy: "after_days" | "keep";
  days: string;
  newcomer: "now" | "date";
  newFrom: string;
  reason: string;
}
const FORM_MOCK: PlanEditForm = {
  planName: "チーム",
  fromVer: 1,
  toVer: 2,
  proposer: "佐野",
  places: 19,
  now: { price: 15000, members: 10, trial: 0 },
  price: "18000",
  members: "12",
  trial: "0",
  policy: "after_days",
  days: "90",
  newcomer: "date",
  newFrom: "2026-12-01",
  reason: "チームの使われ方が増え、人数の上限に当たる会社が多いため。人数を 12 人まで広げ、値段を見直す",
};
const DECIDER_MOCK = "高本 聖斗（「値段を決める」ができる人）";

export interface PlanEditPageProps {
  form?: PlanEditForm;
  onChange?: (patch: Partial<PlanEditForm>) => void;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
  /** 影響（null は案ができる前） */
  impact?: ImpactData | null;
  /** 欄ごとの理由（422） */
  errors?: Partial<Record<"price" | "members" | "trial" | "days" | "reason" | "newFrom", string>>;
  /** 断られたときの字（409 など・role=alert） */
  alert?: string | null;
  busy?: boolean;
  /** 日を決める欄を出す（本番で日を選び直すとき） */
  dateField?: boolean;
  /** 影響が無いときの注 */
  impactNote?: string;
  hrefs?: PlansHrefs;
}

/** 値段を変える案を作る：前後の差・いまの顧客の扱い・新しく入る人・理由・影響・決める人 */
export function PlanEditPage({
  form = FORM_MOCK,
  onChange,
  onSaveDraft,
  onSubmit,
  impact,
  errors = {},
  alert,
  busy,
  dateField,
  impactNote,
  hrefs,
}: PlanEditPageProps) {
  const live = onChange !== undefined;
  const n = (s: string, d: number) => (s.trim() === "" || Number.isNaN(Number(s)) ? d : Number(s));
  const price = n(form.price, form.now.price);
  const members = n(form.members, form.now.members);
  const days = n(form.days, 90);
  const set = (k: keyof PlanEditForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange?.({ [k]: e.target.value });
  const pick = (k: "policy" | "newcomer") => (e: ChangeEvent<HTMLFieldSetElement>) => {
    const t = e.target as unknown as HTMLInputElement;
    if (t.type === "radio") onChange?.({ [k]: t.value });
  };
  const field = (k: "price" | "members" | "trial" | "days", mock: string) =>
    live
      ? { type: "number", inputMode: "numeric" as const, value: form[k], onChange: set(k) }
      : { readOnly: true, defaultValue: mock };
  return (
    <PageBody labelledBy="oq-plan-edit-title">
      <PageHeader
        id="oq-plan-edit-title"
        title={`${form.planName}の値段を変える案`}
        sub={`v${form.fromVer} → v${form.toVer}${form.proposer ? ` ・ 作る人 ${form.proposer}` : ""}`}
        actions={
          <>
            <Button variant="outlined" disabled={busy} {...(onSaveDraft ? { onClick: onSaveDraft } : {})}>
              下書きにする
            </Button>
            <Button disabled={busy} {...(onSubmit ? { onClick: onSubmit } : {})}>
              決める人に回す
            </Button>
          </>
        }
      />
      <div className="k-op-body">
        <SkillsNav on="plans" {...(hrefs?.nav ? { hrefs: hrefs.nav } : {})} />
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        <Card title="変えるところ">
          <div className="k-oq-grid2">
            <TextField
              label="値段（月・税別）"
              name="price"
              error={errors.price}
              {...field("price", yenOf(price))}
              description={`いま ${yenOf(form.now.price)}`}
            />
            <TextField
              label="人数"
              name="people"
              error={errors.members}
              {...field("members", `${members} 人まで`)}
              description={`いま ${form.now.members} 人まで`}
            />
            <TextField
              label="無料期間（日）"
              name="trial_days"
              type="number"
              error={errors.trial}
              {...field("trial", form.trial)}
              description={`0〜365 ・ 0 なら無し ・ いま ${form.now.trial} 日（${form.now.trial > 0 ? `${form.now.trial} 日` : "なし"}）`}
            />
          </div>
        </Card>
        <Card title={`いまの顧客（${form.places} か所）は`}>
          <fieldset className="k-op-fieldset" onChange={pick("policy")}>
            <RadioChoice
              name="existing"
              value="after_days"
              checked={form.policy === "after_days"}
              title={`お知らせから ${days} 日たってから新しい値段`}
              desc={`決めた日にお知らせを出し、${days} 日たった最初の月の分から ${yenOf(price)}。日数は変えられる（30 日より短くはできない）`}
            />
            <RadioChoice
              name="existing"
              value="keep"
              checked={form.policy === "keep"}
              title="ずっと今の値段のまま"
              desc={`いまの顧客は v${form.fromVer}（${yenOf(form.now.price)}）のまま。新しく入る人だけ ${yenOf(price)}。中身の変化（${members} 人まで）も v${form.fromVer} の顧客には効かない`}
            />
          </fieldset>
          <TextField label="日数" name="days" error={errors.days} {...field("days", `${days} 日`)} />
          <Note>値下げ・中身を増やすだけの版は、いまの顧客にも次の請求からすぐ効く（この欄は出ない）</Note>
        </Card>
        <Card title="新しく入る人">
          <fieldset className="k-op-fieldset" onChange={pick("newcomer")}>
            <RadioChoice name="newcomer" value="now" checked={form.newcomer === "now"} title="決めたらすぐ" />
            <RadioChoice
              name="newcomer"
              value="date"
              checked={form.newcomer === "date"}
              title="日を決める"
              {...(form.newFrom ? { desc: mmdd(form.newFrom) } : {})}
            />
          </fieldset>
          {live && dateField ? (
            <TextField
              label="新しく入る人の日"
              name="new_from"
              type="date"
              error={errors.newFrom}
              value={form.newFrom}
              onChange={set("newFrom")}
            />
          ) : null}
        </Card>
        <TextArea
          label="理由"
          name="reason"
          rows={3}
          required
          error={errors.reason}
          description="必須 ・ お知らせの文のもとにもなる"
          {...(live ? { value: form.reason, onChange: set("reason") } : { readOnly: true, defaultValue: form.reason })}
        />
        <Impact {...(impact !== undefined ? { data: impact } : {})} {...(impactNote ? { note: impactNote } : {})} />
        <Card title="決める人">
          <Facts rows={[["決める人", DECIDER_MOCK]]} />
          <Note>自分の案は自分で決められない</Note>
        </Card>
      </div>
    </PageBody>
  );
}

export interface PlanReviewData {
  title: string;
  head: string;
  price: readonly [string, string] | null;
  members: readonly [string, string] | null;
  trial: string;
  existing: string;
  newcomer: string;
  reason: string;
  steps: readonly string[];
}
const REVIEW_MOCK: PlanReviewData = {
  title: "チーム v1 → v2 の案",
  head: "決める人を待っている ・ 佐野 ・ 11/04 16:40 に回した",
  price: ["¥15,000", "¥18,000"],
  members: ["10 人まで", "12 人まで"],
  trial: "なし（変えない）",
  existing: "お知らせから 90 日たった最初の月（2027 年 2 月分）から",
  newcomer: "12/01 から",
  reason: "チームの使われ方が増え、人数の上限に当たる会社が多いため。人数を 12 人まで広げ、値段を見直す",
  steps: [
    "チーム v2 ができる（v1 は残り、いまの顧客は 2027 年 1 月分まで v1）",
    "いまの顧客 19 か所の管理者にお知らせが出る（文は下で直せる）。設定の「プランと支払い」にも変わる日と値段が出る",
    "12/01 から、新しく入る人と「プランを変える」でチームを選ぶ人は ¥18,000",
    "2027 年 2 月分の請求書から ¥18,000（下書きの段で運営が確かめる）",
  ],
};
const NOTICE_MOCK =
  "チームプランの料金を 2027 年 2 月分から月 ¥18,000（税別）に改めます。あわせて人数の上限を 10 人から 12 人に広げます。それまでは今の料金のままです。ご不明な点は「困ったとき・お知らせ」からお問い合わせください。";

const fromTo = (k: string, v: readonly [string, string]) => (
  <span key={k}>
    <span className="k-oq-from">{v[0]}</span> → <span className="k-oq-to">{v[1]}</span>
  </span>
);

export interface PlanReviewPageProps {
  /** 自分の案（決められない・押せない形） */
  self?: boolean;
  /** 押せない形だけ（決める印が無い・決めた・差し戻した案） */
  locked?: boolean;
  proposal?: PlanReviewData;
  /** 影響が無いときの注 */
  impactNote?: string;
  impact?: ImpactData | null;
  notice?: string;
  onNotice?: (text: string) => void;
  onDecide?: () => void;
  onReturn?: () => void;
  busy?: boolean;
  /** 断られたときの字（role=alert） */
  alert?: string | null;
  hrefs?: PlansHrefs;
  proposals?: number;
}

/** 決める人の画面：影響を見て決める／差し戻す。self を渡すと自分の案（決められない・押せない形） */
export function PlanReviewPage({
  self = false,
  locked = false,
  proposal,
  impactNote,
  impact,
  notice,
  onNotice,
  onDecide,
  onReturn,
  busy,
  alert,
  hrefs,
  proposals,
}: PlanReviewPageProps) {
  const blocked = self
    ? { "aria-disabled": true, tabIndex: -1, title: "自分の案は自分で決められません" }
    : locked
      ? { "aria-disabled": true, tabIndex: -1 }
      : {};
  const live = proposal !== undefined;
  const p = proposal ?? REVIEW_MOCK;
  const head = live
    ? p.head
    : self
      ? "自分が作った案 ・ 佐野 ・ 11/04 16:40 に回した"
      : "決める人を待っている ・ 佐野 ・ 11/04 16:40 に回した";
  const act = (f: (() => void) | undefined) => (self || locked || !f ? {} : { onClick: f, disabled: busy });
  const rows: (readonly [string, ReactNode])[] = [
    ...(p.price ? [["値段（月・税別）", fromTo("p", p.price)] as const] : []),
    ...(p.members ? [["人数", fromTo("n", p.members)] as const] : []),
    ["無料期間", p.trial],
    ["いまの顧客", p.existing],
    ["新しく入る人", p.newcomer],
  ];
  return (
    <PageBody labelledBy="oq-plan-review-title">
      <PageHeader id="oq-plan-review-title" title={p.title} sub={head} />
      <div className="k-op-body">
        <SkillsNav on="plans" {...(hrefs?.nav ? { hrefs: hrefs.nav } : {})} />
        <PlansChips on="proposal" {...(hrefs?.chips ? { hrefs: hrefs.chips } : {})} count={proposals ?? 1} />
        {self ? (
          <Band
            tone="info"
            title="自分の案は自分で決められません"
            sub="「値段を決める」ができる別の運営の人（高本）が決めます。決めてもらうまで、この案は見るだけです"
          />
        ) : null}
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        <Card title="変わること">
          <Facts rows={rows} />
          <Note>理由：{p.reason}</Note>
        </Card>
        <Card title="決めると起きること">
          <ol className="k-oq-numbered">
            {p.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
        <TextArea
          label="お知らせの文（決めたら出る）"
          name="notice"
          rows={4}
          {...(onNotice && !self
            ? { value: notice ?? "", onChange: (e: ChangeEvent<HTMLTextAreaElement>) => onNotice(e.target.value) }
            : { readOnly: true, defaultValue: notice ?? NOTICE_MOCK })}
        />
        <Impact {...(impact !== undefined ? { data: impact } : {})} {...(impactNote ? { note: impactNote } : {})} />
        <div className="k-oq-bar">
          <Note>
            決める前に本人確認を取り直す（パスキー）。決めた人・時刻・理由・前後の値段は「記録」に残り、消せない
          </Note>
          <div className="k-oq-acts">
            <Button variant="outlined" {...blocked} {...act(onReturn)}>
              差し戻す（理由を書く）
            </Button>
            <Button {...blocked} {...act(onDecide)}>
              決める
            </Button>
          </div>
        </div>
      </div>
    </PageBody>
  );
}

/** モックの記録（渡さないとき）：UN-002 の字（historyItem(HISTORY_A)）と同じ 5 行 */
const LOG_MOCK: readonly FeedItem[] = [
  {
    at: "11/04 16:40",
    who: "佐野",
    text: "が チーム v2 の案を直して、決める人に回した",
    detail: "値段 ¥20,000 → ¥18,000 ・ 人数 10 → 12 人",
  },
  {
    at: "11/04 15:10",
    who: "高本",
    text: "が チーム v2 の案を差し戻した",
    detail: "理由：上げ幅が大きい。人数の上限を広げるなら考える",
  },
  {
    at: "11/04 11:20",
    who: "佐野",
    text: "が チーム v2 の案を作った",
    detail: "値段 ¥15,000 → ¥20,000",
  },
  { at: "10/14 09:30", who: "高本", text: "が ビジネス v1 を決めた" },
  { at: "04/01 10:00", who: "高本", text: "が 無料・チーム・ビジネス v1 を決めた" },
];
const LOG_PLANS: readonly (readonly [string | null, string])[] = [
  [null, "すべて"],
  ["free", "無料"],
  ["team", "チーム"],
  ["business", "ビジネス"],
];

export interface PlanLogPageProps {
  items?: readonly FeedItem[];
  /** 絞っているプラン（null はすべて） */
  plan?: string | null;
  onPlan?: (key: string | null) => void;
  hrefs?: PlansHrefs;
  proposals?: number;
  /** 読めない・見えないときの中身 */
  fallback?: ReactNode;
}

/** 値段の記録：消せない・直せない */
export function PlanLogPage({ items = LOG_MOCK, plan = null, onPlan, hrefs, proposals, fallback }: PlanLogPageProps) {
  return (
    <PageBody labelledBy="oq-plan-log-title">
      <PageHeader id="oq-plan-log-title" title="プランの記録" sub="値段と中身を変えた記録。消せない・直せない" />
      <div className="k-op-body">
        <SkillsNav on="plans" {...(hrefs?.nav ? { hrefs: hrefs.nav } : {})} />
        <PlansChips on="log" {...(hrefs?.chips ? { hrefs: hrefs.chips } : {})} count={proposals ?? 1} />
        <div className="k-op-chips" role="group" aria-label="プラン">
          {LOG_PLANS.map(([key, label]) => (
            <Chip key={label} on={plan === key} {...(onPlan ? { onClick: () => onPlan(key) } : {})}>
              {label}
            </Chip>
          ))}
        </div>
        {fallback ?? (
          <Card>
            <Feed label="値段の記録" items={items} />
          </Card>
        )}
        <Note>消せない・直せない。決めた版は、どのワークスペースがどの版にいるかと一緒に残る</Note>
      </div>
    </PageBody>
  );
}
