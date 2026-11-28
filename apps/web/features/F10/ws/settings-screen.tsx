"use client";
// 設定（K-831・画面 company-settings・道 /settings/company）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・第 2 ナビ（WsSub）・本文（SettingsPage）。
//   口：getWorkspaceSettings（K-827）を 1 回読む。名前は updateWorkspace（K-827）・ロゴは uploadWorkspaceLogo（K-828・multipart）・
//   誰ができるかは updateWorkspacePermissions（K-829・本人確認の取り直し）。書いた答えで差し替え、読み直さない。
//   押せるかは口の答えの access で決める（役で決めない・D-154.83）。閲覧のみ（依頼する側）は役で先に止める（口 0 回）。口の 403 も同じ「権限なし」
//   K-832：消す手続きの小窓（SETTINGS_DIALOGS の delete）に読み直しと権限なしを渡し、手続き中の帯（読みの deletion）と取り消し（cancelWorkspaceDeletion）をつなぐ
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Button, ErrorState, Loading, NoAccess } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { useMyRoles } from "@/lib/auth/role";
import { StepUp } from "@/features/F1/security/step-up";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { WsHead, WsSub } from "@/features/F10/invite/views";
import { PlanRow } from "@/features/F12/billing/plan-row";
import { usePlans } from "@/features/F12/billing/use-plans";
import { SettingsPage } from "./settings";
import { useCancelDeletion } from "./delete-flow";
import { SETTINGS_DIALOGS, openable, useOpenDialog } from "./settings-dialogs";
import {
  LOGO_MAX_BYTES,
  LOGO_TOO_BIG,
  cleanName,
  clockText,
  initialOf,
  nameProblem,
  noteText,
  toWhoRows,
  withLogo,
  withPermissions,
  withWorkspace,
  type PermKey,
  type PermValue,
  type SettingsAnswer,
} from "./settings-shape";
import { deletingOf } from "./use-deletion";
import { SCREEN, SettingsLoadError, usePatchSettings, useSettings } from "./use-settings";

const SAVE_FAILED = "保存できませんでした。もう一度、入れ直してください";
const DOWN = CATALOG[PAGE_ERROR.down]?.message ?? "";
const CRUMBS = [{ label: "ワークスペースの管理", disabled: true }, { label: "設定" }];
/** 閲覧のみ（依頼する側）の役。会社の設定を持たない役なので口を呼ばずに止める */
const NO_SETTINGS_ROLE = "R4";
const noop = () => undefined;

type PermBody = Partial<Record<PermKey, PermValue>>;
interface NameView {
  status?: "saved";
  at?: string;
  error?: string;
}

/** 口の断りの文（503・網の切れは正本の E-PAGE-003・ほかは口の文） */
const failText = (r: CallErr): string => (r.status === 503 ? DOWN : (r.message ?? CATALOG[r.code]?.message ?? DOWN));

function Frame({ children }: { children: ReactNode }) {
  return (
    <TicketShell screen="company-settings" crumbs={CRUMBS}>
      {children}
    </TicketShell>
  );
}

function Denied() {
  return (
    <Frame>
      <section className="k-root k-page k-me-page k-inv-page" aria-label="設定">
        <NoAccess acts={[noop, "/tickets"]} />
      </section>
    </Frame>
  );
}

export function SettingsScreen() {
  const { roles } = useMyRoles();
  const blocked = roles?.includes(NO_SETTINGS_ROLE) ?? false;
  const q = useSettings(roles !== undefined && !blocked);
  // プランの読み（K-962）を設定の読みと同時に始める（同じ鍵を PlanRow が読む・閲覧のみの役では呼ばない）
  usePlans(roles !== undefined && !blocked);
  const patch = usePatchSettings();
  const dialogs = useOpenDialog();
  const [denied, setDenied] = useState(false);
  const [name, setName] = useState<NameView>({});
  const [logoNotice, setLogoNotice] = useState<string | undefined>();
  const [permNotice, setPermNotice] = useState<string | undefined>();
  const [permBusy, setPermBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ reason: string; withCode: boolean; withPasskey: boolean } | null>(null);
  const savingName = useRef(false);
  const sendingLogo = useRef(false);
  const sendingPerm = useRef(false);
  const pending = useRef<PermBody | null>(null);
  const reload = () => q.refetch();
  const cancelFlow = useCancelDeletion({ reload, onDenied: () => setDenied(true) });
  const data = q.data;

  // 口が取り直しを求めた後は、やめて押し直しても送らず取り直しの小窓から（前の送りを繰り返さない・K-820 の形に揃える PM の決め 2026-11-28）
  const needStepUp = useRef<{ two_factor?: boolean; has_password?: boolean } | null>(null);
  if (roles === undefined) return <Frame>{<Loading />}</Frame>;
  const loadErr = q.error instanceof SettingsLoadError ? q.error.result : null;
  if (blocked || denied || loadErr?.kind === "forbidden") return <Denied />;
  if (q.isError) {
    return (
      <Frame>
        <section className="k-root k-page k-me-page k-inv-page" aria-label="設定">
          <ErrorState code={loadErr ? errorCodeOf(loadErr) : PAGE_ERROR.loadFailed} />
          <Button variant="outlined" onClick={() => void q.refetch()}>
            もう一度読む
          </Button>
        </section>
      </Frame>
    );
  }
  if (!data) return <Frame>{<Loading />}</Frame>;

  // ---- 名前：欄を離れた・Enter。誤り・同じ名前・送っている間は送らない
  const saveName = async (text: string) => {
    const next = cleanName(text);
    if (savingName.current || nameProblem(text) || next === data.workspace.name) return;
    savingName.current = true;
    try {
      const r = await call("updateWorkspace", { body: { name: next }, screenId: SCREEN });
      if (r.ok) {
        const ws = (r.data as unknown as { workspace?: Partial<SettingsAnswer["workspace"]> }).workspace;
        patch((a) => withWorkspace(a, ws ?? { name: next }));
        setName({ status: "saved", at: clockText(new Date()) });
      } else if (r.kind === "forbidden") setDenied(true);
      else if (r.kind === "invalid") setName({ error: r.fields["name"] ?? r.message ?? SAVE_FAILED });
      else setName({ error: SAVE_FAILED });
    } catch {
      setName({ error: SAVE_FAILED }); // 網が切れた：入れた字は残す
    } finally {
      savingName.current = false;
    }
  };

  // ---- ロゴ：2 MB を超える物は口を呼ばない。どの断りでも前のロゴのまま
  const sendLogo = async (file: File) => {
    if (sendingLogo.current) return;
    if (file.size > LOGO_MAX_BYTES) return setLogoNotice(LOGO_TOO_BIG);
    setLogoNotice(undefined);
    sendingLogo.current = true;
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const r = await call("uploadWorkspaceLogo", { form, screenId: SCREEN });
      if (r.ok) {
        const logo = (r.data as unknown as { logo?: SettingsAnswer["workspace"]["logo"] }).logo;
        if (logo) patch((a) => withLogo(a, logo));
      } else if (r.kind === "forbidden") setDenied(true);
      else setLogoNotice(failText(r));
    } catch {
      setLogoNotice(DOWN);
    } finally {
      sendingLogo.current = false;
    }
  };

  // ---- 誰ができるか：選んだ鍵だけ送る。403 STEP_UP_REQUIRED は取り直しのあと同じ体で 1 回だけ送り直す
  const askStepUp = async (body: PermBody) => {
    const key = Object.keys(body)[0] as PermKey | undefined;
    const row = data.permissions.find((p) => p.key === key);
    const sec = needStepUp.current ?? (await readSec());
    needStepUp.current = sec;
    pending.current = body;
    setStepUp({
      reason: `${row?.name ?? ""}を変える前に、本人か確かめます`,
      withCode: sec.two_factor === true,
      withPasskey: sec.has_password === false,
    });
  };
  const readSec = async (): Promise<{ two_factor?: boolean; has_password?: boolean }> => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    return s.ok ? s.data : {};
  };
  const sendPerm = async (body: PermBody, retried: boolean) => {
    if (sendingPerm.current) return;
    if (!retried && needStepUp.current) return void (await askStepUp(body));
    sendingPerm.current = true;
    setPermBusy(true);
    setPermNotice(undefined);
    try {
      const r = await call("updateWorkspacePermissions", { body: body as never, screenId: SCREEN });
      if (r.ok || r.kind !== "step_up") needStepUp.current = null;
      if (r.ok) {
        const got = (r.data as unknown as { permissions?: { key: PermKey; value: PermValue }[] }).permissions;
        const changed = got ?? (Object.entries(body) as [PermKey, PermValue][]).map(([k, v]) => ({ key: k, value: v }));
        patch((a) => withPermissions(a, changed));
      } else if (r.kind === "step_up" && !retried) await askStepUp(body);
      else if (r.kind === "forbidden") setDenied(true);
      else setPermNotice(failText(r));
    } catch {
      setPermNotice(DOWN);
    } finally {
      sendingPerm.current = false;
      setPermBusy(false);
    }
  };
  const pickPerm = (key: PermKey, value: PermValue) => {
    const row = data.permissions.find((p) => p.key === key);
    if (!row || row.value === value) return; // 今の値を選び直しても送らない
    void sendPerm({ [key]: value }, false);
  };

  const canDelete = openable("delete") && data.access.delete_workspace;
  const Dialog = dialogs.open ? SETTINGS_DIALOGS[dialogs.open] : undefined;
  const company = data.workspace.name;
  // プランと支払いの 1 行と小窓（K-962・段 13）
  const planRow: ReactNode = <PlanRow workspace={company} />;
  const deleting = deletingOf(data);
  return (
    <Frame>
      <WsHead name={company} initial={initialOf(company)} />
      <div className="k-me-wrap">
        <WsSub active="settings" items={{ members: { href: "/members" } }} />
        <SettingsPage
          s={{
            name: company,
            initial: initialOf(company),
            logo: data.workspace.logo.kind,
            ...(name.status ? { nameStatus: name.status } : {}),
            ...(name.at ? { nameSavedAt: name.at } : {}),
          }}
          planRow={planRow}
          who={toWhoRows(data)}
          onPerm={pickPerm}
          permBusy={permBusy || stepUp !== null}
          {...(permNotice ? { permNotice } : {})}
          onName={(text) => void saveName(text)}
          {...(name.error ? { nameError: name.error } : {})}
          logoUrl={data.workspace.logo.kind === "image" ? data.workspace.logo.url : null}
          onLogoFile={(file) => void sendLogo(file)}
          {...(logoNotice ? { logoNotice } : {})}
          fixedNote={noteText(data.fixed_rules)}
          deleteDisabled={!canDelete}
          {...(openable("delete") ? { deleteHint: "" } : {})}
          onDelete={() => dialogs.show("delete")}
          readOnly={!data.access.admin}
          {...(deleting ? { deleting } : {})}
          onCancelDeletion={cancelFlow.cancel}
          cancelDisabled={!data.access.delete_workspace}
          cancelBusy={cancelFlow.busy}
          {...(cancelFlow.notice ? { cancelNotice: cancelFlow.notice } : {})}
        />
      </div>
      {Dialog ? (
        <Dialog open onClose={dialogs.close} settings={data} reload={reload} onDenied={() => setDenied(true)} />
      ) : null}
      {cancelFlow.stepUp}
      <StepUp
        open={stepUp !== null}
        reason={stepUp?.reason ?? ""}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId={SCREEN}
        onDone={() => {
          setStepUp(null);
          const body = pending.current;
          pending.current = null;
          if (body) void sendPerm(body, true);
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null;
        }}
      />
    </Frame>
  );
}
