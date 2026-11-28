"use client";
// ログイン後の画面の上の帯（障害・メンテの予定）と画面いっぱいの形（メンテ中・障害）（K-957・行為 A68・D-125.127・D-128.71）。
//   差し込み口は外枠 TicketShell の 1 か所（D-156.10）：ServiceGate が外枠ごと包み、ServiceBands が本文の前に帯を 1 つ並べる。
//   稼働状況は外枠の口 getShell の service_status（外枠が渡す・口を 1 本増やさない・PM の決め 2026-11-28）。お知らせの一覧（鍵 ["k956","notices"]）は、
//   帯が 1 つでもあるとき・画面いっぱいの形のときだけ読む（帯の 2 行目・メンテの出した日のため。無ければ口を呼ばない・G-16）。
//   読めない（503・網の切れ・形が違う）ときは帯も画面いっぱいも出さず、画面はふつうに使える（読めないのに止めない）。
//   閉じる：障害はこの画面の中だけ（別の画面でまた出る）・メンテの予定は覚える（localStorage・D-156.27）。
//   止める日・止められた画面・中を見られている間の帯（K-1008・D-156.23・D-128.68）：
//     止める日が先の stop の帯 → 帯（× なし・問い合わせる）。止めた後 → ServiceGate が止められた画面（/notices・/inquiry は通す）。
//     peek の帯：運営の側（閉じる id あり）は外枠の上に PeekBar と枠・顧客の側は帯の並びに 1 本（閉じられない）。
//     残りの分は 1 分ごとに描き直し、期限を過ぎたら稼働状況を 1 回だけ読み直す（帯が消える）
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import {
  bandView,
  downView,
  gateOf,
  peekOf,
  peekView,
  pickBand,
  stopSoonOf,
  type BandIn,
  type BandsStatusIn,
  type Gate,
} from "./bands-shape";
import { jstWhen, type NoticeIn } from "./help-shape";
import { useOpsContact } from "./ops-contact";
import {
  CustomerPeekBand,
  DownView,
  IncidentBand,
  MaintBand,
  MaintenanceView,
  PeekBar,
  StopSoonBand,
  StoppedView,
  type PeekNotice,
} from "./status-parts";
import { SCREEN, useNotices } from "./use-help";

/** メンテの帯を閉じた印（notice_id の並び）を覚える場所 */
const CLOSED_KEY = "k-band-closed";
/** 障害・メンテの帯の種類（stop・peek は別の形で出す・K-1008） */
const SHOWN = new Set<BandIn["kind"]>(["incident", "maintenance"]);
/** 障害の画面の「いまの様子を見る」（ログイン前の稼働状況） */
const STATUS_HREF = "/help";
/** 問い合わせる小窓の道（K-953）と、見るのをやめた後の運営の場所 */
const INQUIRY_HREF = "/inquiry";
const OPS_HREF = "/ops";
/** 残りの分を描き直す間（1 分） */
const TICK_MS = 60_000;

const askHref = (path: string): string => `${INQUIRY_HREF}?from=${encodeURIComponent(path)}`;

/** 今の時刻。active の間だけ 1 分ごとに進める（帯が無ければ時計を回さない・G-16） */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/** 中を見られている間の帯の期限を過ぎたら、稼働状況を 1 回だけ読み直す（同じ期限では 2 回目を呼ばない） */
function useExpireRetry(band: BandIn | null, now: number, retry: () => void): void {
  const done = useRef<string | null>(null);
  const to = band?.to ?? null;
  const expired = to !== null && Date.parse(to) <= now;
  useEffect(() => {
    if (!expired || to === null || done.current === to) return;
    done.current = to;
    retry();
  }, [expired, to, retry]);
}

function readClosed(): string[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(CLOSED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return []; // 読めない環境では画面の中だけで覚える
  }
}
function rememberClosed(id: string): void {
  try {
    const all = readClosed();
    if (!all.includes(id)) window.localStorage.setItem(CLOSED_KEY, JSON.stringify([...all, id]));
  } catch {
    // 書けない環境では画面の中だけで覚える
  }
}

/** 外枠が渡す稼働状況（getShell の service_status）と読み直し */
interface StatusProps {
  status?: unknown;
  retry?: () => void;
}

/** 稼働状況の答え（読めた時だけ・形が違えば出さない）。外枠の口 getShell の service_status を使い、口を 1 本増やさない（PM の決め 2026-11-28） */
function useStatus({ status, retry }: StatusProps): { status: BandsStatusIn | null; retry: () => void } {
  const ok =
    typeof status === "object" &&
    status !== null &&
    Array.isArray((status as { bands?: unknown }).bands) &&
    Array.isArray((status as { components?: unknown }).components);
  return { status: ok ? (status as BandsStatusIn) : null, retry: retry ?? (() => undefined) };
}

/** お知らせの一覧から 1 件（読めない・無いなら undefined） */
function useNotice(match: (n: NoticeIn) => boolean): NoticeIn | undefined {
  const q = useNotices();
  return q.data?.find(match);
}

/** 外枠の本文の前に並べる帯（無ければ何も描かない・余白を足さない）。screen は帯の場所の印（K-1008 が止める日の帯で使う） */
export function ServiceBands({ screen, ...props }: { screen: string } & StatusProps) {
  const { status, retry } = useStatus(props);
  const router = useRouter();
  const path = usePathname() ?? "/";
  const [closed, setClosed] = useState<ReadonlySet<string>>(() =>
    typeof window === "undefined" ? new Set() : new Set(readClosed()),
  );
  const peekBand = status ? peekOf(status.bands) : null;
  const customerPeek = peekBand && peekView(peekBand, 0).side === "customer" ? peekBand : null;
  const now = useNow(customerPeek !== null);
  useExpireRetry(customerPeek, now, retry);
  if (!status) return null;
  const soon = stopSoonOf(status.bands, now);
  const peek = customerPeek ? peekView(customerPeek, now) : null;
  const shownPeek = peek && peek.rest !== "0 分" ? peek : null;
  const picked = pickBand(
    status.bands.filter((b) => SHOWN.has(b.kind)),
    closed,
  );
  if (!picked && !soon && !shownPeek) return null;
  return (
    <div className="k-uh-bands" data-screen={screen}>
      {soon ? (
        <StopSoonBand day={soon.day} reason={soon.reason} onAsk={() => router.push(askHref(path) as Route)} />
      ) : null}
      {shownPeek ? <CustomerPeekBand reason={shownPeek.reason} rest={shownPeek.rest} /> : null}
      {picked ? <PickedRow picked={picked} onClosed={(id) => setClosed((prev) => new Set([...prev, id]))} /> : null}
    </div>
  );
}

/** 障害・メンテの帯（閉じた印を覚える） */
function PickedRow({
  picked,
  onClosed,
}: {
  picked: NonNullable<ReturnType<typeof pickBand>>;
  onClosed: (id: string) => void;
}) {
  const close = (): void => {
    const id = picked.band.notice_id;
    if (!id) return;
    if (picked.band.kind === "maintenance") rememberClosed(id);
    onClosed(id);
  };
  return (
    <BandRow
      key={picked.band.notice_id ?? picked.band.title}
      band={picked.band}
      others={picked.others}
      onClose={close}
    />
  );
}

/** 帯 1 つ（ここで初めてお知らせの一覧を読む） */
function BandRow({ band, others, onClose }: { band: BandIn; others: number; onClose: () => void }) {
  const router = useRouter();
  const notice = useNotice((n) => n.id === band.notice_id);
  const v = bandView(band, notice);
  const href = v.href;
  const acts = {
    onMore: href ? () => router.push(href as Route) : null,
    onClose,
    closable: band.closable,
    others,
  };
  return v.kind === "incident" ? (
    <IncidentBand title={v.title} state={v.state} note={v.note} {...acts} />
  ) : (
    <MaintBand window={v.window} impact={v.impact} {...acts} />
  );
}

/** メンテ中・画面が止まっている・ワークスペースを止めた後は外枠ごと画面いっぱいの形にする（読めない・読み中はふつうの画面）。
 *  運営が中を見ている間（運営の側）は外枠の上に帯と枠を重ねる */
export function ServiceGate({ children, ...props }: { children: ReactNode } & StatusProps) {
  const { status, retry } = useStatus(props);
  const path = usePathname() ?? "/";
  const peekBand = status ? peekOf(status.bands) : null;
  const opsPeek = peekBand && peekView(peekBand, 0).side === "ops" ? peekBand : null;
  const now = useNow(opsPeek !== null);
  useExpireRetry(opsPeek, now, retry);
  const gate = status ? gateOf(status, Date.now(), path) : null;
  if (status && gate) return <GateView gate={gate} status={status} retry={retry} path={path} />;
  const peek = opsPeek ? peekView(opsPeek, now) : null;
  if (!peek || peek.rest === "0 分" || !peek.id) return <>{children}</>;
  return (
    <div className="k-uh-peek-host">
      <OpsPeekBar id={peek.id} who={peek.who} reason={peek.reason} rest={peek.rest} />
      {children}
    </div>
  );
}

/** 見るのをやめるが断られたときの赤い箱の ID（正本に在る ID はそのまま・ほかは落ちた／読めない） */
function peekErrorCode(r: { code: string; status: number }): string {
  if (r.code in CATALOG) return r.code;
  return r.status >= 500 ? PAGE_ERROR.down : PAGE_ERROR.loadFailed;
}

/** 運営の側の帯：「見るのをやめる」は closePeek を 1 回（送っている間は 2 回目を送らない）・成功で運営の場所へ・失敗は帯の中に赤い箱 */
function OpsPeekBar({ id, who, reason, rest }: { id: string; who: string; reason: string; rest: string }) {
  const router = useRouter();
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState<PeekNotice | null>(null);
  const stop = (): void => {
    if (stopping) return;
    setStopping(true);
    setNotice(null);
    void call("closePeek", { params: { id }, screenId: SCREEN })
      .then((r) => {
        if (r.ok) {
          router.push(OPS_HREF);
          return;
        }
        const code = peekErrorCode(r);
        setNotice({ code, text: errorText(code).title });
        setStopping(false);
      })
      .catch(() => {
        setNotice({ code: PAGE_ERROR.offline, text: errorText(PAGE_ERROR.offline).title });
        setStopping(false);
      });
  };
  return <PeekBar who={who} reason={reason} rest={rest} onStop={stop} stopping={stopping} notice={notice} />;
}

function GateView({
  gate,
  status,
  retry,
  path,
}: {
  gate: Gate;
  status: BandsStatusIn;
  retry: () => void;
  path: string;
}) {
  const m = status.maintenance_now;
  const band = status.bands.find((b) => b.kind === "incident");
  const notice = useNotice((n) =>
    gate.kind === "maintenance"
      ? n.kind === "maintenance" && n.maintenance?.from === m?.from && n.maintenance?.to === m?.to
      : n.id === band?.notice_id,
  );
  if (gate.kind === "maintenance") {
    return <MaintenanceView window={gate.window} noticed={notice ? jstWhen(notice.published_at, false) : undefined} />;
  }
  if (gate.kind === "stopped") return <StoppedGate since={gate.since} reason={gate.reason} path={path} />;
  return <DownView {...downView(band, notice)} onRetry={retry} statusHref={STATUS_HREF} />;
}

/** 止められた画面：押せる物は「問い合わせる」だけ（/inquiry?from=<今の道>）・運営の宛先は設定の値 */
function StoppedGate({ since, reason, path }: { since: string; reason: string; path: string }) {
  const router = useRouter();
  const contact = useOpsContact();
  return (
    <StoppedView since={since} reason={reason} contact={contact} onAsk={() => router.push(askHref(path) as Route)} />
  );
}
