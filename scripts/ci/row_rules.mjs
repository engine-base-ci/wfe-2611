// 行に結ぶ言葉の確かめ（KN-52・ZT4・D-128.88・D-128.115）。契約の生成（contract.mjs）が読み、ENDPOINTS の perm.row に出す。
//   入口（apps/api/src/contract/op.ts の 4.1）は、:id の行を行の守り（RLS）の中で読み、
//     見えなければ 404（無いのと同じ）・見えても下の条件に合わなければ 403。
//   条件は SQL の式で、:id の表の行の列をそのまま書く（`select (式) from 表 where id = $1` で確かめる）。
//   app.user_id() が呼んだ人。app.manages_scope(グループ) は、そのグループ（か上のグループ）のマネージャーか管理者（0082）。
//   ★ここに無い組み合わせは契約の生成で赤になる（行に結ぶ口は全部、どの表のどの列で確かめるかを持つ）。
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROW_WORDS = ["self", "read", "write", "assignee", "approver", "recipient", "manager"];

/** path の :id が指す表（path の :id の前の段）。段の名前が表の名前と違うものだけ書く */
export const ID_TABLE = {
  "/api/v1/work_types": "skills",
  "/api/v1/rules": "policies",
  "/api/v1/bridge/devices": "sessions",
  "/api/v1/me/sessions": "sessions",
  "/api/v1/me/workspaces": "tenant_memberships",
  "/api/v1/knowledge/proposals": "knowledge_page_versions",
  "/api/v1/knowledge_imports": "imports",
  "/api/v1/exports": "export_jobs",
};
/** 入口で行を読まない口（理由が必須）。認証の側の表など、public の表に無いもの */
export const ROW_EXEMPT = {
  "/api/v1/me/passkeys": "パスキーは認証の側の表（auth スキーマ・D-128.119）。本人の分だけを認証の仕組みが引く。入口は役（member）と本人確認の取り直しまで",
};

const ME = "app.user_id()";
const TICKET_PEOPLE = (t) => `(${t}.assignee_member_id = ${ME} or ${t}.created_by = ${ME} or app.manages_scope(${t}.scope_id))`;
const VIA_TICKET = (col = "ticket_id") => `exists (select 1 from tickets t where t.id = ${col} and ${TICKET_PEOPLE("t")})`;
const CLIENT_MANAGER = (cid) =>
  `(app.client_editable(${cid}) or exists (select 1 from client_groups g where g.client_id = ${cid} and g.deleted_at is null and app.manages_scope(g.scope_id)))`;

/** 言葉 → :id の表 → 条件。read は「行が見える」だけ（RLS の select がそのまま守り） */
export const RULES = {
  self: {
    artifact_versions: `owner_member_id = ${ME}`,
    artifacts: `owner_member_id = ${ME}`,
    sessions: `member_id = ${ME}`,
    conversations: `owner_member_id = ${ME}`,
    credentials: `owner_member_id = ${ME}`,
    export_jobs: `requested_by = ${ME}`,
    inquiries: `opened_by_member_id = ${ME}`,
    learning_candidates: `owner_member_id = ${ME}`,
    tenant_memberships: `member_id = ${ME}`,
    memories: `owner_member_id = ${ME}`,
    // 会話の中の発言から作る：自分の会話の発言だけ
    messages: `exists (select 1 from conversations c where c.id = conversation_id and c.owner_member_id = ${ME})`,
    notifications: `member_id = ${ME}`,
    // 保存した見方：作った人とマネージャー（D-128.119）
    saved_views: `(member_id = ${ME} or app.manages_scope(scope_id))`,
    ticket_imports: `uploaded_by = ${ME}`,
    ticket_messages: `author_member_id = ${ME}`,
    policies: `created_by = ${ME}`,
    skills: `owner_member_id = ${ME}`,
    // お知らせを読んだ印は自分の分（お知らせ自体は会社の全員が読める）
    notices: `true`,
  },
  read: {},
  write: {
    tickets: `app.ticket_writable(id)`,
    knowledge_pages: `app.kpage_writable(id)`,
    // 残りは 07_functional/entities.json の update の条件をそのまま使う（RLS と同じ式）
  },
  assignee: {
    // 担当者・作成者・マネージャー。戻すは消した本人も（D-128.84）
    tickets: `(${TICKET_PEOPLE("tickets")} or deleted_by = ${ME})`,
    acceptances: VIA_TICKET(),
    // 実行：始めた人・そのグループのマネージャー・その実行の承認のチケットの担当者
    action_runs: `(created_by = ${ME} or app.manages_scope(scope_id) or exists (select 1 from approvals a join tickets t on t.id = a.ticket_id where a.action_run_id = action_runs.id and t.assignee_member_id = ${ME}))`,
  },
  approver: {
    approvals: `approver_member_id = ${ME}`,
    // ③ 人の確認：そのチケットの承認を割り当てられた人
    checks: `exists (select 1 from approvals a where a.ticket_id = checks.ticket_id and a.approver_member_id = ${ME} and a.deleted_at is null)`,
  },
  recipient: {
    ticket_handovers: `to_member_id = ${ME}`,
  },
  manager: {
    // 取引先の担当・担当グループのマネージャー・管理者
    clients: CLIENT_MANAGER("clients.id"),
    client_contacts: CLIENT_MANAGER("client_contacts.client_id"),
  },
};
/** 口ごとに言葉の中の人が違うもの（screen_api.py の範囲の説明） */
export const OP_RULES = {
  // 承認する人。担当者とマネージャーは読むだけ
  getApproval: `(approver_member_id = ${ME} or app.manages_scope(scope_id) or ${VIA_TICKET()})`,
  // 承認する人・担当者・マネージャー
  stopApproval: `(approver_member_id = ${ME} or app.manages_scope(scope_id) or ${VIA_TICKET()})`,
  // 取り消せる業務の型は、見えるものなら誰でも自分用に複製できる
  copyWorkType: `true`,
};

let ENT = null;
function updatePredicate(root, table) {
  if (!ENT) {
    const p = join(root, "07_functional/entities.json");
    const d = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : [];
    ENT = new Map((Array.isArray(d) ? d : d.entities ?? []).map((x) => [x.name, x]));
  }
  const pol = (ENT.get(table)?.access_control_policies ?? []).find((x) => String(x.operation).split(",").map((o) => o.trim()).includes("update") && (x.role ?? "member") === "member");
  return pol?.predicate ?? null;
}

/** 口 1 本の行の確かめ。null＝行を読まない（:id が無い・言葉が行に結ばない）。{error} は契約の生成で赤 */
export function rowOf(root, e, word) {
  if (!ROW_WORDS.includes(word)) return null;
  const m = /^(.*?)\/:id(\/|$)/.exec(e.path);
  if (!m) return null; // 一覧・作る：行の守り（RLS）が絞る。作る先の確かめは RLS の insert
  const base = m[1];
  if (ROW_EXEMPT[base]) return null;
  const table = ID_TABLE[base] ?? base.split("/").pop();
  if (word === "read") return { table, sql: "true" };
  const sql = OP_RULES[e.operationId] ?? RULES[word]?.[table] ?? (word === "write" ? updatePredicate(root, table) : null);
  if (!sql) return { error: `${e.method} ${e.path}（${e.operationId}）：言葉 ${word} を表 ${table} のどの列で確かめるかが無い（scripts/ci/row_rules.mjs）` };
  return { table, sql };
}

export const rulesSource = (root) => readFileSync(join(root, "scripts/ci/row_rules.mjs"), "utf8");
