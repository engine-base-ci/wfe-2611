-- 0059 認証の表（kaname_auth）をアプリの接続（kaname_app）から触れなくする（2026-10-01・QA で見つかった穴）。
-- 0004 の既定の権限が kaname_app にも select／insert／update／delete を付けていたため、アプリの接続から
-- パスワードのハッシュ・2 段階認証の秘密・セッション・登録待ちを、RLS の外で読み書きできた（境界 B2「kaname_auth ロールだけが触る」に反する）。
-- 実装は認証の表を authPool（kaname_auth）からしか触らない。app.* の security definer 関数は作成者の権限で動くので影響しない。
revoke all on all tables in schema kaname_auth from kaname_app;
revoke all on all sequences in schema kaname_auth from kaname_app;
alter default privileges in schema kaname_auth revoke all on tables from kaname_app;
alter default privileges in schema kaname_auth revoke all on sequences from kaname_app;
revoke usage on schema kaname_auth from kaname_app;
