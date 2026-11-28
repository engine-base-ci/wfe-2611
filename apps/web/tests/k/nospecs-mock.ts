// 「AI に任せる」で確認項目が 0 件のときの小窓（K-573）の試験の道具（K-573 が持つ）。
//   詳細と帯は前からの土台 tests/features/F5/approve-complete.harness.ts の mockApi（getTicket・実行の一覧・自分の情報）。
//   その上に、次の 2 つだけを網の手前で重ねる：
//     GET  /api/v1/tickets/:id         … K-560 が足す spec_count・no_spec_reason を載せる（spec_count を持たない前の口の答えも作れる）
//     POST /api/v1/tickets/:id/delegate … K-565：← {}（確認項目が 1 件以上）か { no_spec_reason }（0 件・使わない理由）
//          → 201 { data: { run_id, job_id, status, pc } }／409 E-CONF-020（確認項目が 0 件で理由なし）・E-CONF-013（もう走っている）・E-CONF-014・429・503 ほか
//   任せた後は getTicket の答えに「作る段の実行（queued）」が付く（帯が「〇〇のAI に任せました。」に替わる）。
//   「確認項目を足す」の合図（window の kaname:f4:open-spec-add）は、頁に入れた聞き役が detail を控える（window.__specAdd）。
//   本人の Bridge（127.0.0.1:38617）にも届かせない（mockApi が網の手前で止める）。固定の待ちは使わない。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Request, type Route } from "@playwright/test";
import {
  API_RE,
  TICKET,
  mockApi,
  ticketOf,
  withBand,
  type Band,
  type Mock,
  type Reply,
} from "../features/F5/approve-complete.harness";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
export const WIDTHS = [375, 768, 1440] as const;
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
/** 正本（errors.json）の文。画面で文を作らない */
export const msg = (id: string): string => ERRORS.find((e) => e.id === id)?.message ?? `(${id} が errors.json に無い)`;
export { TICKET };
export const RUN_ID = "0193c5a0-0000-7000-8000-0000000e0001";
export const JOB_ID = "0193c5a0-0000-7000-8000-0000000b0001";

export interface NoSpecsMock {
  api: Mock;
  /** getTicket の spec_count。"absent" なら鍵ごと載せない（前の口の答え）・null も作れる */
  specCount: number | null | "absent";
  /** getTicket の no_spec_reason（前に残した理由） */
  noSpecReason: string | null;
  /** 任せる口に飛んだ体（飛んだ順） */
  delegates: Record<string, unknown>[];
  ticketReads: number;
  /** 次の任せる口の答えを順に差し替える（空なら 201） */
  next: Reply[];
  /** 任せた後（作る段の実行が付く） */
  started: boolean;
  /** 任せる口以外の書く口（POST・PATCH・PUT・DELETE） */
  otherWrites: string[];
  /** 任せる口の答えを止めておく。返した関数を呼ぶと答える（時間で待たない） */
  hold: () => () => void;
  gate: Promise<void>;
}

export async function mockNoSpecs(
  page: Page,
  o: Partial<Pick<NoSpecsMock, "specCount" | "noSpecReason">> & { band?: Band } = {},
): Promise<NoSpecsMock> {
  const band: Band = o.band ?? { stage: "doing", can_delegate: true };
  const api = await mockApi(page, band);
  const m: NoSpecsMock = {
    api,
    specCount: o.specCount === undefined ? 0 : o.specCount,
    noSpecReason: o.noSpecReason ?? null,
    delegates: [],
    ticketReads: 0,
    next: [],
    started: false,
    otherWrites: [],
    gate: Promise.resolve(),
    hold: () => {
      let open = () => {};
      m.gate = new Promise<void>((r) => (open = r));
      return () => open();
    },
  };
  await page.addInitScript(() => {
    (window as unknown as { __specAdd: unknown[] }).__specAdd = [];
    window.addEventListener("kaname:f4:open-spec-add", (e) =>
      (window as unknown as { __specAdd: unknown[] }).__specAdd.push((e as CustomEvent).detail),
    );
  });
  api.on.ticket = () => {
    const b: Band = m.started ? { ...band, run: { phase: "make", status: "queued", pc: "live" } } : band;
    return {
      status: 200,
      body: {
        data: withBand(b, {
          ...(ticketOf(b) as unknown as Record<string, unknown>),
          ...(m.specCount === "absent" ? {} : { spec_count: m.specCount, spec_unchecked: m.specCount }),
          no_spec_reason: m.noSpecReason,
        }),
      },
    };
  };
  await page.route(API_RE, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    const get = req.method() === "GET";
    const fulfill = (r: Reply) =>
      route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
    if (get && p === `/api/v1/tickets/${TICKET}`) {
      m.ticketReads += 1;
      return route.fallback();
    }
    if (req.method() === "POST" && p === `/api/v1/tickets/${TICKET}/delegate`) {
      m.delegates.push(req.postDataJSON() as Record<string, unknown>);
      await m.gate;
      const r = m.next.shift() ?? {
        status: 201,
        body: { data: { run_id: RUN_ID, job_id: JOB_ID, status: "queued", pc: "live" } },
      };
      // 任せられた（201）か、もう走っていた（E-CONF-013）なら、作る段の実行が付いた形にする
      if (r.status === 201 || (r.body as { code?: string }).code === "E-CONF-013") m.started = true;
      return fulfill(r);
    }
    if (!get && !/\/auth\//.test(p)) m.otherWrites.push(`${req.method()} ${p}`);
    return route.fallback();
  });
  return m;
}

// ---------------------------------------------------------------- 断りの答え
const err = (status: number, error: string, code: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error, code, ...extra },
});
/** 確認項目が 0 件で理由なし（K-565・体に field・details を付けない） */
export const noSpec = (): Reply => err(409, "conflict", "E-CONF-020", { message: msg("E-CONF-020") });
export const running = (): Reply => err(409, "conflict", "E-CONF-013", { message: msg("E-CONF-013"), run_id: RUN_ID });
export const wrongStage = (): Reply => err(409, "conflict", "E-CONF-014", { message: msg("E-CONF-014") });
export const noPc = (): Reply => err(409, "conflict", "E-CONN-001", { message: msg("E-CONN-001") });
export const failed = (): Reply => err(503, "server_error", "E-PAGE-003");
export const tooMany = (sec: number): Reply => err(429, "rate_limited", "RATE_LIMITED", { retry_after_sec: sec });

// ---------------------------------------------------------------- 画面の道具
/** チケットの詳細を開き、帯「AI に任せる」が出るまで待つ */
export async function openDetail(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
  expect((await page.goto(`/tickets/${TICKET}`))?.status()).toBe(200);
  await expect(page.getByRole("region", { name: "AI に任せる", exact: true })).toBeVisible();
}
export const delegateBtn = (page: Page) => page.getByRole("button", { name: "AI に任せる", exact: true });
/** 小窓（題「AI に任せる」。帯の region 名と同じ字なので、dialog の役で探す） */
export const dlg = (page: Page) => page.getByRole("dialog");
export const reasonBox = (page: Page) =>
  dlg(page).getByRole("textbox", { name: "確認項目を使わない理由", exact: true });
export const goBtn = (page: Page) => dlg(page).getByRole("button", { name: "理由を書いて任せる", exact: true });
export const addBtn = (page: Page) => dlg(page).getByRole("button", { name: "確認項目を足す", exact: true });
export const quitBtn = (page: Page) => dlg(page).getByRole("button", { name: "やめる", exact: true });
export const specAddSignals = (page: Page): Promise<unknown[]> =>
  page.evaluate(() => (window as unknown as { __specAdd: unknown[] }).__specAdd);
export const noOverflow = async (page: Page, w: number): Promise<void> => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, `幅 ${w} の横溢れ`).toBe(0);
};
