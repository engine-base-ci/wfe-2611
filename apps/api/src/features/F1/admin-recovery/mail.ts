// K-305 管理者に頼むメールの文面（関門 C6 の送出の口に渡す）。
//   メンバーの画面（/members/:id）と戻す口（resetMemberTwoFactor）ができるまでは、リンクを入れず運営の連絡先を書く（押すと 404 の行き止まり・G-04・answer=77ba93e55de2）。
//   載せるのは頼んだ人の名前と運営の連絡先だけ。パスワード・コード・待ちの印・IP・頼んだ人のメールは入れない（TP-MAIL-03）

export interface AdminRecoveryMail {
  subject: string;
  text: string;
}

/** 頼んだ人の名前（その会社での表示の名前）と運営のメールから文面を組む */
export function adminRecoveryMail(requesterName: string, opsEmail: string): AdminRecoveryMail {
  return {
    subject: `Kaname：${requesterName} さんが 2 段階認証の再設定を頼んでいます`,
    text: [
      `${requesterName} さんが、認証アプリの端末をなくしたので、2 段階認証を戻してほしいと頼んでいます。`,
      "本人だと確かめてから戻してください。",
      "",
      `いまは管理者の画面から戻せないので、戻すときは運営（${opsEmail}）に連絡してください。運営が本人を確かめて戻します。`,
      "心当たりが無ければ、戻さずに本人に確かめてください。",
    ].join("\n"),
  };
}
