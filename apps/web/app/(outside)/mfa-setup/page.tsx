// ログインと安全（K-318・画面 mfa-setup・道 /mfa-setup）。薄い入れ物：中身は apps/web/features/F1/security/（流れと操作ごとのフォルダ・D-128.130）。
//   ?add=passkey で開いた直後に足す小窓を開き（ログインの「この PC にも」・K-317）、足し終えたら ?next=<中の道> へ移る（外の道なら留まる）
import { SecurityScreen } from "@/features/F1/security/security-screen";

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined): string | null => (typeof v === "string" ? v : null);
  return <SecurityScreen add={one(q["add"]) === "passkey"} next={one(q["next"])} />;
}
