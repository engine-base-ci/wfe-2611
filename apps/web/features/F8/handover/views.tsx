"use client";
// 渡す・配る（F8・段 9）の画面の部品（切る段の下絵・部品先行・枝 c/段9）。口とはまだつながず、値を受け取って描くだけ。
//   入口（代表の答え answer=56812da22008）：詳細の右のパネルの「担当者 ▾」→ 相手を選ぶ小窓 → 引き継いでもらう小窓（担当者本人）／配る小窓（マネージャー）。
//   担当者を黙って直に書き換える道は作らない。担当者でない人は「引き継ぐ（申し出る）」だけ（題名の下のボタン・聞くこと 11 の勧め）。
//   AI が動いている・承認を待っているチケットは渡せない（answer=56812da22008）。渡し中も渡した人は全部できる（answer=eaa451436670）。
//   形は正本の部品（Dialog・Confirm・Band・Button・components/k の欄の型）だけで組む。値は正本のトークン（handover.css）だけ。
//   画面に出る文は全部「仮」（代表に聞くこと 20 の勧めのとおり）。エラーの番号（E-HND-…）は契約を書くときに一覧にする
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Band, BandLine, Button, Callout, Confirm, Dialog, NoticeBox, SearchField } from "@/components/k";
import "./handover.css";

/** 相手を選ぶ小窓の 1 人 */
export interface PickMember {
  id: string;
  name: string;
  /** 主のグループと役割（「営業」「営業 マネージャー」） */
  sub: string;
  /** 今週の件数（担当者でまだ終わっていない・期限が今週・聞くこと 14 の勧め） */
  week: number;
  /** メール（名前と同じく探す欄で絞れる） */
  email: string;
  /** 見ている人 */
  self?: boolean;
  /** 今の担当者（✓・選べない） */
  current?: boolean;
  /** 選べない訳（止まっている・招待中）。在れば押せない形で出す */
  unavailable?: string;
}

/** 配る小窓でグループを選ぶときの 1 つ */
export interface PickGroup {
  id: string;
  code: string;
  name: string;
}

const Avatar = ({ name }: { name: string }) => (
  <span className="k-detail-avatar" aria-hidden="true">
    {name.slice(0, 1)}
  </span>
);

/** パネルの「担当者」の値。can＝押せる（▾）・plain＝読むだけ（閲覧のみ・取引先・申し出だけの人）・blocked＝AI が動いている（押せない・訳を出す） */
export function AssigneeValue({
  name,
  mode,
  waitingFor,
  reason,
}: {
  name: string;
  mode: "can" | "plain" | "blocked";
  /** 渡し中の相手（「→ 佐藤（返事待ち）」を名前の下に出す） */
  waitingFor?: string;
  reason?: string;
}) {
  const who = (
    <span className="k-detail-who">
      <Avatar name={name} />
      {name}
    </span>
  );
  return (
    <span className="k-hnd-assignee">
      {mode === "plain" ? (
        who
      ) : (
        <button
          type="button"
          className="k-hnd-assignee-btn"
          aria-haspopup="dialog"
          aria-label={`担当者 ${name}（担当者を変える）`}
          {...(mode === "blocked" && reason ? { title: reason } : {})}
        >
          {who}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      {waitingFor ? <span className="k-hnd-assignee-note">{`→ ${waitingFor}（返事待ち）`}</span> : null}
      {mode === "blocked" && reason ? <span className="k-hnd-assignee-note">{reason}</span> : null}
    </span>
  );
}

/** 探す字で絞る（名前・メール・グループ名。前後の空白・大文字小文字は見ない） */
export function matchesQuery(text: readonly string[], query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || text.some((t) => t.toLowerCase().includes(q));
}

function MemberItem({ m, blocked }: { m: PickMember; blocked: boolean }) {
  const off = blocked || Boolean(m.unavailable) || Boolean(m.current);
  const mark = m.self ? "（自分）" : m.current ? "（今の担当者）" : "";
  return (
    <li>
      <button
        type="button"
        className="k-hnd-pick-item"
        aria-current={m.current || undefined}
        {...(off ? { "aria-disabled": true, tabIndex: -1 } : {})}
      >
        <Avatar name={m.name} />
        <span className="k-hnd-pick-main">
          <span className="k-hnd-pick-name">{`${m.name}${mark}`}</span>
          <span className="k-hnd-pick-sub">{m.unavailable ? m.unavailable : `${m.sub} ・ 今週 ${m.week} 件`}</span>
          <span className="k-hnd-pick-sub">{m.email}</span>
        </span>
        {m.current ? <Check size={14} aria-label="今の担当者" /> : null}
      </button>
    </li>
  );
}

/** 相手を選ぶ小窓（キャンバス TdAssignee の「担当者」の箱を小窓にした形）。上に探す欄（名前・メールで絞る・代表の直し 2026-11-20） */
export function PickDialog({
  open,
  members,
  groups,
  blocked,
  intro,
  query = "",
}: {
  open: boolean;
  members: readonly PickMember[];
  /** マネージャー（配る）のときだけ：グループにも配れる */
  groups?: readonly PickGroup[];
  /** 渡せない訳（AI が動いている・承認待ち・いま別の渡しの返事を待っている） */
  blocked?: string;
  /** 一覧の上の 1 行（引き継いでもらう／配る のどちらになるか） */
  intro: string;
  /** 探す欄に入っている字 */
  query?: string;
}) {
  const people = members.filter((m) => matchesQuery([m.name, m.email], query));
  const teams = (groups ?? []).filter((g) => matchesQuery([g.name, g.code], query));
  const none = people.length === 0 && teams.length === 0;
  return (
    <Dialog
      title="担当者を選ぶ"
      open={open}
      target="EG-119 問い合わせ（山田様）に一次返信する"
      actions={<Button variant="outlined">やめる</Button>}
    >
      <div className="k-dialog-stack">
        {blocked ? <Callout tone="warn">{blocked}</Callout> : null}
        <p className="k-hnd-intro">{intro}</p>
        <SearchField label={groups ? "名前・メール・グループで探す" : "名前・メールで探す"} value={query} readOnly />
        {none ? (
          <p className="k-hnd-empty" role="status">
            {`「${query.trim()}」に合う人がいません。名前かメールの一部で探してください（止まっている人・招待中の人も出ます）`}
          </p>
        ) : null}
        {people.length ? (
          <ul className="k-hnd-pick" aria-label="人">
            {people.map((m) => (
              <MemberItem key={m.id} m={m} blocked={Boolean(blocked)} />
            ))}
          </ul>
        ) : null}
        {teams.length ? (
          <ul className="k-hnd-pick" aria-label="グループ">
            {teams.map((g) => (
              <li key={g.id}>
                <button type="button" className="k-hnd-pick-item">
                  <span className="k-hnd-code" aria-hidden="true">
                    {g.code}
                  </span>
                  <span className="k-hnd-pick-main">
                    <span className="k-hnd-pick-name">{`グループ「${g.name}」に配る`}</span>
                    <span className="k-hnd-pick-sub">担当はそのグループの人が決める</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}

/** 一緒に切り替えるものの 1 行。fixed＝ワークスペースの決まりで「いつも」（印が付いて外せない） */
export interface CarryItem {
  label: string;
  checked: boolean;
  fixed?: boolean;
}

export interface HandoverValues {
  reason: string;
  ask: string;
  due: string;
}
export interface HandoverErrors {
  to?: string;
  reason?: string;
  due?: string;
}

function TextBox({
  label,
  required,
  value,
  error,
  rows = 2,
}: {
  label: string;
  required?: boolean;
  value: string;
  error?: string | undefined;
  rows?: number;
}) {
  return (
    <label className="k-field">
      <span className="k-label">
        {label}
        {required ? <span className="k-field-required"> 必須</span> : null}
      </span>
      <textarea className="k-input" rows={rows} value={value} readOnly aria-invalid={error ? true : undefined} />
      {error ? <span className="k-err">{error}</span> : null}
    </label>
  );
}

function LineBox({ label, value, error }: { label: string; value: string; error?: string | undefined }) {
  return (
    <label className="k-field">
      <span className="k-label">{label}</span>
      <input className="k-input" value={value} readOnly aria-invalid={error ? true : undefined} />
      {error ? <span className="k-err">{error}</span> : null}
    </label>
  );
}

/** 相手の行（変える＝相手を選ぶ小窓に戻る） */
function ToRow({ label, value, error }: { label: string; value: string; error?: string | undefined }) {
  return (
    <div className="k-field">
      <span className="k-label">{label}</span>
      <div className="k-hnd-to">
        <span className="k-detail-who">
          <Avatar name={value} />
          {value}
        </span>
        <Button variant="ghost" size="sm">
          変える
        </Button>
      </div>
      {error ? <span className="k-err">{error}</span> : null}
    </div>
  );
}

/** 引き継いでもらうの小窓（キャンバス StModal） */
export function HandoverDialog({
  open,
  to,
  values,
  errors = {},
  carry,
  notifyManagers = false,
  notice,
}: {
  open: boolean;
  to: string;
  values: HandoverValues;
  errors?: HandoverErrors;
  carry: readonly CarryItem[];
  notifyManagers?: boolean;
  /** 口が断ったとき（もう渡し中・完了した・送りすぎ・調子が悪い）の赤い知らせ。書いた中身は消さない */
  notice?: string;
}) {
  return (
    <Dialog
      title="引き継いでもらう"
      open={open}
      target="EG-119 問い合わせ（山田様）に一次返信する"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>引き継いでもらう</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <ToRow label="渡す相手" value={to} error={errors.to} />
        <TextBox label="理由" required value={values.reason} error={errors.reason} />
        <TextBox label="お願い" value={values.ask} />
        <LineBox label="返事の期限" value={values.due} error={errors.due} />
        {carry.length ? (
          <fieldset className="k-dialog-group">
            <legend>一緒に切り替えるもの（ワークスペースの決まりで選ばれている）</legend>
            {carry.map((c) => (
              <label key={c.label} className="k-dialog-check">
                <input
                  type="checkbox"
                  checked={c.checked}
                  readOnly
                  {...(c.fixed ? { disabled: true, "aria-disabled": true } : {})}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <label className="k-dialog-check">
          <input type="checkbox" checked={notifyManagers} readOnly />
          <span>上の層（マネージャー）にも知らせる</span>
        </label>
        <p className="k-hnd-note">相手が受けるまで担当者はあなたのまま（渡し中）。断られたら理由つきで戻ってきます。</p>
      </div>
    </Dialog>
  );
}

/** 配る小窓（マネージャー・合意なしの既定・聞くこと 15 の勧め） */
export function DistributeDialog({
  open,
  to,
  toGroup = false,
  reason,
}: {
  open: boolean;
  to: string;
  toGroup?: boolean;
  reason: string;
}) {
  return (
    <Dialog
      title="配る"
      open={open}
      target="EG-119 問い合わせ（山田様）に一次返信する"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>配る</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <ToRow label={toGroup ? "配るグループ" : "配る相手"} value={to} />
        <TextBox label="理由" required value={reason} />
        <TextBox label="お願い" value="" />
        <p className="k-hnd-note">
          {toGroup
            ? `${to}の人が「自分が持つ」か「人を決める」を押すまで、担当者はあなたのままです。`
            : `配るとすぐ${to}さんが担当者になり、知らせが届きます。`}
        </p>
      </div>
    </Dialog>
  );
}

/** 断る小窓（理由は必須・承認待ちの行からも詳細の帯からも同じ） */
export function DeclineDialog({
  open,
  from,
  value,
  error,
}: {
  open: boolean;
  from: string;
  value: string;
  error?: string;
}) {
  return (
    <Dialog
      title="断る"
      open={open}
      target="EG-119 問い合わせ（山田様）に一次返信する"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button variant="danger">断る</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <TextBox label="断る理由" required value={value} error={error} />
        <p className="k-hnd-note">{`理由は${from}さんに届き、チケットの記録に残ります。`}</p>
      </div>
    </Dialog>
  );
}

/** 引き継ぐ（申し出る）の小窓（返事の期限は付けない・聞くこと 11 の勧め） */
export function OfferDialog({ open, assignee, value }: { open: boolean; assignee: string; value: string }) {
  return (
    <Dialog
      title="引き継ぎを申し出る"
      open={open}
      target="EG-119 問い合わせ（山田様）に一次返信する"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>申し出る</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <TextBox label="理由" required value={value} />
        <p className="k-hnd-note">{`担当者（${assignee}さん）が「渡す」と答えたら、あなたが担当者になります。`}</p>
      </div>
    </Dialog>
  );
}

/** 渡しを取り消す確かめ */
export function WithdrawConfirm({ open, to }: { open: boolean; to: string }) {
  return (
    <Confirm
      title="渡しを取り消しますか？"
      description={`${to}さんへの渡しを取り消します。担当者はあなたのままです。${to}さんに「取り消されました」と知らせます。`}
      confirmLabel="取り消す"
      open={open}
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
    />
  );
}

/** 担当者でない人の、題名の下のボタン（申し出の入口） */
export function OfferEntry() {
  return (
    <div className="k-hnd-offer">
      <Button variant="outlined" size="sm">
        引き継ぐ（申し出る）
      </Button>
    </div>
  );
}

export type HandoverBandKind =
  | "sending"
  | "receiving"
  | "declined"
  | "overdue"
  | "accepted"
  | "taken"
  | "withdrawn"
  | "offered"
  | "distributed"
  | "group"
  | "failed";

const btn = (label: string, variant: "primary" | "outlined" = "outlined"): ReactNode => (
  <Button key={label} size="sm" variant={variant}>
    {label}
  </Button>
);

/** 詳細の題名の下の、渡しの帯（承認と実行の帯と同じ場所） */
export function HandoverBand({
  kind,
  who,
  at,
  reason,
  ask,
  due,
  carry,
}: {
  kind: HandoverBandKind;
  /** 相手（渡した人から見た相手・渡された人から見た渡した人・配った人・申し出た人） */
  who: string;
  at?: string;
  reason?: string;
  ask?: string;
  due?: string;
  carry?: string;
}) {
  switch (kind) {
    case "sending":
      return (
        <Band
          tone="wait"
          title={`${who}さんの返事を待っています（渡し中）`}
          sub={`返事の期限 ${due ?? ""} ・ 担当者は返事が来るまであなたのまま`}
          acts={[btn("催促する"), btn("取り消す"), btn("別の人にする")]}
        >
          <BandLine>{`理由：${reason ?? ""}`}</BandLine>
          <BandLine>完了にする・消すと、この渡しは取り消され、相手に知らせが届きます</BandLine>
        </Band>
      );
    case "receiving":
      return (
        <Band
          tone="approval"
          title={`${who}さんから、引き継いでほしいと頼まれています`}
          sub={`返事の期限 ${due ?? ""}${carry ? ` ・ ${carry}` : ""}`}
          acts={[btn("断る"), btn("受ける", "primary")]}
        >
          <BandLine>{`理由：${reason ?? ""}`}</BandLine>
          {ask ? <BandLine>{`お願い：${ask}`}</BandLine> : null}
        </Band>
      );
    case "declined":
      return (
        <Band
          tone="danger"
          title={`${who}さんに断られました`}
          sub={at}
          acts={[btn("閉じる"), btn("別の人にする", "primary")]}
        >
          <BandLine>{`理由：${reason ?? ""}`}</BandLine>
        </Band>
      );
    case "overdue":
      return (
        <Band
          tone="wait"
          title={`${who}さんの返事がまだありません`}
          sub={`返事の期限 ${due ?? ""} を過ぎました。${who}さんは今からでも受ける・断るを押せます`}
          acts={[btn("取り消す"), btn("別の人にする"), btn("催促する", "primary")]}
        />
      );
    case "accepted":
      return (
        <Band tone="ok" title="担当者になりました" sub={`${who}さんから引き継ぎ ・ ${at ?? ""}`}>
          {carry ? <BandLine>{carry}</BandLine> : null}
        </Band>
      );
    case "taken":
      return <Band tone="ok" title={`${who}さんが引き継ぎました`} sub={`${at ?? ""} ・ 担当者は${who}さんです`} />;
    case "withdrawn":
      return (
        <Band tone="plain" title="この渡しは取り消されました" sub={`${who}さんが ${at ?? ""} に取り消し`}>
          <BandLine>あなたが答える必要はなくなりました</BandLine>
        </Band>
      );
    case "offered":
      return (
        <Band
          tone="approval"
          title={`${who}さんが、引き継ぎを申し出ています`}
          sub={at}
          acts={[btn("断る"), btn("渡す", "primary")]}
        >
          <BandLine>{`理由：${reason ?? ""}`}</BandLine>
        </Band>
      );
    case "distributed":
      return (
        <Band tone="info" title={`${who}さんから配られました`} sub={at}>
          <BandLine>{`理由：${reason ?? ""}`}</BandLine>
        </Band>
      );
    case "group":
      return (
        <Band
          tone="wait"
          title={`グループ「${who}」に配り中`}
          sub={`そのグループの人が担当を決めるまで、担当者はあなたのまま ・ ${at ?? ""}`}
          acts={[btn("取り消す")]}
        />
      );
    case "failed":
      return (
        <Band tone="danger" role="alert" title="渡しの様子を読み込めませんでした" acts={[btn("もう一度読む")]}>
          <BandLine>本文はそのまま読めます</BandLine>
        </Band>
      );
  }
}

/** 承認待ちの「渡された」の行（行の部品に種類を足す・本番は queue-table.tsx の Row が種類で出し分ける） */
export interface HandoverQueueRow {
  id: string;
  number: string;
  title: string;
  sub: string;
  from: string;
  due: string;
  late?: boolean;
  /** 左の従・右の主のボタン（受ける／断る・渡す／断る・人を決める／自分が持つ） */
  acts: readonly [string, string];
  highlight?: boolean;
}

export function HandoverRow({ row }: { row: HandoverQueueRow }) {
  return (
    <tr className="k-hnd-row" data-highlight={row.highlight || undefined}>
      <td>
        <span className="k-ap-dash" title="1 件ずつ決める">
          —
        </span>
      </td>
      <td>
        <span className="k-ap-kind">渡された</span>
      </td>
      <td />
      <td>
        <a className="k-link k-ap-num" href="#ticket">
          {row.number}
        </a>
      </td>
      <td className="k-ap-title">
        <a href="#ticket">{row.title}</a>
        <span className="k-ap-sub">{row.sub}</span>
      </td>
      <td>
        <span className="k-ap-from">
          <span className="k-ap-avatar" aria-hidden="true">
            {row.from.slice(0, 1)}
          </span>
          {row.from}
        </span>
      </td>
      <td className="k-ap-check" />
      <td data-late={row.late || undefined}>{row.due}</td>
      <td className="k-ap-end">
        <span className="k-ap-acts">
          <Button size="sm" variant="outlined">
            {row.acts[0]}
          </Button>
          <Button size="sm">{row.acts[1]}</Button>
        </span>
      </td>
    </tr>
  );
}

/** 承認待ちのスマホの 1 枚（キャンバス MbApprovals のカード：番号の札と誰から・題名・中身の 1 行・2 つのボタン）。
 *  幅 767 以下は表の代わりにこのカードを縦に並べる（表を横に送らない・代表の直し 2026-11-20） */
export interface QueueCardView {
  id: string;
  number: string;
  /** 番号の札の右の 1 行（「高本さんから ・ 渡された」「佐藤のAI ・ 確認 通過 3」） */
  meta: string;
  title: string;
  sub?: string;
  /** 返事の期限など（橙の字） */
  note?: string;
  acts: readonly [string, string];
}

export function QueueCardMobile({ card }: { card: QueueCardView }) {
  return (
    <li className="k-hnd-mcard">
      <div className="k-hnd-mcard-meta">
        <span className="k-hnd-mcard-num">{card.number}</span>
        <span className="k-hnd-mcard-from">{card.meta}</span>
      </div>
      <a className="k-hnd-mcard-title" href="#ticket">
        {card.title}
      </a>
      {card.sub ? <p className="k-hnd-mcard-sub">{card.sub}</p> : null}
      {card.note ? <p className="k-hnd-mcard-note">{card.note}</p> : null}
      <div className="k-hnd-mcard-acts">
        <Button variant="outlined">{card.acts[0]}</Button>
        <Button>{card.acts[1]}</Button>
      </div>
    </li>
  );
}
