import { Crown, Handshake, ShieldCheck, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";

const base =
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3";

/**
 * "Official" marks content published by an authorised role: announcements,
 * events, staff-uploaded resources. AI content must never use this.
 */
export function OfficialBadge({ className }: { className?: string }) {
  return (
    <span className={cn(base, "border-primary/20 bg-primary/10 text-primary", className)}>
      <ShieldCheck aria-hidden />
      Official
    </span>
  );
}

/** AI content always carries this badge (violet is reserved for AI). */
export function AIBadge({
  label = "AI-generated",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn(base, "border-ai/25 bg-ai/10 text-ai", className)}>
      <Sparkles aria-hidden />
      {label}
    </span>
  );
}

/**
 * Badges next to a name. Staff roles (lecturer, coordinator, super admin) share the Official
 * look; "moderator" is a space moderator; class reps are gold and club captains cyan.
 * Students get no badge.
 */
export type RoleBadgeRole =
  "lecturer" | "coordinator" | "super_admin" | "moderator" | "mentor" | "rep" | "captain";

const ROLE_STYLES: Record<RoleBadgeRole, { label: string; className: string }> = {
  lecturer: { label: "Lecturer", className: "border-primary/20 bg-primary/10 text-primary" },
  coordinator: { label: "Coordinator", className: "border-primary/20 bg-primary/10 text-primary" },
  super_admin: {
    label: "Super admin",
    className: "border-transparent bg-foreground text-background",
  },
  moderator: { label: "Moderator", className: "tint tint-teal" },
  mentor: { label: "Mentor", className: "tint tint-emerald bg-transparent" },
  rep: { label: "Class rep", className: "border-rep/30 bg-rep/12 text-rep-foreground" },
  captain: { label: "Captain", className: "border-brand-cyan/40 bg-brand-cyan/12 text-primary" },
};

export function RoleBadge({ role, className }: { role: RoleBadgeRole; className?: string }) {
  const style = ROLE_STYLES[role];
  return (
    <span className={cn(base, style.className, className)}>
      {role === "mentor" && <Handshake aria-hidden />}
      {role === "rep" && <Star aria-hidden />}
      {role === "captain" && <Crown aria-hidden />}
      {(role === "lecturer" || role === "coordinator") && <ShieldCheck aria-hidden />}
      {style.label}
    </span>
  );
}

export type CategoryTint =
  "blue" | "red" | "emerald" | "amber" | "pink" | "orange" | "indigo" | "teal" | "zinc" | "violet";

/** Soft category pill (event category, space type, announcement category). */
export function CategoryChip({
  tint = "zinc",
  children,
  className,
}: {
  tint?: CategoryTint;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(base, "tint", `tint-${tint}`, className)}>{children}</span>;
}
