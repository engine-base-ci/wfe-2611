// 外枠の口 getShell（GET /api/v1/shell・K-465）の答えを作る道具（K-466 が切る段で作り carry で運ぶ・2026-11-20）。
//   外枠は 1 画面で getShell を 1 回だけ読む（K-466）。外枠を持つ画面の試験の「口の差し替え」は、前は me・scopes・approvals/queue・bridge/devices の 4 本を
//   答えていた。getShell に替えたので、どの試験の差し替えも、この道具で作った答えを /api/v1/shell に返す（鍵が無い・形が違う答えは外枠が読めない扱いにするため、
//   形はここ 1 か所で決める）。Playwright を読み込まない（純な関数だけ）：前からの試験の差し替えと新しい試験のどちらからも使える。
//   形は K-465 の試験（apps/api/test/features/F7/shell.test.ts）に合わせた。形が変わったらここだけを直す：
//     member { id, name, role_id }・workspace { id, name }・approvals_waiting・notifications_unread・
//     groups [{ id, name, ticket_prefix, writable, open_count }]・pc { connected, count }・setup_left・banner { incidents, maintenance }
//   と、契約で任意の鍵 saved_views（保存した検索条件の一覧・K-475 の一覧と同じ 13 鍵の配列。既定では付けない＝8 鍵の答え。K-479 の試験は付けて使う。
//   渡すと付く。渡さない（`undefined` も同じ）なら JSON に鍵が出ない＝古い 8 鍵の答えを作れる）
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
export const WS = "aaaaaaaa-0000-4000-8000-000000000001";
export const ME = "11111111-0000-4000-8000-000000000001";
export const SALES = "22222222-0000-4000-8000-000000000001";
export const ACCT = "22222222-0000-4000-8000-000000000002";
export const DEV = "22222222-0000-4000-8000-000000000003";

export interface ShellGroup {
  id: string;
  name: string;
  ticket_prefix: string | null;
  writable: boolean;
  open_count: number;
}
export interface ShellOpts {
  /** members.role_id（null・知らない値も入れられる）。既定 owner */
  roleId?: string | null;
  /** 名前（null は口が名前を返さない）。既定 高本 */
  name?: string | null;
  /** 会社名（null は口が会社名を返さない）。既定 ENGINE BASE */
  company?: string | null;
  approvals?: number;
  unread?: number;
  groups?: ShellGroup[];
  pcConnected?: boolean;
  setupLeft?: number;
  incidents?: { state: string; title: string; started_at: string }[];
  maintenance?: { title: string; from: string; to: string } | null;
  /** 任意の鍵 saved_views の中身（配列でない値も入れられる＝形の外れた答えを作る）。渡さなければ鍵を付けない */
  savedViews?: unknown;
}

/** 試験の既定のグループ（営業 EG・書ける）。前からの試験の「scopes」の答え（SALES・EG）と同じ */
export const GROUP_SALES: ShellGroup = {
  id: SALES,
  name: "営業",
  ticket_prefix: "EG",
  writable: true,
  open_count: 0,
};

/** getShell の答えの data（鍵は 8 個。`savedViews` を渡したときだけ 9 つ目の saved_views が付く） */
export function shellData(o: ShellOpts = {}) {
  const base = {
    member: {
      id: ME,
      name: o.name === undefined ? "高本" : o.name,
      role_id: o.roleId === undefined ? "owner" : o.roleId,
    },
    workspace: { id: WS, name: o.company === undefined ? "ENGINE BASE" : o.company },
    approvals_waiting: o.approvals ?? 0,
    notifications_unread: o.unread ?? 0,
    groups: o.groups ?? [GROUP_SALES],
    pc: { connected: o.pcConnected ?? false, count: o.pcConnected ? 1 : 0 },
    setup_left: o.setupLeft ?? 0,
    banner: { incidents: o.incidents ?? [], maintenance: o.maintenance ?? null },
  };
  return "savedViews" in o ? { ...base, saved_views: o.savedViews } : base;
}

/** 口の答えの形の体（{ data }）。前からの試験の差し替えは `r = shellReply({ … })` と書く */
export const shellReply = (o: ShellOpts = {}) => ({ status: 200, body: { data: shellData(o) } });

/** 書けるグループの id（前の scopes の答えの meta.writable と同じ） */
export const writableOf = (groups: readonly ShellGroup[]): string[] =>
  groups.filter((g) => g.writable).map((g) => g.id);
