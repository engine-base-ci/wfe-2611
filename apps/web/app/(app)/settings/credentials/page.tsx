"use client";
// ログイン情報を預ける（T-U-10・A10）。状態：預けたもの（n）／追加する（a）／入力（i）／空（ge）／運用中（s）。平文は関門 C8 で暗号化、AI には参照 ID だけ
import { useState } from "react";
import { Button, Empty, Field, Input, Section, Table, Td, Th, Pill } from "@/components/ui";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { RequireRole } from "@/lib/auth/role";
import { AuthExtError, storeCredential } from "@/lib/auth/ext";
import { KeyRound } from "lucide-react";

interface Stored {
  id: string;
  vault_ref: string;
  service_name: string;
}
export default function CredentialsPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="ログイン情報を預ける" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <RequireRole screen="credentials">
        <Credentials />
      </RequireRole>
    </RequireSession>
  );
}
function Credentials() {
  // 契約に GET /credentials が無い（08_api）。この画面の一覧は、この画面で預けた分だけ持つ。一覧の API は仕様の穴として報告（T-U-10 の audit）
  const [rows, setRows] = useState<Stored[]>([]);
  const [state, setState] = useState<"list" | "a" | "i">("list");
  const [service, setService] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const r = await storeCredential({
        service_name: service.normalize("NFKC").trim(),
        login,
        password,
        ...(totp ? { totp_secret: totp } : {}),
      });
      setRows((x) => [...x, { id: r.id, vault_ref: r.vault_ref, service_name: r.service_name ?? service }]);
      setService("");
      setLogin("");
      setPassword("");
      setTotp("");
      setState("list");
    } catch (err) {
      setMsg(err instanceof AuthExtError ? err.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };
  return (
    <WizardLayout
      title="ログイン情報を預ける"
      purpose="AI社員が使う外部サービスのログイン情報を、暗号化して預けます。AIには一切見せません。"
      existing={WIZARD_EXISTING}
    >
      {state === "list" ? (
        rows.length === 0 ? (
          <div data-state="ge">
            <Empty
              icon={<KeyRound />}
              title="まだ資格情報がありません"
              action={<Button onClick={() => setState("a")}>追加する</Button>}
            >
              使う外部サービスの資格情報を暗号化して預ける。AIには一切見せない。最初の 1 件が入るとここに並びます。
            </Empty>
          </div>
        ) : (
          <div data-state="n">
            <Section
              title="預けたもの"
              aside={
                <Button size="sm" onClick={() => setState("a")}>
                  追加する
                </Button>
              }
            >
              <Table>
                <thead>
                  <tr>
                    <Th>サービス</Th>
                    <Th>自動操作</Th>
                    <Th>状態</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td>{r.service_name}</Td>
                      <Td>
                        <Pill tone="neutral">判定はサービス台帳で</Pill>
                      </Td>
                      <Td>
                        預けた · 預かり先の番号{" "}
                        <code className="num font-[var(--font-code)]">{r.vault_ref.slice(0, 10)}</code>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Section>
            <Section title="ここに預けたものの扱い">
              <ul className="list-disc space-y-1 pl-5 text-[13px]">
                <li>ログイン名・パスワード・ワンタイムコードの鍵は暗号化して保管</li>
                <li>入力するのは実行器（Bridge）。AIにも自分のAIにも渡らない</li>
                <li>AIが受け取るのは預かり先の番号だけ</li>
                <li>誰がいつ使ったかは証跡に残る。あなたが見られる</li>
              </ul>
            </Section>
          </div>
        )
      ) : state === "a" ? (
        <div data-state="a">
          <Section title="追加する">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = service.normalize("NFKC").replace(/\s+/g, " ").trim(); // 境界で正規化（全角・空白）
                if (v) {
                  setService(v);
                  setState("i");
                } else setMsg("サービス名を入れてください");
              }}
              noValidate
            >
              <Field
                label="サービス"
                help="入力すると、そのサービスの利用規約から自動操作の可否を判定して出します（サービス台帳）。禁止のサービスは、預けても操作しません"
                error={msg ?? undefined}
              >
                {(id) => (
                  <Input
                    id={id}
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    placeholder="例：発注ナビ"
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button type="submit">次へ</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setState("list");
                    setMsg(null);
                  }}
                >
                  やめる
                </Button>
              </div>
            </form>
          </Section>
        </div>
      ) : (
        <div data-state="i">
          <Section title={`${service} のログイン情報`}>
            <p className="mb-4 text-[13.5px]">
              ここに入れた値は、<b>この画面を閉じた後は誰にも表示されません</b>。あなたにも、自分のAIにも。
            </p>
            <form onSubmit={save} noValidate>
              <Field label="メールアドレス（ログイン名）">
                {(id) => <Input id={id} autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} />}
              </Field>
              <Field label="パスワード" error={msg ?? undefined}>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={!!msg}
                  />
                )}
              </Field>
              <Field
                label="2段階認証のシークレット（あれば）"
                help="認証アプリの登録時に出る文字列。Bridge が6桁を生成します"
              >
                {(id) => <Input id={id} autoComplete="off" value={totp} onChange={(e) => setTotp(e.target.value)} />}
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  保存する
                </Button>
                <Button type="button" variant="ghost" onClick={() => setState("list")}>
                  やめる
                </Button>
              </div>
            </form>
          </Section>
        </div>
      )}
    </WizardLayout>
  );
}
