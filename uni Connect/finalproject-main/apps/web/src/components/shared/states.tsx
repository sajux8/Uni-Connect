import { Lock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared frame for empty / error / no-access states.
 * Server-safe on purpose: server pages pass icon components in. `ErrorState`
 * (which needs a click handler) lives in error-state.tsx as a client component.
 */
export function StateFrame({
  icon: Icon,
  tone,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  tone: "neutral" | "danger" | "warning";
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    neutral: "bg-accent text-accent-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
  }[tone];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-border-strong/70 bg-card px-6 py-14 text-center",
        className,
      )}
    >
      <span className={cn("grid size-[54px] place-items-center rounded-[15px]", toneClass)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h3 className="text-[17px] font-extrabold tracking-tight">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Nothing here yet: always say why and offer the next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StateFrame
      icon={icon}
      tone="neutral"
      title={title}
      description={description}
      className={className}
    >
      {action}
    </StateFrame>
  );
}

/** The user isn't allowed here (private space, missing role…). */
export function NoAccessState({
  title = "You don't have access to this",
  description = "This page is only available to members with the right permissions.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <StateFrame
      icon={Lock}
      tone="warning"
      title={title}
      description={description}
      className={className}
    >
      {action}
    </StateFrame>
  );
}
