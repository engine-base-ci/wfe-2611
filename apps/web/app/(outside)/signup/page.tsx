"use client";
// アカウントを作る（T-U-01・A01）。会社名とメールだけ。既に登録済みなら状態 e（ログイン／入り直しへの導線を必ず出す）
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input } from "@/components/ui";
import { OutsideLayout, SETUP_STEPS } from "@/components/outside/outside-layout";
import { AuthExtError, signUp } from "@/lib/auth/ext";

const schema = z.object({
  email: z
    .string()
    .transform((v) => v.normalize("NFKC").replace(/\s+/g, "").toLowerCase())
    .pipe(z.string().email("メールアドレスの形式が違います")),
  password: z
    .string()
    .min(12, "パスワードは 12 文字以上にしてください")
    .regex(/[a-zA-Z]/, "英字を含めてください")
    .regex(/\d/, "数字を含めてください"),
  company_name: z
    .string()
    .transform((v) => v.normalize("NFKC").trim())
    .pipe(z.string().min(1, "会社名（または屋号）を入れてください")),
  agree: z.boolean().refine((v) => v, { message: "利用規約とプライバシーポリシーへの同意が要ります" }),
});
type Form = z.input<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [state, setState] = useState<"n" | "e">("n");
  const [serverError, setServerError] = useState<string | null>(null);
  const f = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", company_name: "", agree: false },
  });
  const onSubmit = f.handleSubmit(async (v) => {
    setServerError(null);
    try {
      const r = await signUp({ email: v.email, password: v.password, company_name: v.company_name });
      router.push(`/verify-email?sent=1&email=${encodeURIComponent(r.email)}`);
    } catch (e) {
      if (e instanceof AuthExtError && e.code === "E-CONF-001") return setState("e");
      if (e instanceof AuthExtError && e.field) return f.setError(e.field as keyof Form, { message: e.message });
      setServerError(e instanceof Error ? e.message : "うまくいきませんでした");
    }
  });
  return (
    <OutsideLayout
      pitch={
        <>
          自分のAIが、
          <br />
          会社を回す。
        </>
      }
      lead="会社のことを自分のAIに話すだけで、目標・台帳・担当業務・AI社員のたたき台ができます。毎日は自分のAIと話し、自分のAIがAI社員に配り、上がってきたものを一次確認してからあなたに上げます。あなたが押すのは、最後の一手だけです。"
      steps={SETUP_STEPS}
    >
      <h1 className="text-h1 font-bold tracking-[-0.015em]">アカウントを作る</h1>
      <p className="mt-1 text-[13.5px] text-[var(--on-sv)]">
        会社名とメールだけ。ここではまだ何も設定しません。設定はこのあと自分のAIと話しながら作ります。
      </p>
      <form className="mt-6" onSubmit={onSubmit} noValidate data-state={state}>
        <Field
          label="メールアドレス"
          error={
            f.formState.errors.email?.message ??
            (state === "e" ? "このメールアドレスは既に登録されています" : undefined)
          }
        >
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="yamada@example.com"
              {...f.register("email")}
              invalid={!!f.formState.errors.email || state === "e"}
            />
          )}
        </Field>
        {state === "e" ? (
          <p className="-mt-2 mb-4 text-[13px]" role="status">
            <Link className="font-semibold text-[var(--primary)] underline" href="/login">
              ログイン
            </Link>{" "}
            するか、
            <Link className="font-semibold text-[var(--primary)] underline" href="/password-reset">
              パスワードの再設定
            </Link>{" "}
            へ。
          </p>
        ) : null}
        <Field
          label="パスワード"
          help="英字と数字を含む 12 文字以上。よく使われるパスワードは弾きます"
          error={f.formState.errors.password?.message}
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              placeholder="英字と数字で 12 文字以上"
              {...f.register("password")}
              invalid={!!f.formState.errors.password}
            />
          )}
        </Field>
        <Field
          label="会社名（または屋号）"
          help="あとから変えられます。個人事業なら屋号かお名前で構いません"
          error={f.formState.errors.company_name?.message}
        >
          {(id) => (
            <Input
              id={id}
              type="text"
              autoComplete="organization"
              placeholder="山田工務店"
              {...f.register("company_name")}
              invalid={!!f.formState.errors.company_name}
            />
          )}
        </Field>
        <label className="mb-5 flex items-start gap-2 text-[13px]">
          <input type="checkbox" className="mt-1 size-4" {...f.register("agree")} />
          <span>
            利用規約とプライバシーポリシーに同意します
            {f.formState.errors.agree ? (
              <span className="block text-[12px] font-medium text-[var(--error)]" role="alert">
                {f.formState.errors.agree.message}
              </span>
            ) : null}
          </span>
        </label>
        {serverError ? (
          <p className="mb-3 text-[13px] font-medium text-[var(--error)]" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
          {f.formState.isSubmitting ? "作っています" : "はじめる"}
        </Button>
      </form>
      <p className="mt-5 text-[13px] text-[var(--on-sv)]">
        すでにお持ちですか？{" "}
        <Link className="font-semibold text-[var(--primary)] underline" href="/login">
          ログイン
        </Link>
      </p>
    </OutsideLayout>
  );
}
