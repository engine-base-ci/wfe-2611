// 預けたログイン情報の答えの形（K-351・D-128.57）。一覧（listCredentials）・預ける・上書きの口が同じ形で答える。
//   出すのは名前と使い方だけ。金庫の参照（vault_ref）・持ち主の id・サービスの欄（service_*）は読まない・出さない。
//   コードを待っている確かめ：確かめの仕事（bridge_jobs の kind login_check）が asking で、まだ答えていない頼み（bridge_job_events の ask）が
//   あれば、いちばん新しい頼みの request_id を付け、state を asking にする（列 login_check_state は asking を持てない・0066。前の一覧の関数（K-371 で消した）と同じ読み方）。
//   PC の仕事は本人の物だけが見える（行の守り bridge_jobs_self_read）。同じ条件を文にも書く（索引 bridge_jobs_queue_idx で引く）

/** 行を読む文（credentials c と、答えていない頼み asks a）。後ろに where・order by を続けて使う。行の守りの中（withTenant）で流す */
export const CREDENTIAL_SELECT = `
with asks as (
  select distinct on (j.credential_id) j.credential_id, e.request_id
    from bridge_jobs j
    join bridge_job_events e on e.job_id = j.id and e.kind = 'ask'
   where j.tenant_id = app.tenant_id() and j.member_id = app.user_id()
     and j.kind = 'login_check' and j.state_id = 'asking' and j.deleted_at is null and j.credential_id is not null
     and not exists (select 1 from bridge_job_events x
                      where x.job_id = j.id and x.kind = 'answer' and x.request_id = e.request_id)
   order by j.credential_id, e.created_at desc, e.seq desc
)
select c.id, c.name, c.description, c.layer, c.kind_id, c.two_factor_id, c.destinations,
       to_char(c.expires_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as expires_on,
       c.use_count, c.last_used_at, c.login_check_state, c.login_check_detail, c.login_check_at,
       a.request_id as ask_request_id, c.created_at, c.updated_at
  from credentials c
  left join asks a on a.credential_id = c.id`;

export interface CredentialRow {
  id: string;
  name: string;
  description: string | null;
  layer: "workspace" | "personal";
  kind_id: string | null;
  two_factor_id: string;
  destinations: string[];
  /** 期限の日本の日付（YYYY-MM-DD）。無ければ null */
  expires_on: string | null;
  use_count: number;
  last_used_at: Date | null;
  login_check_state: string | null;
  login_check_detail: string | null;
  login_check_at: Date | null;
  /** まだ答えていない頼みの id（コードを待っている確かめ）。無ければ null */
  ask_request_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Credential {
  id: string;
  name: string;
  description: string | null;
  layer: "workspace" | "personal";
  kind: "login" | "key";
  two_factor: string;
  destinations: string[];
  expires_on: string | null;
  use_count: number;
  last_used_at: Date | null;
  login_check: { state: string | null; detail: string | null; at: Date | null; request_id: string | null };
  can_edit: boolean;
  created_at: Date;
  updated_at: Date;
}

/** ログインの種類（ログイン名とパスワードで入る物）。ほか（api_key など）は鍵 */
const LOGIN_KINDS: readonly string[] = ["basic", "password_totp", "email_otp"];

/** 行 → 答えの形。canEditWorkspace はワークスペースの物を直せるか（credentials のワークスペース全体の edit）。個人の物は見えるのが持ち主だけなので true */
export function toCredential(row: CredentialRow, canEditWorkspace: boolean): Credential {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    layer: row.layer,
    kind: row.kind_id !== null && LOGIN_KINDS.includes(row.kind_id) ? "login" : "key",
    two_factor: row.two_factor_id,
    destinations: row.destinations,
    expires_on: row.expires_on,
    use_count: row.use_count,
    last_used_at: row.last_used_at,
    login_check: {
      state: row.ask_request_id !== null ? "asking" : row.login_check_state,
      detail: row.login_check_detail,
      at: row.login_check_at,
      request_id: row.ask_request_id,
    },
    can_edit: row.layer === "personal" ? true : canEditWorkspace,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
