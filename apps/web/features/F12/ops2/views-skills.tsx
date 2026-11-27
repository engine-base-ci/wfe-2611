"use client";
// 配るもの › ひな形・操作／会社の側のひな形の新しい版（段 13・領域 ops2・キャンバス OpTemplates・OpTypes）。値を受け取って描くだけ。
//   ひな形は新しく入る会社が最初に使う既定の形（種別（名前・色・本文のひな形）・状態・項目）。会社は後から自由に変えられ、新しい版は
//   会社が手を付けていない所だけ「こう変わります」と知らせる（代表の答え 2026-11-23・D-156.20）。業務の型は描かない（段 10 の決め）
//   本番（K-994）は任意の props で値と行き先を渡す。渡さない呼び方（モック）は下絵の見た目のまま
import { Fingerprint, Plus } from "lucide-react";
import { Band, Button, Callout, Dialog, Empty, PageBody, PageHeader } from "@/components/k";
import { Bullets, Card, Note, StatusBadge } from "@/features/F12/ops/ops-parts";
import { SkillsNav, type SkillsTab } from "./views-plans";
import "@/features/F12/ops/ops.css";
import "./ops2.css";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";

/** 配るものの中の行き先（本番の道） */
type SkillsHrefs = Partial<Record<SkillsTab, string>>;

/** ひな形の 1 行（本番は templates-shape.ts の templateRow が口の答えから作る） */
export interface TemplateRow {
  id: string;
  name: string;
  body: string;
  ver: string;
  using: string;
  took: string;
  last: string;
}
const TEMPLATES: readonly TemplateRow[] = [
  {
    id: "kind",
    name: "種別",
    body: "タスク・QA・課題・会議 の名前・色・本文のひな形",
    ver: "v3",
    using: "48",
    took: "31 ／ 46",
    last: "10/20",
  },
  {
    id: "state",
    name: "状態",
    body: "未着手・作業中・確認中・承認待ち・実行中・完了",
    ver: "v2",
    using: "48",
    took: "48 ／ 48",
    last: "09/15",
  },
  {
    id: "field",
    name: "項目",
    body: "チケットの欄の並び・必須。種別ごとに持つ",
    ver: "v1",
    using: "48",
    took: "—",
    last: "09/01",
  },
];
const NEW_LABEL = "新しい版";
/** 行の［新しい版］。行き先を渡したときだけ押せるリンク、渡さなければ下絵と同じ押せない形（押せる形にするのは K-1111） */
function NewVersion({ row, href }: { row: TemplateRow; href?: string | undefined }) {
  const label = `${row.name} の新しい版を作る`;
  if (href)
    return (
      <a className="k-btn" data-variant="outlined" data-size="sm" href={href} aria-label={label}>
        {NEW_LABEL}
      </a>
    );
  return (
    <Button size="sm" variant="outlined" aria-label={label} aria-disabled="true" tabIndex={-1} title="まだ使えません">
      {NEW_LABEL}
    </Button>
  );
}
const columns = (newHref?: (row: TemplateRow) => string): RespColumn<TemplateRow>[] => [
  {
    key: "name",
    header: "ひな形",
    cell: (r) => (
      <span className="k-op-name">
        <b>{r.name}</b>
        <span>{r.body}</span>
      </span>
    ),
  },
  { key: "ver", header: "版", cell: (r) => r.ver },
  { key: "using", header: "使い始めたワークスペース", num: true, cell: (r) => r.using },
  { key: "took", header: "新しい版に変えた", num: true, cell: (r) => r.took },
  { key: "last", header: "最後に出した日", cell: (r) => r.last },
  {
    key: "act",
    header: <span className="sr-only">操作</span>,
    card: "action",
    cell: (r) => <NewVersion row={r} href={newHref?.(r)} />,
  },
];

/** ひな形：中身は 種別・状態・項目。版・使っている会社の数・新しい版に変えた数 */
export function TemplatesPage({
  rows = TEMPLATES,
  newHref,
  nav,
  status,
}: {
  rows?: readonly TemplateRow[];
  newHref?: (row: TemplateRow) => string;
  nav?: SkillsHrefs;
  /** 新しい版を出した後の知らせ（role=status・K-1111） */
  status?: string | null;
} = {}) {
  return (
    <PageBody labelledBy="oq-templates-title">
      <PageHeader
        id="oq-templates-title"
        title="ひな形"
        sub="新しく入るワークスペースが最初に使う既定の形。各ワークスペースは後から自由に変えられる"
        actions={
          <Button icon={<Plus size={14} />} aria-disabled="true" tabIndex={-1} title="まだ使えません">
            ひな形を足す
          </Button>
        }
      />
      <div className="k-op-body">
        {status ? (
          <p role="status" className="k-op-note-text">
            {status}
          </p>
        ) : null}
        <SkillsNav on="templates" {...(nav ? { hrefs: nav } : {})} />
        <RespTable caption="ひな形の一覧" columns={columns(newHref)} rows={[...rows]} rowKey={(r) => r.id} />
        <Card title="新しい版を出すと">
          <ol className="k-oq-numbered">
            <li>新しく入るワークスペースは、最新の既定で始まる</li>
            <li>
              既定のまま使っているワークスペースの管理者には、鈴で「ひな形がこう変わります」と知らせる。管理者が「そのままにする」か「変える」を選ぶ
            </li>
            <li>既定から変えたワークスペース（直した・消した・自分で足した物がある）には知らせない（そのまま残る）</li>
          </ol>
          <Note>
            新しい版は、今の版の中身を写して直す（足す・直す・消す）。運営が業界ごとに作り込むことはしない。版を出す前に本人確認を取り直す
          </Note>
        </Card>
      </div>
    </PageBody>
  );
}

/** 断りの赤い箱（もう一度を持つ物は［もう一度］つき） */
export interface TemplateAlert {
  text: string;
  retry?: () => void;
}
function AlertBox({ alert }: { alert: TemplateAlert }) {
  return (
    <div role="alert" className="k-op-alert">
      {alert.text}
      {alert.retry ? (
        <>
          {" "}
          <Button size="sm" variant="outlined" onClick={alert.retry}>
            もう一度
          </Button>
        </>
      ) : null}
    </div>
  );
}

export interface TemplateReleaseConfirmProps {
  open?: boolean;
  /** ひな形の名前（種別・状態・項目） */
  name?: string;
  /** 出す版の番号 */
  version?: number;
  /** 使っているワークスペースの数 */
  using?: number;
  /** そのうち既定のまま使っている（鈴で知らせる）数 */
  offered?: number;
  error?: TemplateAlert | null;
  busy?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
}

/** ひな形の新しい版を出す確かめ（会社に知らせる）。値を渡さない呼び方（モック）は下絵の値 */
export function TemplateReleaseConfirm({
  open = true,
  name = "種別",
  version = 4,
  using = 48,
  offered = 31,
  error,
  busy = false,
  onClose,
  onConfirm,
}: TemplateReleaseConfirmProps) {
  const close = () => {
    if (!busy) onClose?.();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? undefined : close())}
      size="confirm"
      title={`ひな形「${name}」の新しい版（v${version}）を出す`}
      description={`使っているワークスペース ${using} か所のうち、既定のまま使っている ${offered} か所の管理者に鈴で知らせます`}
      actions={
        <>
          <Button variant="outlined" onClick={close} disabled={busy}>
            やめる
          </Button>
          <Button loading={busy} onClick={() => (busy ? undefined : onConfirm?.())}>
            本人確認をして出す
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        <Bullets
          label="出すと起きること"
          items={[
            `新しく入るワークスペースは、すぐ v${version} で始まる`,
            "既定のまま使っているワークスペースの管理者に、鈴で「ひな形がこう変わります」と知らせる。「そのままにする」か「変える」を選ぶ",
            `既定から変えたワークスペース ${Math.max(using - offered, 0)} か所には知らせない（そのまま残る）`,
          ]}
        />
        <Note>
          <Fingerprint size={14} aria-hidden="true" />{" "}
          出す前に本人確認を取り直します（パスキー）。出した人・時刻・版は運営の記録に残ります
        </Note>
        {error ? <AlertBox alert={error} /> : null}
      </div>
    </Dialog>
  );
}

/** 操作の 1 枚（本番は templates-shape.ts の operationCard が口の答えから作る）。札が無ければ出さない */
export interface OperationView {
  key: string;
  title: string;
  aside: string;
  body: string;
  badge: string | null;
  tone?: "success" | "danger";
}
const OPERATIONS: readonly OperationView[] = [
  {
    key: "browser",
    title: "ブラウザで操作する",
    aside: "v1.4 ・ 読むだけ",
    body: "汎用の操作 1 つ。初めてのサイトも動かし、うまくいったら動かし方を記録して次から使う",
    badge: "検査 通った",
    tone: "success",
  },
];

/** 操作：読むだけ（ブラウザで操作する v1.4）。上げる・直すは後のフェーズ（押せない形で出す） */
export function OperationsPage({
  operations = OPERATIONS,
  versionDisabled = true,
  nav,
}: {
  operations?: readonly OperationView[];
  /** ［版を見る］を押せない形で出す（既定・版は 1 つだけ） */
  versionDisabled?: boolean;
  nav?: SkillsHrefs;
} = {}) {
  const off = versionDisabled ? ({ "aria-disabled": "true", tabIndex: -1, title: "まだ使えません" } as const) : {};
  return (
    <PageBody labelledBy="oq-operations-title">
      <PageHeader
        id="oq-operations-title"
        title="操作"
        sub="全社向け。顧客には欄と説明だけが見え、中の作りは見えない"
        actions={
          <Button icon={<Plus size={14} />} aria-disabled="true" tabIndex={-1} title="まだ使えません">
            操作を上げる
          </Button>
        }
      />
      <div className="k-op-body">
        <SkillsNav on="ops" {...(nav ? { hrefs: nav } : {})} />
        {operations.map((o) => (
          <Card key={o.key} title={o.title} aside={o.aside}>
            <p>{o.body}</p>
            <div className="k-op-inline">
              {o.badge ? <StatusBadge tone={o.tone ?? "success"}>{o.badge}</StatusBadge> : null}
              <Button size="sm" variant="outlined" {...off}>
                版を見る
              </Button>
            </div>
          </Card>
        ))}
        <Note>いまは読むだけです。操作を上げる・版を出す・直すは、後のフェーズで使えるようになります</Note>
      </div>
    </PageBody>
  );
}

export interface DiffRow {
  id: string;
  kind: "足す" | "変える";
  target: string;
  detail: string;
}
const DIFFS: readonly DiffRow[] = [
  { id: "d1", kind: "足す", target: "種別「会議」", detail: "欄「議事録のリンク」を足す（必須ではありません）" },
  { id: "d2", kind: "足す", target: "種別「課題」", detail: "色「橙」を足す" },
  { id: "d3", kind: "足す", target: "本文のひな形「QA」", detail: "「再現の手順」の見出しを足す" },
];
const DIFF_COLS: RespColumn<DiffRow>[] = [
  { key: "kind", header: "", cell: (r) => <StatusBadge tone="success">{r.kind}</StatusBadge> },
  { key: "target", header: "どこ", cell: (r) => r.target },
  { key: "detail", header: "中身", cell: (r) => r.detail },
];

/** 会社の側の頁で選ぶ 2 つ（K-1016：変える＝change・そのままにする＝keep） */
export type TemplateChoice = "change" | "keep";

export interface TemplateUpdatePageProps {
  /** 副題（届いた版・出した日）。渡さないと下絵の字 */
  sub?: string;
  /** 差の行（手を付けていない所だけ）。渡さないと下絵の 3 行 */
  rows?: readonly DiffRow[];
  /** 上の 2 つのボタンを押したとき */
  onApply?: (choice: TemplateChoice) => void;
  /** 送っている間（2 つのボタンを押せない） */
  busy?: boolean;
  /** 選んだ後の知らせ（role=status） */
  done?: string;
  /** 口が断ったときの知らせ（role=alert） */
  alert?: string;
}

/** 選んだ後の知らせと断りの知らせ（どちらも無ければ何も描かない） */
function UpdateNotes({ done, alert }: Pick<TemplateUpdatePageProps, "done" | "alert">) {
  return (
    <>
      {alert ? <Callout tone="danger">{alert}</Callout> : null}
      {done ? <Callout tone="info">{done}</Callout> : null}
    </>
  );
}

/** 会社の側（ワークスペースの管理 › 設定）：ひな形がこう変わる。手を付けていない所だけを出し、「そのままにする」か「変える」を選ぶ（D-156.20）。
 *  値を渡さない呼び方（モック）は下絵の字のまま */
export function TemplateUpdatePage({ sub, rows, onApply, busy, done, alert }: TemplateUpdatePageProps = {}) {
  return (
    <PageBody labelledBy="oq-template-update-title">
      <PageHeader
        id="oq-template-update-title"
        title="ひな形がこう変わります"
        sub={sub ?? "種別 v3 → v4 ・ 手を付けていない所だけ ・ 出した日 10/20 ・ Kaname 運営より"}
        actions={
          <>
            <Button
              variant="outlined"
              disabled={busy === true}
              {...(onApply ? { onClick: () => onApply("keep") } : {})}
            >
              そのままにする
            </Button>
            <Button disabled={busy === true} {...(onApply ? { onClick: () => onApply("change") } : {})}>
              変える
            </Button>
          </>
        }
      />
      <div className="k-op-body">
        <UpdateNotes {...(done ? { done } : {})} {...(alert ? { alert } : {})} />
        <Band
          tone="info"
          title="自分で変えた所は、ここに出ません"
          sub="このワークスペースで手を付けていない所だけを出しています。変えても、自分で変えた所はそのまま残ります"
        />
        <RespTable caption="こう変わります" columns={DIFF_COLS} rows={[...(rows ?? DIFFS)]} rowKey={(r) => r.id} />
        <Note>
          「変える」は上の {(rows ?? DIFFS).length}{" "}
          つを新しい既定に変えます（自分で変えた種別・色・本文には触りません）。「そのままにする」は今のまま使います
        </Note>
        <Note>選べるのはワークスペースの管理者だけです。選んだ人と日時は記録に残ります</Note>
      </div>
    </PageBody>
  );
}

/** 会社の側：届いている新しい版が無いとき（選んだ後・はじめから無い） */
export function TemplateUpdateEmpty(notes: Pick<TemplateUpdatePageProps, "done" | "alert">) {
  return (
    <PageBody labelledBy="oq-template-update-title">
      <PageHeader id="oq-template-update-title" title="ひな形がこう変わります" />
      <div className="k-op-body">
        <UpdateNotes {...notes} />
        <Empty title="届いている新しい版はありません" />
      </div>
    </PageBody>
  );
}

/** 直す頁の 1 行（部ごとに使う欄だけ） */
export interface EditRow {
  id: string;
  name: string;
  /** 色の名前（種別・状態） */
  color?: string;
  /** 本文のひな形の要約（種別）・説明（項目） */
  body?: string;
  /** 種類（項目） */
  type?: string;
  /** 必須（項目） */
  required?: boolean;
  /** 今の版から変えた所（無ければ今の版のまま） */
  change?: "足した" | "直した" | "消す";
  /** 出す口が合わないと断った 1 つ（行に data-invalid） */
  invalid?: boolean;
}
const EDIT_ROWS: readonly EditRow[] = [
  { id: "task", name: "タスク", color: "青緑", body: "やること・期限・確かめること" },
  { id: "qa", name: "QA", color: "藤", body: "確かめる所・再現の手順・期待", change: "直した" },
  { id: "issue", name: "課題", color: "黄土", body: "困っていること・影響・次の手", change: "直した" },
  { id: "meeting", name: "会議", color: "藍", body: "議題・決めたこと・議事録のリンク", change: "直した" },
  { id: "memo", name: "メモ", color: "若草", body: "書いておくこと", change: "消す" },
  { id: "estimate", name: "見積", color: "葡萄", body: "範囲・金額・期限", change: "足した" },
];
const EDIT_DIFF: readonly string[] = [
  "足す：種別「見積」",
  "直す：種別「QA」「課題」「会議」",
  "消す：種別「メモ」（使っているワークスペースの「メモ」はそのまま残る）",
];
const CHANGE_TONE = { 足した: "success", 直した: "progress", 消す: "danger" } as const;

export type EditPart = "kind" | "state" | "field";
const PART_HEAD: Record<EditPart, { title: string; aside: string }> = {
  kind: { title: "種別", aside: "名前・色・本文のひな形" },
  state: { title: "状態", aside: "名前・色" },
  field: { title: "項目", aside: "名前・種類・必須・説明" },
};
interface EditActs {
  onEdit?: ((row: EditRow) => void) | undefined;
  onDelete?: ((row: EditRow) => void) | undefined;
  onUndo?: ((row: EditRow) => void) | undefined;
  busy?: boolean | undefined;
}

/** 直す頁の 1 行：名前（種別は本文のひな形・項目は説明）・色か種類と必須・変えた所・直す／消す（消す行は取り消す） */
function editCols(part: EditPart, a: EditActs): RespColumn<EditRow>[] {
  const name: RespColumn<EditRow> = {
    key: "name",
    header: PART_HEAD[part].title,
    cell: (r) =>
      r.body ? (
        <span className="k-op-name">
          <b>{r.name}</b>
          <span>{r.body}</span>
        </span>
      ) : (
        <span className="k-op-name">
          <b>{r.name}</b>
        </span>
      ),
  };
  const mid: RespColumn<EditRow>[] =
    part === "field"
      ? [
          { key: "type", header: "種類", nowrap: true, cell: (r) => r.type ?? "—" },
          { key: "required", header: "必須", nowrap: true, cell: (r) => (r.required ? "必須" : "—") },
        ]
      : [{ key: "color", header: "色", nowrap: true, cell: (r) => r.color ?? "—" }];
  return [
    name,
    ...mid,
    {
      key: "change",
      header: "今の版から",
      nowrap: true,
      cell: (r) =>
        r.change ? (
          <StatusBadge tone={CHANGE_TONE[r.change]}>{r.change}</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">そのまま</StatusBadge>
        ),
    },
    {
      key: "act",
      header: <span className="sr-only">操作</span>,
      card: "action",
      cell: (r) => (
        <span className="k-oq-acts">
          <Button
            size="sm"
            variant="outlined"
            aria-label={`${r.name} を直す`}
            disabled={a.busy}
            {...(a.onEdit ? { onClick: () => a.onEdit?.(r) } : {})}
          >
            直す
          </Button>
          {r.change === "消す" ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${r.name} を消すのを取り消す`}
              disabled={a.busy}
              {...(a.onUndo ? { onClick: () => a.onUndo?.(r) } : {})}
            >
              取り消す
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`${r.name} を消す`}
              disabled={a.busy}
              {...(a.onDelete ? { onClick: () => a.onDelete?.(r) } : {})}
            >
              消す
            </Button>
          )}
        </span>
      ),
    },
  ];
}

export interface TemplateEditPageProps extends EditActs {
  /** ひな形の名前（種別・状態・項目） */
  name?: string;
  /** 今の版の番号（出すのは次の版） */
  version?: number;
  /** 副題（下書きの有る無し） */
  sub?: string;
  /** 部（表の列が替わる） */
  part?: EditPart;
  rows?: readonly EditRow[];
  /** 今の版との差の字（0〜3 行） */
  diff?: readonly string[];
  onAdd?: () => void;
  onDraft?: () => void;
  onRelease?: () => void;
  /** 出せるか（差が 0 の間は押せない形） */
  canRelease?: boolean;
  /** 頁の上の赤い箱（下書きが読めない・落ちた） */
  error?: TemplateAlert | null;
  /** 配るものの中の本番の行き先 */
  nav?: SkillsHrefs;
}

/** ひな形の新しい版の中身を直す頁：今の版（v3）を写して直す（種別・状態・項目を足す・直す・消す）。出すときに出す確かめ（D-156.55）。
 *  値を渡さない呼び方（モック）は下絵の値 */
export function TemplateEditPage({
  name = "種別",
  version = 3,
  sub = "今の版 v3 を写して直しています ・ 下書き ・ 佐野 ・ 11/05 14:20 に保存",
  part = "kind",
  rows = EDIT_ROWS,
  diff = EDIT_DIFF,
  onAdd,
  onDraft,
  onRelease,
  canRelease = true,
  error,
  nav,
  ...acts
}: TemplateEditPageProps) {
  const next = version + 1;
  const head = PART_HEAD[part];
  return (
    <PageBody labelledBy="oq-template-edit-title">
      <PageHeader
        id="oq-template-edit-title"
        title={`ひな形「${name}」の新しい版（v${next}）`}
        sub={sub}
        actions={
          <>
            <Button variant="outlined" disabled={acts.busy} {...(onDraft ? { onClick: onDraft } : {})}>
              下書きにする
            </Button>
            <Button
              icon={<Fingerprint size={14} />}
              loading={acts.busy}
              {...(canRelease ? {} : { "aria-disabled": "true" as const, title: "今の版から変えると出せます" })}
              {...(onRelease ? { onClick: () => (canRelease ? onRelease() : undefined) } : {})}
            >
              v{next} を出す
            </Button>
          </>
        }
      />
      <div className="k-op-body">
        {error ? <AlertBox alert={error} /> : null}
        <SkillsNav on="templates" {...(nav ? { hrefs: nav } : {})} />
        <Card title={head.title} aside={head.aside}>
          <RespTable
            caption={`新しい版の${head.title}`}
            columns={editCols(part, acts)}
            rows={[...rows]}
            rowKey={(r) => r.id}
            rowAttrs={(r) => ({ "data-invalid": r.invalid ? "true" : undefined })}
          />
          <div className="k-oq-acts">
            <Button
              size="sm"
              variant="outlined"
              icon={<Plus size={14} />}
              disabled={acts.busy}
              {...(onAdd ? { onClick: onAdd } : {})}
            >
              {head.title}を足す
            </Button>
          </div>
        </Card>
        <Card title={`今の版 v${version} との差`}>
          {diff.length ? (
            <Bullets label={`今の版 v${version} との差`} items={diff} />
          ) : (
            <Note>まだ今の版から変えていません</Note>
          )}
          <Note>{`出すまでは顧客に何も届きません。今の版 v${version} はそのまま残り、前の版に戻せます`}</Note>
        </Card>
      </div>
    </PageBody>
  );
}
