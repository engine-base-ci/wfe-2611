// 届いた依頼の出し手に送るメールの文面（K-893・関門 C6 の送出の口に渡す・D-128.103）。
//   載せるのは 1 行の案内と依頼の画面へのリンクだけ。返事の本文・依頼の題・社内の人の名前は載せない
//   （署名と返信先は送出の口 server.ts の signedMail が全部のメールに付ける）

/** 依頼の画面の住所（ゲストの場所） */
export const requestLink = (base: string, requestId: string): string => `${base}/portal/requests/${requestId}`;

/** 返事が届いた知らせ（replyToClientRequest） */
export function requestRepliedMail(requestId: string, base: string): { subject: string; text: string } {
  return {
    subject: "Kaname：依頼に返事が届きました",
    text: `お送りいただいた依頼に返事が届きました。下のリンクから開いてください。\n${requestLink(base, requestId)}`,
  };
}

/** 依頼を断った知らせ（declineClientRequest・K-895）。断りの理由は載せない（理由は依頼の画面で見える） */
export function requestDeclinedMail(requestId: string, base: string): { subject: string; text: string } {
  return {
    subject: "Kaname：依頼について連絡が届きました",
    text: `お送りいただいた依頼について連絡が届きました。下のリンクから開いてください。\n${requestLink(base, requestId)}`,
  };
}
