// K-334 送り直しを頼まれたメールの文面（関門 C6 の送出の口に渡す）。
//   載せるのはワークスペースの名前・宛ての招待のメール（誰が頼んだか）・招いた日・期限だけ。
//   招待のトークン・リンクは入れない（送り直すのは招いた人が新しい招待を出すこと・TP-MAIL-03）

export const RESEND_REQUEST_SUBJECT = "【Kaname】招待の送り直しを頼まれました";

export interface ResendRequestFacts {
  invitee_email: string;
  invited_at: Date;
  expires_at: Date;
  workspace_name: string | null;
}

const DAY = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 頼まれた招待の事実から文面を組む */
export function resendRequestMail(f: ResendRequestFacts): { subject: string; text: string } {
  const where = f.workspace_name ? `「${f.workspace_name}」` : "ワークスペース";
  return {
    subject: RESEND_REQUEST_SUBJECT,
    text: [
      `${where}に招待した ${f.invitee_email} さんから、招待の送り直しを頼まれました。`,
      "招待のリンクの期限が過ぎていたため、参加できなかったようです。",
      "",
      `招いた日：${DAY.format(new Date(f.invited_at))}`,
      `期限：${DAY.format(new Date(f.expires_at))}`,
      "",
      "参加してもらうには、Kaname のメンバーの画面から新しい招待を出してください。",
      "心当たりが無ければ、このメールは無視してかまいません。",
    ].join("\n"),
  };
}
