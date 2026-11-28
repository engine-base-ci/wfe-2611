"use client";
// 届いた依頼の本文（キャンバス CuRequests）：開いた依頼・分身のチケットの案・返事の下書き・チケットを作る／詳しく聞く／断る。
//   値を受け取って描くだけ（口は呼ばない）。本物の画面は data（依頼の値）と acts（押した結果）を渡す（K-898）。渡さなければ下絵の見本。PC をつないでいない（ps="PS0"）あいだは、分身の案の所を押せない形にし、題名を手で書く欄を出す。
//   分身の案（K-899）：PC がつながっていて案が無いときは「案を作る」を出す（draft の動きは入れ物が渡す）。PC が閉じているときは押せない形のまま。
//   画面に出る字：キャンバスにある所はキャンバスのとおり。無い状態（保存中・断られた・読むだけ・聞いている・さばいた）は仮
import { Bot, ChevronDown, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import {
  Badge,
  Band,
  BandLine,
  Button,
  Callout,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  TextArea,
  TextField,
} from "@/components/k";
import { Avatar, NeedPc } from "@/features/F11/clients/parts";
import "./requests.css";

export type Phase = "idle" | "accepted" | "asked" | "declined";
type Ps = "PS0" | "PS2";

type Status = "new" | "asking" | "done";

/** 依頼ごとの中身（題・先方の本文・分身の案・返事の下書き）。開いた依頼の題と本文と案を同じ依頼でそろえる */
interface ReqContent {
  title: string;
  who: string;
  initial: string;
  from: string;
  body: string;
  /** 分身の案の元（何から案を作ったか） */
  basis: string;
  proposal: { title: string; kind: string; owner: string; due: string; cost: string; route: string; why: string };
  ask: string;
  draft: string;
}
/** 本物の依頼の値（画面の入れ物が口の答えから作る・K-898）。分身の案（proposal・ask・basis・draft）は無ければ出さない */
export interface RequestData {
  title: string;
  who: string;
  initial: string;
  from: string;
  body: string;
  basis?: string;
  proposal?: ReqContent["proposal"] | null;
  ask?: string;
  draft?: string;
  /** 届け先を変える ▾ の選び肢 */
  routes?: readonly { id: string; name: string }[];
  /** 今の届け先の名前（案が無いときの「届け先」の行に出す） */
  route?: string;
  /** 聞いている依頼のやり取り（古い順・1 件 1 行の字。画面の入れ物が口の messages から作る） */
  thread?: readonly ThreadLine[];
  /** さばいた依頼がチケットになっていれば、そのチケット（無ければ断った依頼） */
  ticketId?: string;
  ticketNumber?: string;
  declinedReason?: string;
  /** 届け先を変えられなかった等の知らせ（本文の頭に出す） */
  notice?: ReactNode;
}
/** 分身の案を作る動き（K-899・画面の入れ物が渡す）。PC がつながっていて案が無いときだけ使う */
export interface DraftControl {
  /** 「案を作る」を押した（無ければボタンを出さない） */
  onMake?: () => void;
  /** 案を作っている間（ボタンを無効にし「案を作っています…」を出す） */
  making?: boolean;
  /** 案を作れなかった・案が来ない の 1 行（押し直せる失敗だけ。読み直しを伴う断りは本文の頭の知らせ data.notice に出す） */
  message?: string | null;
  /** PC なしで手で書く題名と期限（小窓の初期値に入る） */
  manualTitle?: string;
  manualDue?: string;
  onManualTitle?: (v: string) => void;
  onManualDue?: (v: string) => void;
}
export const MAKING_TEXT = "案を作っています…";
/** 聞いている帯の中の 1 行（side：we＝聞いたこと／they＝先方の返事） */
export interface ThreadLine {
  side: "we" | "they";
  text: string;
}
/** 先方の返事がまだ無いときの 1 行（「返事を送りました」の帯の要約と同じ字・answer=551509bd2ce7） */
export const WAITING_TEXT = "先方の返事を待っています。返事が来たら、ここに出ます。";
/** 下絵の聞いている依頼のやり取り（rq-asking） */
const SAMPLE_THREAD: readonly ThreadLine[] = [
  {
    side: "we",
    text: "聞いたこと（高本 聖斗 ・ 11/22 15:02）：絞り込みたい項目と、使う方の範囲を教えていただけますか。",
  },
  {
    side: "they",
    text: "先方の返事（大橋 誠 様 ・ 11/23 09:10）：注文日と担当者で絞り込みたいです。使うのは営業の 5 人です。",
  },
];

/** 聞いている帯：やり取りを古い順に 1 件 1 行。最後が先方の返事でなければ（やり取りが無いときも）待っている文を最後に */
function AskingBand({ thread }: { thread: readonly ThreadLine[] }) {
  const waiting = thread[thread.length - 1]?.side !== "they";
  return (
    <Band tone="wait" title="先方に詳しく聞いています">
      {thread.map((l, i) => (
        <BandLine key={i}>{l.text}</BandLine>
      ))}
      {waiting ? <BandLine>{WAITING_TEXT}</BandLine> : null}
    </Band>
  );
}

/** 押した結果（画面の入れ物が渡す）。渡さないボタンは押せない形 */
export interface RequestActs {
  onAsk?: () => void;
  onDecline?: () => void;
  onCreate?: () => void;
  onChangeRoute?: (routeId: string) => void;
  onOpenTicket?: () => void;
  /** 先方に返す欄の値（無ければ下書きのまま） */
  reply?: string;
  onReplyChange?: (v: string) => void;
}
const EMPTY_PROPOSAL: ReqContent["proposal"] = {
  title: "",
  kind: "",
  owner: "",
  due: "",
  cost: "",
  route: "",
  why: "",
};
function contentOf(status: Status, data?: RequestData): ReqContent {
  if (!data) return CONTENT[status];
  return {
    title: data.title,
    who: data.who,
    initial: data.initial,
    from: data.from,
    body: data.body,
    basis: data.basis ?? "",
    proposal: data.proposal ?? EMPTY_PROPOSAL,
    ask: data.ask ?? "",
    draft: data.draft ?? "",
  };
}

// 下絵の見本の値。案の形（K-892 の ticket_draft・route_suggestion）に欄の無い注（案の元・担当や期限の添え書き）は出さない（データの出どころが無い・PM の決め 2026-11-28。欄を足すかは代表に聞く項目）
const CONTENT: Record<Status, ReqContent> = {
  new: {
    title: "12 月分の作業報告書もほしい",
    who: "鈴木 健太 様（セイコー株式会社（ゲスト）） ・ 営業に届いた ・ 今日 10:20",
    initial: "鈴",
    from: "鈴木 健太 様 ・ 今日 10:20",
    basis: "",
    body: "いつもありがとうございます。11 月分と同じ形で、12 月分の作業報告書もいただけますか。年内に社内に回したいです。",
    proposal: {
      title: "セイコー様 12 月分の作業報告書を作って送る",
      kind: "タスク",
      owner: "高本",
      due: "12/26",
      cost: "保守契約の範囲内（追加費用なし）",
      route: "EG 営業",
      why: "分身の案：作業報告書は保守契約の仕事なので 営業（経理ではない）",
    },
    ask: "報告書の形は 11 月分と同じでよいか ・ 宛先は山田様か鈴木様か",
    draft: "鈴木様 承知しました。11 月分と同じ形で、12/26 までにお送りします。宛先は山田様でよろしいでしょうか。",
  },
  asking: {
    title: "管理画面に検索の絞り込みを足したい",
    who: "大橋 誠 様（京蟻システム株式会社（ゲスト）） ・ 受託開発に届いた ・ 昨日",
    initial: "大",
    from: "大橋 様 ・ 昨日 11:40",
    basis: "",
    body: "お世話になっております。管理画面の注文の一覧に、検索の絞り込みを足していただけますか。件数が増えて探すのに時間がかかっています。",
    proposal: {
      title: "京蟻システム様 管理画面の注文の一覧に検索の絞り込みを足す",
      kind: "タスク",
      owner: "佐藤",
      due: "先方の返事のあとに決める",
      cost: "追加の開発（見積を出してから）",
      route: "JD 受託開発",
      why: "分身の案：管理画面の改修なので 受託開発",
    },
    ask: "絞り込みたい項目 ・ 使う人の範囲",
    draft:
      "大橋様 ありがとうございます。絞り込みたい項目と、使う方の範囲を教えていただけますか。いただいた内容でお見積りをお送りします。",
  },
  done: {
    title: "10 月分の請求書の再発行",
    who: "小林 様（合同会社ミナト（ゲスト）） ・ 経理に届いた ・ 10/30",
    initial: "小",
    from: "小林 様 ・ 10/30 09:15",
    basis: "",
    body: "10 月分の請求書の宛名を、新しい部署名で出し直していただけますか。",
    proposal: {
      title: "ミナト様 10 月分の請求書を出し直す",
      kind: "タスク",
      owner: "高本",
      due: "10/31",
      cost: "追加費用なし",
      route: "KR 経理",
      why: "分身の案：請求書の出し直しなので 経理",
    },
    ask: "新しい部署名",
    draft: "小林様 承知しました。新しい部署名で出し直します。",
  },
};

/** スマホで開いた依頼の画面の頭に置く戻り（一覧へ）。768 以上は一覧が左に並ぶので出さない */
export function BackToRequests() {
  return (
    <a className="k-f11q-back" href="/requests">
      <ChevronLeft size={14} aria-hidden="true" />
      届いた依頼
    </a>
  );
}

export function Message({ status = "new", data }: { status?: Status; data?: RequestData }) {
  const c = contentOf(status, data);
  return (
    <section className="k-f11q-msg" aria-label="届いた依頼">
      <Avatar initial={c.initial} tone="plum" />
      <div>
        <b>{c.from}</b>
        <p>{c.body}</p>
      </div>
    </section>
  );
}

const SAMPLE_ROUTES = [
  { id: "eg", name: "EG 営業" },
  { id: "kr", name: "KR 経理" },
  { id: "jd", name: "JD 受託開発" },
] as const;

function RouteMenu({
  open,
  routes = SAMPLE_ROUTES,
  onSelect,
}: {
  open?: boolean;
  routes?: readonly { id: string; name: string }[];
  onSelect?: (routeId: string) => void;
}) {
  return (
    <Menu defaultOpen={Boolean(open)}>
      <MenuTrigger className="k-f11q-change" label="届け先を変える">
        変える <ChevronDown size={12} aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="start" className="k-f11c-menu">
        {routes.map((r) => (
          <MenuItem key={r.id} {...(onSelect ? { onSelect: () => onSelect(r.id) } : {})}>
            {r.name}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

/** 分身のチケットの案（PS2）／PC なしの押せない形と手で書く欄（PS0） */
export function TicketProposal({
  ps,
  menuOpen,
  status = "new",
  data,
  onChangeRoute,
  pcConnected,
  draftControl,
}: {
  ps: Ps;
  menuOpen?: boolean;
  status?: Status;
  data?: RequestData;
  onChangeRoute?: (routeId: string) => void;
  /** PC がつながっているが案がまだ無い（ps は PS0 で渡す）。押せない形を出さず、「届け先」の行と ▾ を出す（answer=70068278fce9） */
  pcConnected?: boolean;
  draftControl?: DraftControl;
}) {
  const c = contentOf(status, data);
  const pr = c.proposal;
  const dc = draftControl;
  const menu = (
    <RouteMenu
      {...(menuOpen ? { open: true } : {})}
      {...(data?.routes ? { routes: data.routes } : {})}
      {...(onChangeRoute ? { onSelect: onChangeRoute } : {})}
    />
  );
  if (ps === "PS0")
    return (
      <section className="k-f11q-card" aria-label="チケットの案">
        <h3 className="k-f11q-card-title">
          <Bot size={14} aria-hidden="true" /> 高本のAI のチケットの案
        </h3>
        {pcConnected ? (
          <dl className="k-f11q-dl">
            <dt>届け先</dt>
            <dd>
              <span className="k-f11q-route">
                {data?.route ?? pr.route}
                {menu}
              </span>
            </dd>
          </dl>
        ) : (
          <NeedPc>PC がつながると分身が案を出します</NeedPc>
        )}
        {pcConnected && dc?.onMake ? (
          <div className="k-f11q-make">
            <Button variant="outlined" size="sm" disabled={Boolean(dc.making)} onClick={dc.onMake}>
              案を作る
            </Button>
            {dc.making ? (
              <p className="k-f11c-sub-text" role="status">
                {MAKING_TEXT}
              </p>
            ) : null}
          </div>
        ) : null}
        {dc?.message ? (
          <p className="k-f11c-sub-text" role="status">
            {dc.message}
          </p>
        ) : null}
        <p className="k-f11c-sub-text">いまは、題名と期限を自分で書いてチケットを作ります。</p>
        <TextField
          name="req-title"
          label="題名"
          {...(dc?.onManualTitle
            ? {
                value: dc.manualTitle ?? "",
                onChange: (e: { target: { value: string } }) => dc.onManualTitle?.(e.target.value),
              }
            : { defaultValue: c.title })}
        />
        <TextField
          name="req-due"
          label="期限"
          placeholder="例：12/26"
          {...(dc?.onManualDue
            ? {
                value: dc.manualDue ?? "",
                onChange: (e: { target: { value: string } }) => dc.onManualDue?.(e.target.value),
              }
            : {})}
        />
      </section>
    );
  return (
    <section className="k-f11q-card" aria-label="チケットの案">
      <h3 className="k-f11q-card-title">
        <Bot size={14} aria-hidden="true" /> {data && pr.owner ? pr.owner : "高本"}のAI のチケットの案{" "}
        {c.basis ? <span className="k-f11c-sub-text">{c.basis}</span> : null}
      </h3>
      <dl className="k-f11q-dl">
        <dt>題名</dt>
        <dd>{pr.title}</dd>
        <dt>種別</dt>
        <dd>{pr.kind}</dd>
        <dt>担当</dt>
        <dd>{pr.owner}</dd>
        <dt>期限</dt>
        <dd>{pr.due}</dd>
        <dt>費用</dt>
        <dd>{pr.cost}</dd>
        <dt>届け先</dt>
        <dd>
          <span className="k-f11q-route">
            {pr.route}
            {menu}
          </span>
          {pr.why ? <span className="k-f11c-sub-text">{pr.why}</span> : null}
        </dd>
      </dl>
      {c.ask ? (
        <p className="k-f11q-ask">
          <b>分身が先方に聞きたいこと：</b>
          {c.ask}
        </p>
      ) : null}
    </section>
  );
}

export function ReplyBox({
  ps,
  edited,
  readOnly,
  status = "new",
  data,
  value,
  onChange,
  pcConnected,
}: {
  ps: Ps;
  /** PC がつながっているが下書きがまだ無い（K-899）。押せない形の「PC がつながると…」を出さない */
  pcConnected?: boolean;
  edited?: boolean;
  readOnly?: boolean;
  status?: Status;
  data?: RequestData;
  /** 本物の画面：欄の値と書き換え（無ければ下書きを初めの値にする） */
  value?: string;
  onChange?: (v: string) => void;
}) {
  const draft = contentOf(status, data).draft;
  const editedText = `${draft}\n年内に回すご予定とのことなので、12/24 までに先にお送りすることもできます。`;
  return (
    <section className="k-f11q-reply" aria-label="先方に返す">
      <h3 className="k-f11q-card-title">
        先方に返す <Badge tone="progress">先方に見える</Badge>
      </h3>
      <TextArea
        name="reply"
        label="返事"
        rows={4}
        readOnly={readOnly}
        {...(value !== undefined
          ? { value, onChange: (e: { target: { value: string } }) => onChange?.(e.target.value) }
          : ps === "PS2"
            ? { defaultValue: edited ? editedText : draft }
            : { placeholder: "先方への返事を書く" })}
        {...(value !== undefined && ps === "PS0" ? { placeholder: "先方への返事を書く" } : {})}
        description={
          ps === "PS2"
            ? edited || (value !== undefined && draft !== "" && value !== draft)
              ? "分身が下書きした返事を、あなたが直しました。"
              : "分身が下書きした返事。直せる"
            : undefined
        }
      />
      {ps === "PS0" && !pcConnected ? <NeedPc>PC がつながると分身が返事の下書きを出します</NeedPc> : null}
    </section>
  );
}

function Acts({ canAct, acts }: { canAct: boolean; acts?: RequestActs }) {
  const off = !canAct;
  const lock = off
    ? {
        "aria-disabled": "true" as const,
        tabIndex: -1,
        title: "依頼をさばけるのは、この依頼が届いたグループの人です",
      }
    : {};
  // 本物の画面（acts を渡す）：押した結果の無いボタンは押せない形（隠さない・D-145.9）
  const live = (fn?: () => void) =>
    !acts
      ? lock
      : off
        ? lock
        : fn
          ? { onClick: fn }
          : { "aria-disabled": "true" as const, tabIndex: -1, title: "まだ使えません" };
  return (
    <div className="k-f11q-acts">
      <p className="k-f11c-sub-text">
        「チケットを作る」で、期限・担当などを社内で決める。依頼のやり取りは、チケットのチャットの頭に残る
      </p>
      <div className="k-f11q-btns">
        <Button variant="outlined" {...live(acts?.onDecline)}>
          断る（理由を返す）
        </Button>
        <Button variant="outlined" {...live(acts?.onAsk)}>
          返事を送って詳しく聞く
        </Button>
        <Button {...live(acts?.onCreate)}>チケットを作る</Button>
      </div>
    </div>
  );
}

export interface RequestDetailProps {
  ps?: Ps;
  phase?: Phase;
  /** 開いた依頼の状態（新しい・聞いている・さばいた） */
  status?: Status;
  edited?: boolean;
  menuOpen?: boolean;
  /** 依頼をさばける人か（読むだけは false） */
  canAct?: boolean;
  /** 本物の依頼の値（K-898）。無ければ下絵の見本 */
  data?: RequestData;
  /** 押した結果（K-898）。無ければ下絵の見本の形 */
  acts?: RequestActs;
  /** PC がつながっているが案がまだ無い（ps は PS0 で渡す）。届け先を変える ▾ と「案を作る」を出す */
  pcConnected?: boolean;
  /** 分身の案を作る動き（K-899） */
  draftControl?: DraftControl;
}

export function RequestDetail({
  ps = "PS2",
  phase = "idle",
  status = "new",
  edited,
  menuOpen,
  canAct = true,
  data,
  acts,
  pcConnected,
  draftControl,
}: RequestDetailProps) {
  const { title, who } = contentOf(status, data);
  const openTicket = acts?.onOpenTicket ? { onClick: acts.onOpenTicket } : {};
  return (
    <article className="k-f11q-detail" aria-labelledby="f11q-title">
      <BackToRequests />
      <header className="k-f11q-head">
        <h1 id="f11q-title">{title}</h1>
        <p className="k-f11c-sub-text">{who} ・ 同じゲストのグループの全員と社内に見えている</p>
      </header>
      {phase === "accepted" && !data ? (
        <Band
          tone="ok"
          title="チケットを作りました（EG-131）"
          sub="依頼のやり取りは、チケットのチャットの頭に残っています。セイコー株式会社（ゲスト）に見えています。"
          acts={
            <Button size="sm" variant="outlined">
              チケットを開く
            </Button>
          }
        />
      ) : null}
      {phase === "accepted" && data ? (
        <Band
          tone="ok"
          title={data.ticketNumber ? `チケットを作りました（${data.ticketNumber}）` : "チケットを作りました"}
          sub="依頼のやり取りは、チケットのチャットの頭に残っています。"
          acts={
            <Button size="sm" variant="outlined" {...openTicket}>
              チケットを開く
            </Button>
          }
        />
      ) : null}
      {phase === "asked" ? (
        <Band tone="wait" title="返事を送りました" sub="先方の返事を待っています。返事が来たら、ここに出ます。" />
      ) : null}
      {phase === "declined" ? (
        <Band tone="plain" title="断りました" sub="理由を先方に返しました。この依頼は「さばいたもの」に移ります。" />
      ) : null}
      {data?.notice ?? null}
      <Message status={status} {...(data ? { data } : {})} />
      {status === "asking" ? <AskingBand thread={data ? (data.thread ?? []) : SAMPLE_THREAD} /> : null}
      {status === "done" && !data ? (
        <Band
          tone="ok"
          title="チケットを作りました（EG-124）"
          sub="依頼のやり取りはチケットのチャットの頭に残っている ・ 10/30 に作った"
          acts={
            <Button size="sm" variant="outlined">
              チケットを開く
            </Button>
          }
        />
      ) : null}
      {status === "done" && data?.ticketId && phase === "idle" ? (
        <Band
          tone="ok"
          title={data.ticketNumber ? `チケットを作りました（${data.ticketNumber}）` : "チケットを作りました"}
          sub="依頼のやり取りは、チケットのチャットの頭に残っています。"
          acts={
            <Button size="sm" variant="outlined" {...openTicket}>
              チケットを開く
            </Button>
          }
        />
      ) : null}
      {status === "done" && data && !data.ticketId && phase === "idle" ? (
        <Band tone="plain" title="断りました" {...(data.declinedReason ? { sub: data.declinedReason } : {})} />
      ) : null}
      {status !== "done" && phase !== "accepted" && phase !== "declined" ? (
        <>
          <TicketProposal
            ps={ps}
            status={status}
            {...(menuOpen ? { menuOpen: true } : {})}
            {...(data ? { data } : {})}
            {...(acts?.onChangeRoute && canAct ? { onChangeRoute: acts.onChangeRoute } : {})}
            {...(pcConnected ? { pcConnected: true } : {})}
            {...(draftControl && canAct ? { draftControl } : {})}
          />
          <ReplyBox
            ps={ps}
            status={status}
            {...(edited ? { edited: true } : {})}
            readOnly={!canAct}
            {...(data ? { data } : {})}
            {...(acts?.reply !== undefined ? { value: acts.reply } : {})}
            {...(acts?.onReplyChange ? { onChange: acts.onReplyChange } : {})}
            {...(pcConnected ? { pcConnected: true } : {})}
          />
          {!canAct ? (
            <Callout tone="info">依頼をさばけるのは、この依頼が届いたグループの人です。ここでは読むだけです。</Callout>
          ) : null}
          <Acts canAct={canAct} {...(acts ? { acts } : {})} />
        </>
      ) : null}
    </article>
  );
}
