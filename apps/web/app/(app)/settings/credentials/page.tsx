"use client";
// 預けたログイン情報（K-356・画面 credentials・A10）。薄い入れ物：中身は apps/web/features/F3/credentials/（流れと操作ごとのフォルダ・D-128.130）。
//   段の門（RequireSetup・(app) の layout）・入っていないときの戻し（RequireSession）・役（RequireRole）は前の画面（T-U-10）と同じに包む
import { RequireSession } from "@/lib/auth/session";
import { RequireRole } from "@/lib/auth/role";
import { CredentialsScreen } from "@/features/F3/credentials/credentials-screen";

export default function CredentialsPage() {
  return (
    <RequireSession>
      <RequireRole screen="credentials">
        <CredentialsScreen />
      </RequireRole>
    </RequireSession>
  );
}
