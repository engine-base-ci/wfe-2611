"use client";
// 段 8（F7）の下絵のモック：お知らせ（ベル）と探す（部品先行・枝 c/段8）。本番と同じ部品（features/F7/notice・features/F7/search・
//   components/k の外枠 Shell・features/F4 の一覧の頭）を、決めた値で並べる。1 つの id ＝ 1 つの状態。
//   外枠の鈴と探す欄は、本番では TicketShell が onNotices・onSearch を渡して押せるようにする（K-466・K-467・K-471）。ここでは何もしない関数を渡して押せる形にする。
//   重なる箱（お知らせ・探す）は Shell の上に出す。Shell の「探すを開いた」はスマホの帯の中の状態（props に無い）なので、375 の探すは虫眼鏡を 1 回押して開く（OpenMobileSearch）。
//   キャンバスの絵：StOverlay（お知らせと探すが重なる）・MbNotify（スマホのお知らせ）。絵に無い状態の文は案（下絵の状態の一覧 B1〜B13）。
import { useEffect, useState, type ReactNode } from "react";
import { Shell, type Group } from "@/components/k";
import "@/features/F4/ticket-list/ticket-list.css";
import { NumberCards } from "@/features/F7/due/views";
import { ScopeHead, ViewTabs } from "@/features/F7/overview/views";
import { CARDS } from "@/features/F7/saved/sample";
import { NoticePanel, NoticeSheet, type NoticeItem, type NoticePerson } from "@/features/F7/notice/views";
import { SearchPanel, type SearchGroupView, type SearchKind, type SearchStatus } from "@/features/F7/search/views";
import type { Theme } from "@/lib/theme";

const noop = () => undefined;

// ---------------------------------------------------------------- 見本の値（セイコー商事・高本・佐藤・鈴木。キャンバスの字のまま）
const NOTICES: readonly NoticeItem[] = [
  {
    id: "n1",
    kind: "handover",
    avatar: { initial: "佐", tone: "teal" },
    text: "佐藤さんが EG-119 を渡しました。返事の期限 11/03",
    label: "EG-119",
    when: "1 時間前",
    unread: true,
    href: "#handover",
  },
  {
    id: "n2",
    kind: "approval",
    avatar: { initial: "AI", tone: "ai" },
    text: "EG-128 の確認が終わり、あなたの承認を待っています",
    label: "EG-128",
    when: "4 時間前",
    unread: true,
    href: "#approval",
  },
  {
    id: "n3",
    kind: "mention",
    avatar: { initial: "鈴", tone: "indigo" },
    text: "鈴木さんが EG-128 であなたを @ しました",
    label: "EG-128",
    when: "5 時間前",
    unread: true,
    href: "#talk",
  },
  {
    id: "n4",
    kind: "due",
    avatar: { initial: "佐", tone: "teal" },
    text: "佐藤さんが EG-128 に書き込みました（期限を 11/02 に）",
    label: "EG-128",
    when: "10:41",
    unread: false,
    href: "#talk",
  },
  {
    id: "n5",
    kind: "stopped",
    avatar: { initial: "AI", tone: "ai" },
    text: "EG-127 が止まりました：発注ナビの画面が変わっていた",
    label: "EG-127",
    when: "昨日",
    unread: false,
    href: "#stopped",
  },
  {
    id: "n6",
    kind: "operator",
    avatar: { initial: "運", tone: "operator" },
    text: "お知らせ：11/10 2:00〜3:00 メンテナンス",
    label: "お知らせ",
    when: "昨日",
    unread: false,
  },
  {
    id: "n7",
    kind: "setting",
    avatar: { initial: "設", tone: "plum" },
    text: "新しい PC からログインがありました。心当たりが無いときは設定で確かめてください",
    when: "11/17",
    unread: false,
    href: "#me",
  },
];
const PAST: readonly NoticeItem[] = [
  {
    id: "p1",
    kind: "approval",
    avatar: { initial: "AI", tone: "ai" },
    text: "EG-101 の確認が終わり、あなたの承認を待っていました",
    label: "EG-101",
    when: "10/28",
    unread: false,
    href: "#approval",
  },
  {
    id: "p2",
    kind: "mention",
    avatar: { initial: "鈴", tone: "indigo" },
    text: "鈴木さんが EG-098 であなたを @ しました",
    label: "EG-098",
    when: "10/21",
    unread: false,
    href: "#talk",
  },
];
const PEOPLE: readonly NoticePerson[] = [
  { id: "sato", name: "佐藤 花子" },
  { id: "suzuki", name: "鈴木 一郎" },
  { id: "ops", name: "運営" },
];
const UNREAD = NOTICES.filter((n) => n.unread);

const QUERY = "セイコー 請求";
const GROUPS_ALL: readonly SearchGroupView[] = [
  {
    kind: "ticket",
    hits: [
      {
        id: "s1",
        kind: "ticket",
        lead: "EG-128",
        title: "セイコー様へ 11月分の請求書を送る",
        tag: { label: "承認待ち", tone: "warning" },
        href: "#ticket",
      },
      {
        id: "s2",
        kind: "ticket",
        lead: "EG-112",
        title: "セイコー様へ 10月分の請求書を送る",
        tag: { label: "完了", tone: "success" },
        href: "#ticket",
      },
    ],
  },
  {
    kind: "decision",
    hits: [
      { id: "s3", kind: "decision", title: "支払期日は月末締め翌月末", meta: "EG-128 ・ 10/28", href: "#decision" },
    ],
  },
  // 行き先の画面がまだ無い種類（ナレッジ・会話）は、出すが押せない形（D-145.9）
  { kind: "knowledge", hits: [{ id: "s4", kind: "knowledge", title: "請求のルール", meta: "ワークスペース ・ 版 4" }] },
  {
    kind: "conversation",
    hits: [
      {
        id: "s5",
        kind: "conversation",
        title: "セイコー様の請求の相談",
        snippet: "請求書の送り先を先に確かめましょう",
        meta: "11/02",
        href: "/ai/chat?c=c1",
      },
    ],
  },
];

const GROUPS: Group[] = [
  { code: "EG", name: "営業", count: 18, href: "/tickets?scope=eg", tone: "teal" },
  { code: "JD", name: "受託開発", count: 42, href: "/tickets?scope=jd", tone: "plum" },
  { code: "KR", name: "経理", count: 9, href: "/tickets?scope=kr", tone: "amber" },
];

// ---------------------------------------------------------------- 画面の組み立て
/** スマホ：探すの虫眼鏡を押して帯いっぱいに開き、打った字を入れる（Shell の探す欄は props で開けないので） */
function OpenMobileSearch({ query }: { query: string }) {
  useEffect(() => {
    // 広い幅は重ねる枠の入力が打つ所（帯の探す欄は元のまま）。帯の欄に字を入れるのは帯いっぱいに開くスマホだけ
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const input = document.querySelector<HTMLInputElement>('.k-bar input[name="q"]');
    if (input) input.value = query;
    let tries = 0;
    let raf = 0;
    const press = () => {
      const open = document.querySelector<HTMLButtonElement>(".k-bar-search-open");
      if (open) open.click();
      else if (++tries < 30) raf = requestAnimationFrame(press);
    };
    raf = requestAnimationFrame(press);
    return () => cancelAnimationFrame(raf);
  }, [query]);
  return null;
}

/** 重なる箱の下に見える画面（チケットの「自分に関わるもの」）。頭（見出し・タブ）と数の札は、f7-mine と同じ部品・同じ余白（k-list-head・k-list-body） */
function Behind() {
  return (
    <div className="k-root k-list-page">
      <ScopeHead title="チケット" sub="すべてのグループ" tabs={<ViewTabs current="mine" />} />
      <div className="k-list-body">
        <section className="k-list-main" aria-labelledby="tickets-title">
          <NumberCards cards={CARDS} />
        </section>
      </div>
    </div>
  );
}

function Frame({
  theme,
  approvals = 2,
  notices = 3,
  groups = GROUPS,
  children,
}: {
  theme: Theme;
  approvals?: number;
  notices?: number;
  groups?: Group[];
  children?: ReactNode;
}) {
  return (
    <Shell
      role="R1"
      screen="tickets"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
      workspace={{ name: "ENGINE BASE", initial: "E" }}
      member={{ name: "高本", initial: "高" }}
      groups={groups}
      badges={approvals ? { approvals } : {}}
      notices={notices}
      onNotices={noop}
      onSearch={noop}
      bridgeConnected
      theme={theme}
    >
      <Behind />
      {children}
    </Shell>
  );
}

interface NoticeOpts {
  items?: readonly NoticeItem[];
  past?: readonly NoticeItem[];
  onlyUnread?: boolean;
  peopleOpen?: boolean;
  status?: "ready" | "failed";
}
/** 767 以下か（分かるまでは null）。広い幅の箱とスマホの全面は片方だけを描く（隠れた方の「人で絞る」の箱が帯の左端に出ないように） */
function useNarrow(): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, []);
  return narrow;
}

/** お知らせの箱（広い幅）と全面（スマホ）。幅で片方だけを描く */
function Notices({ items = NOTICES, past, onlyUnread = false, peopleOpen, status = "ready" }: NoticeOpts) {
  const narrow = useNarrow();
  const unread = items.filter((n) => n.unread).length;
  const mentions = items.filter((n) => n.kind === "mention").length;
  if (narrow === null) return null;
  if (narrow)
    return (
      <NoticeSheet
        items={items}
        filter={onlyUnread ? "unread" : "all"}
        unread={unread}
        mentions={mentions}
        onlyUnread={onlyUnread}
        people={PEOPLE}
        personId={null}
        {...(peopleOpen ? { peopleOpen } : {})}
        status={status}
        onRetry={noop}
        loadingDelayMs={0}
      />
    );
  return (
    <NoticePanel
      items={items}
      {...(past ? { past } : {})}
      unread={unread}
      onlyUnread={onlyUnread}
      people={PEOPLE}
      personId={null}
      {...(peopleOpen ? { peopleOpen } : {})}
      status={status}
      onRetry={noop}
      loadingDelayMs={0}
    />
  );
}

interface SearchOpts {
  query?: string;
  kind?: SearchKind;
  status: SearchStatus;
  groups?: readonly SearchGroupView[];
  activeId?: string;
  placement?: "overlay" | "inline";
}
function Search({ query = QUERY, kind = "all", status, groups = [], activeId, placement }: SearchOpts) {
  return (
    <SearchPanel
      query={query}
      kind={kind}
      groups={groups}
      status={status}
      {...(activeId ? { activeId } : {})}
      {...(placement ? { placement } : {})}
      onRetry={noop}
      loadingDelayMs={0}
    />
  );
}

// ---------------------------------------------------------------- 状態の一覧（下絵の状態の一覧 5 章の #1〜#11）
export const NOTICE_RENDERS: Record<string, (theme: Theme) => ReactNode> = {
  "f7-bell-open": (theme) => (
    <Frame theme={theme}>
      <Notices />
    </Frame>
  ),
  "f7-bell-past": (theme) => (
    <Frame theme={theme}>
      <Notices past={PAST} />
    </Frame>
  ),
  "f7-bell-filter": (theme) => (
    <Frame theme={theme}>
      <Notices items={UNREAD} onlyUnread peopleOpen />
    </Frame>
  ),
  "f7-bell-empty": (theme) => (
    <Frame theme={theme} notices={0}>
      <Notices items={[]} />
    </Frame>
  ),
  "f7-bell-failed": (theme) => (
    <Frame theme={theme} notices={0}>
      <Notices items={[]} status="failed" />
    </Frame>
  ),
  "f7-bell-mobile": (theme) => (
    <Frame theme={theme}>
      <Notices />
    </Frame>
  ),
  "f7-shell-badges": (theme) => <Frame theme={theme} approvals={9} notices={3} />,
  "f7-search-start": (theme) => (
    <Frame theme={theme}>
      <Search query="" status="start" />
    </Frame>
  ),
  "f7-search-results": (theme) => (
    <Frame theme={theme}>
      <OpenMobileSearch query={QUERY} />
      <Search status="ready" groups={GROUPS_ALL} activeId="s1" />
    </Frame>
  ),
  "f7-search-empty": (theme) => (
    <Frame theme={theme}>
      <OpenMobileSearch query="セイコー 見積書" />
      <Search query="セイコー 見積書" status="empty" />
    </Frame>
  ),
  "f7-search-wait": (theme) => (
    <Frame theme={theme}>
      <OpenMobileSearch query={QUERY} />
      <Search status="loading" />
    </Frame>
  ),
  "f7-search-failed": (theme) => (
    <Frame theme={theme}>
      <OpenMobileSearch query={QUERY} />
      <Search status="failed" />
    </Frame>
  ),
  "f7-search-mobile": (theme) => (
    <Frame theme={theme}>
      <OpenMobileSearch query={QUERY} />
      <Search status="ready" groups={GROUPS_ALL} />
    </Frame>
  ),
};
