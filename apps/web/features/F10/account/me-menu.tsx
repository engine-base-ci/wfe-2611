"use client";
// 外枠の自分のメニューとワークスペースの切り替えの中身（K-844・行為 A74）。部品 MeMenuPanel・OrgPanel に口の答えをつなぐ。
//   箱が開いて中身が描かれたときだけ getMe を読む（鍵は K-839 と同じ・画面を開いただけでは読まない・2 回目からは読み直さない）。
//   切り替え：switchWorkspace → 200 は /tickets を開き直す（読みの鍵を全部捨てる・D-154.81）／404 は断りと自分の読み直し／
//     ほか（503・網の切れ）は E-PAGE-003 の文。答えを待つ間はどの行も押せない。401 は call が入り直しへ送る
//   届いた招待は数だけ出し、押せない形（押した先は代表の答え待ち・D-154.81）
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { applyTheme } from "@/components/k/theme";
import { call } from "@/lib/api/call";
import type { Theme } from "@/lib/theme";
import {
  ORG_GONE,
  ORG_UNREAD,
  aiHintOf,
  asMeAnswer,
  fallbackOrgRow,
  inviteLine,
  inviteTotal,
  orgRows,
  pcLine,
  whoOf,
} from "./me-menu-shape";
import { MeMenuPanel, OrgPanel } from "./menu";
import type { MeAnswer } from "./me-shape";
import { ME_KEY } from "./use-me";

const INVITES_KEY = ["k844", "invitations"] as const;
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;
const DOWN = CATALOG["E-PAGE-003"]?.message ?? "E-PAGE-003";

function useMeOnOpen(screen: string): UseQueryResult<MeAnswer> {
  return useQuery<MeAnswer>({
    queryKey: ME_KEY,
    ...ONCE,
    queryFn: async () => {
      const r = await call("getMe", { screenId: screen });
      if (!r.ok) throw new Error(r.code);
      const a = asMeAnswer(r.data);
      if (!a) throw new Error("答えの形が違う");
      return a;
    },
  });
}

export interface MeMenuBoxProps {
  screen: string;
  /** 読み中・読めないときの名前（外枠の名前） */
  fallbackName: string;
  bridgeConnected: boolean;
  theme: Theme;
  onSignOut: () => void;
}

export function MeMenuBox({ screen, fallbackName, bridgeConnected, theme, onSignOut }: MeMenuBoxProps) {
  const q = useMeOnOpen(screen);
  const [t, setT] = useState<Theme>(theme);
  const answer = q.data ?? null;
  return (
    <MeMenuPanel
      who={whoOf(answer, fallbackName)}
      aiHint={aiHintOf(answer, fallbackName)}
      pc={pcLine(bridgeConnected)}
      theme={t}
      onTheme={(next) => {
        setT(next);
        applyTheme(next);
      }}
      onSignOut={onSignOut}
      settingsHref="/account"
    />
  );
}

export interface OrgMenuBoxProps {
  screen: string;
  /** 読めないときに出す今いる会社の名前（外枠の名前） */
  workspaceName: string;
}

type Notice = null | "gone" | "down";

export function OrgMenuBox({ screen, workspaceName }: OrgMenuBoxProps) {
  const q = useMeOnOpen(screen);
  const inv = useQuery<number | null>({
    queryKey: INVITES_KEY,
    ...ONCE,
    queryFn: async () => {
      const r = await call("listMyInvitations", { screenId: screen });
      if (!r.ok) throw new Error(r.code);
      return inviteTotal(r.data, r.meta.total);
    },
  });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const done = () => {
    busyRef.current = false;
    setBusy(false);
  };
  const pick = async (id: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    let r;
    try {
      r = await call("switchWorkspace", { params: { id }, body: {}, screenId: screen });
    } catch {
      setNotice("down");
      done();
      return;
    }
    if (r.ok) {
      window.location.assign("/tickets");
      return;
    }
    if (r.kind === "not_found") {
      setNotice("gone");
      await q.refetch();
    } else if (r.kind !== "unauthenticated") {
      setNotice("down");
    }
    done();
  };
  const unread = q.isError;
  const rows = q.data ? orgRows(q.data) : unread ? [fallbackOrgRow(workspaceName)] : [];
  const text = notice === "gone" ? ORG_GONE : notice === "down" ? DOWN : null;
  return (
    <OrgPanel
      rows={rows}
      busy={busy}
      onPick={(id) => void pick(id)}
      invites={inviteLine(inv.isSuccess ? inv.data : null)}
      notice={
        unread ? (
          <div className="k-f10a-pop-line" role="status">
            <span className="k-f10a-grow">{ORG_UNREAD}</span>
            <button type="button" className="k-btn" onClick={() => void q.refetch()}>
              もう一度読む
            </button>
          </div>
        ) : text ? (
          <div className="k-f10a-pop-line" role="status">
            <span className="k-f10a-grow">{text}</span>
          </div>
        ) : null
      }
    />
  );
}
