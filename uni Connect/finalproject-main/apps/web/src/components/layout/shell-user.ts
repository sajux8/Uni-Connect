import type { UserRole } from "@/lib/campus";

/** What the app shell needs to know about the signed-in user (passed down from the server layout). */
export interface ShellUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatarUrl: string | null;
  /** "Computing · Year 2", or just the department for staff. */
  subtitle: string;
}

/** Unread counts shown as badges in the shell (nav items with a matching badgeKey). */
export type ShellBadges = Partial<
  Record<"announcements" | "messages" | "notifications" | "reports" | "inbox", number>
>;

/** A joined space in the sidebar's "Your spaces" list. */
export interface ShellSpace {
  slug: string;
  name: string;
  icon: string | null;
  type: "department" | "batch" | "module" | "club" | "general";
}
