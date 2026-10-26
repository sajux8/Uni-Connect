import { AppShell } from "@/components/layout/app-shell";
import { requireApproved } from "@/lib/auth/session";
import { yearLabel, roleAtLeast } from "@/lib/campus";
import { openReportCount } from "@/server/queries/admin";
import { unreadAnnouncementCount } from "@/server/queries/announcements";
import { unreadConversationCount } from "@/server/queries/messages";
import { unreadNotificationCount } from "@/server/queries/notifications";
import { listJoinedSpaces } from "@/server/queries/spaces";
import { openTicketCount } from "@/server/queries/support";

// Signed-in app: only approved, onboarded users get past requireApproved (others are redirected).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireApproved();
  const moderator = roleAtLeast(profile.role, "coordinator");
  const [joined, notifications, announcements, messages, reports, inbox] = await Promise.all([
    listJoinedSpaces(profile.id),
    unreadNotificationCount(profile.id),
    unreadAnnouncementCount(),
    unreadConversationCount(),
    moderator ? openReportCount() : Promise.resolve(0),
    moderator ? openTicketCount() : Promise.resolve(0),
  ]);
  const year = yearLabel(profile.yearOfStudy);
  const subtitle = [profile.departmentName, year].filter(Boolean).join(" · ") || profile.email;

  return (
    <AppShell
      user={{
        id: profile.id,
        name: profile.fullName,
        username: profile.username,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        subtitle,
      }}
      spaces={joined.map((s) => ({ slug: s.slug, name: s.name, icon: s.icon, type: s.type }))}
      badges={{ notifications, announcements, messages, reports, inbox }}
    >
      {children}
    </AppShell>
  );
}
