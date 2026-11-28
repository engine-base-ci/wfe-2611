// 「項目の変更を版 N に戻す」（K-579）の試験の道具（K-579 の試験だけが読む・2026-11-22）。
//   版と差分の頁（K-449）の口の差し替え versions-mock.ts の mockVersions の上に、口の葉 K-576 の 1 本だけを網の手前で重ねる。答えの形は 11_tickets/K-576.md の「前提と制約」と同じ：
//     POST /api/v1/tickets/:id/item-changes/restore ← { from, to }（頭 Idempotency-Key。from＝比べる元の点の番号・to＝いま見ている点の最新の番号）
//       → 200 { data: { changed, restored: [{ field, name }], skipped: [{ field, name, why }] } }（戻せる物だけ戻し、戻せなかった項目と訳を返す）
//       → 409 E-ITM-001（完了したチケット）・E-ITM-002（先に項目が変えられた・to が最新でない）・E-ITM-003（戻す物が無い）／403／404／503
//   既定の動き（K-576 の「断る順」）：完了なら E-ITM-001 → from が to 以上なら E-ITM-003 → to が最新の点でなければ E-ITM-002 → 差分が空なら E-ITM-003 →
//   差分の行のうち restorable の物を戻した扱い・そうでない物を戻せなかった扱いにして、戻せた物が 1 つでもあれば新しい点（最新の次の番号）を足し、
//   その点の差分（最新 → 新しい点）に、戻した行の from と to を入れ替えた物を入れる。戻せた物が無ければ点は増えない（changed が false）。
//   getTicket・版の一覧・項目の変更を読む口は versions-mock のまま（点が増えれば、読み直しで新しい点が出る）。
//   固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import type { Page, Request, Route } from "@playwright/test";
import { API_RE, TICKET, type Reply } from "../features/F5/approve-complete.harness";
import { DEFAULT_DIFFS, conflict, mockVersions, type DiffRow, type VersionsMock } from "./versions-mock";

export interface RestoreCall {
  body: Record<string, unknown>;
  headers: Record<string, string>;
}
export interface RestoreState {
  /** 戻す口に届いた要求（届いた順） */
  calls: RestoreCall[];
  /** 次の答えを順に差し替える（null・無くなった後は既定の動き） */
  next: (Reply | null)[];
  /** 次の戻すを何回、網ごと切るか */
  abort: number;
  /** 戻す口を処理する前に呼ぶ（n 回目）。別の人の直しや完了を割り込ませる */
  before: ((n: number, m: VersionsMock) => void) | null;
  /** 戻す口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

/** 既定の差分（点 2 → 点 3）の担当者の行（戻せない）。K-576 の答えの skipped に入る */
export const ASSIGNEE_ROW: DiffRow = DEFAULT_DIFFS()["2-3"]![1]!;

const AT_RESTORED = "2026-11-21T02:30:00Z";

function defaultReply(m: VersionsMock, body: Record<string, unknown>): Reply {
  const from = body["from"] as number;
  const to = body["to"] as number;
  const top = Math.max(...m.points.map((p) => p.n));
  if (m.completed) return conflict("E-ITM-001");
  if (from >= to) return conflict("E-ITM-003");
  if (to !== top) return conflict("E-ITM-002");
  const rows = m.diffs[`${from}-${to}`] ?? [];
  if (rows.length === 0) return conflict("E-ITM-003");
  const restored = rows.filter((r) => r.restorable);
  const skipped = rows.filter((r) => !r.restorable);
  if (restored.length > 0) {
    const n = top + 1;
    m.points.push({ n, at: AT_RESTORED, by: "高本", summary: `項目を点 ${from} の形に戻した` });
    m.diffs[`${to}-${n}`] = restored.map((r) => ({ ...r, from: r.to, to: r.from }));
  }
  return {
    status: 200,
    body: {
      data: {
        changed: restored.length > 0,
        restored: restored.map((r) => ({ field: r.field, name: r.name })),
        skipped: skipped.map((r) => ({ field: r.field, name: r.name, why: r.why })),
      },
    },
  };
}

/** 版と差分の頁の口（K-449 の道具）に、項目を戻す口（K-576）を重ねる */
export async function mockItemRestore(
  page: Page,
  o: Parameters<typeof mockVersions>[1] = {},
): Promise<{ m: VersionsMock; r: RestoreState }> {
  const m = await mockVersions(page, o);
  const r: RestoreState = {
    calls: [],
    next: [],
    abort: 0,
    before: null,
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      r.gate = new Promise<void>((res) => (open = res));
      return () => open();
    },
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const u = new URL(req.url());
    if (req.method() !== "POST" || u.pathname !== `/api/v1/tickets/${TICKET}/item-changes/restore`)
      return route.fallback();
    const body = req.postDataJSON() as Record<string, unknown>;
    r.calls.push({ body, headers: req.headers() });
    const n = r.calls.length;
    await r.gate;
    if (r.abort > 0) {
      r.abort -= 1;
      return route.abort("failed");
    }
    r.before?.(n, m);
    const reply = r.next.shift() ?? defaultReply(m, body);
    return route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  return { m, r };
}
