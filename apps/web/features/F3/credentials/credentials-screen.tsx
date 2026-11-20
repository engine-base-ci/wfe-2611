"use client";
// 預けたログイン情報（K-356・画面 credentials・道 /settings/credentials）。外枠（TicketShell）の中に、自分の設定の第 2 ナビ（MeSub・「預けたログイン情報」）と本文。
//   見た目はモック /dev/mock/f3/cred-* と同じ部品（views.tsx）。動き：開くと一覧の口 listCredentials を 1 回 → 値の直し方（to-item.ts）→ 層でタブに分ける。
//   タブを替えても口を呼ばない。401 はログインへ（next はこの道）・ほかの失敗と網の切れは部品の「読めない」（赤の箱）。
//   「預ける」（預ける小窓・段 4）と行の操作（上書き・消す・コードを入れる・もう一度確かめる）は出すが灰色で押せない（D-145.9）。押せるようにするのは後の葉
//   会社名と名前は外枠と同じ問い合わせ（鍵 ["me"]）の答え。口は増えない
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loading, MeSub } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { toItem, type CredentialAnswer, type CredentialRow, type Layer } from "./to-item";
import { CredentialsBody, CredentialsHead } from "./views";

const SCREEN = "credentials";
const PATH = "/settings/credentials";
const loginUrl = (): string => `/login?next=${encodeURIComponent(PATH)}`;

/** 一覧の読み：null は読んでいる途中・"failed" は読めなかった */
type ListState = CredentialRow[] | "failed" | null;

function useCredentialList(): { list: ListState; load: () => Promise<void> } {
  const [list, setList] = useState<ListState>(null);
  const load = useCallback(async () => {
    try {
      const r = await call("listCredentials", { screenId: SCREEN });
      if (r.ok) {
        const now = new Date();
        setList((r.data as CredentialAnswer[]).map((c) => toItem(c, now)));
        return;
      }
      if (r.kind === "unauthenticated") {
        window.location.replace(loginUrl());
        return;
      }
      setList("failed");
    } catch {
      setList("failed"); // 網が切れた（口に届かない）
    }
  }, []);
  return { list, load };
}

/** 外枠と同じ鍵の自分の情報（会社名は workspace_name・K-253） */
type Me = Awaited<ReturnType<typeof me>> & { workspace_name?: string | null };

export function CredentialsScreen() {
  const { list, load } = useCredentialList();
  const [tab, setTab] = useState<Layer>("workspace");
  const started = useRef(false);
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const mine = who.isSuccess ? (who.data as Me) : null;

  // ログインしていなければ、口を呼ばずにログインへ（戻り先はこの道）
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!getToken()) {
      window.location.replace(loginUrl());
      return;
    }
    void load();
  }, [load]);

  const items = Array.isArray(list) ? list.filter((it) => it.layer === tab) : [];
  return (
    <TicketShell screen={SCREEN} crumbs={[{ label: "自分の設定", disabled: true }, { label: "預けたログイン情報" }]}>
      <div className="k-me-wrap">
        <MeSub current="credentials" />
        <section className="k-page k-me-page" aria-labelledby="credentials-title">
          <CredentialsHead />
          {list === null ? (
            <Loading />
          ) : (
            <CredentialsBody
              workspaceName={mine?.workspace_name?.trim() ?? ""}
              personalName={mine?.display_name ?? ""}
              tab={tab}
              onTab={setTab}
              items={items}
              failed={list === "failed"}
            />
          )}
        </section>
      </div>
    </TicketShell>
  );
}
