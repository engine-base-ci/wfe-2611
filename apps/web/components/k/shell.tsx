"use client";
// 外枠（K-25・キャンバスの左のバー・上の帯・右のパネル・スマホの下のタブ）。新しい画面は全部この中に置く
//   中身（どのまとまりを出すか・行き先）は nav-model.ts（flow.json の生成物）。数・名前・グループは呼ぶ側が API から渡す
//   幅：1024 以上は左のバー 216（畳むと 56）／768〜1023 は 56 のレール／767 以下は左のバーを出さず下のタブ（D-072）
//   右のパネル（自分の AI）は 1180 以上で既定で開く（本文 720 を保てるときだけ・D-070）。開閉は自分で替えられ、次も同じ
//   キャンバスに在る物は機能がまだでも出す（D-145.9）：作っていない項目・探す欄・知らせの鈴は、正本の「使えない状態」の薄さで押せない形にする。
//   目に見える「準備中」の字は出さない（指を置くと title で読める・D-144.1）。帯の題は見出しにしない（1 画面の h1 は本文の 1 つ・K-138）
//   使えない項目は role と aria-disabled と tabIndex で読み上げとキーボードに伝える（Enter でも動かない）
//   767 以下はキャンバス MobileList どおり上の帯を出さない。鈴は本文の見出しの右（ShellBell を本文が置く）・自分のメニューは下のタブの「メニュー」の中
import { Menu as M } from "@base-ui/react/menu";
import { Bell, CircleUser, Inbox, LifeBuoy, PanelLeft, PanelRight, Search, type LucideIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BUILT_ROUTES } from "@/lib/built-routes";
import type { RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { EMPTY_NAV, navFor, type NavItem } from "./nav-model";
import { ThemeSwitch } from "./theme";

/** キャンバス（Main・MobileList）の絵の線をそのまま描く（flow の icon の名前と同じ鍵・K-138） */
const CANVAS_ICON: Record<string, ReactNode> = {
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  check: <path d="M20 6 9 17l-5-5" />,
  bot: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </>
  ),
  book: <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  building: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
};
/** キャンバスに絵が無い項目（運営・クライアントの場所・自分のメニュー）は部品の絵 */
const OTHER_ICON: Record<string, LucideIcon> = { "circle-user": CircleUser, inbox: Inbox, "life-buoy": LifeBuoy };
const Icon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const lines = CANVAS_ICON[name];
  if (lines)
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        {lines}
      </svg>
    );
  const C = OTHER_ICON[name] ?? CircleUser;
  return <C size={size} aria-hidden="true" strokeWidth={2} />;
};

/** 767 以下か（キャンバス MobileList の形にする幅） */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

interface BellState {
  narrow: boolean;
  notices?: number | undefined;
  onNotices?: (() => void) | undefined;
}
const BellContext = createContext<BellState>({ narrow: false });

function BellButton({ notices, onNotices, inline }: Omit<BellState, "narrow"> & { inline?: boolean }) {
  return (
    <button
      type="button"
      className={inline ? "k-icon-btn k-bell k-bell-inline" : "k-icon-btn k-bell"}
      aria-label={notices ? `知らせ（${notices} 件）` : "知らせ"}
      aria-disabled={onNotices ? undefined : true}
      title={onNotices ? undefined : "知らせ（準備中）"}
      onClick={onNotices}
    >
      <Bell size={18} aria-hidden="true" />
      {notices ? <b aria-hidden="true">{notices}</b> : null}
    </button>
  );
}

/** 767 以下で本文の見出しの右に置く鈴（キャンバス MobileList）。広い画面では帯にあるので何も出さない */
export function ShellBell() {
  const b = useContext(BellContext);
  return b.narrow ? <BellButton notices={b.notices} onNotices={b.onNotices} inline /> : null;
}

export interface Crumb {
  label: string;
  href?: string;
  /** その画面がまだ無い段：出すが押せない（href なし・aria-disabled・Tab で止まらない・正本の使えない状態の薄さ・D-145.9） */
  disabled?: boolean;
}
export interface Group {
  code: string;
  name: string;
  count?: number;
  href: string;
  /** 押しても行き先がまだ効かない（絞り込みができるまでグレーで押せない・D-145.18） */
  pending?: boolean;
  tone: "indigo" | "teal" | "amber" | "coral" | "sage" | "plum" | "lavender" | "teal-light";
}
export interface ShellProps {
  /** 役。分からないあいだ（読み中・ログインが切れた）は渡さない：役の項目を 1 つも出さない */
  role?: RoleId;
  /** いま見ている画面（flow の screen id） */
  screen: string;
  crumbs: Crumb[];
  workspace: { name: string; initial: string };
  member: { name: string; initial: string };
  groups?: Group[];
  badges?: Partial<Record<string, number>>;
  notices?: number;
  bridgeConnected: boolean;
  theme: Theme;
  /** 右のパネル（自分の AI）の中身。無ければパネルを出さない（会話の画面そのものなど） */
  panel?: ReactNode;
  /** 作るボタン（左のメニューと下のタブの＋）。無ければ作るボタンを出さない（書けるグループが無い人） */
  onCreate?: () => void;
  /** 探す。無ければ探す欄を使えない形（グレー・打てない）で出す */
  onSearch?: (q: string) => void;
  /** 知らせを開く。無ければ鈴を使えない形（グレー・押しても何も開かない）で出す */
  onNotices?: () => void;
  onSignOut?: () => void;
  /** 試験・見本で「作った画面」の一覧を替える */
  built?: readonly string[];
  children: ReactNode;
}

const PANEL_KEY = "k-shell-panel";
const NAV_KEY = "k-shell-nav";
const readPref = (k: string): boolean | null => {
  try {
    const v = window.localStorage.getItem(k);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
};
const writePref = (k: string, v: boolean) => {
  try {
    window.localStorage.setItem(k, v ? "1" : "0");
  } catch {
    /* 残せない環境（非公開の窓など）でも動く */
  }
};

function NavLink({ it, compact }: { it: NavItem; compact?: boolean }) {
  const body = (
    <>
      <Icon name={it.icon} size={compact ? 20 : 16} />
      <span className="k-nav-label">{compact ? (it.tab ?? it.label) : it.label}</span>
      {it.badge ? (
        <b className="k-nav-badge" aria-label={`${it.badge} 件`}>
          {it.badge}
        </b>
      ) : null}
    </>
  );
  if (it.pending)
    return (
      <span
        className="k-nav-item"
        data-compact={compact || undefined}
        role="link"
        aria-disabled="true"
        tabIndex={0}
        title={`${it.label}（準備中）`}
      >
        {body}
      </span>
    );
  return (
    <a
      className="k-nav-item"
      data-compact={compact || undefined}
      href={it.href}
      title={it.label}
      aria-current={it.current ? "page" : undefined}
    >
      {body}
    </a>
  );
}

function MeMenu({
  me,
  member,
  theme,
  onSignOut,
}: {
  me: NavItem[];
  member: { name: string; initial: string };
  theme: Theme;
  onSignOut?: (() => void) | undefined;
}) {
  return (
    <M.Root>
      <M.Trigger className="k-me" aria-label="自分のメニュー">
        <span className="k-avatar" aria-hidden="true">
          {member.initial}
        </span>
        ▾
      </M.Trigger>
      <M.Portal>
        <M.Positioner sideOffset={6} align="end">
          <M.Popup className="k-select-popup k-menu">
            <div className="k-menu-head">{member.name}</div>
            {me.map((it) =>
              it.pending ? (
                <M.Item key={it.key} className="k-select-item" disabled title={`${it.label}（準備中）`}>
                  {it.label}
                </M.Item>
              ) : (
                <M.Item key={it.key} className="k-select-item" render={<a href={it.href} />}>
                  {it.label}
                </M.Item>
              ),
            )}
            <div className="k-menu-theme">
              <ThemeSwitch initial={theme} />
            </div>
            {onSignOut ? (
              <M.Item className="k-select-item" onClick={onSignOut}>
                ログアウト
              </M.Item>
            ) : null}
          </M.Popup>
        </M.Positioner>
      </M.Portal>
    </M.Root>
  );
}

/** 押せない小さな印（★・会社の切り替え ▾）。読み上げは「使えないボタン」・Tab で止まる・押しても何もしない */
const Inert = ({ className, label, children }: { className: string; label: string; children: ReactNode }) => (
  <span className={className} role="button" aria-disabled="true" tabIndex={0} aria-label={label} title={label}>
    {children}
  </span>
);

export function Shell(p: ShellProps) {
  const narrow = useNarrow();
  const nav = p.role
    ? navFor(p.role, {
        screen: p.screen,
        memberName: p.member.name,
        ...(p.badges ? { badges: p.badges } : {}),
        built: p.built ?? BUILT_ROUTES,
      })
    : EMPTY_NAV;
  const searchBox = useRef<HTMLInputElement>(null);
  const [railed, setRailed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    setRailed(readPref(NAV_KEY) ?? false);
    setPanelOpen(readPref(PANEL_KEY) ?? window.matchMedia("(min-width: 1180px)").matches);
  }, []);
  // ⌘K（Ctrl+K）で探す欄へ。探すが使えないあいだは何もしない
  const canSearch = Boolean(p.onSearch);
  useEffect(() => {
    if (!canSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchBox.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSearch]);
  const toggleNav = () => {
    setRailed((v) => (writePref(NAV_KEY, !v), !v));
  };
  const togglePanel = () => {
    setPanelOpen((v) => (writePref(PANEL_KEY, !v), !v));
  };
  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (q) p.onSearch?.(q);
  };
  const title = p.crumbs.at(-1)?.label ?? "";

  const sidebar = (inSheet: boolean) => (
    <>
      <div className="k-nav-top">
        <span className="k-ws-mark" aria-hidden="true">
          {p.workspace.initial}
        </span>
        <b className="k-nav-label k-ws-name">
          {p.workspace.name}
          {p.workspace.name ? " " : ""}
          <Inert className="k-ws-switch" label="会社を切り替える（準備中）">
            ▾
          </Inert>
        </b>
        {inSheet ? null : (
          <button
            type="button"
            className="k-icon-btn k-nav-toggle"
            aria-label={railed ? "メニューを開く" : "メニューを畳む"}
            aria-expanded={!railed}
            onClick={toggleNav}
          >
            <PanelLeft size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {p.onCreate ? (
        <button type="button" className="k-nav-create" onClick={p.onCreate} title="チケットを作る">
          <span aria-hidden="true">＋</span>
          <span className="k-nav-label">チケットを作る</span>
        </button>
      ) : null}
      {nav.main.map((it) => (
        <NavLink key={it.key} it={it} />
      ))}
      {p.groups?.length ? (
        <>
          <div className="k-nav-label k-nav-sec">
            グループ
            <Inert className="k-nav-star" label="グループの★（準備中）">
              ★
            </Inert>
          </div>
          {p.groups.map((g) => {
            const body = (
              <>
                <span className="k-group-mark" data-tone={g.tone} aria-hidden="true">
                  {g.code}
                </span>
                <span className="k-nav-label">{g.name}</span>
                {g.count !== undefined ? <span className="k-nav-label k-nav-count">{g.count}</span> : null}
              </>
            );
            return g.pending ? (
              <span
                key={g.href}
                className="k-nav-item"
                data-group={g.name}
                role="link"
                aria-disabled="true"
                tabIndex={0}
                title={`${g.name}（準備中）`}
              >
                {body}
              </span>
            ) : (
              <a key={g.href} className="k-nav-item" data-group={g.name} href={g.href} title={g.name}>
                {body}
              </a>
            );
          })}
        </>
      ) : null}
      <div className="k-nav-fill" />
      {nav.bottom.map((it) => (
        <NavLink key={it.key} it={it} />
      ))}
      <div
        className="k-pc"
        data-on={p.bridgeConnected || undefined}
        title={p.bridgeConnected ? "PC つながっている" : "PC をつないでいない"}
      >
        <span className="k-pc-dot" aria-hidden="true" />
        <span className="k-nav-label">{p.bridgeConnected ? "PC つながっている" : "PC をつないでいない"}</span>
      </div>
      {inSheet ? (
        <div className="k-sheet-me">
          <MeMenu me={nav.me} member={p.member} theme={p.theme} onSignOut={p.onSignOut} />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="k-root k-shell" data-railed={railed || undefined} data-panel={(p.panel && panelOpen) || undefined}>
      <a className="k-skip" href="#k-main">
        本文へ
      </a>
      <nav aria-label="メニュー" className="k-nav">
        {sidebar(false)}
      </nav>
      <div className="k-body">
        <header className="k-bar">
          <nav aria-label="いまの場所" className="k-crumbs">
            <ol>
              {p.crumbs.map((c, i) => (
                <li key={`${c.label}-${i}`}>
                  {i > 0 ? (
                    <span className="k-crumb-sep" aria-hidden="true">
                      ›
                    </span>
                  ) : null}
                  {c.disabled && i < p.crumbs.length - 1 ? (
                    <a role="link" aria-disabled="true" tabIndex={-1} title={`${c.label}（準備中）`}>
                      {c.label}
                    </a>
                  ) : c.href && i < p.crumbs.length - 1 ? (
                    <a href={c.href}>{c.label}</a>
                  ) : (
                    <span aria-current={i === p.crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <b className="k-bar-title">{title}</b>
          <div className="k-bar-tools">
            <form role="search" className="k-search" data-disabled={canSearch ? undefined : true} onSubmit={search}>
              <label>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">探す</span>
                <input
                  ref={searchBox}
                  type="search"
                  name="q"
                  placeholder="チケット・ナレッジ・決定を探す"
                  disabled={!canSearch}
                  aria-disabled={canSearch ? undefined : true}
                />
                <span className="k-search-key" aria-hidden="true">
                  ⌘K
                </span>
              </label>
            </form>
            {narrow ? null : <BellButton notices={p.notices} onNotices={p.onNotices} />}
            {narrow ? null : <MeMenu me={nav.me} member={p.member} theme={p.theme} onSignOut={p.onSignOut} />}
            {p.panel ? (
              <button
                type="button"
                className="k-icon-btn k-panel-toggle"
                aria-label={panelOpen ? "自分の AI のパネルを閉じる" : "自分の AI のパネルを開く"}
                aria-expanded={panelOpen}
                aria-controls="k-panel"
                onClick={togglePanel}
              >
                <PanelRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </header>
        <div className="k-work">
          <main id="k-main" className="k-main" tabIndex={-1}>
            <BellContext.Provider value={{ narrow, notices: p.notices, onNotices: p.onNotices }}>
              {p.children}
            </BellContext.Provider>
          </main>
          {p.panel ? (
            <aside id="k-panel" aria-label="自分の AI" className="k-panel" hidden={!panelOpen}>
              {p.panel}
            </aside>
          ) : null}
        </div>
      </div>
      <nav aria-label="下のタブ" className="k-tabs">
        {nav.tabs.slice(0, 2).map((it) => (
          <NavLink key={it.key} it={it} compact />
        ))}
        {p.onCreate ? (
          <button type="button" className="k-tab-create" aria-label="チケットを作る" onClick={p.onCreate}>
            <span className="k-tab-plus">＋</span>
          </button>
        ) : null}
        {nav.tabs.slice(2).map((it) => (
          <NavLink key={it.key} it={it} compact />
        ))}
        <button
          type="button"
          className="k-nav-item"
          data-compact
          aria-expanded={sheet}
          aria-controls="k-sheet"
          onClick={() => setSheet((v) => !v)}
        >
          <Icon name="menu" size={20} />
          <span className="k-nav-label">メニュー</span>
        </button>
      </nav>
      {sheet ? (
        <nav id="k-sheet" aria-label="メニュー（全部）" className="k-sheet">
          {sidebar(true)}
        </nav>
      ) : null}
    </div>
  );
}
