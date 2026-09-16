"use client";
// 招待を受けて参加する（T-U-03・A03）。状態：担当者として／閲覧のみとして／取り消し済み。見える範囲を先に示す（D-073）
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Input, Pill } from "@/components/ui";
import { OutsideLayout } from "@/components/outside/outside-layout";
import { AuthExtError, acceptInvitation, invitationPreview } from "@/lib/auth/ext";
import { pendingRoute } from "@/lib/pending-route";

type Preview = Awaited<ReturnType<typeof invitationPreview>>;
export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [pv, setPv] = useState<Preview | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    invitationPreview(token).then(setPv, () => setPv(null));
  }, [token]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await acceptInvitation(token, { name, password });
      router.push(pendingRoute("/today", "T-U-13")); // 今日の画面は T-U-13 で実装（今は 404 に落ちる）
    } catch (err) {
      setMsg(err instanceof AuthExtError ? err.message : "うまくいきませんでした");
      if (err instanceof AuthExtError && err.status === 410)
        setPv((p) => (p ? { ...p, valid: false, reason: "revoked" } : p));
    } finally {
      setBusy(false);
    }
  };
  const viewer = pv?.role_id === "viewer";
  const state = pv === undefined ? "loading" : !pv || !pv.valid ? "x" : viewer ? "r4" : "n";
  return (
    <OutsideLayout
      pitch={
        <>
          招かれた人は、
          <br />
          自分の分だけ見える。
        </>
      }
      lead="会社全体の数字や統制は見えません。見えるのは、あなたに配られた仕事と、その進みだけです。どこを見ればいいかは、代表のAIが最初に説明します。"
    >
      {state === "loading" ? (
        <p className="text-[13.5px] text-[var(--on-sv)]">招待を確かめています</p>
      ) : state === "x" ? (
        <div data-state="x">
          <h1 className="text-h1 font-bold tracking-[-0.015em]">この招待は取り消されています</h1>
          <p className="mt-2 text-[14px] leading-[1.8]">
            招待した人が取り消したか、7日の期限を過ぎました。もう一度招待してもらってください。
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate data-state={state} data-roles={viewer ? "R4" : "R3"}>
          <p className="text-[13.5px]">
            <b>{pv!.tenant_name}</b> があなたを{" "}
            <Pill tone={viewer ? "neutral" : "progress"}>{viewer ? "閲覧のみ" : "担当者"}</Pill> として招待しています
          </p>
          <h1 className="mt-2 text-h1 font-bold tracking-[-0.015em]">参加する</h1>
          <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">
            {viewer ? "進捗を見るだけの参加です。書き込みはできません。" : "名前とパスワードだけで入れます。"}
          </p>
          <div className="mt-6">
            <Field label="お名前">
              {(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="メールアドレス" help="招待されたアドレス。変えられません">
              {(id) => <Input id={id} type="email" value={pv!.email} readOnly />}
            </Field>
            <Field label="パスワード" help="英字と数字を含む 12 文字以上" error={msg ?? undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={!!msg}
                />
              )}
            </Field>
          </div>
          <section className="mb-5 rounded-[var(--r-md)] bg-[var(--sv)] p-4 text-[13px]">
            <h2 className="text-[12px] font-semibold tracking-[0.05em] text-[var(--on-sv)]">あなたに見えるもの</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {viewer ? (
                <li>共有された案件の段階と進み</li>
              ) : (
                <>
                  <li>今日やること・承認待ち（自分の分）</li>
                  <li>配られた案件と自分の進み</li>
                  <li>代表のAIからの申し送り</li>
                </>
              )}
            </ul>
            <p className="mt-2 text-[12.5px] text-[var(--on-sv)]">
              見えないもの：会社の目標の全体・売上・他の人の担当・ルールの編集
            </p>
          </section>
          <Button type="submit" className="w-full" disabled={busy}>
            参加する
          </Button>
        </form>
      )}
    </OutsideLayout>
  );
}
