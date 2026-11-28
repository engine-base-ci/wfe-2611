// 段 8（F7）の「絞る・保存・見え方」の画面の試験の道具（K-478 が運ぶ。K-479 も同じ道具を読む）。
//   前からの土台 list-mock.ts（mockList・item・ok・open など）の上に、足りない物だけを置く：
//     ・自分に関わるものの口の答え（1 回目＝cursor なしだけ meta.counts を付ける・K-474 の形：overdue・today・assigned・ai・approve の 5 つの整数）
//     ・絞りの口（members・ticket_stages・ticket_kinds）の差し替えと、読んだ数
//     ・口に飛んだ問い合わせを「名前 → 値」の形で読む（queryOf）・日本時間の今日（todayJst）
//   一覧の口の絞りの欄の名前は K-472・K-473 の md のとおり（assignee_id・stage_id・kind_id・client_id・done・due_from・due_to・start_from・start_to・
//   overdue・fire・parent・sort・fields）。「AI に任せている」「自分が承認」の札・チップを押したときの欄（delegated・approving・どちらも done=false を重ねる）と期限なし（due=none）は、
//   K-473 が足す 13 欄の外の欄（K-474 の数 ai・approve と同じ集まり）。
//   本人の Bridge（127.0.0.1:38617）には届かせない（list-mock.ts の mockList が網の手前で 404）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Route } from "@playwright/test";
import { ME, SALES, TASK, idOf, item, mockList, ok, type ListMock, type Reply } from "./list-mock";

export { ME, SALES, TASK, idOf, item, ok, type ListMock, type Reply };

/** 札に出る数（K-474 の meta.counts の形） */
export interface Counts {
  overdue: number;
  today: number;
  assigned: number;
  ai: number;
  approve: number;
}
export const COUNTS: Counts = { overdue: 2, today: 3, assigned: 11, ai: 5, approve: 2 };
export const SUZUKI = "33333333-0000-4000-8000-000000000001";
export const STAGE_DONE = "55555555-0000-4000-8000-000000000001";
export const STAGE_DOING = "55555555-0000-4000-8000-000000000002";
export const KIND_QA = "66666666-0000-4000-8000-000000000001";

/** 日本時間の今日（YYYY-MM-DD） */
export const todayJst = (): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
/** 口の問い合わせを「名前 → 値」にする（同じ名前が 2 つあれば後ろ） */
export const queryOf = (q: URLSearchParams): Record<string, string> => Object.fromEntries(q.entries());

export interface MineOptions {
  /** 札の数。null＝口が数を返さない（古い口・失敗）。既定は COUNTS */
  counts?: Counts | null;
  /** 問い合わせ（view・絞り込み・sort・cursor）から答える行。既定は 3 件 */
  rows?: (q: URLSearchParams, call: number) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>;
  /** 一覧の口の答えそのものを替える（失敗の回など）。返したら rows・counts は使わない */
  reply?: (q: URLSearchParams, call: number) => Reply | undefined | Promise<Reply | undefined>;
}

export interface MineMock extends ListMock {
  /** 絞りの口を読んだ数 */
  reads: { members: number; stages: number; kinds: number };
}

const PEOPLE = [
  { id: ME, display_name: "高本", kind_id: "human" },
  { id: SUZUKI, display_name: "鈴木", kind_id: "human" },
];
const STAGES = [
  { id: STAGE_DOING, name: "作業中", key: "doing", position: 2 },
  { id: STAGE_DONE, name: "完了", key: "done", position: 9 },
];
const KINDS = [
  { id: TASK, name: "タスク", sections: [] },
  { id: KIND_QA, name: "QA", sections: [] },
];

/** 自分に関わるもの・一覧の口と、絞りの口（人・段・種別）を差し替える。1 回目（cursor なし）の view=mine の答えにだけ counts を付ける */
export async function mockMine(page: Page, o: MineOptions = {}): Promise<MineMock> {
  const counts = o.counts === undefined ? COUNTS : o.counts;
  const reads = { members: 0, stages: 0, kinds: 0 };
  const m = await mockList(page, {
    list: async (q, call) => {
      const own = await o.reply?.(q, call);
      if (own) return own;
      const rows = (await o.rows?.(q, call)) ?? [item(1), item(2), item(3)];
      const first = (q.get("view") ?? "mine") === "mine" && !q.get("cursor");
      return ok(rows, { next_cursor: null, ...(first && counts ? { counts } : {}) });
    },
  });
  // 後から足した道すじが先に当たる（Playwright）。絞りの 3 本だけを答え、ほかは前からの差し替えに任せる
  await page.route(/\/api\/v1\/(members|ticket_stages|ticket_kinds)(\?|$)/, async (route: Route) => {
    const p = new URL(route.request().url()).pathname;
    let body: unknown;
    if (p.endsWith("/members")) {
      reads.members += 1;
      body = { data: PEOPLE, meta: { limit: 200 } };
    } else if (p.endsWith("/ticket_stages")) {
      reads.stages += 1;
      body = { data: STAGES, meta: { limit: 50 } };
    } else {
      reads.kinds += 1;
      body = { data: KINDS, meta: { limit: 50 } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return Object.assign(m, { reads });
}

/** 期限が今日より前（炎）・今日・先の 3 件（札・並びの試験の行） */
export const dueRows = (today = todayJst()) => [
  item(1, { due_on: "2026-01-05", overdue: true }),
  item(2, { due_on: today }),
  item(3, { due_on: "2099-12-01" }),
];
