"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Ellipsis, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpaceIcon } from "@/components/community/space-icon";
import { useCurrentSpaceSlug } from "@/components/layout/current-space";
import type { ShellBadges, ShellSpace } from "@/components/layout/shell-user";
import { useLocalStorageBoolean } from "@/hooks/use-local-storage";
import type { UserRole } from "@/lib/campus";
import {
  adminSidebarFor,
  SIDEBAR_NAV,
  isActive,
  spaceSlugFromPath,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  collapsed,
  badge = 0,
  active: activeOverride,
  spaceRow = false,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  badge?: number;
  /** Overrides the path-based highlight (used for Spaces when a joined space is highlighted). */
  active?: boolean;
  /** Sits in the "Your spaces" list: the icon takes a space tile's width so the labels line up. */
  spaceRow?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activeOverride ?? isActive(pathname, item.href);
  const label = badge > 0 ? `${item.label}, ${badge} unread` : item.label;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed || badge > 0 ? label : undefined}
      className={cn(
        "group/nav flex h-9 items-center gap-3 rounded-full px-3.5 text-[14px] font-semibold text-muted-foreground transition-colors outline-none",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        active &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        spaceRow && "px-3 font-medium",
        collapsed && "justify-center px-0",
      )}
    >
      <span
        className={cn(
          "relative shrink-0",
          spaceRow && !collapsed && "grid size-[26px] place-items-center",
        )}
      >
        <item.icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {collapsed && badge > 0 && (
          <span
            className="absolute -top-1 -right-1 size-2 rounded-full bg-brand-cyan"
            aria-hidden
          />
        )}
      </span>
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && badge > 0 && (
        <span
          aria-hidden
          className={cn(
            "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-5 font-bold",
            active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-2 my-2.5 h-px bg-sidebar-border" aria-hidden />;
  return (
    <p className="flex items-center gap-2 px-3.5 pt-5 pb-1.5 text-[10.5px] font-extrabold tracking-[0.18em] text-primary uppercase before:h-[3px] before:w-4 before:rounded-full before:bg-brand-cyan dark:text-accent-foreground">
      {children}
    </p>
  );
}

/** The row that opens and closes the More group; an icon button on the collapsed rail. */
function MoreToggle({
  open,
  collapsed,
  onToggle,
}: {
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="sidebar-more"
      aria-label={collapsed ? (open ? "Show fewer pages" : "Show more pages") : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-3 rounded-full px-3.5 text-[14px] font-semibold text-muted-foreground transition-colors outline-none",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0",
      )}
    >
      <Ellipsis className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">More</span>
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </>
      )}
    </button>
  );
  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{open ? "Show fewer pages" : "Show more pages"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Sidebar body shared by the desktop sidebar and the mobile sheet: the
 * everyday pages first, then your spaces, then the rest under More (closed until opened, and
 * remembered); Notifications and Support stay pinned to the bottom. Collapses to an icon rail on
 * desktop (state is remembered).
 */
export function SidebarContent({
  collapsed = false,
  role,
  spaces,
  badges = {},
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  role: UserRole;
  spaces: ShellSpace[];
  badges?: ShellBadges;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const adminItems = adminSidebarFor(role);
  // The space you're in: from the URL, or from a post page that belongs to it.
  const postSpace = useCurrentSpaceSlug();
  const currentSpace = spaceSlugFromPath(pathname) ?? postSpace;
  const inSidebar = currentSpace !== null && spaces.some((s) => s.slug === currentSpace);
  // More stays open while you're on one of its pages, whatever was last chosen.
  const [moreChosen, setMoreChosen] = useLocalStorageBoolean("uniconnect:sidebar-more-open", false);
  const onMorePage = SIDEBAR_NAV.more.some((item) => isActive(pathname, item.href));
  const moreOpen = moreChosen || onMorePage;

  const links = (items: NavItem[]) =>
    items.map((item) => (
      <li key={item.href}>
        <NavLink
          item={item}
          collapsed={collapsed}
          badge={item.badgeKey ? badges[item.badgeKey] : 0}
          onNavigate={onNavigate}
        />
      </li>
    ));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex h-[72px] shrink-0 items-center gap-2 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Logo href="/home" iconOnly={collapsed} tagline={false} />
        {onToggleCollapsed && !collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            className="ml-auto text-muted-foreground"
          >
            <PanelLeftClose />
          </Button>
        )}
      </div>
      {onToggleCollapsed && collapsed && (
        <div className="flex shrink-0 justify-center pb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            className="text-muted-foreground"
          >
            <PanelLeftOpen />
          </Button>
        </div>
      )}

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 pb-4">
            <ul className="space-y-0.5">{links(SIDEBAR_NAV.primary)}</ul>

            <SectionLabel collapsed={collapsed}>Your spaces</SectionLabel>
            <ul className="space-y-0.5">
              {spaces.length === 0 && !collapsed && (
                <li className="px-3.5 py-1 text-[13px] text-muted-foreground">
                  You haven&apos;t joined any spaces yet.
                </li>
              )}
              {spaces.map((space) => {
                const href = `/spaces/${space.slug}`;
                const active = space.slug === currentSpace;
                return (
                  <li key={space.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? space.name : undefined}
                      className={cn(
                        "flex h-9 items-center gap-3 rounded-full px-3 text-[14px] font-medium text-muted-foreground transition-colors outline-none",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                        active &&
                          "bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <SpaceIcon
                        icon={space.icon}
                        type={space.type}
                        size="sm"
                        className={cn(active && "border-transparent bg-card")}
                      />
                      {!collapsed && <span className="truncate">{space.name}</span>}
                    </Link>
                  </li>
                );
              })}
              <li>
                <NavLink
                  item={SIDEBAR_NAV.allSpaces}
                  collapsed={collapsed}
                  spaceRow
                  active={pathname === "/spaces" || (currentSpace !== null && !inSidebar)}
                  onNavigate={onNavigate}
                />
              </li>
            </ul>

            <div className={cn("mt-3", collapsed && "mt-0")}>
              {collapsed && <div className="mx-2 my-2.5 h-px bg-sidebar-border" aria-hidden />}
              <MoreToggle
                open={moreOpen}
                collapsed={collapsed}
                onToggle={() => setMoreChosen(!moreOpen)}
              />
              <ul id="sidebar-more" hidden={!moreOpen} className="mt-0.5 space-y-0.5">
                {links(SIDEBAR_NAV.more)}
              </ul>
            </div>

            {adminItems.length > 0 && (
              <>
                <SectionLabel collapsed={collapsed}>Admin</SectionLabel>
                <ul className="space-y-0.5">{links(adminItems)}</ul>
              </>
            )}
          </div>
        </ScrollArea>

        <ul className="shrink-0 space-y-0.5 border-t border-sidebar-border px-3 py-2.5">
          {links(SIDEBAR_NAV.footer)}
        </ul>
      </nav>
    </div>
  );
}
