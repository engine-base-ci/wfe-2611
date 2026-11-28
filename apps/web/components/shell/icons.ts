import {
  Building2,
  CalendarCheck,
  LifeBuoy,
  ListChecks,
  Settings,
  Target,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
// flow.json navigation.sections[].icon（lucide の名前）→ 部品。絵文字は使わない
export const SECTION_ICON: Record<string, LucideIcon> = {
  "calendar-check": CalendarCheck,
  "user-round-cog": UserRoundCog,
  "list-checks": ListChecks,
  target: Target,
  "building-2": Building2,
  settings: Settings,
  "life-buoy": LifeBuoy,
};
