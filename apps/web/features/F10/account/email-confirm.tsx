"use client";
// 確かめのリンクを押した先（K-840・道 /account/email-confirm?token=…・外枠の外の画面）。入口の枠は段 1 の AuthFrame（部品 EmailDoneCard）。
//   開くと verifyEmailChange { token } を 1 回だけ（印は 1 回しか使えない：StrictMode でも 1 回・鍵 ["k840","verify",token]・retry なし）。
//   印が無い道は口を呼ばず「使えない」。変わった → 自分の読み（["k839","me"]）を無効にする。
//   503・網の切れ → ErrorState（E-PAGE-007）と「もう一度読む」（印は使われていないので確かめ直せる）。401 は call が入り直しへ送る
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button, ErrorState, PAGE_ERROR } from "@/components/k";
import { AuthLoading } from "@/features/F1/sign-up/auth-loading";
import { AuthFrame } from "@/features/F1/sign-up/frame";
import { EmailDoneCard } from "./dialogs";
import { verify, type VerifyDown, type VerifyResult } from "./use-email-change";
import { ME_KEY } from "./use-me";

export function EmailConfirm({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const q = useQuery<VerifyResult, VerifyDown>({
    queryKey: ["k840", "verify", token],
    queryFn: () => verify(token ?? ""),
    enabled: token !== null,
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const changed = q.data?.kind === "changed";
  useEffect(() => {
    if (changed) void qc.invalidateQueries({ queryKey: ME_KEY });
  }, [changed, qc]);

  if (token === null) return <EmailDoneCard kind="unusable" />;
  if (q.isError) {
    return (
      <AuthFrame foot="help">
        <ErrorState code={PAGE_ERROR.loadFailed} heading={1} />
        <div className="k-state-actions">
          <Button variant="primary" onClick={() => void q.refetch()}>
            もう一度読む
          </Button>
        </div>
      </AuthFrame>
    );
  }
  if (!q.data || q.data.kind === "auth") return <AuthLoading />;
  return <EmailDoneCard kind={q.data.kind} />;
}
