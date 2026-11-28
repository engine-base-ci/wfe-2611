// 置き場 k144.d の土台（K-378）：葉ごとのファイル（K-<番号>.ts）の形。型だけを書く（動く物は書かない）。
//   共有の試験 ../k144-contract.test.ts に葉が足す分は、本体に行を足さず、この置き場に K-<自分の番号>.ts を置く（置き方は README.md）。
//   別のファイルなので、葉を同時に作ってもぶつからない。読む所は ../k144-leaves.ts（readK144Leaves）で、本体は試験を集める時に 1 回読む。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import type { EndpointDef } from "@kaname/contracts/registry";
import type { Fixture, Person } from "../../fixture.js";

/** 入口の uuid の行（本体の UUID_PARAM_CASES と同じ形）：[行 ID（K144-API-NNN）, 口の名前, 道の値か問い合わせか, 値の名前] */
export type K144UuidCase = readonly [row: string, op: string, where: "path" | "query", name: string];

/** 口の答えの体（本体の Json と同じ形） */
export type K144Json = Record<string, unknown> & { data?: unknown; details?: { field: string; message: string }[] };

/** 葉だけの試験（tests）に本体が渡す道具。本体の頭の手助けと同じ物。
 *  f・T・writer・mate は、準備（beforeAll）で入る値を「読む時」に取りに行く（葉は集める時に受け取り、試験の中で読む）。
 *  試験の外（集める時）に中の値を読むと止まる */
export interface K144Kit {
  /** 試験の土台（本物の DB・本物の口） */
  f: Fixture;
  /** K144 の会社と、その全体のグループ */
  T: { tenantId: string; rootScope: string };
  /** 書く人（チケットを書ける人）。PC を 1 台つないでいる */
  writer: Person;
  /** 担当の人 */
  mate: Person;
  /** 書く人の PC の印（PC の口を叩く頭 x-bridge-session の値） */
  pcToken: () => string;
  /** 契約の口の定義（registry）。無い名前は止まる */
  def: (op: string) => EndpointDef;
  json: (r: Response) => Promise<K144Json>;
  /** 答えが契約どおりか：状態コードが契約の並びにあり、成功の data は契約の形（strict）に合う */
  conforms: (op: string, r: Response) => Promise<void>;
  /** 422 の答えの、理由のある欄の名前 */
  fields: (j: K144Json) => string[];
  /** 422 の答えの、その欄の理由 */
  uuidReason: (j: K144Json, field: string) => string | undefined;
  /** 数を 1 つ返す SQL（列の名前は n）を、行の守りの外で流す */
  count: (sql: string, p?: unknown[]) => Promise<number>;
  /** その口を、uuid の値 name を value にして叩く（ほかの道の値は正しい uuid・体は BODIES の体） */
  hit: (op: string, where: "path" | "query", name: string, value: string) => Promise<Response>;
}

/** 葉のファイルが出す物。`export const leaf: K144Leaf = { … }` の 1 つだけを出す。鍵は下の 4 つだけ（どれか 1 つは要る） */
export interface K144Leaf {
  /** 本体の準備（beforeAll）の中で、土台を作った直後に 1 回呼ばれる。自分の口の振る舞い（hooks）を土台に足す */
  setup?: (f: Fixture) => void | Promise<void>;
  /** 入口の uuid の行。本体の行の後ろに足され、同じ試験（⑫）が 1 行ずつ回る。1 行に 1 つ、字のまま書く（契約の形の検査が字で読む） */
  UUID_PARAM_CASES?: readonly K144UuidCase[];
  /** uuid の行を叩く時の体（必須の欄を入れて、正しい uuid では 422 にならない体）。鍵は口の名前 */
  BODIES?: Readonly<Record<string, unknown>>;
  /** 葉だけの試験（describe・it）を並べる。本体が試験を集める時に 1 回呼ぶ */
  tests?: (k: K144Kit) => void;
}

/** 読む所に本体が渡す物：本体のファイルの道（行 ID の重なりを字で見る）と、本体の行と体 */
export interface K144Base {
  file: string;
  UUID_PARAM_CASES: readonly K144UuidCase[];
  BODIES: Readonly<Record<string, unknown>>;
}

/** 読む所が返す物（葉の分だけ。本体の行と体は入れない） */
export interface K144Leaves {
  /** 読んだ葉のファイルの名前（番号の小さい順） */
  files: readonly string[];
  /** 葉の uuid の行（ファイルは番号の順・中は書いた順） */
  UUID_PARAM_CASES: readonly K144UuidCase[];
  /** 葉の体を足し合わせた物 */
  BODIES: Readonly<Record<string, unknown>>;
  /** 葉の setup を番号の順に、1 つ終わってから次を呼ぶ */
  setup: (f: Fixture) => Promise<void>;
  /** 葉の tests を番号の順に呼ぶ */
  tests: (k: K144Kit) => void;
}
