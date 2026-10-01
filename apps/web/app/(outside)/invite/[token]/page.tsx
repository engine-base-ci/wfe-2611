"use client";
// 招待を受けて参加する（T-U-03・A03）。状態：担当者として／閲覧のみとして／取り消し済み。見える範囲を先に示す（D-073）
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { Ban, Check, LogIn, Users } from "lucide-react";
import { AuthHead, AuthIcon, OutsideLayout } from "@/components/outside/outside-layout";
import { afterLogin } from "@/lib/after-login";
import { AuthExtError, acceptInvitation, invitationPreview } from "@/lib/auth/ext";

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
      router.push(afterLogin()); // 行き先は今のデータから（設定が済んでいない人を 今日 へ飛ばさない）
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
          <AuthIcon tone="ng">
            <Ban />
          </AuthIcon>
          <AuthHead title="この招待は取り消されています">
            招待した人が取り消したか、7日の期限を過ぎました。もう一度招待してもらってください。
          </AuthHead>
        </div>
      ) : (
        <form onSubmit={submit} noValidate data-state={state} data-roles={viewer ? "R4" : "R3"}>
          <div className="mb-[22px] flex gap-[9px] rounded-[var(--r-md)] bg-[var(--primary-c)] px-3.5 py-[11px] text-[12.5px] leading-[1.75] text-[var(--on-primary-c)]">
            <Users className="mt-[3px] size-4 shrink-0" aria-hidden />
            <span>
              <b>{pv!.tenant_name}</b> があなたを <b>{viewer ? "閲覧のみ" : "担当者"}</b> {viewer ? "で" : "として"}招待しています
            </span>
          </div>
          <AuthHead title="参加する">
            {viewer ? "進捗を見るだけの参加です。書き込みはできません。" : "名前とパスワードだけで入れます。"}
          </AuthHead>
          <div>
            <Field label="お名前">
              {(id) => (
                <Input
                  id={id}
                  autoComplete="name"
                  placeholder="山田 太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
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
                  placeholder="英字と数字で 12 文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  invalid={!!msg}
                />
              )}
            </Field>
          </div>
          <section className="mb-[18px] rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--card)] p-3.5 text-[13px]">
            <h2 className="mb-2 text-[12px] font-semibold text-[var(--on-sv)]">あなたに見えるもの</h2>
            <ul className="flex flex-col gap-1.5">
              {(viewer
                ? ["共有された案件の段階と進み"]
                : ["今日やること・承認待ち（自分の分）", "配られた案件と自分の進み", "代表のAIからの申し送り"]
              ).map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-[var(--st-success)]" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
            {!viewer ? (
              <p className="mt-2.5 text-[12px] text-[var(--on-sv)]">見えないもの：会社の目標の全体・売上・他の人の担当・ルールの編集</p>
            ) : null}
          </section>
          <Button type="submit" className="w-full" icon={<LogIn />} disabled={busy}>
            参加する
          </Button>
        </form>
      )}
    </OutsideLayout>
  );
}
