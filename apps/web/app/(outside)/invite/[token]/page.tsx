"use client";
// 招待を受けて参加する（/invite/:token・A03）。画面の中身は features/F2/invite（K-335・入口の枠と k の部品）。ここは入れ物だけ
import { Suspense } from "react";
import { AuthLoading } from "@/features/F1/sign-up/auth-loading";
import { InvitePage } from "@/features/F2/invite/invite-page";

export default function InviteAcceptRoute() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <InvitePage />
    </Suspense>
  );
}
