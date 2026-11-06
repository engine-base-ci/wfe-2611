// DB の時刻を進める道具（K-54）：眠らずに、行の時刻の列を DB の now() から過去へずらす（＝その分だけ時が経った・D-128.130）。
//   探したが無かった：目録（03_architecture/catalog.json）の共通の処理・apps/web/tests/_lib・apps/api/test/_pending.ts に、時刻を進める道具は無い。
//   似たもの：apps/api/test/features/F1/sign-up.test.ts・verify-email.test.ts の setExpiry は、期限（expires_at）だけを決めた式に置き直す
//   （その試験のファイルの中だけ・口の単体の試験の境目を作る）。ここは申し込みの時刻の列を全部、同じ幅だけ一緒に過去へずらす
//   （作った・送った・期限の前後がそのまま残る＝本当に時間が経ったのと同じ形）。幅は SQL の interval で渡す（文字は埋め込まない）
import { admin } from "./api";

/** 申し込み（kaname_auth.pending_signup）の時刻を `by`（例 "30 minutes 1 second"）だけ進める。動かした行の数を返す */
export async function elapseSignup(email: string, by: string): Promise<number> {
  const r = await admin<{ email: string }>(
    `update kaname_auth.pending_signup
        set expires_at = expires_at - $2::interval,
            created_at = created_at - $2::interval,
            updated_at = updated_at - $2::interval,
            sent_at = sent_at - $2::interval,
            consented_at = consented_at - $2::interval
      where email = $1 returning email`,
    [email, by],
  );
  return r.length;
}
