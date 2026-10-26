import {
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CircleHelp,
  FolderCheck,
  Flag,
  GraduationCap,
  Handshake,
  Hash,
  Inbox,
  LifeBuoy,
  House,
  Library,
  Megaphone,
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/lib/campus";
import { ROUTES, roleAllows, type RoutePattern } from "@/lib/routes";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown as a small dot/badge when there is something new (wired up in later milestones). */
  badgeKey?: "announcements" | "messages" | "notifications" | "reports" | "inbox";
  /**
   * Where the sidebar shows the item: "primary" is the short everyday list at the top, "more" sits
   * in the More group (closed until opened), "footer" is the row pinned to the bottom. Items with
   * no group aren't listed on their own (Spaces is reached through "Your spaces").
   */
  group?: "primary" | "more" | "footer";
}

/**
 * Every main page, in sidebar order. The command palette lists them
 * all; the sidebar shows them by group (SIDEBAR_NAV).
 */
export const MAIN_NAV: NavItem[] = [
  { label: "Home", href: "/home", icon: House, group: "primary" },
  { label: "Timetable", href: "/timetable", icon: CalendarClock, group: "primary" },
  {
    label: "Announcements",
    href: "/announcements",
    icon: Megaphone,
    badgeKey: "announcements",
    group: "primary",
  },
  { label: "Events", href: "/events", icon: CalendarDays, group: "primary" },
  { label: "Questions", href: "/questions", icon: CircleHelp, group: "primary" },
  {
    label: "Messages",
    href: "/messages",
    icon: MessageCircle,
    badgeKey: "messages",
    group: "primary",
  },
  { label: "Ask AI", href: "/ask", icon: Sparkles, group: "primary" },
  { label: "Spaces", href: "/spaces", icon: Hash },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck, group: "more" },
  { label: "Feedback", href: "/forms", icon: ClipboardList, group: "more" },
  { label: "Mentors", href: "/mentors", icon: Handshake, group: "more" },
  { label: "Resources", href: "/resources", icon: Library, group: "more" },
  { label: "Careers", href: "/careers", icon: Briefcase, group: "more" },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark, group: "more" },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    badgeKey: "notifications",
    group: "footer",
  },
  { label: "Support", href: "/support", icon: LifeBuoy, group: "footer" },
];

const inGroup = (group: NavItem["group"]) => MAIN_NAV.filter((item) => item.group === group);

/** The sidebar's three lists, plus the link to the spaces directory under "Your spaces". */
export const SIDEBAR_NAV = {
  primary: inGroup("primary"),
  more: inGroup("more"),
  footer: inGroup("footer"),
  allSpaces: { ...MAIN_NAV.find((item) => item.href === "/spaces")!, label: "All spaces" },
};

/** Admin sub-navigation (shown to staff roles only). */
export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: ShieldCheck },
  { label: "Approvals", href: "/admin/approvals", icon: Users },
  { label: "Inbox", href: "/admin/inbox", icon: Inbox, badgeKey: "inbox" },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Batches", href: "/admin/batches", icon: GraduationCap },
  { label: "Timetables", href: "/admin/timetable", icon: CalendarClock },
  { label: "Reports", href: "/admin/reports", icon: Flag, badgeKey: "reports" },
  { label: "Resources", href: "/admin/resources", icon: FolderCheck },
  { label: "Spaces", href: "/admin/spaces", icon: Hash },
  { label: "Departments", href: "/admin/departments", icon: Building2 },
  { label: "Tags", href: "/admin/tags", icon: Tags },
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "Moderation log", href: "/admin/moderation-log", icon: ScrollText },
];

/** The short admin list shown in the sidebar; the full list lives in the admin sub-navigation. */
export const ADMIN_SIDEBAR_NAV: NavItem[] = ADMIN_NAV.filter((item) =>
  [
    "/admin",
    "/admin/approvals",
    "/admin/inbox",
    "/admin/batches",
    "/admin/users",
    "/admin/reports",
  ].includes(item.href),
);

/** Admin pages this role can open (organizers only get announcements). */
export function adminNavFor(role: UserRole): NavItem[] {
  return ADMIN_NAV.filter((item) =>
    roleAllows(role, ROUTES[item.href as RoutePattern]?.access ?? "super_admin"),
  );
}

/** The sidebar's admin section for this role (empty for students). */
export function adminSidebarFor(role: UserRole): NavItem[] {
  const allowed = adminNavFor(role);
  const short = allowed.filter((item) => ADMIN_SIDEBAR_NAV.includes(item));
  return short.length > 0 ? short : allowed;
}

/** Mobile bottom tab bar. */
export const MOBILE_TABS: NavItem[] = [
  { label: "Home", href: "/home", icon: House },
  { label: "Events", href: "/events", icon: CalendarDays },
  { label: "Spaces", href: "/spaces", icon: Hash },
  { label: "Classes", href: "/timetable", icon: CalendarClock },
  { label: "Alerts", href: "/notifications", icon: Bell, badgeKey: "notifications" },
];

/** The space a /spaces/[slug]/… path belongs to (null for the directory itself). */
export function spaceSlugFromPath(pathname: string): string | null {
  return /^\/spaces\/([^/]+)/.exec(pathname)?.[1] ?? null;
}

/** True when `pathname` is the nav item's page or one of its children. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
