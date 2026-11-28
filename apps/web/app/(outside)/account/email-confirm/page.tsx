// メールを変える確かめのリンクの先（K-840・行為 A74）。薄い入れ物：中身は apps/web/features/F10/account/email-confirm.tsx。
//   ?token= の印を渡す（無い・空なら「このリンクは使えません」・口を呼ばない）
import { EmailConfirm } from "@/features/F10/account/email-confirm";

export default async function EmailConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const t = q["token"];
  return <EmailConfirm token={typeof t === "string" && t !== "" ? t : null} />;
}
