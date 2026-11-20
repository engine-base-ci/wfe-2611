"use client";
// PC の行の「…」から PC を外す動き（K-363）。見た目は K-369 の部品（pc-row-parts.tsx の PcMoreMenu・RemovePcConfirm）と段 2 の StepUp。
//   「外す」→ revokeMyDevice を 1 回（答えを待つ間は主ボタンが処理中・2 回押しで 2 回呼ばない）。
//   200 → 小窓を閉じ、一覧を読み直し、帯に「外しました…」。403・STEP_UP_REQUIRED → getMySecurity を 1 回読み取り直しの小窓。通ったら同じ PC を続けて外す。
//   404 → 帯に E-PAGE-001・一覧を読み直す。ほかの失敗（503 など）→ 帯に E-PAGE-003（行は残る）。401 は call が入り直しへ送る。
import { useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import type { Device } from "./devices";
import { nameOf } from "./pc-cards";
import { PcMoreMenu, REMOVE_PC_STEP_UP_REASON, REMOVED_PC_TEXT, RemovePcConfirm } from "./pc-row-parts";

const SCREEN = "bridge-setup";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";

/** 一覧の上の帯（外しました・失敗の文）。行が消えた後も出すので、行の外（並べる所で 1 回だけ呼ぶ hook）が持つ */
export interface RemoveBanner {
  tone: "info" | "danger";
  text: string;
}
export function RemoveBannerView({ banner }: { banner: RemoveBanner | null }) {
  if (!banner) return null;
  return <Callout tone={banner.tone}>{banner.text}</Callout>;
}

export interface RemovePcProps {
  device: Device;
  reload: () => Promise<void>;
  onBanner: (b: RemoveBanner | null) => void;
}

/** 1 台ぶん：「…」のボタン（行の直の子）と、小窓（Portal）を並べる */
export function RemovePc({ device, reload, onBanner }: RemovePcProps) {
  const name = nameOf(device);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const sending = useRef(false);

  const remove = async (): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("revokeMyDevice", { params: { id: device.id }, screenId: SCREEN });
      if (r.ok) {
        setAsking(false);
        setStepUp(null);
        onBanner({ tone: "info", text: REMOVED_PC_TEXT });
        await reload();
        return;
      }
      if (r.kind === "step_up") {
        setAsking(false);
        const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
        const sec = s.ok ? s.data : {};
        setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
        return;
      }
      setAsking(false);
      setStepUp(null);
      if (r.kind === "not_found") {
        onBanner({ tone: "danger", text: textOf(PAGE_ERROR.notFound) });
        await reload();
        return;
      }
      if (r.kind === "unauthenticated") return; // call が入り直しへ送る
      onBanner({ tone: "danger", text: textOf(PAGE_ERROR.down) });
    } catch {
      setAsking(false);
      setStepUp(null);
      onBanner({ tone: "danger", text: textOf(PAGE_ERROR.offline) }); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <PcMoreMenu
        name={name}
        onRemove={() => {
          onBanner(null);
          setAsking(true);
        }}
      />
      <RemovePcConfirm
        name={name}
        open={asking}
        busy={busy}
        onOpenChange={(o) => {
          if (!o && !sending.current) setAsking(false);
        }}
        onConfirm={() => void remove()}
      />
      <StepUp
        open={stepUp !== null}
        reason={REMOVE_PC_STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId={SCREEN}
        onDone={() => void remove()}
        onCancel={() => setStepUp(null)}
      />
    </>
  );
}
