-- 20261119120400 預けたログイン情報に名前・説明・層を足す（K-351・契約の口 listCredentials・D-125.148・D-125.149・D-128.57 ①・関門 C2）
--   名前で管理する（D-125.148）。層はワークスペースと個人の 2 つだけ（代表の答え ac0813ee7c21 ②）。
--   行の守りは同じ名前の policies（個人の物は持ち主だけが書ける・ワークスペースの物は credentials の edit を持つ人だけ・D-128.57 ①）。
--
-- ① name：英大文字で始まり、英大文字・数字・_ だけで 64 文字まで。
--      前の道すじ（/api/auth-ext/vault/*・名前を入れない insert）が残る間は、列の既定（LOGIN_ と 16 進 8 けた）で埋める。
--      既定は行ごとに引くので、今ある行にも 1 行ずつ違う名前が入る
-- ② description：空でよい
-- ③ layer：workspace／personal。既定は personal（前の道すじの insert は持ち主＝本人の個人の物）
-- ④ 一意：ワークスペースは会社の中で 1 つ・個人は持ち主の中で 1 つ。消した物と失効しただけの物は名前をふさがない
--      （見えず直せない物が名前だけふさぐのを避ける・代表の答え answer=449e72553c59）
alter table credentials add column if not exists name text not null
  default ('LOGIN_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
alter table credentials add column if not exists description text;
alter table credentials add column if not exists layer text not null default 'personal';

alter table credentials drop constraint if exists credentials_name_check;
alter table credentials add constraint credentials_name_check check (name ~ '^[A-Z][A-Z0-9_]{0,63}$');
alter table credentials drop constraint if exists credentials_layer_check;
alter table credentials add constraint credentials_layer_check check (layer in ('workspace', 'personal'));

create unique index if not exists credentials_workspace_name_uq on credentials (tenant_id, name)
  where layer = 'workspace' and deleted_at is null and revoked_at is null;
create unique index if not exists credentials_personal_name_uq on credentials (tenant_id, owner_member_id, name)
  where layer = 'personal' and deleted_at is null and revoked_at is null;
