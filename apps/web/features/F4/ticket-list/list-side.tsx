// 一覧の画面の右の列（K-251）。幅 340 まで・1023 以下は本文の下（ticket-list.css）。
//   はじめて（0 件・キャンバス OnHome）：はじめにやること（K-250 の口・D-145.10〜.15）と いつでもできること（押せない・ひな形の行は字だけで値は空）。
//     はじめにやること：数は「済みか飛ばした数 ／ 使える項目の数」。使えない項目（パスキー）はグレーで押せず ✓ を出さない（D-145.11）。
//     まだの項目は口の href へのリンク（PC は「つなぐ」・ログイン情報は「預ける」）、任意の項目は横に「あとで」（飛ばす・D-145.13・D-145.14）。
//     「いまは閉じる」で箱を閉じる。閉じた・全部済んだ・読めないときは箱を出さない
//   チケットが在る（キャンバス Main）：自分の承認を待っているもの（承認待ちの口の番号と題名）・〈名前〉のAI のいま・最近の知らせ（見出しだけで中身は空）
import { errorText, PAGE_ERROR } from "@/components/k/error-of";
import type { Approvals, SetupTask, SetupTasks } from "./use-ticket-list";

/** はじめにやることの行の右の操作（まだの項目だけ） */
function TaskAct({ task, setup, first }: { task: SetupTask; setup: SetupTasks; first: boolean }) {
  if (!task.available || task.done || task.skipped || !task.href) return null;
  const label = task.key === "pc" ? "つなぐ" : "預ける";
  return (
    <span className="k-list-task-acts">
      <a className="k-btn k-list-act" data-variant={first ? "primary" : "outlined"} href={task.href}>
        {label}
      </a>
      {task.optional ? (
        <button
          type="button"
          className="k-btn k-list-act"
          data-variant="ghost"
          disabled={setup.pending !== null}
          aria-busy={setup.pending === task.key || undefined}
          onClick={() => setup.skip(task.key)}
        >
          あとで
        </button>
      ) : null}
    </span>
  );
}

function Task({ task, setup, first }: { task: SetupTask; setup: SetupTasks; first: boolean }) {
  const settled = task.available && (task.done || task.skipped);
  return (
    <li
      className="k-list-task"
      data-task={task.key}
      data-skipped={task.skipped || undefined}
      {...(task.available ? {} : { "aria-disabled": "true" as const, title: `${task.label}（まだ付けられません）` })}
    >
      <span className="k-list-task-mark" data-done={task.done || undefined} aria-hidden="true">
        {task.done && task.available ? "✓" : ""}
      </span>
      <span className="k-list-task-text">
        <b className="k-list-task-label" data-settled={settled || undefined}>
          {task.label}
        </b>
        <span className="k-list-task-desc">{task.desc}</span>
      </span>
      <TaskAct task={task} setup={setup} first={first} />
    </li>
  );
}

function SetupBox({ setup }: { setup: SetupTasks }) {
  // 主ボタン（紺）は、まだの項目のうち最初の 1 つだけ（1 画面 1 主アクション）
  const firstOpen = setup.tasks.find((t) => t.available && !t.done && !t.skipped)?.key;
  const ratio = setup.total ? setup.done / setup.total : 0;
  return (
    <section className="k-list-side-box" aria-labelledby="k-list-setup-title">
      <div className="k-list-side-head">
        <h2 id="k-list-setup-title" className="k-list-side-title">
          はじめにやること
        </h2>
        <span className="k-list-dim">
          {setup.done} ／ {setup.total}
        </span>
      </div>
      <div className="k-list-progress" aria-hidden="true">
        <div style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <ul className="k-list-tasks">
        {setup.tasks.map((t) => (
          <Task key={t.key} task={t} setup={setup} first={t.key === firstOpen} />
        ))}
      </ul>
      <p className="k-list-setup-foot">
        いつでも続きから。全部終わると消える ・{" "}
        <button
          type="button"
          className="k-list-text-btn"
          disabled={setup.pending !== null}
          aria-busy={setup.pending === "close" || undefined}
          onClick={setup.close}
        >
          いまは閉じる
        </button>
      </p>
    </section>
  );
}

const ANYTIME = ["メンバーを招く", "ナレッジのページを書く", "チケットの形を自社に合わせる"] as const;

function Anytime() {
  return (
    <section className="k-list-anytime" aria-labelledby="k-list-anytime-title">
      <h2 id="k-list-anytime-title" className="k-list-anytime-title">
        いつでもできること
      </h2>
      <p>
        {ANYTIME.map((t, i) => (
          <span key={t}>
            {i ? " ・ " : null}
            <span className="k-list-off" aria-disabled="true" title={`${t}（準備中）`}>
              {t}
            </span>
          </span>
        ))}
      </p>
      {/* ひな形の名前と数は口がまだ無いので空（D-144.3・PM の決め） */}
      <p className="k-list-dim" data-part="template">
        はじめは「
        <span data-value />
        」のひな形（層 <span data-value />
        ・種別 <span data-value />
        ・やり方 <span data-value />
        ）で動いている
      </p>
    </section>
  );
}

export function FirstSide({ setup }: { setup: SetupTasks }) {
  return (
    <aside className="k-list-side" aria-label="はじめての案内">
      {setup.show ? <SetupBox setup={setup} /> : null}
      <Anytime />
    </aside>
  );
}

function BoxHead({ id, title, more }: { id: string; title: string; more?: string }) {
  return (
    <h2 id={id} className="k-list-box-title">
      {title}
      {more ? (
        <span className="k-list-off k-list-box-more" aria-disabled="true" title={`${more}（準備中）`}>
          {more}
        </span>
      ) : null}
    </h2>
  );
}

function ApprovalRows({ approvals }: { approvals: Approvals }) {
  if (approvals.state === "loading") return null;
  if (approvals.state === "error") return <p className="k-list-box-row">{errorText(PAGE_ERROR.loadFailed).title}</p>;
  return (
    <>
      {approvals.rows.map((a) => (
        <div key={a.id} className="k-list-box-row">
          <div className="k-list-dim">{a.ticket_number}</div>
          {a.ticket_id ? (
            <a className="k-list-link k-list-box-link" href={`/tickets/${encodeURIComponent(a.ticket_id)}`}>
              {a.title}
            </a>
          ) : (
            <b className="k-list-box-link">{a.title}</b>
          )}
        </div>
      ))}
    </>
  );
}

export function MainSide({ name, approvals }: { name: string; approvals: Approvals }) {
  const ai = `${name}のAI のいま`;
  return (
    <aside className="k-list-side" aria-label="自分に関わるものの右の列">
      <section className="k-list-box" aria-labelledby="k-list-ap-title">
        <BoxHead id="k-list-ap-title" title="自分の承認を待っているもの" more="すべて" />
        <ApprovalRows approvals={approvals} />
      </section>
      {/* AI のいま・最近の知らせは、読む口ができるまで見出しだけ（中身は空・D-144.3） */}
      <section className="k-list-box" aria-label={ai}>
        <BoxHead id="k-list-ai-title" title={ai} more="分身の部屋へ" />
      </section>
      <section className="k-list-box" aria-labelledby="k-list-notes-title">
        <BoxHead id="k-list-notes-title" title="最近の知らせ" />
      </section>
    </aside>
  );
}
