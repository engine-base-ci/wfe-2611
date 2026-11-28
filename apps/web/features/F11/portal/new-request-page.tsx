"use client";
// 依頼を出す /portal/requests/new（K-912）。値と動きは use-new-request、見た目は部品 NewRequestForm（口を呼ばない）。
//   会社の名前は外枠の文脈（口の tenant_name）、届け先の名前とゲストのグループの名前はホームの読み（外枠と同じ鍵・同じ住所を 2 回呼ばない）
//   ホームの読みが済むまで中身を出さない（会社の名前が分からないまま字を出さない・読めなければ K-911 のホームと同じ読めない形）
import { useRouter } from "next/navigation";
import { ErrorState, PAGE_ERROR } from "@/components/k";
import { NewRequestForm } from "./request";
import { usePortalCompany } from "./frame";
import { usePortalHome } from "./use-portal-home";
import { useNewRequest } from "./use-new-request";
import { NotVisible, SessionExpired } from "./work";

const HERE = "/portal/requests/new";

export function NewRequestPage() {
  const router = useRouter();
  const company = usePortalCompany();
  const home = usePortalHome();
  const h = home.data?.ok ? home.data.data : null;
  const group = h?.group_name ?? "";
  const scope = h?.request_scope_name ?? "";
  const f = useNewRequest();
  const toHome = () => router.push("/portal");
  const relogin = () => router.push(`/login?next=${encodeURIComponent(HERE)}`);

  if (f.expired) return <SessionExpired onRelogin={relogin} />;
  if (home.isPending) return null;
  if (!h) {
    const kind = home.data?.ok === false ? home.data.err.kind : undefined;
    if (kind === "unauthenticated") return <SessionExpired onRelogin={relogin} />;
    if (kind === "forbidden") return <NotVisible groupName="" onBack={() => router.push("/")} />;
    return <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void home.refetch()]} />;
  }
  if (f.sent) return <NewRequestForm phase="sent" onBack={toHome} />;
  return (
    <>
      <h1 className="k-f11p-h1">依頼を出す</h1>
      {company && scope && group ? (
        <p className="k-f11p-sub">{`${company} の${scope}グループに届きます。${group}の皆さんにも見えます`}</p>
      ) : null}
      <NewRequestForm
        value={f.body}
        onChange={f.setBody}
        onBlurBody={f.onBlurBody}
        bodyError={f.bodyError}
        questions={f.questions}
        pcOpen={f.pcOpen}
        due={{ value: f.due, options: f.dueChoices, onChange: f.setDue, error: f.dueError }}
        files={f.files}
        badFiles={f.badFiles}
        onAddFile={f.addFiles}
        onRemoveFile={f.removeFile}
        attachFull={f.attachFull}
        busy={f.busy}
        error={f.error}
        onSubmit={f.submit}
        note={group && company ? `この依頼は、${group}の皆さんと ${company} に見えます。` : ""}
      />
    </>
  );
}
