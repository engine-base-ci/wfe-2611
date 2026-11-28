"use client";
// 段 8（F7）の下絵：止まった理由（K-486）と 消す・元に戻す（K-590）の状態（部品先行・枝 c/段8）。
//   本番と同じ部品（features/F7/stopped・features/F7/delete・features/F4 の詳細の頭と一覧・components/k）を、決めた値で並べる。
//   詳細の右のパネルは今の本線（detail-panel.tsx）と同じクラスと並び。本番では差し込み口（止まった帯・「…」）に F7 の部品が入る
//   画面に出す文はキャンバス（StFailed・TdMore・TdDelete）の字のまま。絵に無い所の文は部品のコメントに「案」と書いてある
import { Bot, PanelRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { DocTools, Prose, Shell, Toaster, useNotify, type Crumb, type Group } from "@/components/k";
import { DetailMeta, InertButton } from "@/features/F4/create-ticket/detail-head";
import { ListTable } from "@/features/F4/ticket-list/list-table";
import { ListViews } from "@/features/F4/ticket-list/list-views";
import type { ListItem } from "@/features/F4/ticket-list/use-ticket-list";
import { CheckTable } from "@/features/F5/approve-complete/check-table";
import { DeleteChildrenDialog, DeletePreview, UndoToast, type DeletePreviewData } from "@/features/F7/delete/views";
import { RetryConfirm, StopHand, StopReason, TakeoverConfirm, type BrokenCause } from "@/features/F7/stopped/views";
import "@/features/F4/create-ticket/ticket-detail.css";
import "@/features/F4/ticket-list/ticket-list.css";
import type { RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import type { MockEntry } from "../types";

// ---------------------------------------------------------------- 見本の値（キャンバス StFailed・TdDelete の EG-128 と同じ顔ぶれ）
const WHO = "高本のAI";
const KIND = { name: "タスク", color: "#22345C" };
const GROUPS: Group[] = [
  { code: "EG", name: "営業", href: "/tickets?scope=eg", pending: true, tone: "teal" },
  { code: "JD", name: "受託開発", href: "/tickets?scope=jd", pending: true, tone: "plum" },
];
interface Sample {
  number: string;
  title: string;
  due_on: string;
  stage: { key: string; name: string };
  sections: readonly { key: string; label: string; text: string }[];
}
const INVOICE: Sample = {
  number: "EG-128",
  title: "セイコー様へ 11月分の請求書を送る",
  due_on: "2026-11-30",
  stage: { key: "doing", name: "作業中" },
  sections: [
    { key: "goal", label: "目的", text: "セイコー様に 11 月分の保守費を請求し、11/30 までに入金してもらう。" },
    {
      key: "done",
      label: "完了の条件",
      text: "金額が見積 EG-097 の月額と一致している\nPDF がセイコー株式会社 経理部 山田様に送られている",
    },
  ],
};
const RENEWAL: Sample = {
  number: "EG-124",
  title: "セイコー様 保守契約の更新",
  due_on: "2026-11-15",
  stage: { key: "doing", name: "作業中" },
  sections: [{ key: "goal", label: "目的", text: "セイコー様の保守契約を、今の条件で 1 年更新してもらう。" }],
};
const withStage = (s: Sample, key: string, name: string): Sample => ({ ...s, stage: { key, name } });

type Viewer = "takamoto" | "suzuki";
const VIEWER: Record<Viewer, { name: string; initial: string; role: RoleId }> = {
  takamoto: { name: "高本", initial: "高", role: "R1" },
  suzuki: { name: "鈴木", initial: "鈴", role: "R3" },
};

// ---------------------------------------------------------------- 画面の組み立て
function Toast({ title }: { title: string }) {
  const notify = useNotify();
  useEffect(() => {
    notify(title);
  }, [notify, title]);
  return null;
}

function Frame({
  theme,
  viewer,
  crumbs,
  approvals,
  children,
  dialog,
}: {
  theme: Theme;
  viewer: Viewer;
  crumbs: Crumb[];
  approvals: number;
  children: ReactNode;
  dialog?: ReactNode;
}) {
  const v = VIEWER[viewer];
  return (
    <Toaster>
      <Shell
        role={v.role}
        screen="tickets"
        crumbs={crumbs}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: v.name, initial: v.initial }}
        groups={GROUPS}
        badges={approvals ? { approvals } : {}}
        bridgeConnected
        theme={theme}
      >
        {children}
      </Shell>
      {dialog}
    </Toaster>
  );
}

/** 詳細の右のパネル（今の detail-panel.tsx と同じクラスと並び） */
function Panel({ me, assignee, due }: { me: string; assignee: string; due: string }) {
  const secs: [string, [string, ReactNode][]][] = [
    [
      "担当",
      [
        ["担当者", assignee],
        ["種別", "タスク"],
        ["承認する人", "高本"],
      ],
    ],
    [
      "日付と時間",
      [
        ["開始日", "11/01（日）"],
        ["期限", due],
      ],
    ],
    [
      "分類",
      [
        ["グループ", "営業（EG）"],
        ["優先度", "中"],
      ],
    ],
  ];
  return (
    <aside aria-label="チケットのパネル" className="k-detail-panel">
      <button type="button" className="k-detail-panel-close" aria-label="パネルを閉じる" title="パネルを閉じる">
        <PanelRight size={16} aria-hidden="true" />
      </button>
      <nav aria-label="パネルのタブ" className="k-detail-tabs">
        <button type="button" aria-current="page">
          属性
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          やり取り
        </button>
        <button type="button" aria-disabled="true" tabIndex={-1} title="まだ使えません">
          <Bot size={14} aria-hidden="true" />
          {`${me}のAI`}
        </button>
      </nav>
      <div className="k-detail-panel-body">
        {secs.map(([label, rows]) => (
          <section key={label} aria-label={label} className="k-detail-panel-sec">
            <h2>{label}</h2>
            <dl className="k-detail-fields">
              {rows.map(([k, v]) => (
                <div key={k} className="k-detail-field">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </aside>
  );
}

interface DetailProps {
  theme: Theme;
  t: Sample;
  viewer?: Viewer;
  /** 題名の下の帯（止まった帯など） */
  band?: ReactNode;
  /** 題名の行の「…」（無ければ押せない形） */
  more?: ReactNode;
  dialog?: ReactNode;
}

function Detail({ theme, t, viewer = "takamoto", band, more, dialog }: DetailProps) {
  const me = VIEWER[viewer].name;
  return (
    <Frame
      theme={theme}
      viewer={viewer}
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: t.number }]}
      approvals={1}
      dialog={dialog}
    >
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="ticket-title">
          <article className="k-detail-card">
            <DetailMeta
              ticket={{
                number: t.number,
                title: t.title,
                created_at: "2026-11-01T00:12:00Z",
                start_on: "2026-11-01",
                due_on: t.due_on,
              }}
              kind={KIND}
              stage={t.stage}
            />
            <header className="k-page-head">
              <div className="k-detail-title">
                <h1 id="ticket-title" title={t.title}>
                  {t.title}
                </h1>
              </div>
              <div className="k-page-acts">
                <InertButton>複製</InertButton>
                <InertButton>
                  <Bot size={13} aria-hidden="true" />
                  {`${me}のAI と話す`}
                </InertButton>
                {more ?? (
                  <InertButton label="ほかの操作" className="k-detail-more">
                    …
                  </InertButton>
                )}
              </div>
            </header>
            {band ? <div className="k-detail-bands">{band}</div> : null}
            <DocTools label="本文の道具" note="「/」で部品を入れる ・ 本文の版 1" />
            <div className="k-detail-doc">
              {t.sections.map((s) => (
                <section key={s.key} className="k-section" aria-label={s.label}>
                  <h2 id={`sec-${s.key}`}>{s.label}</h2>
                  <Prose>{s.text}</Prose>
                </section>
              ))}
            </div>
          </article>
          <section className="k-detail-links" aria-label="子チケット・つながり">
            <div className="k-detail-links-head">
              <h2>子チケット・つながり</h2>
              <InertButton size="sm">子を足す</InertButton>
              <InertButton size="sm">つながりを足す</InertButton>
            </div>
          </section>
        </section>
        <Panel me={me} assignee="高本 聖斗" due="11/30（月）" />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- 止まった理由（K-486）
const FAILED_REASON = "金額が見積 EG-097 の月額と合いませんでした";
const hand = (kind: Parameters<typeof StopHand>[0]["kind"], canAct = true) => (
  <StopHand kind={kind} canAct={canAct} assignee="高本" />
);

function StopFailed({ canAct = true }: { canAct?: boolean }) {
  return (
    <StopReason who={WHO} kind="check-failed" detail={FAILED_REASON} hand={hand("check-failed", canAct)}>
      <CheckTable />
    </StopReason>
  );
}

/** 壊れた帯。原因（口の答えの reason_kind から決まる 4 つ）を props で替えられる。見本は Bridge が古い */
function StopBroken({ theme, cause = "bridge-old" }: { theme: Theme; cause?: BrokenCause }) {
  return (
    <Detail
      theme={theme}
      t={INVOICE}
      band={<StopReason who={WHO} kind="broken" cause={cause} hand={hand("broken")} />}
    />
  );
}

const entry = (
  id: string,
  label: string,
  leaf: string,
  widths: MockEntry["widths"],
  render: MockEntry["render"],
): MockEntry => ({ id, screen: "tickets", label, ticket: leaf, leaf, widths, render });

const STOP_ENTRIES: readonly MockEntry[] = [
  entry(
    "f7-stop-broken",
    "理由：PC か AI が壊れた（Bridge が古い。ほかの 3 つは理由の字と案内だけが替わる）→ PC をつなぐへ",
    "K-486",
    [375, 1440],
    (theme) => <StopBroken theme={theme} />,
  ),
  entry(
    "f7-stop-retry",
    "一手：もう一度（「AI に任せる」を押した後・PC が受け取るのを待つ）",
    "K-486",
    [1440],
    (theme) => (
      <Detail
        theme={theme}
        t={INVOICE}
        band={<RetryConfirm who={WHO} />}
        dialog={<Toast title={`${WHO} に任せました`} />}
      />
    ),
  ),
  entry("f7-stop-takeover", "一手：自分で直す（AI の仕事を外し、担当者が自分で進める）", "K-486", [1440], (theme) => (
    <Detail
      theme={theme}
      t={INVOICE}
      band={<StopFailed />}
      dialog={<TakeoverConfirm open who={WHO} assigneeName="高本" />}
    />
  )),
  entry(
    "f7-stop-denied",
    "担当者でない人は見るだけ（一手は押せない形・訳は指を置くと読める）",
    "K-486",
    [375, 1440],
    (theme) => <Detail theme={theme} t={INVOICE} viewer="suzuki" band={<StopFailed canAct={false} />} />,
  ),
];

// ---------------------------------------------------------------- 消す・元に戻す（K-590）
const awaiting = withStage(INVOICE, "awaiting_approval", "承認待ち");
const DEL_DATA: DeletePreviewData = {
  number: "EG-128",
  title: "セイコー様へ 11月分の請求書を送る",
  approvals: 1,
  approvalTo: "高本",
  children: 0,
  links: 2,
  attachments: 1,
  artifacts: 1,
  runs: 0,
  restorableDays: 30,
};
const DEL_PARENT: DeletePreviewData = {
  number: "EG-124",
  title: "セイコー様 保守契約の更新",
  approvals: 0,
  children: 4,
  grandchildren: 2,
  links: 1,
  attachments: 0,
  artifacts: 0,
  runs: 0,
  restorableDays: 30,
};
const noop = () => undefined;

const deleted = (id: string, label: string, widths: MockEntry["widths"], render: MockEntry["render"]) =>
  entry(id, label, "K-590", widths, render);

const row = (
  i: number,
  number: string,
  title: string,
  stage: { name: string; key: string | null },
  who: string,
  due: string,
): ListItem => ({
  id: `t${i}`,
  number,
  title,
  kind: { id: "k1", name: "タスク" },
  stage: { id: `s${i}`, ...stage },
  assignee: { id: `u${i}`, display_name: who },
  delegated_to_clone: false,
  due_on: due,
  overdue: false,
  updated_at: "2026-11-20T01:00:00Z",
});
/** 消した EG-128 が無くなった後の一覧（キャンバス Main・Gantt の顔ぶれ） */
const ROWS: readonly ListItem[] = [
  row(1, "EG-119", "問い合わせ（山田様）に一次返信する", { name: "渡し中", key: null }, "佐藤", "2026-11-24"),
  row(2, "EG-126", "更新の見積を作る", { name: "確認中", key: "checking" }, "高本", "2026-11-25"),
  row(3, "EG-129", "契約書の更新版を送る", { name: "作業中", key: "doing" }, "高本", "2026-11-27"),
  row(4, "KR-034", "10月分の経費をまとめる", { name: "未着手", key: null }, "高本", "2026-12-01"),
];

const DELETE_ENTRIES: readonly MockEntry[] = [
  deleted("f7-delete-confirm", "消す前の確認（一緒に起きること・30 日・理由・やめる／消す）", [375, 1440], (theme) => (
    <Detail
      theme={theme}
      t={awaiting}
      dialog={<DeletePreview open data={DEL_DATA} reason="重複して作ってしまった" />}
    />
  )),
  deleted(
    "f7-delete-children",
    "子・孫がいる親を消す：別の親へ移す／一緒に消す／親を外して単体にする",
    [375, 1440],
    (theme) => (
      <Detail
        theme={theme}
        t={RENEWAL}
        dialog={
          <DeleteChildrenDialog
            open
            data={DEL_PARENT}
            choice="move"
            parent={{ number: "EG-097", title: "保守契約の見積" }}
            reason=""
          />
        }
      />
    ),
  ),
  deleted("f7-delete-denied", "消せない（権限が無い）：口が断った赤い箱・書いた理由は残る", [1440], (theme) => (
    <Detail
      theme={theme}
      t={awaiting}
      viewer="suzuki"
      dialog={
        <DeletePreview
          open
          data={{ ...DEL_DATA, approvals: 0 }}
          reason="重複して作ってしまった"
          notice="このチケットを消せるのは、作った人と、このグループで編集の権限を持つ人です"
          onOpenChange={noop}
        />
      }
    />
  )),
  deleted("f7-delete-undo", "消した直後：小さなお知らせ「元に戻す」と、消えた後の一覧", [375, 1440], (theme) => (
    <Frame
      theme={theme}
      viewer="takamoto"
      crumbs={[{ label: "チケット", href: "/tickets" }, { label: "自分に関わるもの" }]}
      approvals={0}
      dialog={<UndoToast title="EG-128 を消しました" keep />}
    >
      <div className="k-root k-list-page">
        <header className="k-page-head k-list-head">
          <div className="k-list-head-row">
            <h1 id="tickets-title">チケット</h1>
            <span className="k-list-dim">すべてのグループ</span>
          </div>
          <ListViews view="all" />
        </header>
        <div className="k-list-body">
          <section className="k-list-main" aria-labelledby="tickets-title">
            <div className="k-list-panel">
              <ListTable
                rows={[...ROWS]}
                columns={["kind", "number", "title", "stage", "assignee", "due"]}
                sections={false}
                hasMore={false}
                loadingMore={false}
                moreError={null}
                onMore={noop}
              />
            </div>
          </section>
        </div>
      </div>
    </Frame>
  )),
];

export const STOPPED_MOCKS: readonly MockEntry[] = [...STOP_ENTRIES, ...DELETE_ENTRIES];
