// 自分の入っていないグループから、自分のグループに共有された物（K-676 が置いた器・K-719 が中身を差し替えた）。
//   app.kn_shared_tree()（K-719 の migration・security definer）を 1 文で読み、元のグループごとに組む（名前のコードポイント順）。
//   共有したフォルダ・個別に共有したページは、親が行の集まりに無いので buildNodes がグループの直下に置く。色は tree.ts が group_id から決める
import type pg from "pg";
import type { FolderRow, PageRow } from "../tree.js";

export interface SharedGroupRows {
  readonly group_id: string;
  readonly group_name: string;
  readonly group_code: string | null;
  readonly folders: readonly FolderRow[];
  readonly pages: readonly PageRow[];
}

interface SharedRow {
  readonly source_scope: string;
  readonly source_name: string;
  readonly source_code: string | null;
  readonly item_kind: "folder" | "page";
  readonly id: string;
  readonly name: string;
  readonly parent_folder_id: string | null;
  readonly scope_id: string;
  readonly is_personal: boolean;
  readonly is_must: boolean;
  readonly is_draft: boolean;
  readonly copied: boolean;
}

const SHARED_SQL = `select t.source_scope, t.source_name, nullif(s.ticket_prefix, '') as source_code, t.item_kind, t.id, t.name,
       t.parent_folder_id, t.scope_id, t.is_personal, t.is_must, t.is_draft, t.copied
  from app.kn_shared_tree() t join scopes s on s.id = t.source_scope
 order by t.source_name collate "C", t.source_scope, t.item_kind, t."position", t.name collate "C", t.id`;

const toFolder = (r: SharedRow): FolderRow => ({
  id: r.id,
  name: r.name,
  parent_folder_id: r.parent_folder_id,
  scope_id: r.scope_id,
  is_personal: r.is_personal,
});
const toPage = (r: SharedRow): PageRow => ({
  id: r.id,
  title: r.name,
  is_must: r.is_must,
  folder_id: r.parent_folder_id,
  scope_id: r.scope_id,
  is_personal: r.is_personal,
  is_draft: r.is_draft,
  copied: r.copied,
});

export async function readSharedRows(cl: pg.PoolClient): Promise<readonly SharedGroupRows[]> {
  const rows = (await cl.query<SharedRow>(SHARED_SQL)).rows;
  const order: string[] = [];
  const byGroup = new Map<string, SharedRow[]>();
  for (const r of rows) {
    const list = byGroup.get(r.source_scope);
    if (list) list.push(r);
    else {
      order.push(r.source_scope);
      byGroup.set(r.source_scope, [r]);
    }
  }
  return order.map((g) => {
    const list = byGroup.get(g)!;
    const head = list[0]!;
    return {
      group_id: g,
      group_name: head.source_name,
      group_code: head.source_code,
      folders: list.filter((r) => r.item_kind === "folder").map(toFolder),
      pages: list.filter((r) => r.item_kind === "page").map(toPage),
    };
  });
}

/** 木の残りのノード数（room）までに共有の行を切る（フォルダを先に）。切ったら cut true（木の口が truncated を立てる） */
export function capSharedRows(
  groups: readonly SharedGroupRows[],
  room: number,
): { readonly groups: readonly SharedGroupRows[]; readonly cut: boolean } {
  const total = groups.reduce((n, g) => n + g.folders.length + g.pages.length, 0);
  if (total <= room) return { groups, cut: false };
  let left = Math.max(room, 0);
  const take = <T>(xs: readonly T[]): readonly T[] => {
    const out = xs.slice(0, left);
    left -= out.length;
    return out;
  };
  const folders = groups.map((g) => take(g.folders));
  const pages = groups.map((g) => take(g.pages));
  return {
    groups: groups.map((g, i) => ({ ...g, folders: folders[i]!, pages: pages[i]! })),
    cut: true,
  };
}
