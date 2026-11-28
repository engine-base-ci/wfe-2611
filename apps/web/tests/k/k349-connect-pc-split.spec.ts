// K-349「『PC と使った量』の画面の入れ物 connect-pc.tsx を、区画ごとのファイルに分ける（動きは変えない）」の試験（実装より先に積む）。
//   画面：/setup/bridge（K-57 の features/F3/connect-pc）。見た目も動きも変えない移すだけなので、正は前からの突き合わせの組のまま
//   （bridge-code・bridge-connected・bridge-installed・bridge-shell。前からの試験 k230・k220・connect-pc.spec.ts・fidelity.spec.ts が替えずに緑＝チケットの完了の条件）。
//   この試験が見るのは、この葉で新しく決めた形だけ：
//     字で見る行（K349-SP-…）：区画のファイルと出す名前・connect-pc.tsx は並べるだけ・つなぎの字・行の差す所・一覧を読む所
//     実ブラウザの行（K349-UI-…）：差す所が空のときの行の形・行の data-device・「…」・本文の下の並び・小窓の受け取る段
//   後の葉（K-361・K-363・K-368・K-374・K-375・K-367・K-373）が自分の区画のファイルに中身を足しても通り続けるように、
//     一覧の差し替えは自己診断（health）も AI が使うブラウザ（browser）も持たない行にする（後の葉はこの行に何も差さない）。
//     「…」は押せる・押せないを求めず（K-363 が押せるメニューに替える）、前の画面への文は在れば置き場だけを見る（K-367 が消す）。後の葉はこの試験を替えない。
//   口（API）とこの PC の中だけの口（127.0.0.1:38617）は網の手前で差し替える（本人の Bridge に届かせない）。固定の待ち（waitForTimeout）は使わない。
//   区画のファイルは、字で見る試験の本体で読む（まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
//   テストはチケットを切る人が書き、実装する人は変えない（D-128.125）
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
import { shellData } from "./shell-answer";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "../../features/F3/connect-pc");
const WS = "aaaaaaaa-0000-4000-8000-000000000349";
const ME = "11111111-0000-4000-8000-000000000349";
const BODY = 'section[aria-labelledby="connect-pc-title"]';
const LIST = `${BODY} section[aria-labelledby="pc-list-title"]`;
const SEEN = "2026-11-15T00:00:00Z";
const PASSED = "この PC の Bridge にコードを渡しました。アプリからの返事を待っています…";
const LEGACY_TEXT =
  "Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、前の設定の画面で行えます。";

// ---- 字で見る行の道具

/** 区画のファイルの字（注を除く：/* … *\/ と、行の頭からの // の行）。無いファイルは空の字 */
function code(name: string): string {
  const path = join(DIR, name);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}
/** 字 needle が s に何回在るか */
const count = (s: string, needle: string): number => s.split(needle).length - 1;

/** 区画のファイルと、そこから出す名前（チケットの「区画のファイルと持ち主」の表と同じ） */
const EXPORTS: readonly (readonly [file: string, kind: string, name: string])[] = [
  ["connect-pc.tsx", "function|const", "ConnectPc"],
  ["safe-from.ts", "function|const", "safeFrom"],
  ["use-connect-pc.ts", "function|const", "useConnectPc"],
  ["pc-frame.tsx", "function|const", "PcFrame"],
  ["pc-foot.tsx", "function|const", "PcFoot"],
  ["pc-row-extra.tsx", "function|const", "usePcRowExtra"],
  ["pc-row-extra.tsx", "interface|type", "PcRowCtx"],
  ["pc-row-more.tsx", "function|const", "usePcRowMore"],
  ["take-help.tsx", "function|const", "useTakeHelp"],
  ["pc-cards.tsx", "function|const", "PcList"],
];
/** connect-pc.tsx が直に書かない React の hook（状態・effect・処理は use-connect-pc.ts と区画の hook が持つ） */
const STATE_HOOKS = ["useState", "useEffect", "useCallback", "useRef"] as const;
/** 並べる所が呼ぶ 4 つの hook（呼ぶ順もこのとおり：受け取る段の差す物 → 画面の状態 → 行の差す物 2 つ） */
const WIRE_HOOKS = ["useTakeHelp(", "useConnectPc(", "usePcRowExtra(", "usePcRowMore("] as const;

test("K349-SP-001 区画のファイルの一覧：9 つのファイルが在り、それぞれが決めた名前を出している", () => {
  const files = [...new Set(EXPORTS.map(([file]) => file))];
  expect(files).toHaveLength(9);
  expect(
    files.filter((f) => !existsSync(join(DIR, f))),
    "無い区画のファイル",
  ).toEqual([]);
  const missing = EXPORTS.filter(
    ([file, kind, name]) => !new RegExp(`^export\\s+(?:async\\s+)?(?:${kind})\\s+${name}\\b`, "m").test(code(file)),
  ).map(([file, , name]) => `${file}：${name}`);
  expect(missing, "決めた名前を出していない区画").toEqual([]);
});

test("K349-SP-002 connect-pc.tsx は並べるだけ：useState・useEffect・useCallback・useRef を直に書かず（呼ばない・react から読み込まない）、safeFrom は safe-from.ts から出し直す", () => {
  const raw = readFileSync(join(DIR, "connect-pc.tsx"), "utf8");
  expect(raw.trimStart().startsWith('"use client"'), '頭は "use client"').toBe(true);
  const s = code("connect-pc.tsx");
  const called = STATE_HOOKS.filter((h) => new RegExp(`\\b${h}\\s*[<(]`).test(s));
  expect(called, "connect-pc.tsx が直に呼ぶ hook").toEqual([]);
  const fromReact = [...s.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']react["']/g)].flatMap((m) =>
    (m[1] ?? "").split(",").map((x) => x.trim().replace(/^type\s+/, "")),
  );
  expect(
    fromReact.filter((n) => (STATE_HOOKS as readonly string[]).includes(n)),
    "react から読み込む hook",
  ).toEqual([]);
  expect(s, "safeFrom の出し直し（読む側を変えない）").toMatch(
    /export\s*\{\s*safeFrom\s*\}\s*from\s*["']\.\/safe-from["']/,
  );
  expect(s, "safeFrom の中身は connect-pc.tsx に残さない").not.toMatch(/function\s+safeFrom\b/);
});

test("K349-SP-003 並べる所のつなぎ：4 つの hook をこの順に 1 回ずつ呼び（最初の <PcFrame より前）、renderExtra=・renderMore=・takeHelp= と <PcFoot が 1 回ずつ。「…」の置き場は more を行に・above を <PcList のすぐ上に", () => {
  const s = code("connect-pc.tsx");
  for (const h of WIRE_HOOKS) expect(count(s, h), `${h} の呼び出しの数`).toBe(1);
  for (const a of ["renderExtra=", "renderMore=", "takeHelp=", "<PcFoot", ".above}"])
    expect(count(s, a), `${a} の数`).toBe(1);
  expect(count(s, "<PcFrame"), "外枠の区画 <PcFrame を使う").toBeGreaterThanOrEqual(1);
  expect(s).toContain("<ConnectDialog");
  // 受け取る段の差す物の onTaken を、画面の状態の hook に渡す
  expect(s, "useConnectPc(from, { onTaken: … })").toMatch(/useConnectPc\(\s*from\s*,\s*\{\s*onTaken\b/);
  // 「…」の置き場（usePcRowMore の返す物）：above は一覧のすぐ上・more は行へ
  expect(s, "above は <PcList のすぐ上に並べる").toMatch(/\{\w+\.above\}\s*<PcList\b/);
  expect(s, "more を renderMore に渡す").toMatch(/renderMore=\{\w+\.more\}/);
  // hook は早い戻り（どれも <PcFrame を返す）より前に、決めた順で呼ぶ
  const at = WIRE_HOOKS.map((h) => s.indexOf(h));
  const firstFrame = s.indexOf("<PcFrame");
  for (const [i, pos] of at.entries())
    expect(pos, `${WIRE_HOOKS[i]} は最初の <PcFrame より前`).toBeLessThan(firstFrame);
  expect(at[0], "useTakeHelp は useConnectPc より前").toBeLessThan(at[1] ?? -1);
  expect(at[1], "useConnectPc は usePcRowExtra より前").toBeLessThan(at[2] ?? -1);
  expect(at[1], "useConnectPc は usePcRowMore より前").toBeLessThan(at[3] ?? -1);
});

test("K349-SP-004 行の差す所（pc-cards.tsx）：PcList が renderExtra・renderMore を受け、行は data-device を持ち、extra は .k-pc-main の最後の子・more が無ければ今の「…」。PC の名前の決まり nameOf を出す", () => {
  const s = code("pc-cards.tsx");
  for (const needle of [
    "renderExtra?:",
    "renderMore?:",
    "extra={renderExtra?.(d)}",
    "more={renderMore?.(d)}",
    "data-device={d.id}",
    "{more ?? <More name={name} />}",
  ])
    expect(count(s, needle), `${needle} の数`).toBe(1);
  expect(s, "PC の名前の決まり nameOf を出す（行の外で名前を出す所が同じ決まりを使う）").toMatch(
    /^export\s+(?:const|function)\s+nameOf\b/m,
  );
  expect(count(s, "{extra}"), "{extra} は切れている行とほかの行の 2 か所").toBe(2);
  expect(s, "切れている行：直し方の箱の後・本文の最後の子").toMatch(
    /<section className="k-pc-main"[\s\S]*?k-pc-wake[\s\S]*?<\/span>\s*\{extra\}\s*<\/section>/,
  );
  expect(s, "ほかの行：補足と読み上げの 1 行の後・本文の最後の子").toMatch(
    /<span className="k-pc-main">[\s\S]*?sr-only[\s\S]*?\{extra\}\s*<\/span>/,
  );
});

test("K349-SP-005 画面の状態の hook（use-connect-pc.ts）：一覧を読み続ける所は 1 つ・読み直し reload は一覧の口をその場で 1 回（時計を足さない）・受け取りに成功した所で onTaken を呼ぶ", () => {
  const s = code("use-connect-pc.ts");
  expect(count(s, "pollDevices("), "一覧を読み続ける所").toBe(1);
  expect(count(s, 'call("listMyDevices"'), "読み直しが一覧の口を直に呼ぶ所").toBe(1);
  expect(count(s, "setTimeout("), "時計はコードの期限の 1 つだけ（読み直しに時計を挟まない）").toBe(1);
  expect(count(s, "reload"), "reload を作って返す").toBeGreaterThanOrEqual(2);
  expect(s, "受け取りに成功した所（setReceived(true) の次）で onTaken を呼ぶ").toMatch(
    /setReceived\(true\);\s*(?:opts\.)?onTaken\?\.\(os\);/,
  );
});

// ---- 実ブラウザの行の道具

type DevState = "live" | "asleep" | "waiting";
interface Dev {
  id: string;
  device_label: string;
  state: DevState;
  last_seen_at: string | null;
  connected_at: string;
  version: string;
}
/** 一覧の差し替え：生きている・切れている・返事待ちの 3 台。自己診断（health）もブラウザ（browser）も持たない＝後の葉は何も差さない */
const DEVS: readonly Dev[] = [
  {
    id: "0349a000-0000-4000-8000-000000000001",
    device_label: "高本の MacBook",
    state: "live",
    last_seen_at: SEEN,
    connected_at: "2026-11-02T03:00:00Z",
    version: "1.4.0",
  },
  {
    id: "0349a000-0000-4000-8000-000000000002",
    device_label: "事務所の Mac mini",
    state: "asleep",
    last_seen_at: SEEN,
    connected_at: "2026-10-28T03:00:00Z",
    version: "1.4.0",
  },
  {
    id: "0349a000-0000-4000-8000-000000000003",
    device_label: "倉庫の Windows",
    state: "waiting",
    last_seen_at: null,
    connected_at: "2026-11-15T03:00:00Z",
    version: "1.4.0",
  },
];
/** 行の本文（.k-pc-main）の直の子。差す所が空なら今と同じ */
const MAIN_KIDS: Record<DevState, readonly string[]> = {
  live: ["span.k-pc-name", "span.k-pc-detail", "span.sr-only"],
  asleep: ["span.k-pc-name", "span.k-pc-detail", "span.k-pc-fix"],
  waiting: ["span.k-pc-name", "span.k-pc-detail"],
};

type Reply = { status: number; body: unknown };
interface Mock {
  devices: readonly Dev[];
  /** この PC で Bridge が動いている（ブラウザ・Bridge の窓の外） */
  installed: boolean;
  downloads: string[];
  codes: number;
  pairs: number;
}
const ok = (data: unknown, meta: Record<string, unknown> = {}): Reply => ({ status: 200, body: { data, meta } });

async function mockApi(page: Page, o: Partial<Pick<Mock, "devices" | "installed">> = {}): Promise<Mock> {
  const m: Mock = { devices: [], installed: false, downloads: [], codes: 0, pairs: 0, ...o };
  // 作り物のログインの印（本物の秘密ではない・前からの k220・k230 と同じ作り方）
  await page.addInitScript((t) => window.localStorage.setItem("kaname.token", t), `tok-${WS}`);
  await page.route(/127\.0\.0\.1:38617/, async (route: Route, req: Request) => {
    if (!m.installed) return route.abort("connectionrefused");
    const cors = {
      "access-control-allow-origin": req.headers()["origin"] ?? "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    const path = new URL(req.url()).pathname;
    if (path === "/pair" && req.method() === "POST") m.pairs += 1;
    const body =
      path === "/ping"
        ? { app: "kaname-bridge", version: "1.4.0", device_label: "この PC", connected: false }
        : { ok: true };
    return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/\/api\/(v1|auth-ext|auth)\//, async (route: Route, req: Request) => {
    const p = new URL(req.url()).pathname;
    let r: Reply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
    if (p === "/api/auth-ext/me")
      r = ok({ member_id: ME, tenant_id: WS, display_name: "高本", role_id: "owner", scope_id: null });
    else if (p === "/api/v1/scopes") r = ok([], { limit: 200, writable: [] });
    else if (p === "/api/v1/shell")
      r = ok(shellData({ groups: [] })); // 外枠の口 getShell（K-466）
    else if (p === "/api/v1/approvals/queue") r = ok([], { limit: 20, counts: { total: 0 }, cursor: null });
    else if (p === "/api/v1/bridge/devices") r = ok(m.devices);
    else if (p === "/api/v1/bridge/pairing-codes" && req.method() === "POST") {
      m.codes += 1;
      r = {
        status: 201,
        body: { data: { code: "KQ7M2X", expires_at: new Date(Date.now() + 600_000).toISOString() } },
      };
    } else {
      const d = /^\/api\/v1\/bridge\/releases\/(\w+)\/file$/.exec(p);
      if (d) {
        m.downloads.push(d[1] ?? "");
        return route.fulfill({ status: 200, contentType: "application/octet-stream", body: "Kaname-Bridge" });
      }
    }
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) });
  });
  return m;
}

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const res = await page.goto("/setup/bridge");
  expect(res?.status()).toBe(200);
}
const rows = (page: Page): Locator => page.locator(`${LIST} .k-pc-row`);
/** 直の子を「タグ.最初のクラス」で並べる */
const kids = (l: Locator): Promise<string[]> =>
  l.evaluate((e) => Array.from(e.children).map((c) => `${c.tagName.toLowerCase()}.${c.classList[0] ?? ""}`));

/** この PC に Bridge が入っている人が「この PC の Bridge につなぐ」を押し、本文のお知らせが出るまで待つ */
async function passToLocalBridge(page: Page): Promise<Mock> {
  const m = await mockApi(page, { installed: true });
  await open(page);
  const connect = page.getByRole("button", { name: "この PC の Bridge につなぐ" });
  await expect(connect).toBeVisible();
  await connect.click();
  await expect(page.locator(`${BODY} .k-pc-note`)).toHaveText(PASSED);
  return m;
}

test("K349-UI-001 差す所が空のとき、行の形は今と同じ：行の直の子は絵・本文・「…」の 3 つ、本文の直の子は生きている／切れている／返事待ちごとに今の並びのまま", async ({
  page,
}) => {
  await mockApi(page, { devices: DEVS });
  await open(page);
  await expect(rows(page)).toHaveCount(DEVS.length);
  for (const [i, d] of DEVS.entries()) {
    const row = rows(page).nth(i);
    const rowKids = await kids(row);
    expect(rowKids, `${d.device_label}：行の直の子の数`).toHaveLength(3);
    expect(rowKids[0], `${d.device_label}：1 つ目は PC の絵`).toBe("span.k-pc-icon");
    expect(rowKids[1], `${d.device_label}：2 つ目は本文`).toMatch(/^(span|section)\.k-pc-main$/);
    await expect(row.locator(":scope > button.k-pc-more"), `${d.device_label}：3 つ目は「…」のボタン`).toHaveCount(1);
    expect(rowKids[2], `${d.device_label}：3 つ目は「…」のボタン`).toMatch(/^button\./);
    expect(await kids(row.locator(":scope > .k-pc-main")), `${d.device_label}（${d.state}）：本文の直の子`).toEqual(
      MAIN_KIDS[d.state],
    );
  }
  // PC が在るので、つなぐ小窓は開かない（コードの口も呼ばない）
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K349-UI-002 行の data-device：どの行も一覧の id を持ち、並びは一覧の順。data-state と名前は同じ行に今のまま在る", async ({
  page,
}) => {
  await mockApi(page, { devices: DEVS });
  await open(page);
  await expect(rows(page)).toHaveCount(DEVS.length);
  const seen = await rows(page).evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-device"), state: e.getAttribute("data-state") })),
  );
  expect(seen).toEqual(DEVS.map((d) => ({ id: d.id, state: d.state })));
  for (const d of DEVS) {
    const row = page.locator(`${LIST} .k-pc-row[data-device="${d.id}"]`);
    await expect(row).toHaveCount(1);
    await expect(row.locator(".k-pc-label")).toHaveText(d.device_label);
  }
});

test("K349-UI-003 行の「…」：どの行にも「…」のボタン（.k-pc-more・名前は「…（<PC の名前> の操作）」）がちょうど 1 つ、行の直の子として在る（押せる・押せないは見ない）", async ({
  page,
}) => {
  await mockApi(page, { devices: DEVS });
  await open(page);
  await expect(rows(page)).toHaveCount(DEVS.length);
  for (const [i, d] of DEVS.entries()) {
    const row = rows(page).nth(i);
    // 名前が「…」で始まるボタンは行に 1 つだけ（今の押せない「…」でも、後の葉の押せるメニューの引き金でも同じ名前）
    const byName = row.getByRole("button", { name: /^…/ });
    await expect(byName, `${d.device_label}：名前が「…」で始まるボタン`).toHaveCount(1);
    await expect(byName).toHaveAttribute("aria-label", `…（${d.device_label} の操作）`);
    await expect(byName).toHaveClass(/(^|\s)k-pc-more(\s|$)/);
    await expect(row.locator(".k-pc-more"), `${d.device_label}：.k-pc-more は行に 1 つ`).toHaveCount(1);
    const direct = await byName.evaluate((e) => e.parentElement?.classList.contains("k-pc-row") ?? false);
    expect(direct, `${d.device_label}：「…」は行の直の子`).toBe(true);
  }
});

test("K349-UI-004 本文の下のお知らせ：この PC の Bridge にコードを渡すと、お知らせ（role=status・.k-pc-note）が 1 つ、本文の箱の直の子で一番最後に出る（つないでいる PC のカードより後ろ）。コードの口とこの PC の口は 1 回ずつ", async ({
  page,
}) => {
  const m = await passToLocalBridge(page);
  const note = page.locator(`${BODY} .k-pc-note`);
  await expect(note).toHaveCount(1);
  await expect(note).toHaveAttribute("role", "status");
  const place = await note.evaluate((e) => {
    const list = document.querySelector('section[aria-labelledby="pc-list-title"]');
    return {
      tag: e.tagName.toLowerCase(),
      parent: e.parentElement?.getAttribute("aria-labelledby") ?? null,
      last: e.nextElementSibling === null,
      afterList: list !== null && (list.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    };
  });
  expect(place).toEqual({ tag: "p", parent: "connect-pc-title", last: true, afterList: true });
  expect(m.codes, "接続のコードの口").toBe(1);
  expect(m.pairs, "この PC の口 /pair").toBe(1);
  // この PC に Bridge が入っているときは、つなぐ小窓を出さない（今のまま）
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("K349-UI-005 前の画面への文の置き場：在れば 1 つだけ、つないでいる PC のカードのすぐ後・お知らせのすぐ前（リンク「前の設定の画面」は /setup/bridge/legacy）。無ければ、お知らせのすぐ前はつないでいる PC のカード", async ({
  page,
}) => {
  await passToLocalBridge(page);
  const legacy = page.locator(`${BODY} .k-pc-legacy`);
  const n = await legacy.count();
  expect(n, "前の画面への文は 0 か 1 つ").toBeLessThanOrEqual(1);
  await expect(page.locator(`${BODY} [data-act="legacy"]`), "リンクは文の数と同じ").toHaveCount(n);
  // お知らせのすぐ前：文が在れば文・無ければつないでいる PC のカード（つながっている PC が無いので、使った量の箱は出ない）
  const before = await page.locator(`${BODY} .k-pc-note`).evaluate((e) => {
    const prev = e.previousElementSibling;
    return {
      legacy: prev?.classList.contains("k-pc-legacy") ?? false,
      list: prev?.getAttribute("aria-labelledby") ?? null,
    };
  });
  expect(before).toEqual(n === 1 ? { legacy: true, list: null } : { legacy: false, list: "pc-list-title" });
  if (n === 1) {
    await expect(legacy).toHaveText(LEGACY_TEXT);
    const link = legacy.getByRole("link", { name: "前の設定の画面" });
    await expect(link).toHaveAttribute("href", "/setup/bridge/legacy");
    await expect(link).toHaveAttribute("data-act", "legacy");
    const place = await legacy.evaluate((e) => ({
      tag: e.tagName.toLowerCase(),
      parent: e.parentElement?.getAttribute("aria-labelledby") ?? null,
      prev: e.previousElementSibling?.getAttribute("aria-labelledby") ?? null,
    }));
    expect(place).toEqual({ tag: "p", parent: "connect-pc-title", prev: "pc-list-title" });
  }
});

test("K349-UI-006 小窓の受け取る段に差す物が無い間：受け取る前の 1 段目の説明の中の要素は受け取るの字のリンク 2 つだけ。「Mac 用」を押すと口が 1 回・丸が ✓・お知らせ「ダウンロードを始めました…」（今のまま）", async ({
  page,
}) => {
  const m = await mockApi(page);
  await open(page);
  const d = page.getByRole("dialog", { name: "PC をつなぐ" });
  await expect(d).toBeVisible();
  await expect(d.getByTestId("pairing-code")).toHaveText("KQ7M2X");
  const step1 = d.locator(".k-steps > li").first();
  expect(await kids(step1.locator(".k-step-desc")), "受け取る前：1 段目の説明の中の要素").toEqual([
    "a.k-pc-take",
    "a.k-pc-take",
  ]);
  await expect(step1.locator(".k-step-dot")).toHaveText("1");
  expect(m.downloads).toEqual([]);
  await step1.getByRole("button", { name: "Mac 用を受け取る" }).click();
  await expect(step1.locator(".k-step-dot")).toHaveText("✓");
  await expect(d.locator(".k-pc-dialog-note")).toHaveText(
    "ダウンロードを始めました。入れて開くと、この画面が自分で気づきます",
  );
  expect(m.downloads, "受け取りの口は 1 回").toEqual(["mac"]);
  expect(m.codes, "接続のコードの口は開いた最初の 1 回").toBe(1);
});
