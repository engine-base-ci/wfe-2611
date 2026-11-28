// 試験の道具（K-53）：本人を「今の版の利用規約とプライバシーポリシーに同意済み」にする。口の試験（apps/api/test/_pending.ts）と
//   画面の試験（apps/web/tests/_lib/api.ts）の両方がここを使う（同じ SQL を 2 か所に書かない）。どちらも管理者の接続で呼ぶ。
//   K-53 の後は、同意の無い本人は同意し直しの印（sessions.terms_pending）で口が 403・E-AUTH-010 になる。本物の登録は確定（K-52）で
//   申し込みの同意が移るが、申し込みを通らずに人を作る道具（signUp で直に作る・招待で入る）はここで今の版への同意を入れ、
//   確定の直後と同じく、その人のセッションの印を下ろす。今の版は K-53 の app.current_terms() で引くので、K-53 の migration の後に使う（K-53 の実装のコミットで入る道具）。印の列が無ければ下ろさない。

/** 管理者の接続で SQL を 1 本流し、行を返す（pg の Pool・Client のどちらでも包める） */
export type AdminQuery = (sql: string, params?: unknown[]) => Promise<unknown[]>;

// 同じ人（auth_user_id）が 2 つの会社に member を持つことがある（hold の試験の土台の alsoIn など）。同意は人ごとに 1 回（D-128.137）なので、
// member は 1 人（いちばん古い会社の行）に絞ってから、今の版（app.current_terms()・K-53）を掛け合わせる。版ごとに 1 行だけ入る
const AGREE = `insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at)
  select m.tenant_id, m.id, m.auth_user_id, v.id, now()
    from (select distinct on (auth_user_id) id, tenant_id, auth_user_id from members
           where auth_user_id = $1 and deleted_at is null order by auth_user_id, created_at, id) m
    cross join (select id from app.current_terms() where kind in ('terms', 'privacy')) v
   where not exists (select 1 from terms_consents c where c.auth_user_id = $1 and c.terms_version_id = v.id and c.deleted_at is null)`;
const HAS_FLAG =
  "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sessions' and column_name = 'terms_pending'";
const CLEAR =
  "update sessions set terms_pending = false where member_id in (select id from members where auth_user_id = $1)";

export async function agreeCurrentTerms(query: AdminQuery, authUserId: string): Promise<void> {
  await query(AGREE, [authUserId]);
  if ((await query(HAS_FLAG)).length) await query(CLEAR, [authUserId]);
}
