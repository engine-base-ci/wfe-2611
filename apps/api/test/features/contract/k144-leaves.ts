// 置き場 k144.d を読む所（K-378）：共有の試験 ./k144-contract.test.ts に葉が足す分を、葉ごとのファイル（K-<番号>.ts）から読む。
//   本体は試験を集める時に 1 回だけ readK144Leaves を呼ぶ。葉のファイルの形は ./k144.d/_base.ts、置き方は置き場の説明のファイル。
//   決まりに合わない物は、黙って飛ばさずに K144LeafError で止める（知らない名前・形の違い・行 ID や口と値や体の鍵の重なり）。
//   試験の道具（製品のコードではない）。node の標準の部品だけを使う。
import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Fixture } from "../fixture.js";
import type { K144Base, K144Kit, K144Leaf, K144Leaves, K144UuidCase } from "./k144.d/_base.js";

/** 読む所の誤り（置き場の決まりに合わない・葉が読み込めない・準備で入る値をまだ読めない） */
export class K144LeafError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "K144LeafError";
  }
}

const PLACE = join(dirname(fileURLToPath(import.meta.url)), "k144.d");
/** 葉のファイルの名前：K-<数字>.ts（0 で始めない。K-7 と K-007 を両方置けないように） */
const LEAF_NAME = /^K-([1-9]\d*)\.ts$/;
/** 葉でないが置いてよい物：葉の形の型（土台）と説明。読み込まない */
const NOT_A_LEAF = /^(?:_base\.ts|README\.md)$/;
const KEYS: readonly string[] = ["setup", "UUID_PARAM_CASES", "BODIES", "tests"];
const ROW_ID = /^K144-API-\d{3}$/;
/** 字のまま書いた入口の uuid の行（契約の形の検査 scripts/ci/contract_shape_test.py の K144-SHAPE-017 と同じ拾い方） */
const ROW_IN_TEXT = /\["(K144-API-\d{3})",\s*"(\w+)",\s*"(path|query)",\s*"(\w+)"\]/g;
/** 行 ID の字（入口の uuid の行と、試験の題の頭）。二重引用符で始まる字だけを拾う */
const ID_IN_TEXT = /"(K144-API-\d{3})(?!\d)/g;
const BODY = "本体";

interface Loaded {
  name: string;
  text: string;
  leaf: K144Leaf;
}
type Bag = Record<string, unknown>;

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const isBag = (v: unknown): v is Bag => typeof v === "object" && v !== null && !Array.isArray(v);
const numberOf = (name: string): number => Number(LEAF_NAME.exec(name)?.[1]);
/** ファイルの字を読む。読めなければ、何を読めなかったかを文に出して止める */
const textOf = (path: string, what: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    throw new K144LeafError(`${what}を読めない：${reason(e)}`, { cause: e });
  }
};

/** ① 置き場の中の葉のファイルの名前（番号の小さい順）。知らない名前とフォルダは止める */
const leafNames = (dir: string): string[] => {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    throw new K144LeafError(`置き場 ${dir} が読めない（フォルダが無い）：${reason(e)}`, { cause: e });
  }
  const names: string[] = [];
  const unknown: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue; // 隠しファイル（.DS_Store など）は数えない
    if (e.isFile() && NOT_A_LEAF.test(e.name)) continue;
    if (e.isFile() && LEAF_NAME.test(e.name)) names.push(e.name);
    else unknown.push(e.isDirectory() ? `${e.name}（フォルダ）` : e.name);
  }
  if (unknown.length > 0)
    throw new K144LeafError(
      `置き場 ${dir} に置けない名前が在る：${unknown.join("・")}（置けるのは K-<数字>.ts（0 で始めない）と、土台の型と説明だけ。フォルダは置けない）`,
    );
  return names.sort((a, b) => numberOf(a) - numberOf(b));
};

/** ③ 入口の uuid の行の形：4 つの字（行 ID は K144-API-<3 けた>・3 つ目は path か query） */
const isRow = (r: unknown): r is K144UuidCase =>
  Array.isArray(r) &&
  r.length === 4 &&
  r.every((x) => typeof x === "string") &&
  ROW_ID.test(r[0] as string) &&
  (r[2] === "path" || r[2] === "query");

/** ③ 1 つの葉の形を確かめる。出す名前は leaf だけ・鍵は 4 つのどれか（1 つは要る） */
const shapeOf = (name: string, mod: Bag): K144Leaf => {
  const stop = (why: string): never => {
    throw new K144LeafError(`${name}：${why}`);
  };
  const others = Object.keys(mod).filter((k) => k !== "leaf");
  if (others.length > 0) stop(`出す名前は leaf だけ（ほかに ${others.join("・")} を出している）`);
  const leaf = mod["leaf"];
  if (!isBag(leaf)) return stop("export const leaf = { … } の入れ物を出していない（並び・null は置けない）");
  const keys = Object.keys(leaf);
  const strange = keys.filter((k) => !KEYS.includes(k));
  if (strange.length > 0) stop(`leaf に知らない鍵が在る：${strange.join("・")}（鍵は ${KEYS.join("・")} だけ）`);
  if (keys.length === 0) stop(`leaf に鍵が 1 つも無い（${KEYS.join("・")} のどれか 1 つは要る）`);
  for (const k of ["setup", "tests"]) if (k in leaf && typeof leaf[k] !== "function") stop(`leaf.${k} は関数で書く`);
  if ("BODIES" in leaf && !isBag(leaf["BODIES"])) stop("leaf.BODIES は入れ物（鍵は口の名前）で書く");
  if ("UUID_PARAM_CASES" in leaf) {
    const rows = leaf["UUID_PARAM_CASES"];
    if (!Array.isArray(rows)) return stop("leaf.UUID_PARAM_CASES は並びで書く");
    const bad = rows.filter((r) => !isRow(r));
    if (bad.length > 0)
      stop(
        `入口の uuid の行の形が違う：${bad.map((r) => JSON.stringify(r)).join("・")}（["K144-API-<3 けた>", "<口>", "path" か "query", "<値の名前>"]）`,
      );
  }
  return leaf as K144Leaf;
};

/** ④ 行は字のまま書く：字から拾った行（Python の検査が数える行）と、動く行が同じ並びでなければ止める */
const sameAsText = ({ name, text, leaf }: Loaded): void => {
  const written = [...text.matchAll(ROW_IN_TEXT)].map((m) => m.slice(1, 5));
  const live = leaf.UUID_PARAM_CASES ?? [];
  if (JSON.stringify(written) === JSON.stringify(live)) return;
  throw new K144LeafError(
    `${name}：入口の uuid の行は 1 行に 1 つ、字のまま書く（字から拾った行 ${JSON.stringify(written)} と、動く行 ${JSON.stringify(live)} が同じでない。組み立てた行・注にした行は置けない）`,
  );
};

/** ②③④ 葉のファイルを 1 つ読み込む。落ちたら、ファイルの名前を文に出して止める（生の例外をそのまま投げない） */
const load = async (dir: string, name: string): Promise<Loaded> => {
  const path = join(dir, name);
  const text = textOf(path, `${name}：葉のファイルの字`);
  let mod: Bag;
  try {
    mod = (await import(path)) as Bag;
  } catch (e) {
    throw new K144LeafError(`${name}：葉のファイルを読み込めない：${reason(e)}`, { cause: e });
  }
  const loaded = { name, text, leaf: shapeOf(name, mod) };
  sameAsText(loaded);
  return loaded;
};

/** ⑤ 重なり：行 ID・口と値・体の鍵は、本体と置き場の全部で 1 つ。2 か所に在れば、2 つの持ち主と重なった物を文に出して止める */
const noOverlap = (base: K144Base, leaves: readonly Loaded[]): void => {
  const ids = new Map<string, string>();
  const values = new Map<string, string>();
  const bodies = new Map<string, string>();
  const twice: string[] = [];
  const take = (seen: Map<string, string>, key: string, owner: string, what: string): void => {
    const first = seen.get(key);
    if (first === undefined) seen.set(key, owner);
    else if (first === owner) twice.push(`${what} ${key} が ${owner} の中に 2 回在る`);
    else twice.push(`${what} ${key} が ${first} と ${owner} の 2 か所に在る`);
  };
  const valueOf = ([, op, where, name]: K144UuidCase): string =>
    `${op} の ${where === "path" ? "道の値 :" : "問い合わせ ?"}${name}`;
  // 本体は 1 つの持ち主として数える（本体の中の同じ字は見ない。見るのは葉との重なり）
  for (const m of textOf(base.file, `本体のファイル ${base.file} `).matchAll(ID_IN_TEXT)) ids.set(m[1]!, BODY);
  for (const row of base.UUID_PARAM_CASES) values.set(valueOf(row), BODY);
  for (const op of Object.keys(base.BODIES)) bodies.set(op, BODY);
  for (const { name, text, leaf } of leaves) {
    for (const m of text.matchAll(ID_IN_TEXT)) take(ids, m[1]!, name, "行 ID");
    for (const row of leaf.UUID_PARAM_CASES ?? []) take(values, valueOf(row), name, "同じ口の同じ値の行");
    for (const op of Object.keys(leaf.BODIES ?? {})) take(bodies, op, name, "体（BODIES）の鍵");
  }
  if (twice.length > 0) throw new K144LeafError(`置き場の重なり（どちらか 1 つにする）：${twice.join("／")}`);
};

/** 置き場 dir（省けば、このファイルの隣の k144.d）の葉のファイルを番号の順に読み、葉の分（行・体・準備・葉だけの試験）を足し合わせて返す */
export async function readK144Leaves(base: K144Base, dir: string = PLACE): Promise<K144Leaves> {
  const leaves: Loaded[] = [];
  for (const name of leafNames(dir)) leaves.push(await load(dir, name)); // 番号の順に 1 つずつ
  noOverlap(base, leaves);
  return {
    files: leaves.map((l) => l.name),
    UUID_PARAM_CASES: leaves.flatMap((l) => l.leaf.UUID_PARAM_CASES ?? []),
    BODIES: Object.assign({}, ...leaves.map((l) => l.leaf.BODIES ?? {})) as Record<string, unknown>,
    setup: async (f: Fixture): Promise<void> => {
      for (const l of leaves) await l.leaf.setup?.(f); // 1 つ終わってから次
    },
    tests: (k: K144Kit): void => {
      for (const l of leaves) l.leaf.tests?.(k);
    },
  };
}

/** 準備（beforeAll）で入る値を「読む時」に取りに行く入れ物。葉は試験を集める時に受け取り、試験の中で中を読む。
 *  中を読むたびに get() の今の値から読み、読んだ値は包まずにそのまま返す。値がまだ無い時（試験の外）に中を読むと止まる */
export function late<T extends object>(get: () => T | undefined): T {
  const now = (): T => {
    const v = get();
    if (v === undefined)
      throw new K144LeafError(
        "準備（beforeAll）で入る値がまだ無い。葉は試験（it）の中で読む（試験を集める時には読めない）",
      );
    return v;
  };
  return new Proxy({} as T, {
    get: (_t, p) => Reflect.get(now(), p),
    has: (_t, p) => Reflect.has(now(), p),
    set: (_t, p, v) => Reflect.set(now(), p, v),
    ownKeys: () => Reflect.ownKeys(now()),
    getOwnPropertyDescriptor: (_t, p) => Reflect.getOwnPropertyDescriptor(now(), p),
  });
}
