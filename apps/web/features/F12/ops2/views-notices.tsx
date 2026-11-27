"use client";
// 運営のお知らせ：一覧・作る・1 件（障害の続報）・出す確かめ（段 13・領域 ops2・キャンバス OpNotices・OpNoticeNew・OpNotice）。値を受け取って描くだけ
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Band,
  Button,
  Callout,
  Confirm,
  Empty,
  PageBody,
  PageHeader,
  Select,
  TextArea,
  TextField,
  NoticeBox,
  type BadgeTone,
} from "@/components/k";
import { Bullets, Card, Chip, Facts, Feed, Note, RadioChoice, StatusBadge } from "@/features/F12/ops/ops-parts";
import "@/features/F12/ops/ops.css";
import "./ops2.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";
import "../shared/choice.css";
import { NoticeWriteView, type NoticeWriteProps } from "./notice-write-view";

export interface NoticeRow {
  /** 1 件の行き先に使う（下絵の行には無い） */
  id?: string;
  kind: string;
  title: string;
  to: string;
  state: string;
  tone: BadgeTone;
  by: string;
}
const ROWS: readonly NoticeRow[] = [
  {
    kind: "障害",
    title: "分身の実行が遅れています",
    to: "全部",
    state: "原因が分かった ・ 11/02 09:40〜",
    tone: "warning",
    by: "高本",
  },
  {
    kind: "メンテ",
    title: "11/10（月）2:00〜3:00 メンテナンス",
    to: "全部",
    state: "予定 ・ 11/03 10:00 に出す",
    tone: "progress",
    by: "高本",
  },
  {
    kind: "リリース",
    title: "チケットにスレッドができました",
    to: "全部",
    state: "出した 10/28",
    tone: "success",
    by: "高本",
  },
  {
    kind: "リリース",
    title: "先方の人を招けるようにしました",
    to: "チーム・ビジネス",
    state: "出した 10/14",
    tone: "success",
    by: "佐野",
  },
  {
    kind: "リリース",
    title: "ナレッジの取り込み（Obsidian・Notion）",
    to: "全部",
    state: "下書き",
    tone: "neutral",
    by: "佐野",
  },
];
const MOCK_ONE = "/dev/mock/f12-ops2/oq-notice";
const MOCK_NEW = "/dev/mock/f12-ops2/oq-notice-new";
const colsOf = (rowHref: (r: NoticeRow) => string): RespColumn<NoticeRow>[] => [
  { key: "kind", header: "種類", cell: (r) => <StatusBadge tone="neutral">{r.kind}</StatusBadge> },
  {
    key: "title",
    header: "題",
    cell: (r) => (
      <Link className="k-link" href={rowHref(r)}>
        {r.title}
      </Link>
    ),
  },
  { key: "to", header: "誰に", cell: (r) => r.to },
  { key: "state", header: "状態", cell: (r) => <StatusBadge tone={r.tone}>{r.state}</StatusBadge> },
  { key: "by", header: "出した人", cell: (r) => r.by },
];

/** 絞り込みの札 1 つ（押した印と押したときの関数） */
export interface NoticeChipItem {
  label: string;
  on: boolean;
  onClick: () => void;
}

export interface NoticesPageProps {
  /** 一覧の行（渡さなければ下絵の 5 行） */
  rows?: readonly NoticeRow[];
  /** 絞り込みの札（渡さなければ下絵の「すべて」を押した形） */
  chips?: readonly NoticeChipItem[];
  /** 題の行き先 */
  rowHref?: (r: NoticeRow) => string;
  /** ［お知らせを書く］の行き先 */
  writeHref?: string;
  /** 行が 0 のときの字（渡したときだけ表の代わりに出す） */
  empty?: string;
}

const CHIP_LABELS = ["すべて", "障害", "メンテ", "リリース", "下書き"] as const;

/** お知らせの一覧：出した・予定・障害の状態・下書き */
export function NoticesPage({
  rows = ROWS,
  chips,
  rowHref = () => MOCK_ONE,
  writeHref = MOCK_NEW,
  empty,
}: NoticesPageProps = {}) {
  const chipItems: readonly NoticeChipItem[] =
    chips ?? CHIP_LABELS.map((label, i) => ({ label, on: i === 0, onClick: () => undefined }));
  const isEmpty = empty !== undefined && rows.length === 0;
  return (
    <PageBody labelledBy="oq-notices-title">
      <PageHeader
        id="oq-notices-title"
        title="お知らせ"
        sub="全部のワークスペースか、選んだワークスペースに出す"
        actions={
          <Link className="k-btn" data-variant="primary" data-size="md" href={writeHref}>
            <Plus size={14} aria-hidden="true" />
            お知らせを書く
          </Link>
        }
      />
      <div className="k-op-body">
        <div className="k-op-chips" role="group" aria-label="種類">
          {chipItems.map((c) => (
            <Chip key={c.label} on={c.on} {...(chips ? { onClick: c.onClick } : {})}>
              {c.label}
            </Chip>
          ))}
        </div>
        {isEmpty ? (
          <Empty title={empty} />
        ) : (
          <RespTable
            caption="お知らせの一覧"
            columns={colsOf(rowHref)}
            rows={[...rows]}
            rowKey={(r) => r.id ?? r.title}
          />
        )}
        <Note>
          顧客には「困ったとき・お知らせ」の一覧に出る。障害とメンテは上の帯にも出て、メンテ中はメンテナンス中の画面になる。メールは、使えなくなるメンテのときだけ各ワークスペースの管理者に届く
        </Note>
      </div>
    </PageBody>
  );
}

const PLAN_PICKS = ["無料", "チーム", "ビジネス"] as const;
const WS_PICKS = ["合同会社ミナト企画", "北村デザイン事務所", "株式会社オオタ物流"] as const;

/** 誰に を選んだときの中の選び肢（プラン 3 つ・ワークスペースの候補）。選んでいない方は押せない */
function PickChecks({ label, items, on }: { label: string; items: readonly string[]; on: boolean }) {
  // ワークスペースの名前は長いので 1 列（細い列で名前が折れないように）
  const wide = items.some((t) => t.length > 6);
  return (
    <div className="k-op-checks" role="group" aria-label={label} {...(wide ? { "data-wide": true } : {})}>
      {items.map((t) => (
        <label key={t} className="k-op-choice">
          <input type="checkbox" defaultChecked={on && t !== "無料"} disabled={!on} />
          <span className="k-op-choice-text">
            <b>{t}</b>
          </span>
        </label>
      ))}
    </div>
  );
}

export interface NoticeNewPageProps extends Partial<NoticeWriteProps> {
  /** 出したお知らせを書き直す（題・本文・影響・メンテの時間だけ直せる。種類・誰に・出す場所・いつ出すかは押せない形で出す＝隠さない） */
  edit?: boolean;
}

/** お知らせを書く・書き直す：種類・題・本文・メンテの始まりと終わり・影響・誰に・出す場所・いつ出すか・顧客にはこう見える。
 *  form を渡すと本番の欄（K-1015・notice-write-view.tsx）。渡さない呼び方（モック）は下絵のまま */
export function NoticeNewPage({ edit = false, ...live }: NoticeNewPageProps) {
  if (live.form && live.onForm) return <NoticeWriteView {...(live as NoticeWriteProps)} edit={edit} />;
  const fixed = edit ? { disabled: true } : {};
  return (
    <PageBody labelledBy="oq-notice-new-title">
      <PageHeader
        id="oq-notice-new-title"
        title={edit ? "お知らせを書き直す" : "お知らせを書く"}
        {...(edit ? { sub: "出したお知らせ ・ 題・本文・影響・メンテの時間だけ直せます" } : {})}
        actions={
          edit ? (
            <>
              <Button variant="outlined">やめる</Button>
              <Button>書き直す</Button>
            </>
          ) : (
            <>
              <Button variant="outlined">下書きにする</Button>
              <Button>11/03 10:00 に出す</Button>
            </>
          )
        }
      />
      <div className="k-op-body">
        <div className="k-oq-grid2">
          <div className="k-op-form">
            <Select
              label="種類"
              name="kind"
              defaultValue="maint"
              {...fixed}
              options={[
                { value: "release", label: "リリース" },
                { value: "incident", label: "障害" },
                { value: "maint", label: "メンテ" },
              ]}
            />
            <TextField label="題" name="title" readOnly defaultValue="11/10（月）2:00〜3:00 メンテナンス" />
            <TextArea
              label="本文"
              name="body"
              rows={6}
              readOnly
              defaultValue={
                "データベースの入れ替えのため、11/10（月）2:00〜3:00 の間 Kaname を使えません。\n・実行中の分身の仕事は、始まる前に区切りまで進めて止めます\n・この間に承認したものは「実行待ち」になり、終わってから動きます"
              }
            />
            <div className="k-oq-grid2">
              <TextField
                label="メンテの始まり"
                name="starts_at"
                type="datetime-local"
                readOnly
                defaultValue="2026-11-10T02:00"
                description="日本時間 ・ 種類がメンテのときだけ"
              />
              <TextField
                label="メンテの終わり"
                name="ends_at"
                type="datetime-local"
                readOnly
                defaultValue="2026-11-10T03:00"
              />
            </div>
            <TextField
              label="影響する部分"
              name="impact"
              readOnly
              defaultValue="画面・分身の実行・PC とのつながり（すべて使えません）"
              description="200 字まで"
            />
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>誰に</legend>
              <RadioChoice name="to" value="all" checked title="全部のワークスペース" />
              <RadioChoice name="to" value="plan" title="プランで選ぶ" />
              <PickChecks label="プラン" items={PLAN_PICKS} on={false} />
              <RadioChoice name="to" value="pick" title="ワークスペースを選ぶ" />
              <PickChecks label="ワークスペース" items={WS_PICKS} on={false} />
            </fieldset>
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>出す場所</legend>
              <div className="k-op-checks" data-wide>
                {["お知らせの一覧", "上の帯（閉じられる）"].map((t) => (
                  <label key={t} className="k-op-choice">
                    <input type="checkbox" defaultChecked />
                    <span className="k-op-choice-text">
                      <b>{t}</b>
                    </span>
                  </label>
                ))}
              </div>
              <Note>
                メンテのときは、メンテの間はメンテナンス中の画面・ログインの画面にも出ます。使えなくなるメンテなので、各ワークスペースの管理者にメールでも届きます
              </Note>
            </fieldset>
            <fieldset className="k-op-fieldset" {...fixed}>
              <legend>いつ出すか</legend>
              <RadioChoice name="at" value="now" title="すぐ" />
              <RadioChoice name="at" value="date" checked title="日を決める" desc="11/03 10:00" />
            </fieldset>
          </div>
          <div className="k-op-form">
            <b>顧客にはこう見える</b>
            <div className="k-oq-preview">
              <span>上の帯</span>
              <Band
                tone="wait"
                title="11/10（月）2:00〜3:00 メンテナンス"
                sub="データベースの入れ替えのため、11/10（月）2:00〜3:00 の間 Kaname を使えません。…"
                acts={
                  <Button size="sm" variant="outlined">
                    詳しく
                  </Button>
                }
              />
            </div>
            <div className="k-oq-preview">
              <span>困ったとき・お知らせ の一覧</span>
              <b>メンテ ・ 11/10（月）2:00〜3:00 メンテナンス</b>
            </div>
          </div>
        </div>
      </div>
    </PageBody>
  );
}

const STEPS = ["調べている", "原因が分かった", "様子を見ている", "直った"] as const;
const STEP_OPTIONS = [
  { value: "cause", label: "原因が分かった" },
  { value: "watch", label: "様子を見ている" },
  { value: "fixed", label: "直った" },
] as const;
const DEFAULT_STEP = "様子を見ている";

/** 1 件の値（渡さなければ下絵の障害の 1 件） */
export interface NoticeDetailView {
  title: string;
  sub: string;
  /** 障害の状態の段（障害でなければ null：段・状態を足す・直ったにする を出さない） */
  steps: { labels: readonly string[]; current: number } | null;
  /** これまで（新しい順） */
  feed: readonly { at: string; text: string; detail: string }[];
  /** 本文（障害でない 1 件だけ出す） */
  body: string;
  /** 影響の 1 行（無ければ null） */
  impact: string | null;
  /** 出している場所のカードの字 */
  place: { maint: string | null; where: string };
}

/** 書いた続報の失敗の赤い箱の字 */
export interface NoticeErrorView {
  title: string;
  body: string;
}

export interface NoticePageProps {
  detail?: NoticeDetailView;
  /** 選んだ状態の字（原因が分かった・様子を見ている・直った） */
  step?: string;
  onStep?: (label: string) => void;
  /** 書いている続報 */
  body?: string;
  onBody?: (v: string) => void;
  onAdd?: () => void;
  onResolve?: () => void;
  /** 直った後：［足して出す］［直ったにする］を押せない形にする（隠さない） */
  locked?: boolean;
  /** 送っている間（2 回目を送らない） */
  busy?: boolean;
  error?: NoticeErrorView | null;
  /** ［書き直す］の行き先 */
  editHref?: string;
}

const MOCK_DETAIL: NoticeDetailView = {
  title: "分身の実行が遅れています",
  sub: "障害 ・ 全部のワークスペース ・ 11/02 09:40〜",
  steps: { labels: STEPS, current: 1 },
  feed: [
    {
      at: "11/02 10:20",
      text: "原因が分かった",
      detail: "送る順番の仕組みが詰まっていました。入れ替えています。データは消えていません。",
    },
    {
      at: "11/02 09:40",
      text: "調べている",
      detail: "分身の実行が始まるまでに時間がかかっています。調べています。",
    },
  ],
  body: "",
  impact: "分身の実行が始まるまでに時間がかかっています。画面と PC とのつながりはふつうに使えます",
  place: { maint: null, where: "お知らせの一覧 ・ 上の帯" },
};
const MOCK_BODY = "送る順番の仕組みを入れ替えました。遅れていた実行は順に動いています。様子を見ています。";

/** 押せない形（aria-disabled・押しても何もしない）か、押せる形の主ボタン */
function ActButton({
  children,
  variant,
  off,
  busy,
  onPress,
}: {
  children: string;
  variant?: "outlined";
  off: boolean;
  busy: boolean;
  onPress?: (() => void) | undefined;
}) {
  return (
    <Button
      {...(variant ? { variant } : {})}
      loading={busy && !off}
      aria-disabled={off || undefined}
      onClick={off || busy ? undefined : onPress}
    >
      {children}
    </Button>
  );
}

/** 1 件：障害は 状態 4 つ・続報を足す・これまで・影響する部分／障害でなければ 本文と出している場所 */
export function NoticePage({
  detail = MOCK_DETAIL,
  step,
  onStep,
  body,
  onBody,
  onAdd,
  onResolve,
  locked = false,
  busy = false,
  error = null,
  editHref,
}: NoticePageProps = {}) {
  const live = onAdd !== undefined;
  const steps = detail.steps;
  const stepValue = STEP_OPTIONS.find((o) => o.label === (step ?? DEFAULT_STEP))?.value ?? "watch";
  const emptyBody = live && (body ?? "").trim() === "";
  const edit = editHref ? (
    <Link className="k-btn" data-variant="outlined" data-size="md" href={editHref}>
      書き直す
    </Link>
  ) : (
    <Button variant="outlined">書き直す</Button>
  );
  return (
    <PageBody labelledBy="oq-notice-title">
      <PageHeader
        id="oq-notice-title"
        title={detail.title}
        sub={detail.sub}
        actions={
          <>
            {edit}
            {steps ? (
              <ActButton off={locked} busy={busy} onPress={onResolve}>
                直ったにする
              </ActButton>
            ) : null}
          </>
        }
      />
      <div className="k-op-body">
        {steps ? (
          <>
            <ol className="k-oq-steps" aria-label="状態">
              {steps.labels.map((s, i) => (
                <li key={s} {...(i === steps.current ? { "aria-current": "step" as const } : {})}>
                  {i + 1} {s}
                </li>
              ))}
            </ol>
            <Card title="状態を足す">
              <div className="k-op-form">
                <Select
                  label="状態"
                  name="step"
                  {...(live
                    ? {
                        value: stepValue,
                        onValueChange: (v: string | null) =>
                          onStep?.(STEP_OPTIONS.find((o) => o.value === v)?.label ?? DEFAULT_STEP),
                      }
                    : { defaultValue: "watch" })}
                  options={[...STEP_OPTIONS]}
                />
                {live ? (
                  <TextArea
                    label="続報"
                    name="body"
                    rows={3}
                    value={body ?? ""}
                    onChange={(e) => onBody?.(e.currentTarget.value)}
                  />
                ) : (
                  <TextArea label="続報" name="body" rows={3} readOnly defaultValue={MOCK_BODY} />
                )}
                {error ? (
                  <Callout tone="danger" title={error.title}>
                    {error.body}
                  </Callout>
                ) : null}
                <div className="k-oq-end">
                  <ActButton off={locked || emptyBody} busy={busy} onPress={onAdd}>
                    足して出す
                  </ActButton>
                </div>
              </div>
            </Card>
            <Card title="これまで">
              <Feed label="続報の記録" items={detail.feed} />
            </Card>
            <Card title="影響する部分">
              <Facts
                rows={[
                  ...(detail.impact ? [["影響", detail.impact] as const] : []),
                  ["出している場所", detail.place.where],
                ]}
              />
            </Card>
          </>
        ) : (
          <>
            <Card title="本文">
              <p className="k-op-note-text">{detail.body}</p>
              {detail.impact ? <Facts rows={[["影響", detail.impact]]} /> : null}
            </Card>
            {detail.place.maint ? <p className="k-op-note-text">{detail.place.maint}</p> : null}
            <Card title="出している場所">
              <Facts rows={[["出している場所", detail.place.where]]} />
            </Card>
          </>
        )}
      </div>
    </PageBody>
  );
}

/** お知らせを出す確かめ：届く数・メンテはメールも */
export interface NoticePublishConfirmProps {
  onClose?: () => void;
  onConfirm?: () => void;
  /** 開いているか（既定は開いている＝モック） */
  open?: boolean;
  /** 出すと起きること（K-1015：publishBullets の字） */
  bullets?: readonly string[];
  title?: string;
  description?: string;
  /** 出す口が断った・落ちたときの字（確かめの中の赤い箱） */
  error?: string | null;
  busy?: boolean;
}
const SAMPLE_BULLETS = [
  "48 か所・延べ 312 人の「困ったとき・お知らせ」に出る",
  "画面の上の帯にも出る（閉じられる）",
  "メンテの間は、メンテナンス中の画面になる",
  "メンテなので、48 か所の管理者にメールも届く（使えなくなるため）",
] as const;
export function NoticePublishConfirm({
  onClose,
  onConfirm,
  open = true,
  bullets = SAMPLE_BULLETS,
  title = "このお知らせを出す",
  description = "11/10（月）2:00〜3:00 メンテナンス。出すと、全部のワークスペースの人に届きます",
  error = null,
  busy = false,
}: NoticePublishConfirmProps) {
  return (
    <Confirm
      open={open}
      onOpenChange={(o) => !o && onClose?.()}
      onConfirm={() => onConfirm?.()}
      busy={busy}
      tone="primary"
      confirmLabel="出す"
      title={title}
      description={description}
    >
      {error ? <NoticeBox>{error}</NoticeBox> : null}
      <Bullets label="出すと起きること" items={bullets} />
      <Note>
        出したあとも、続報と 題・本文・影響・メンテの時間 の書き直しはできます。出したことは運営の記録に残ります
      </Note>
    </Confirm>
  );
}
