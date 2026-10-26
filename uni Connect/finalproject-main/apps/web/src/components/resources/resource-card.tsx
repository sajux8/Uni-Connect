import {
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import {
  fileKind,
  fileTypeLabel,
  formatBytes,
  REVIEW_STATUS_LABELS,
  type FileKind,
} from "@/lib/resources";
import { cn } from "@/lib/utils";
import type { ResourceSummary } from "@/server/queries/resources";

const ICONS: Record<FileKind, { icon: LucideIcon; className: string }> = {
  pdf: { icon: FileText, className: "tint tint-red" },
  word: { icon: FileText, className: "tint tint-blue" },
  slides: { icon: Presentation, className: "tint tint-orange" },
  sheet: { icon: FileSpreadsheet, className: "tint tint-emerald" },
  image: { icon: FileImage, className: "tint tint-violet" },
  zip: { icon: FileArchive, className: "tint tint-zinc" },
  link: { icon: Link2, className: "tint tint-teal" },
};

/** File-type tile (icon in a tinted square). Server-safe. */
export function ResourceIcon({
  mimeType,
  isLink,
  className,
}: {
  mimeType: string | null;
  isLink: boolean;
  className?: string;
}) {
  const style = ICONS[fileKind(mimeType, isLink)];
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-2xl border-0",
        style.className,
        className,
      )}
    >
      <style.icon className="size-5" aria-hidden />
    </span>
  );
}

export function ReviewStatusChip({ status }: { status: ResourceSummary["status"] }) {
  if (status === "approved") return null;
  return (
    <CategoryChip tint={status === "pending" ? "amber" : "red"}>
      {REVIEW_STATUS_LABELS[status]}
    </CategoryChip>
  );
}

/** One resource in a list. The whole card opens it. */
export function ResourceCard({ resource: r }: { resource: ResourceSummary }) {
  const isLink = r.kind === "link";
  const staff = r.uploader.role && r.uploader.role !== "student";
  return (
    <article
      aria-labelledby={`resource-${r.id}`}
      className="relative flex gap-4 rounded-[22px] border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift sm:p-5"
    >
      <ResourceIcon mimeType={r.mimeType} isLink={isLink} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 id={`resource-${r.id}`} className="leading-snug font-extrabold">
          <Link
            href={`/resources/${r.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-[22px] hover:text-primary focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
          >
            {r.title}
          </Link>
        </h3>
        {r.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <ReviewStatusChip status={r.status} />
          {staff && <OfficialBadge />}
          {r.moduleCode && <CategoryChip tint="indigo">{r.moduleCode}</CategoryChip>}
          {r.departmentName && <CategoryChip>{r.departmentName}</CategoryChip>}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{fileTypeLabel(r.mimeType, isLink)}</span>
          {r.fileSize ? <span>{formatBytes(r.fileSize)}</span> : null}
          {r.uploader.name && <span>· {r.uploader.name}</span>}
          <span>
            · <RelativeTime date={r.createdAt} />
          </span>
          {r.downloadCount > 0 && (
            <span>
              · {r.downloadCount}{" "}
              {isLink ? "opens" : r.downloadCount === 1 ? "download" : "downloads"}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
