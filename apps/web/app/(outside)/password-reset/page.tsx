"use client";
// パスワードの再設定（T-U-06・A31）。画面の中身は features/F1/password-reset（K-320・入口の枠と k の部品）。ここは入れ物だけ
import { Suspense } from "react";
import { AuthLoading } from "@/features/F1/sign-up/auth-loading";
import { PasswordResetPage } from "@/features/F1/password-reset";

export default function PasswordResetRoute() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <PasswordResetPage />
    </Suspense>
  );
}
