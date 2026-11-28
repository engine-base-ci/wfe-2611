-- 使い終わったリンクと、期限が切れたリンクを区別する（D-088.3）。
-- 消してしまうと「もう登録が済んでいる」と「期限切れ」が同じ見た目になり、
-- 二度押し・リロードした人に「はじめからやり直せ」と言ってしまう。
alter table kaname_auth.pending_signup add column if not exists consumed_at timestamptz;
