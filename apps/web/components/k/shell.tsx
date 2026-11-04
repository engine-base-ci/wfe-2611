"use client";
// 外枠（K-25・キャンバスの左のバー・上の帯・右のパネル・スマホの下のタブ）。新しい画面は全部この中に置く
//   中身（どのまとまりを出すか・行き先）は nav-model.ts（flow.json の生成物）。数・名前・グループは呼ぶ側が API から渡す
//   幅：1024 以上は左のバー 216（畳むと 56）／768〜1023 は 56 のレール／767 以下は左のバーを出さず下のタブ（D-072）
//   右のパネル（自分の AI）は 1180 以上で既定で開く（本文 720 を保てるときだけ・D-070）。開閉は自分で替えられ、次も同じ
import { Menu as M } from "@base-ui/react/menu";
import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  ChevronDown,
  CircleCheck,
  CircleUser,
  Handshake,
  Inbox,
  LifeBuoy,
  ListChecks,
  Menu,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BUILT_ROUTES } from "@/lib/built-routes";
import type { RoleId } from "@/lib/nav";
import type { Theme } from "@/lib/theme";
import { navFor, type NavItem } from "./nav-model";
import { ThemeSwitch } from "./theme";

const ICON: Record<string, LucideIcon> = {
  "list-checks": ListChecks,
  "check-circle": CircleCheck,
  bot: Bot,
  "book-open": BookOpen,
  "building-2": Building2,
  handshake: Handshake,
  "circle-user": CircleUser,
  inbox: Inbox,
  "life-buoy": LifeBuoy,
};
const Icon = ({ name, size = 16 }: { name: string; size?: number }) => {
  const C = ICON[name] ?? ListChecks;
  return <C size={size} aria-hidden="true" strokeWidth={2} />;
};

export interface Crumb {
  label: string;
  href?: string;
}
export interface Group {
  code: string;
  name: string;
  count?: number;
  href: string;
  tone: "indigo" | "teal" | "amber" | "coral" | "sage" | "plum" | "lavender" | "teal-light";
}
export interface ShellProps {
  role: RoleId;
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
  onCreate?: () => void;
  onSearch?: (q: string) => void;
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
      <Icon name={it.icon} />
      <span className="k-nav-label">{it.label}</span>
      {it.badge ? (
        <b className="k-nav-badge" aria-label={`${it.badge} 件`}>
          {it.badge}
        </b>
      ) : null}
      {it.pending ? <span className="k-nav-pending">準備中</span> : null}
    </>
  );
  if (it.pending)
    return (
      <span
        className="k-nav-item"
        data-compact={compact || undefined}
        aria-disabled="true"
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

export function Shell(p: ShellProps) {
  const nav = navFor(p.role, {
    screen: p.screen,
    memberName: p.member.name,
    ...(p.badges ? { badges: p.badges } : {}),
    built: p.built ?? BUILT_ROUTES,
  });
  const [railed, setRailed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    setRailed(readPref(NAV_KEY) ?? false);
    setPanelOpen(readPref(PANEL_KEY) ?? window.matchMedia("(min-width: 1180px)").matches);
  }, []);
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
        <b className="k-nav-label k-ws-name">{p.workspace.name}</b>
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
          <Plus size={16} aria-hidden="true" />
          <span className="k-nav-label">チケットを作る</span>
        </button>
      ) : null}
      {nav.main.map((it) => (
        <NavLink key={it.key} it={it} />
      ))}
      {p.groups?.length ? (
        <>
          <div className="k-nav-label k-nav-sec">グループ</div>
          {p.groups.map((g) => (
            <a key={g.code} className="k-nav-item" href={g.href} title={g.name}>
              <span className="k-group-mark" data-tone={g.tone} aria-hidden="true">
                {g.code}
              </span>
              <span className="k-nav-label">{g.name}</span>
              {g.count !== undefined ? <span className="k-nav-label k-nav-count">{g.count}</span> : null}
            </a>
          ))}
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
                  {c.href && i < p.crumbs.length - 1 ? (
                    <a href={c.href}>{c.label}</a>
                  ) : (
                    <span aria-current={i === p.crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="k-bar-title">{title}</h1>
          <div className="k-bar-tools">
            <form role="search" className="k-search" onSubmit={search}>
              <label>
                <Search size={14} aria-hidden="true" />
                <span className="sr-only">探す</span>
                <input type="search" name="q" placeholder="チケット・ナレッジ・決定を探す" />
              </label>
            </form>
            <button
              type="button"
              className="k-icon-btn k-bell"
              aria-label={p.notices ? `知らせ（${p.notices} 件）` : "知らせ"}
              onClick={p.onNotices}
            >
              <Bell size={18} aria-hidden="true" />
              {p.notices ? <b aria-hidden="true">{p.notices}</b> : null}
            </button>
            <M.Root>
              <M.Trigger className="k-me" aria-label="自分のメニュー">
                <span className="k-avatar" aria-hidden="true">
                  {p.member.initial}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </M.Trigger>
              <M.Portal>
                <M.Positioner sideOffset={6} align="end">
                  <M.Popup className="k-select-popup k-menu">
                    <div className="k-menu-head">{p.member.name}</div>
                    {nav.me.map((it) =>
                      it.pending ? (
                        <M.Item key={it.key} className="k-select-item" disabled>
                          {it.label}
                          <span className="k-nav-pending">準備中</span>
                        </M.Item>
                      ) : (
                        <M.Item key={it.key} className="k-select-item" render={<a href={it.href} />}>
                          {it.label}
                        </M.Item>
                      ),
                    )}
                    <div className="k-menu-theme">
                      <ThemeSwitch initial={p.theme} />
                    </div>
                    {p.onSignOut ? (
                      <M.Item className="k-select-item" onClick={p.onSignOut}>
                        ログアウト
                      </M.Item>
                    ) : null}
                  </M.Popup>
                </M.Positioner>
              </M.Portal>
            </M.Root>
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
            {p.children}
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
            <Plus size={22} aria-hidden="true" />
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
          <Menu size={16} aria-hidden="true" />
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
