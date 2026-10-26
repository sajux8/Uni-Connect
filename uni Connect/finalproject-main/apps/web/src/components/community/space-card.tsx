import { Lock, Users } from "lucide-react";
import Link from "next/link";

import { JoinButton } from "@/components/community/join-button";
import { SpaceIcon } from "@/components/community/space-icon";
import { CategoryChip } from "@/components/shared/badges";
import { spaceTypeInfo } from "@/lib/community";
import type { SpaceSummary } from "@/server/queries/spaces";

export function SpaceCard({ space }: { space: SpaceSummary }) {
  const type = spaceTypeInfo(space.type);
  const membership =
    space.membership?.status === "active"
      ? "active"
      : space.membership?.status === "pending"
        ? "pending"
        : "none";

  return (
    <article
      aria-labelledby={`space-${space.id}`}
      className="relative flex h-full flex-col gap-4 rounded-[22px] border bg-card p-5 shadow-soft transition-[box-shadow,border-color] hover:border-border-strong hover:shadow-lift"
    >
      <div className="flex items-start gap-3.5">
        <SpaceIcon icon={space.icon} type={space.type} />
        <div className="min-w-0 flex-1">
          <h3 id={`space-${space.id}`} className="truncate text-[16px] font-extrabold">
            <Link
              href={`/spaces/${space.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-[22px] focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
            >
              {space.name}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <CategoryChip tint={type.tint}>{type.label}</CategoryChip>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {space.memberCount} {space.memberCount === 1 ? "member" : "members"}
            </span>
            {space.joinPolicy === "approval" && (
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3.5" aria-hidden /> Approval
              </span>
            )}
          </div>
        </div>
      </div>
      {space.description && (
        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{space.description}</p>
      )}
      <div className="relative z-10 flex justify-end">
        {space.type === "department" || space.type === "batch" ? (
          // Membership of department and batch spaces follows the profile.
          <span className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13.5px] font-bold text-primary dark:text-accent-foreground">
            {space.type === "batch" ? "Your batch" : "Your department"}
          </span>
        ) : (
          <JoinButton
            spaceId={space.id}
            spaceName={space.name}
            joinPolicy={space.joinPolicy}
            initial={membership}
          />
        )}
      </div>
    </article>
  );
}
