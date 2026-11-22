// K-419 招待のメールの文面（関門 C6 の送出の口に渡す）。
//   載せるのはワークスペースの名前・招いた人・グループ・役割・ひとこと（在れば）・招待のリンク・期限だけ。
//   リンクのトークンはこのメールだけが持つ（DB には sha256 だけ・ログにも出さない）

export interface InviteMailFacts {
  workspaceName: string;
  inviterName: string;
  groupName: string;
  role: string;
  message: string | null;
  link: string;
  expiresAt: Date;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  member: "メンバー",
  viewer: "閲覧のみ",
};

const DAY = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** 招待の事実から件名と本文を組む。行は 1 つの文字列の中の改行でつなぐ（K-334 の resend-mail.ts と同じ訳） */
export function inviteMail(f: InviteMailFacts): { subject: string; text: string } {
  const note = f.message ? `\n${f.inviterName}さんからのひとこと：\n${f.message}\n` : "";
  const text = `${f.inviterName}さんから、「${f.workspaceName}」に招待されました。

グループ：${f.groupName}
役割：${ROLE_LABEL[f.role] ?? f.role}
${note}
下のリンクから参加してください。
${f.link}

リンクの期限：${DAY.format(f.expiresAt)}まで
心当たりが無ければ、このメールは無視してかまいません。`;
  return { subject: `【Kaname】${f.inviterName}さんから「${f.workspaceName}」への招待が届きました`, text };
}
