// K-378「共有の試験 k144-contract.test.ts に葉が足す分を、葉ごとのファイル（k144.d/K-<番号>.ts）から読む」の単体の試験（DB は使わない）。
// 名前の頭の行 ID（K378-KL-…）は 11_tickets/K-378.md の表の行に 1 対 1 で結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   見るもの：読む所（./k144-leaves.ts の readK144Leaves・late。作る段で作る）の決まりと、本体（./k144-contract.test.ts）のつなぎと前からの行。
//   作りものの置き場は OS の一時の置き場に作り、葉のファイルは型の字を使わない素の書き方で置く（後片付けで消す）。
//   読む所は試験の本体で読む（実装の前の smoke で、まだ無いファイルを準備で読んで準備ごと落とさない・answer=8f745003d023）。
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture } from "../fixture.js";
import type { K144Base, K144Kit, K144Leaves, K144UuidCase } from "./k144.d/_base.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BODY = join(HERE, "k144-contract.test.ts");
const PLACE = join(HERE, "k144.d");
// 置き場の説明のファイルの名前。字のまま 1 つに書くと、範囲の検査（ci_scope.py の no_test_path_reads）が根の同じ名前の文書を読む試験と数えるので、分けて書く
const README = ["README", "md"].join(".");
const OWN_LEAF = "K-378.ts"; // この葉のつなぎの確かめのファイル（本体の回の中で流れる）
// 本体の回の中で流れる行。この置き場の試験の題には書かない（題に在ると、本体が葉だけの試験を流さなくても「流れた」に数えられる）
const OWN_ROW = "K378-KL-019";

interface Loader {
  K144LeafError: new (message?: string) => Error;
  readK144Leaves: (base: K144Base, dir?: string) => Promise<K144Leaves>;
  late: <T extends object>(get: () => T | undefined) => T;
}
const loader = async (): Promise<Loader> => (await import(join(HERE, "k144-leaves.ts"))) as Loader;
// 1 本の試験が作りものの置き場をいくつも読む。台が混んでも時間で落ちないよう、上限に余裕を持たせる（固定の待ちは使わない）
vi.setConfig({ testTimeout: 30_000 });

// ---- 作りものの置き場
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

interface Tmp {
  dir: string;
  base: K144Base;
}
/** 作りものの本体：行 801（baseOp の :id）と、体 baseOp と、本体だけの試験の題 802 を持つ */
const BASE_ROWS: readonly K144UuidCase[] = [["K144-API-801", "baseOp", "path", "id"]];
const BASE_TEXT = [
  "export const UUID_PARAM_CASES = [",
  '  ["K144-API-801", "baseOp", "path", "id"],',
  "] as const;",
  'it("K144-API-802 本体だけの試験", () => {});',
  "",
].join("\n");
/** 一時の置き場を作る。files の値が null の名前はフォルダにする */
const place = (files: Record<string, string | null>): Tmp => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "k378-")));
  made.push(root);
  const dir = join(root, "k144.d");
  mkdirSync(dir);
  for (const [name, text] of Object.entries(files)) {
    if (text === null) mkdirSync(join(dir, name));
    else writeFileSync(join(dir, name), text);
  }
  const file = join(root, "body.ts");
  writeFileSync(file, BASE_TEXT);
  return { dir, base: { file, UUID_PARAM_CASES: BASE_ROWS, BODIES: { baseOp: { note: "本体の体" } } } };
};
const read = async (t: Tmp): Promise<K144Leaves> => (await loader()).readK144Leaves(t.base, t.dir);

// ---- 葉のファイルの字（作りもの）
const row = (id: number, op: string, where = "path", name = "id") =>
  `    ["K144-API-${id}", "${op}", "${where}", "${name}"],`;
const rows = (...r: string[]) => `  UUID_PARAM_CASES: [\n${r.join("\n")}\n  ],`;
const leaf = (...parts: string[]) => `export const leaf = {\n${parts.join("\n")}\n};\n`;
const OK = leaf("  setup: () => {},");

/** 止まること：読む所の誤り（K144LeafError）で断り、文に words が全部入る */
const stops = async (t: Tmp, ...words: string[]) => {
  const { K144LeafError, readK144Leaves } = await loader();
  const e = await readK144Leaves(t.base, t.dir).then(
    () => null,
    (x: unknown) => x,
  );
  const inside = existsSync(t.dir) ? readdirSync(t.dir).join("・") : "置き場が無い";
  expect(e, `止まらずに読めたか、読む所の誤りでない物で落ちた（${inside}）：${String(e)}`).toBeInstanceOf(
    K144LeafError,
  );
  for (const w of words) expect((e as Error).message, `文に ${w} が無い`).toContain(w);
};

// ---- 本体の字から拾う物（本物の置き場を読むときの本体の行と体）
const UUID_ROW = /\["(K144-API-\d{3})",\s*"(\w+)",\s*"(path|query)",\s*"(\w+)"\]/g;
const rowsIn = (text: string): K144UuidCase[] =>
  [...text.matchAll(UUID_ROW)].map((m) => [m[1]!, m[2]!, m[3] as "path" | "query", m[4]!] as const);
const bodyText = () => readFileSync(BODY, "utf8");
const bodyRows = (text: string) => rowsIn(/UUID_PARAM_CASES = \[(.*?)\] as const;/s.exec(text)?.[1] ?? "");
const bodyBodies = (text: string) => {
  const inner = /const BODIES: Record<string, unknown> = \{(.*?)\n\};/s.exec(text)?.[1] ?? "";
  return [...inner.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]!);
};
const leafNames = () =>
  readdirSync(PLACE)
    .filter((n) => /^K-[1-9]\d*\.ts$/.test(n))
    .sort((a, b) => Number(a.slice(2, -3)) - Number(b.slice(2, -3)));

// 本線（588dcab2）の本体が持つ行と体。K-378 は 1 つも減らさない
const BODY_ROWS: readonly K144UuidCase[] = [
  ["K144-API-022", "getTicket", "path", "id"],
  ["K144-API-023", "updateConversation", "path", "id"],
  ["K144-API-024", "deleteConversation", "path", "id"],
  ["K144-API-026", "listMembers", "query", "scope_id"],
  ["K144-API-027", "listScopes", "query", "layer_id"],
  ["K144-API-028", "listAuditEvents", "query", "member_id"],
  ["K144-API-029", "listAuditEvents", "query", "ticket_id"],
  ["K144-API-046", "delegateTicket", "path", "id"],
  ["K144-API-047", "getActionRun", "path", "id"],
  ["K144-API-048", "listTicketRuns", "path", "id"],
  ["K144-API-049", "listTicketRuns", "query", "scope_id"],
  ["K144-API-050", "reportJobProgress", "path", "id"],
  ["K144-API-051", "getJobControl", "path", "id"],
  ["K144-API-052", "callKanameTool", "path", "id"],
  ["K144-API-053", "finishBridgeJob", "path", "id"],
  ["K144-API-056", "getApproval", "path", "id"],
  ["K144-API-057", "approveApproval", "path", "id"],
  ["K144-API-054", "returnApproval", "path", "id"],
  ["K144-API-055", "completeTicket", "path", "id"],
  ["K144-API-058", "listSetupTasks", "query", "scope_id"],
  ["K144-API-059", "renamePasskey", "path", "id"],
  ["K144-API-060", "deletePasskey", "path", "id"],
];
const BODY_BODIES = [
  "updateConversation",
  "reportJobProgress",
  "finishBridgeJob",
  "returnApproval",
  "completeTicket",
  "renamePasskey",
];

describe("K-378 ① 置き場を読む：番号の順に読み、葉の行・体・準備・葉だけの試験を足し合わせる", () => {
  it("K378-KL-001 番号の順（K-3 は K-12 の前）に読む：files は葉のファイルだけ（説明・土台・隠しファイルは数えず、土台は読み込まない）。行は葉の分だけがファイルの順・書いた順に並び、体は足し合わさる", async () => {
    const t = place({
      "K-12.ts": leaf(rows(row(812, "opTwelve", "query", "scope_id")), "  BODIES: { opTwelve: { n: 12 } },"),
      "K-3.ts": leaf(rows(row(811, "opThree"), row(813, "opThreeB")), "  BODIES: { opThree: { n: 3 } },"),
      [README]: "# 作りものの置き場\n",
      "_base.ts": 'throw new Error("土台は読み込まない");\n',
      ".DS_Store": "",
    });
    const got = await read(t);
    expect(got.files).toEqual(["K-3.ts", "K-12.ts"]);
    expect(got.UUID_PARAM_CASES).toEqual([
      ["K144-API-811", "opThree", "path", "id"],
      ["K144-API-813", "opThreeB", "path", "id"],
      ["K144-API-812", "opTwelve", "query", "scope_id"],
    ]);
    expect(got.BODIES).toEqual({ opThree: { n: 3 }, opTwelve: { n: 12 } });
  });

  it("K378-KL-002 準備（setup）は番号の順に、1 つ終わってから次を呼び、渡した土台をそのまま渡す。葉だけの試験（tests）も番号の順に呼び、渡した道具をそのまま渡す", async () => {
    const t = place({
      "K-12.ts": leaf(
        '  setup: (f) => {\n    f.log.push("K-12");\n  },',
        '  tests: (k) => {\n    k.log.push("K-12");\n  },',
      ),
      "K-3.ts": leaf(
        '  setup: async (f) => {\n    f.log.push("K-3 始め");\n    await null;\n    await null;\n    f.log.push("K-3 終わり");\n  },',
        '  tests: (k) => {\n    k.log.push("K-3");\n  },',
      ),
    });
    const got = await read(t);
    const f = { log: [] as string[] };
    await expect(got.setup(f as unknown as Fixture)).resolves.toBeUndefined();
    expect(f.log).toEqual(["K-3 始め", "K-3 終わり", "K-12"]);
    const k = { log: [] as string[] };
    got.tests(k as unknown as K144Kit);
    expect(k.log).toEqual(["K-3", "K-12"]);
  });

  it("K378-KL-003 葉が 1 つも無い置き場（説明と土台だけ）：止まらず、files・行は空の並び、体は空。準備と葉だけの試験は何もしないで終わる", async () => {
    const t = place({ [README]: "# 空の置き場\n", "_base.ts": "export {};\n" });
    const got = await read(t);
    expect(got.files).toEqual([]);
    expect(got.UUID_PARAM_CASES).toEqual([]);
    expect(got.BODIES).toEqual({});
    await expect(got.setup({} as unknown as Fixture)).resolves.toBeUndefined();
    expect(() => got.tests({} as unknown as K144Kit)).not.toThrow();
  });
});

describe("K-378 ② 置き場の決まりに合わない物は、黙って飛ばさずに止める", () => {
  it("K378-KL-004 名前の決まり：K-<数字>.ts（0 で始めない）・土台・説明のほかの名前のファイルと、中のフォルダは止める（文にその名前）", async () => {
    for (const bad of ["extra.ts", "k-1.ts", "K-01.ts", "K-0.ts", "K-2.test.ts", "K-2.js", "K-2.tsx", "K-2.ts.bak"]) {
      await stops(place({ "K-5.ts": OK, [bad]: OK }), bad);
    }
    await stops(place({ "K-5.ts": OK, "K-2.ts": null }), "K-2.ts");
    await stops(place({ "K-5.ts": OK, sub: null }), "sub");
    // 決まりに合う名前だけなら読める（上の赤が、いつも止まるせいでないこと）
    expect((await read(place({ "K-5.ts": OK, "K-2.ts": OK }))).files).toEqual(["K-2.ts", "K-5.ts"]);
  });

  it("K378-KL-005 同じ行 ID が 2 つの葉のファイルに在れば止める（文に 2 つのファイルの名前と行 ID）", async () => {
    await stops(
      place({ "K-7.ts": leaf(rows(row(821, "opSeven"))), "K-8.ts": leaf(rows(row(821, "opEight"))) }),
      "K-7.ts",
      "K-8.ts",
      "K144-API-821",
    );
  });

  it("K378-KL-006 行 ID は本体と置き場の全部で 1 つ：本体の行と同じ ID・本体だけの試験の題と同じ ID・別の葉の葉だけの試験の題と同じ ID・同じ葉の中の行と題で同じ ID は止める（文に行 ID と葉のファイルの名前）", async () => {
    await stops(place({ "K-7.ts": leaf(rows(row(801, "opSeven"))) }), "K144-API-801", "K-7.ts");
    await stops(place({ "K-7.ts": leaf(rows(row(802, "opSeven"))) }), "K144-API-802", "K-7.ts");
    const titled = (id: number) =>
      `  tests: () => {\n    const title = "K144-API-${id} 葉だけの試験";\n    void title;\n  },`;
    await stops(
      place({ "K-7.ts": leaf(titled(822)), "K-8.ts": leaf(rows(row(822, "opEight"))) }),
      "K144-API-822",
      "K-7.ts",
      "K-8.ts",
    );
    await stops(place({ "K-7.ts": leaf(rows(row(823, "opSeven")), titled(823)) }), "K144-API-823", "K-7.ts");
    // 別の ID なら、行と葉だけの試験の題を同じ葉が持てる
    expect((await read(place({ "K-7.ts": leaf(rows(row(824, "opSeven")), titled(825)) }))).files).toEqual(["K-7.ts"]);
  });

  it("K378-KL-007 同じ口の同じ値（口・道か問い合わせか・値の名前）の行が 2 か所に在れば止める：本体と葉・葉と葉（文に口と値の名前）。同じ口でも値が違えば読める", async () => {
    await stops(place({ "K-7.ts": leaf(rows(row(831, "baseOp"))) }), "baseOp", "K-7.ts");
    await stops(
      place({
        "K-7.ts": leaf(rows(row(832, "opA", "query", "scope_id"))),
        "K-8.ts": leaf(rows(row(833, "opA", "query", "scope_id"))),
      }),
      "opA",
      "scope_id",
      "K-7.ts",
      "K-8.ts",
    );
    const ok = await read(
      place({ "K-7.ts": leaf(rows(row(834, "opA"))), "K-8.ts": leaf(rows(row(835, "opA", "query", "scope_id"))) }),
    );
    expect(ok.UUID_PARAM_CASES).toHaveLength(2);
  });

  it("K378-KL-008 体（BODIES）の同じ鍵が 2 か所に在れば止める：本体と葉・葉と葉（文に鍵とファイルの名前）", async () => {
    await stops(place({ "K-7.ts": leaf("  BODIES: { baseOp: { a: 1 } },") }), "baseOp", "K-7.ts");
    await stops(
      place({ "K-7.ts": leaf("  BODIES: { opB: { a: 1 } },"), "K-8.ts": leaf("  BODIES: { opB: { a: 2 } },") }),
      "opB",
      "K-7.ts",
      "K-8.ts",
    );
  });

  it("K378-KL-009 葉の形：leaf を出さない・leaf のほかも出す（default も）・leaf が入れ物でない・知らない鍵・鍵が 1 つも無い・準備や葉だけの試験が関数でない・行や体の形が違う、は止める（文にファイルの名前）", async () => {
    const bad: Record<string, string> = {
      "leaf を出さない": "export const other = { setup: () => {} };\n",
      ほかの名前も出す: `${OK}export const extra = 1;\n`,
      "default も出す": `${OK}export default {};\n`,
      "leaf が並び": "export const leaf = [];\n",
      "leaf が null": "export const leaf = null;\n",
      知らない鍵: leaf("  UUID_PARAMS: [],"),
      "鍵が 1 つも無い": "export const leaf = {};\n",
      "setup が関数でない": leaf('  setup: "x",'),
      "tests が関数でない": leaf("  tests: 1,"),
      "BODIES が並び": leaf("  BODIES: [],"),
      "BODIES が null": leaf("  BODIES: null,"),
      行が並びでない: leaf("  UUID_PARAM_CASES: {},"),
    };
    for (const [why, text] of Object.entries(bad)) {
      const t = place({ "K-9.ts": text });
      await stops(t, "K-9.ts").catch((e: unknown) => {
        throw new Error(`${why}：${e instanceof Error ? e.message : String(e)}`);
      });
    }
    await stops(place({ "K-9.ts": leaf("  UUID_PARAMS: [],") }), "K-9.ts", "UUID_PARAMS");
    await stops(place({ "K-9.ts": `${OK}export const extra = 1;\n` }), "K-9.ts", "extra");
  });

  it("K378-KL-010 行の形：4 つの字でない・道か問い合わせかが path／query でない・行 ID が K144-API-<3 けた> でない、は止める（文にファイルの名前）", async () => {
    const bad: Record<string, string> = {
      "3 つしか無い": '    ["K144-API-841", "opC", "path"],',
      "5 つ在る": '    ["K144-API-841", "opC", "path", "id", "x"],',
      "path でも query でもない": '    ["K144-API-841", "opC", "body", "id"],',
      値の名前が字でない: '    ["K144-API-841", "opC", "path", 5],',
      "行 ID が 2 けた": '    ["K144-API-84", "opC", "path", "id"],',
      "行 ID が 4 けた": '    ["K144-API-8411", "opC", "path", "id"],',
      "行 ID の頭が違う": '    ["K145-API-841", "opC", "path", "id"],',
    };
    for (const [why, line] of Object.entries(bad)) {
      await stops(place({ "K-9.ts": leaf(rows(line)) }), "K-9.ts").catch((e: unknown) => {
        throw new Error(`${why}：${e instanceof Error ? e.message : String(e)}`);
      });
    }
  });

  it("K378-KL-011 行は字のまま書く：字から拾った行（契約の形の検査 K144-SHAPE-017 と同じ拾い方）と、動く行が同じでなければ止める（組み立てた行・注にした行）。字のまま書いた行は読める", async () => {
    const built =
      'const id = "K144-API-" + "851";\nexport const leaf = {\n  UUID_PARAM_CASES: [[id, "opD", "path", "id"]],\n};\n';
    await stops(place({ "K-9.ts": built }), "K-9.ts");
    const commented = leaf(rows(row(852, "opD"), '    // ["K144-API-853", "opE", "path", "id"],'));
    await stops(place({ "K-9.ts": commented }), "K-9.ts");
    const plain = await read(
      place({
        "K-9.ts": leaf(rows(`${row(854, "opD")} // K-9（行の後ろの注）`, row(855, "opE", "query", "ticket_id"))),
      }),
    );
    expect(plain.UUID_PARAM_CASES).toEqual([
      ["K144-API-854", "opD", "path", "id"],
      ["K144-API-855", "opE", "query", "ticket_id"],
    ]);
  });

  it("K378-KL-012 壊れた葉：字が閉じていない・読み込みの途中で落ちる、は読む所の誤りで止める（文にファイルの名前。生の例外をそのまま投げない）", async () => {
    await stops(place({ "K-9.ts": "export const leaf = {\n" }), "K-9.ts");
    await stops(place({ "K-9.ts": `throw new Error("K-378 の試験：読み込みで落ちる");\n${OK}` }), "K-9.ts");
  });

  it("K378-KL-013 置き場のフォルダが無い：読む所の誤りで止める（空の置き場と取り違えない）", async () => {
    const t = place({});
    await stops({ ...t, dir: join(t.dir, "無いフォルダ") });
  });
});

describe("K-378 ③ 準備で入る値を、読む時に取りに行く（late）", () => {
  it("K378-KL-014 late の返す物は、中を読んだ時の今の値を返す（入れ替えた後は新しい値・関数も呼べる）。値がまだ無い時に中を読むと読む所の誤りで止まる", async () => {
    const { late, K144LeafError } = await loader();
    let cur: { id: string; hello: () => string } | undefined;
    const view = late(() => cur);
    expect(() => view.id).toThrow(K144LeafError);
    cur = { id: "a", hello: () => "こんにちは a" };
    expect(view.id).toBe("a");
    expect(view.hello()).toBe("こんにちは a");
    cur = { id: "b", hello: () => "こんにちは b" };
    expect(view.id).toBe("b");
    expect(view.hello()).toBe("こんにちは b");
  });
});

describe("K-378 ④ 本物の置き場と本体", () => {
  it("K378-KL-015 本物の置き場（k144.d）は、今ある葉のファイルが全部読める：files は置き場の K-<数字>.ts の全部（番号の順）で、行の数は葉のファイルの字から数えた数と同じ。置き場を省いて呼んでも同じ。土台と説明が在る", async () => {
    const text = bodyText();
    const base: K144Base = {
      file: BODY,
      UUID_PARAM_CASES: bodyRows(text),
      BODIES: Object.fromEntries(bodyBodies(text).map((k) => [k, {}])),
    };
    const { readK144Leaves } = await loader();
    const got = await readK144Leaves(base, PLACE);
    const names = leafNames();
    expect(got.files).toEqual(names);
    const written = names.flatMap((n) => rowsIn(readFileSync(join(PLACE, n), "utf8")));
    expect(got.UUID_PARAM_CASES).toEqual(written);
    expect((await readK144Leaves(base)).files).toEqual(names);
    const all = readdirSync(PLACE);
    expect(all).toContain("_base.ts");
    expect(all).toContain(README);
  });

  it("K378-KL-018 置き場に、この葉のつなぎの確かめのファイル（K-378.ts）が在る：出すのは leaf だけで鍵は setup と tests・入口の uuid の行と体を持たない・試験の土台を値で読み込まない・本体の回の中で流れる行の題をちょうど 1 つ持つ", () => {
    expect(leafNames()).toContain(OWN_LEAF);
    const own = readFileSync(join(PLACE, OWN_LEAF), "utf8");
    expect(own).toMatch(/^export const leaf: K144Leaf = \{$/m);
    expect(own.match(/^export /gm) ?? []).toHaveLength(1);
    expect(own).toMatch(/^ {2}setup: /m);
    expect(own).toMatch(/^ {2}tests: /m);
    expect(rowsIn(own)).toEqual([]);
    expect(own).not.toMatch(/^ {2}(UUID_PARAM_CASES|BODIES)\b/m);
    // 試験の土台（DB の住所を読み込みの時に読む）は値で読み込まない。型は _base.ts から
    expect([...own.matchAll(/^import (type )?.* from "([^"]+)";$/gm)].map((m) => `${m[1] ?? ""}${m[2]}`)).toEqual([
      "vitest",
      "type ./_base.js",
    ]);
    // 本体の回の中で流れる行（CI は、この題の試験が本体の回で通ったかで判定する。本体が葉だけの試験を並べなければ「流れていない」になる）
    expect(own.match(new RegExp(`\\bit\\("${OWN_ROW} `, "g")) ?? []).toHaveLength(1);
  });

  it("K378-KL-016 本体の前からの行は 1 つも減っていない：入口の uuid の行 23・体の鍵 7・行 ID 001〜060（行と試験の題の頭）が本体に全部在る", () => {
    const text = bodyText();
    const have = bodyRows(text).map((r) => r.join(" "));
    for (const r of BODY_ROWS) expect(have, `本体の行 ${r.join(" ")} が無い`).toContain(r.join(" "));
    const keys = bodyBodies(text);
    for (const k of BODY_BODIES) expect(keys, `本体の体 ${k} が無い`).toContain(k);
    const ids = new Set([...text.matchAll(/["'`](K144-API-\d{3})\b/g)].map((m) => m[1]));
    const lost = Array.from({ length: 60 }, (_x, i) => `K144-API-${String(i + 1).padStart(3, "0")}`).filter(
      (id) => !ids.has(id),
    );
    expect(lost).toEqual([]);
  });

  it("K378-KL-017 本体が置き場を読む（字で見る）：集める時に 1 回だけ読み、入口の uuid の行は本体の行の後ろに葉の行を足して回り、体は本体に無ければ葉の体を使い、準備は土台を作った後・会社を作る前に葉の準備を呼び、葉だけの試験に本体の手助けを渡す", () => {
    const text = bodyText();
    expect(text).toMatch(/import \{[^}]*\breadK144Leaves\b[^}]*\} from "\.\/k144-leaves\.js";/);
    // ① 集める時に 1 回だけ読む（本体のファイルの道・本体の行・本体の体を渡す）
    expect(text.match(/readK144Leaves\(/g) ?? []).toHaveLength(1);
    const call = /^const LEAVES = await readK144Leaves\(\{([^}]*)\}\);/m.exec(text);
    expect(call, "const LEAVES = await readK144Leaves({ … }); が無い").not.toBeNull();
    for (const w of ["file: fileURLToPath(import.meta.url)", "UUID_PARAM_CASES", "BODIES"])
      expect(call?.[1]).toContain(w);
    // ② 入口の uuid の行：本体の行の後ろに葉の行
    expect(text).toContain("for (const [row, op, where, name] of [...UUID_PARAM_CASES, ...LEAVES.UUID_PARAM_CASES]) {");
    // ③ 体：本体に無ければ葉の体
    expect(text).toContain("BODIES[op] ?? LEAVES.BODIES[op] ?? {}");
    // ④ 準備：土台を作った後・会社を作る前に 1 回
    const made0 = text.indexOf("f = await makeFixture(");
    const setup = text.indexOf("await LEAVES.setup(f);");
    const company = text.indexOf("T = await f.company(");
    expect(made0).toBeGreaterThan(-1);
    expect(setup).toBeGreaterThan(made0);
    expect(company).toBeGreaterThan(setup);
    expect(text.match(/LEAVES\.setup\(/g) ?? []).toHaveLength(1);
    // ⑤ 葉だけの試験：本体の手助けを渡す。準備で入る値（f・T・writer・mate）は late で包む
    expect(text.match(/LEAVES\.tests\(/g) ?? []).toHaveLength(1);
    const kit = /^LEAVES\.tests\(\{([\s\S]*?)\n\}\);/m.exec(text)?.[1] ?? "";
    for (const n of ["f", "T", "writer", "mate"])
      expect(kit, `${n} を late で包んでいない`).toContain(`${n}: late(() => ${n})`);
    expect(kit).toContain("pcToken: () => pcToken");
    for (const n of ["def", "json", "conforms", "fields", "uuidReason", "count", "hit"])
      expect(kit, `手助け ${n} を渡していない`).toMatch(new RegExp(`(^|[\\s,{])${n},`, "m"));
  });
});
