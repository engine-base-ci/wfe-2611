// 外枠の並べ方（KN-105）。中身は全部 flow.json から生成した lib/nav.ts（G27 が最新かを見る）。画面ごとに手で並べない（screen-derivation §6）
//   ・左のバーの上：役割の主ナビ（ワークスペースの管理・自分のメニューを除く）
//   ・左のバーの下：ワークスペースの管理（ある役割だけ）
//   ・自分のメニュー：右上の自分のボタンの中（自分の設定・つなぐ・問い合わせ・お知らせ）
//   ・スマホの下のタブ：主ナビの先頭 3 本＋メニュー（全部はメニューの中）
//   行き先は、その役割が入れる画面（by_role）のうち、まとまりの先頭。まだ作っていない画面は「準備中」で押させない（lib/built-routes.ts）
import { NAV, type RoleId, type ScreenId } from "@/lib/nav";

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  href: string;
  current: boolean;
  /** まだ作っていない画面（押すと行き止まりになるので押させない） */
  pending: boolean;
  badge?: number;
}
export interface ShellNav {
  main: NavItem[];
  bottom: NavItem[];
  me: NavItem[];
  tabs: NavItem[];
}
export interface NavOptions {
  /** いま見ている画面（flow の screen id）。そのまとまりを「いまの場所」にする */
  screen?: string;
  /** 自分の名前（「（名前）のAI」の名前） */
  memberName: string;
  /** まとまりごとの数（承認待ち 2 件 など） */
  badges?: Partial<Record<string, number>>;
  built: readonly string[];
}

const BOTTOM = new Set(["company"]);
const ME = "me";

/** 作った画面か（built-routes は app の page から機械生成。:id の形のまま並ぶので、そのまま比べる） */
export function isBuilt(route: string, built: readonly string[]): boolean {
  return built.includes(route);
}

export function navFor(role: RoleId, o: NavOptions): ShellNav {
  const allowed = new Set<string>(NAV.byRole[role] ?? []);
  const keys = NAV.sectionsByRole[role] ?? [];
  const item = (key: string): NavItem | null => {
    const sec = NAV.sections.find((s) => s.key === key);
    if (!sec) return null;
    // 役割の一覧（by_role）が無い役割（運営など）は、まとまりの画面を全部使える
    const first = sec.screens.find((id) => allowed.size === 0 || allowed.has(id)) ?? sec.screens[0];
    if (!first) return null;
    const route = NAV.screens[first as ScreenId]?.route ?? "/";
    return {
      key,
      label: sec.label.replace("（名前）", o.memberName),
      icon: sec.icon,
      href: route,
      current: o.screen ? sec.screens.includes(o.screen) : false,
      pending: !isBuilt(route, o.built),
      ...(o.badges?.[key] ? { badge: o.badges[key] } : {}),
    };
  };
  const all = keys.map(item).filter((x): x is NavItem => x !== null);
  const main = all.filter((x) => !BOTTOM.has(x.key) && x.key !== ME);
  const bottom = all.filter((x) => BOTTOM.has(x.key));
  const meSec = NAV.sections.find((s) => s.key === ME);
  const me = keys.includes(ME)
    ? (meSec?.screens ?? [])
        .filter((id) => allowed.size === 0 || allowed.has(id))
        .map((id) => {
          const s = NAV.screens[id as ScreenId];
          return {
            key: id,
            label: s.name,
            icon: "",
            href: s.route,
            current: o.screen === id,
            pending: !isBuilt(s.route, o.built),
          };
        })
    : [];
  return { main, bottom, me, tabs: main.slice(0, 3) };
}
