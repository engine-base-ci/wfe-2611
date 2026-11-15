"use client";
// メールを確かめる（A02・D-088）の薄い入れ物。手がかり（?token=）があれば確認のリンクを開いた画面（K-52・features/F1/verify-email）、
// 無ければ待つ画面（K-51・features/F1/sign-up）。中身はどちらも features の中にある。
// 確認のリンクの画面は、読んだ後に URL から手がかりを消してこのタブの中にだけ覚える（K-52・L3）。再読み込み・戻るで手がかりの無い URL に来たら、
// 覚えた手がかりで同じ画面を出す（確定済み → ログイン中なら中へ）
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SignupWaiting } from "@/features/F1/sign-up";
import { VerifyLink, readLinkToken } from "@/features/F1/verify-email";
import { AuthLoading } from "@/features/F1/sign-up/frame";

function VerifyEmailSwitch() {
  const sp = useSearchParams();
  const current = sp.get("token");
  const [first] = useState(current); // 開いたときの手がかり（URL から消えても待つ画面に切り替えない）
  const [kept, setKept] = useState<string | null | undefined>(undefined); // このタブに覚えた手がかり（読むまで undefined）
  useEffect(() => setKept(readLinkToken()), []);
  const token = current ?? first ?? kept;
  if (token) return <VerifyLink token={token} />;
  if (kept === undefined) return null; // 覚えた手がかりを読むまで待つ（読むのは画面が開いた直後の 1 回）
  return <SignupWaiting />;
}

// useSearchParams は Suspense の中でしか使えない（本番ビルドの prerender で落ちる。dev では出ない）
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <VerifyEmailSwitch />
    </Suspense>
  );
}
