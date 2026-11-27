"use client";
// 承認待ちの残りの下絵（段 6 core・束 E）：札と並べ替え（K-749）・決めた履歴の板（K-751）・続けて裁く（K-752）・まとめて承認。
//   表の枠は今の承認待ち（approve.css の .k-ap-*）を使い回し、新しい形は「確認」の列（数だけ「4 ／ 5 済み」・D-153.3）と札・並べ替え。
//   札のうち「上位の承認」「判断を仰がれた」は物がまだ無いので押せない形。「決まりの例外」「やり方を広げる」は札から外した（聞くこと 8）。
//   まとめて承認（K-769）：行に選ぶ四角・［まとめて承認（全部）］・選んだ N 件の帯（聞くこと 9）。
import { ph } from "@/features/F5/room/phrase";
import { Dialog as D } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Fragment } from "react";
import { Button, Empty } from "@/components/k";
import { ArtifactCardMore } from "./artifact";
import { ChecksTable, type CheckRow } from "./checks";
import { Choice, PickBox } from "./choice";
import "@/features/F5/approve-complete/approve.css";
import "@/features/F5/delegate/delegate.css";
import "./more.css";
import "@/features/F5/history/history.css";

const INERT = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;
const GAP = "　";

export interface ChipView {
  label: string;
  count?: number;
  on?: boolean;
  /** 物がまだ無い札：押せない形 */
  inert?: boolean;
}
export const CHIPS_ALL: readonly ChipView[] = [
  { label: "すべて", count: 9, on: true },
  { label: "AI の成果物", count: 6 },
  { label: "渡された", count: 3 },
  { label: "上位の承認", inert: true },
  { label: "判断を仰がれた", inert: true },
];
export const SORTS = ["期限の近い順", "新しく承認待ちになった順", "題名の順"] as const;

export function QueueTools({
  chips,
  sort = SORTS[0],
  sortOpen = false,
}: {
  chips: readonly ChipView[];
  sort?: string;
  sortOpen?: boolean;
}) {
  return (
    <div className="k-ap-tools">
      <div className="k-ap-chips" role="group" aria-label="絞り込み">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            className="k-ap-chip"
            aria-pressed={c.on ? "true" : "false"}
            {...(c.inert ? INERT : {})}
          >
            {c.label}
            {c.count !== undefined ? <span className="k-more-count">{c.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="k-ap-tools-end">
        <span className="k-more-sortwrap">
          <button type="button" className="k-more-sortbtn" aria-haspopup="listbox" aria-expanded={sortOpen}>
            {`${sort} ▾`}
          </button>
          {sortOpen ? (
            <ul className="k-more-pop" role="listbox" aria-label="並べ替え">
              {SORTS.map((s) => (
                <li key={s} role="option" aria-selected={s === sort}>
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </span>
        <Button variant="outlined" size="sm">
          まとめて承認（全部）
        </Button>
        <Button variant="outlined" size="sm">
          決めた履歴
        </Button>
      </div>
    </div>
  );
}

export interface QRow {
  group: string;
  alert?: boolean;
  kind: string;
  number: string;
  title: string;
  note?: string;
  from: string;
  /** 確認の列：「4 ／ 5 済み」（数だけ）／「検査なし」／空は — */
  check: string;
  due: string;
  late?: boolean;
  acts: "approve" | "look" | "handover";
}
export const QROWS: readonly QRow[] = [
  {
    group: "期限切れ",
    alert: true,
    kind: "AI の成果物",
    number: "EG-128",
    title: "セイコー様へ 11 月分の請求書を送る",
    note: "承認するとメールを送る（取り消せない）",
    from: "高本のAI",
    check: "4 ／ 5 済み",
    due: "11/01",
    late: true,
    acts: "look",
  },
  {
    group: "今日",
    kind: "AI の成果物",
    number: "KR-031",
    title: "入金の照合（10 月分）を記録する",
    note: "承認すると会計に記録する（戻せる）",
    from: "高本のAI",
    check: "3 ／ 3 済み",
    due: "11/02（今日）",
    acts: "approve",
  },
  {
    group: "7 日以内",
    kind: "渡された",
    number: "EG-119",
    title: "問い合わせ（山田様）に一次返信する",
    note: "理由：先方と面識がある ・ 返事の期限 11/03",
    from: "佐藤 花子",
    check: "",
    due: "11/03",
    acts: "handover",
  },
  {
    group: "7 日以内",
    kind: "AI の成果物",
    number: "EG-127",
    title: "発注ナビ 応募文を出す",
    note: "承認すると 3 社に応募する（外に出る）",
    from: "高本のAI",
    check: "2 ／ 3 済み",
    due: "11/04",
    acts: "look",
  },
];

function RowActs({ r }: { r: QRow }) {
  if (r.acts === "handover")
    return (
      <span className="k-ap-acts">
        <Button size="sm" variant="outlined">
          断る
        </Button>
        <Button size="sm">受ける</Button>
      </span>
    );
  return (
    <span className="k-ap-acts">
      <Button size="sm" variant="outlined">
        差し戻す
      </Button>
      {r.acts === "approve" ? (
        <Button size="sm">承認する</Button>
      ) : (
        <a className="k-btn" data-variant="primary" data-size="sm" href="#">
          中身を見る
        </a>
      )}
    </span>
  );
}

/** まとめて承認で選べる行（AI の成果物。渡された物は［受ける］［断る］で 1 件ずつ） */
const pickable = (r: QRow): boolean => r.kind === "AI の成果物";

export function QueueTable({ rows, picked = [] }: { rows: readonly QRow[]; picked?: readonly string[] }) {
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <div className="k-ap-scroll k-more-qtable">
      <table className="k-ap-table">
        <thead>
          <tr>
            <th scope="col">
              <PickBox checked={false} label="まとめて選べるものをすべて選ぶ" />
            </th>
            {["種別", "番号", "題名", "誰から", "確認", "期限"].map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
            <th scope="col" className="k-ap-end">
              その場で決める
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const rs = rows.filter((r) => r.group === g);
            return (
              <Fragment key={g}>
                <tr className="k-ap-group" data-alert={rs[0]?.alert || undefined}>
                  <td colSpan={9}>
                    <span>{g}</span>
                    {GAP}
                    <span>{rs.length} 件</span>
                  </td>
                </tr>
                {rs.map((r) => (
                  <tr key={r.number}>
                    <td>
                      {pickable(r) ? (
                        <PickBox checked={picked.includes(r.number)} label={`${r.number} を選ぶ`} />
                      ) : (
                        <span className="k-ap-dash" title="1 件ずつ決める">
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="k-ap-kind">{r.kind}</span>
                    </td>
                    <td>
                      <a className="k-link k-ap-num" href="#">
                        {r.number}
                      </a>
                    </td>
                    <td className="k-ap-title">
                      <a href="#">{r.title}</a>
                      {r.note ? <span className="k-ap-sub">{r.note}</span> : null}
                    </td>
                    <td>
                      <span className="k-ap-from">
                        <span className="k-ap-avatar" aria-hidden="true">
                          {r.from.startsWith("高本") ? "AI" : "佐"}
                        </span>
                        {r.from}
                      </span>
                    </td>
                    <td className="k-ap-check">{r.check || "—"}</td>
                    <td data-late={r.late || undefined}>{r.due}</td>
                    <td className="k-ap-end">
                      <RowActs r={r} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** まだチェックの無い確認項目の数（確認の列の字「4 ／ 5 済み」から） */
const stillOpen = (check: string): number => {
  const m = /(\d+) ／ (\d+) 済み/.exec(check);
  return m ? Number(m[2]) - Number(m[1]) : 0;
};

/** スマホ（キャンバス MbApprovals）：表をやめ、1 件を 1 枚のカードにして縦に並べる。768 以上では出さない */
export function QueueCards({ rows, picked = [] }: { rows: readonly QRow[]; picked?: readonly string[] }) {
  return (
    <ul className="k-more-mq" aria-label="承認待ちの一覧（スマホ）">
      {rows.map((r) => {
        const open = stillOpen(r.check);
        const who = r.acts === "handover" ? `${r.kind} ・ ${r.from}さんから` : `${r.from} が作成`;
        return (
          <li key={r.number} className="k-more-mcard" data-alert={r.alert || undefined}>
            <div className="k-more-mcard-meta">
              {pickable(r) ? (
                <Choice kind="checkbox" checked={picked.includes(r.number)} className="k-more-mcard-pick">
                  <span className="k-more-mcard-num">{r.number}</span>
                </Choice>
              ) : (
                <span className="k-more-mcard-num">{r.number}</span>
              )}
              <span className="k-more-mcard-who">{who}</span>
            </div>
            <a className="k-more-mcard-title" href="#">
              {r.title}
            </a>
            {r.note ? <p className="k-more-mcard-sub">{r.note}</p> : null}
            {r.check ? (
              <p className="k-more-mcard-open" data-open={open > 0 || undefined}>{`確認 ${r.check}`}</p>
            ) : null}
            <p className="k-more-mcard-due" data-late={r.late || undefined}>{`期限 ${r.due}`}</p>
            <div className="k-more-mcard-acts">
              {r.acts === "handover" ? (
                <>
                  <Button variant="outlined">断る</Button>
                  <Button>受ける</Button>
                </>
              ) : (
                <>
                  <a className="k-btn" data-variant="outlined" data-size="md" href="#">
                    中身を見る
                  </a>
                  {r.acts === "approve" ? <Button>承認する</Button> : <Button {...INERT}>見てから承認</Button>}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** スマホの下の入口：続けて裁く（頭の同じボタンはスマホでは出さない） */
export function NextBottom({ total }: { total: number }) {
  return <Button variant="outlined" size="lg" className="k-more-mnext">{`続けて裁く（${total} 件・1 件ずつ）`}</Button>;
}

export const QUEUE_NOTE =
  "— は 1 件ずつ中身を見て決めるもの（取り消せない操作・あなたが見る項目がある）。押すとチケットの詳細の承認の帯へ";

/** 絞って 0 件 */
export function FilteredEmpty({ label }: { label: string }) {
  return (
    <Empty
      icon="✓"
      title={ph(`「${label}」で`, "決めるものは", "ありません")}
      action={<Button variant="outlined">すべてに戻す</Button>}
    >
      ほかの札には、決めるものが残っています
    </Empty>
  );
}

// ---- 決めた履歴の板 ----
export interface HistRow {
  time: string;
  decision: "承認" | "差し戻し";
  number: string;
  title: string;
  sub: string;
  undo?: boolean;
}
export const HIST_DAYS: readonly { day: string; rows: readonly HistRow[] }[] = [
  {
    day: "今日",
    rows: [
      {
        time: "10:52",
        decision: "承認",
        number: "KR-031",
        title: "入金の照合（10 月分）",
        sub: "実行は 11:00 の予定",
        undo: true,
      },
      {
        time: "10:48",
        decision: "承認",
        number: "EG-127",
        title: "発注ナビ 応募文 3 本",
        sub: "中身を見て承認 ・ 送った",
      },
      {
        time: "09:40",
        decision: "差し戻し",
        number: "EG-098",
        title: "提案書の骨組み",
        sub: "理由：結論が先に見えない",
      },
    ],
  },
  {
    day: "10/31（金）",
    rows: [
      { time: "15:05", decision: "承認", number: "EG-126", title: "セイコー様 更新の見積", sub: "確認 3 件すべて通過" },
    ],
  },
];
const HIST_CHIPS = ["すべて 4", "承認 3", "差し戻し 1"] as const;

export function HistorySheet({ days, empty = false }: { days: typeof HIST_DAYS; empty?: boolean }) {
  return (
    <D.Root open>
      <D.Portal>
        <D.Backdrop className="k-backdrop" />
        <D.Popup className="k62-run-sheet">
          <div className="k-dialog-head">
            <D.Title className="k-dialog-title">決めた履歴</D.Title>
            <D.Close className="k-dialog-close" aria-label="閉じる">
              <X aria-hidden="true" size={16} />
            </D.Close>
          </div>
          <div className="k-more-hist-head">
            <div role="group" aria-label="絞り込み" className="k62-run-chips">
              {HIST_CHIPS.map((c, i) => (
                <button key={c} type="button" className="k62-run-chip" aria-pressed={i === 0}>
                  {c}
                </button>
              ))}
            </div>
            <span className="k-ap-sort">この 1 週間 ▾</span>
          </div>
          <div className="k-dialog-body k-more-hist">
            {empty ? (
              <p className="k-more-hist-note">この 1 週間に決めたものはありません</p>
            ) : (
              days.map((d) => (
                <section key={d.day} aria-label={d.day}>
                  <h3 className="k-more-day">{d.day}</h3>
                  <ul className="k-more-hist-list">
                    {d.rows.map((r) => (
                      <li key={r.number} className="k-more-hist-row">
                        <time>{r.time}</time>
                        <span className="k-more-hist-title">
                          <span>
                            <b>{r.decision}</b>
                            {` ${r.number} ${r.title}`}
                          </span>
                          <span className="k-more-hist-sub">{r.sub}</span>
                        </span>
                        {r.undo ? (
                          <Button size="sm" variant="outlined">
                            取り消す
                          </Button>
                        ) : (
                          <span />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            <p className="k-more-hist-note">
              「取り消す」は、実行がまだ始まっていない承認だけ。実行が始まったあとは、差し戻しの書き込みで
            </p>
          </div>
        </D.Popup>
      </D.Portal>
    </D.Root>
  );
}

// ---- 続けて裁く ----
const KEYS = "次 J ・ 前 K ・ 承認 A ・ 差し戻す R ・ 自分で直す E ・ 飛ばす S";
const FOCUS_ROWS: readonly CheckRow[] = [
  {
    text: "金額が見積の月額と一致している",
    who: "ai",
    at: "11/01 09:12",
    basis: "PDF の合計 1,716,000 円 ＝ 見積 EG-097 の月額と追加対応の合計",
  },
  { text: "宛名と CC が取引先のルールどおり", who: "ai", at: "11/01 09:12", basis: "宛先は経理部 山田様・CC は鈴木様" },
  { text: "送る前に PDF を目で見る", who: null },
];
const Key = ({ k }: { k: string }) => <kbd className="k-more-key">{k}</kbd>;

export function FocusView({ confirmNote }: { confirmNote?: string }) {
  return (
    <div className="k-more-focus">
      <header className="k-more-focus-head">
        <h1>続けて裁く</h1>
        <p className="k-more-focus-pos">2 / 9 件</p>
        <Button className="k-more-focus-exit" variant="outlined" size="sm">
          ‹ 一覧に戻る
        </Button>
      </header>
      <main className="k-more-focus-main">
        <section className="k-more-focus-card" aria-label="いま決めるもの">
          <h2>EG-128 セイコー様へ 11 月分の請求書を送る</h2>
          <p className="k-more-focus-meta">
            高本のAI ・ 期限 11/01（1 日過ぎ） ・ 承認するとメールを送る（取り消せない）
          </p>
          <ChecksTable rows={FOCUS_ROWS} />
          <ArtifactCardMore version={1} />
          {confirmNote ? <p className="k-more-focus-meta">{confirmNote}</p> : null}
        </section>
        <p className="k-more-focus-keys">{`キー：${KEYS}`}</p>
      </main>
      <footer className="k-more-focus-foot">
        <Button variant="outlined" className="k-more-f-skip">
          飛ばす
          <Key k="S" />
        </Button>
        <Button variant="outlined" className="k-more-f-stop">
          止める
        </Button>
        <Button variant="outlined" className="k-more-f-return">
          差し戻す
          <Key k="R" />
        </Button>
        <Button variant="outlined" className="k-more-f-edit">
          自分で直す
          <Key k="E" />
        </Button>
        <Button className="k-more-focus-main-act">
          承認して送る → 次へ
          <Key k="A" />
        </Button>
        <p className="k-more-focus-next">次：KR-031 入金の照合（10 月分）を記録する ・ EG-127 発注ナビ 応募文を出す</p>
      </footer>
    </div>
  );
}

export function FocusDone() {
  return (
    <div className="k-more-focus">
      <header className="k-more-focus-head">
        <h1>続けて裁く</h1>
        <p className="k-more-focus-pos">9 / 9 件</p>
      </header>
      <main className="k-more-focus-done">
        <h2>決め終わりました</h2>
        <ul className="k-more-tally" aria-label="結果">
          <li>承認 5 件</li>
          <li>差し戻し 2 件</li>
          <li>飛ばした 2 件</li>
        </ul>
        <p className="k-more-focus-meta">飛ばした 2 件は、承認待ちに残っています</p>
        <Button>承認待ちに戻る</Button>
      </main>
      <footer className="k-more-focus-foot">
        <p className="k-more-focus-next">決めた物は、承認待ちの［決めた履歴］で見られます</p>
      </footer>
    </div>
  );
}

/** まとめて承認（K-769）：選んだ N 件の帯。PC は表の上（at="table"）・スマホはカードの後ろに置いて画面の下に貼り付く（at="mobile"・代表の決め answer=0050b3906ae6）。
 *  置き場ごとに 1 つずつ置き、幅で片方だけを出す（見えない方は一覧の役に数えない） */
export function BulkBar({ count, at = "table" }: { count: number; at?: "table" | "mobile" }) {
  return (
    <div className="k-more-bulkbar" data-at={at} role="region" aria-label="選んだもの">
      <p>{`${count} 件を選んでいます`}</p>
      <Button size="sm">選んだものを承認</Button>
    </div>
  );
}
