// 名前を直す口（K-827）：updateWorkspace（PATCH /api/v1/workspace・D-154.21・D-154.5）。名前だけ・変えたらすぐ保存（保存のボタンは無い）。
//   入口（op.ts）が先に確かめる：ログイン・権限（管理者の束）・上限・冪等・体の形（strict・欄は name だけ）・NUL（K-427）。
//   前処理（input）：前後の空白（全角を含む）を削り、字数を Array.from で数える（サロゲート対は 1 字・K-833 の名前と同じ数え方）。
//     欠け・空・空白だけ → 422・E-WS-001／101 字以上 → 422・E-WS-002（details は欄 name）
//   本体（before）：1 つの取引で app.workspace_rename（会社ごとの錠 → 管理者か → 同じ名前なら書かない → 名前と記録 workspace.renamed）。
//     管理者でない → 403（data なし）・DB が落ちた → 503・E-PAGE-003（名前も記録も残らない）
//   答え：200 { data: { workspace: { id, name, logo } } }（logo は読む口と同じ作り）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { ObjectStore } from "@kaname/storage";
import type { Row } from "@kaname/db/repository";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { dbFailed, forbidden, pgCode, workspaceOf, type WorkspaceRow } from "./settings.js";

/** 名前の字数の上限（契約の maxLength と同じ・コードポイントで数える） */
export const WORKSPACE_NAME_MAX = 100;
/** 前後の空白（半角・全角） */
const EDGE_SPACES = /^[\s\u3000]+|[\s\u3000]+$/g;

const badName = (code: "E-WS-001" | "E-WS-002"): HookReply => {
  const e = kanameError(code);
  return { status: 422, body: { ...e.toJSON(), details: [{ field: "name", message: e.entry.message }] } };
};

/** 名前をそろえて確かめる。通れば削った後の字、通らなければ 422 の答え */
export function checkWorkspaceName(raw: unknown): { name: string } | { reply: HookReply } {
  if (typeof raw !== "string") return { reply: badName("E-WS-001") };
  const name = raw.replace(EDGE_SPACES, "");
  const len = Array.from(name).length;
  if (len === 0) return { reply: badName("E-WS-001") };
  if (len > WORKSPACE_NAME_MAX) return { reply: badName("E-WS-002") };
  return { name };
}

/** 前処理：体が形の通る object なら、名前をそろえて確かめる（ほかの欄は入口の strict な形が 422 にする） */
export function workspaceUpdateInput(raw: unknown): { input: Row } | { reply: HookReply } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Row };
  const body = raw as Row;
  const checked = checkWorkspaceName(body["name"]);
  if ("reply" in checked) return checked;
  return { input: { ...body, name: checked.name } };
}

interface RenameRow {
  changed: boolean;
  workspace: WorkspaceRow;
}

export function createUpdateWorkspace(d: { appPool: pg.Pool; objects: ObjectStore }) {
  return async (a: HookArgs): Promise<HookReply> => {
    const checked = checkWorkspaceName(a.input["name"]);
    if ("reply" in checked) return checked.reply;
    let row: RenameRow;
    try {
      row = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: RenameRow }>("select app.workspace_rename($1) as v", [checked.name]);
        return r.rows[0]!.v;
      });
    } catch (e) {
      const code = pgCode(e);
      if (code === "42501") return forbidden();
      if (code === "22023") return badName("E-WS-002");
      console.error(`[workspace] 名前を直せなかった（${code || "Error"}）`);
      return dbFailed();
    }
    return { status: 200, body: { data: { workspace: await workspaceOf(d.objects, a.ctx, row.workspace) } } };
  };
}
