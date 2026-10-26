import { Clock, Download, ExternalLink, Hash, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { RelativeTime } from "@/components/community/relative-time";
import {
  DeleteResourceButton,
  ResourceReviewButtons,
} from "@/components/resources/resource-actions";
import { ResourceIcon, ReviewStatusChip } from "@/components/resources/resource-card";
import { CategoryChip, OfficialBadge } from "@/components/shared/badges";
import { BookmarkButton } from "@/components/shared/bookmark-button";
import { ReportButton } from "@/components/shared/report-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { fileTypeLabel, formatBytes } from "@/lib/resources";
import { cn } from "@/lib/utils";
import { isBookmarked } from "@/server/queries/bookmarks";
import { getResource } from "@/server/queries/resources";
import { roleAtLeast } from "@/lib/campus";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getResource(id);
}

export async function generateMetadata({
  params,
}: PageProps<"/resources/[id]">): Promise<Metadata> {
  await requireApproved();
  const resource = await load((await params).id);
  return { title: resource?.title ?? "Resource" };
}

export default async function Page({ params }: PageProps<"/resources/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const resource = await load(id);
  if (!resource) notFound();
  const saved =
    resource.status === "approved" ? await isBookmarked(user.id, "resource", resource.id) : false;

  const isLink = resource.kind === "link";
  const isOwner = resource.uploader.id === user.id;
  const isModerator = roleAtLeast(user.role, "coordinator");
  const staffUpload = resource.uploader.role && resource.uploader.role !== "student";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: resource.title }]}
        title={resource.title}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStatusChip status={resource.status} />
          {staffUpload && <OfficialBadge />}
          {resource.moduleCode && <CategoryChip tint="indigo">{resource.moduleCode}</CategoryChip>}
          {resource.departmentName && <CategoryChip>{resource.departmentName}</CategoryChip>}
        </div>
      </PageHeader>

      {resource.status === "pending" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            Waiting for a moderator. Only {isOwner ? "you" : "the uploader"} and moderators can see
            it until it&apos;s approved.
          </p>
        </div>
      )}
      {resource.status === "rejected" && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <strong>Not approved.</strong> {resource.reviewNote}
          </p>
        </div>
      )}

      <article className="space-y-5 rounded-[22px] border bg-card p-5 shadow-soft sm:p-7">
        <div className="flex items-center gap-4">
          <ResourceIcon mimeType={resource.mimeType} isLink={isLink} />
          <div className="min-w-0">
            <p className="truncate font-bold">{isLink ? resource.url : resource.fileName}</p>
            <p className="text-[13px] text-muted-foreground">
              {fileTypeLabel(resource.mimeType, isLink)}
              {resource.fileSize ? ` · ${formatBytes(resource.fileSize)}` : ""}
              {resource.downloadCount > 0 &&
                ` · ${resource.downloadCount} ${isLink ? "opens" : resource.downloadCount === 1 ? "download" : "downloads"}`}
            </p>
          </div>
        </div>

        {resource.description && (
          <p className="text-[15px] whitespace-pre-line">{resource.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/resources/${resource.id}/download`}
            target={isLink ? "_blank" : undefined}
            rel={isLink ? "noopener noreferrer" : undefined}
            className={cn(buttonVariants({ size: "lg" }), "max-sm:w-full")}
          >
            {isLink ? (
              <ExternalLink data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {isLink ? "Open link" : "Download"}
          </a>
          {resource.status === "approved" && (
            <BookmarkButton type="resource" id={resource.id} initial={saved} withLabel />
          )}
          {(isOwner || isModerator) && <DeleteResourceButton id={resource.id} />}
          {!isOwner && resource.status === "approved" && (
            <ReportButton targetType="resource" targetId={resource.id} />
          )}
        </div>

        {isModerator && resource.status === "pending" && (
          <div className="space-y-2 rounded-2xl border bg-surface-tint p-4">
            <p className="text-sm font-bold">Review</p>
            <ResourceReviewButtons id={resource.id} title={resource.title} />
          </div>
        )}

        <dl className="grid gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold text-muted-foreground uppercase">Shared by</dt>
            <dd>{resource.uploader.name ?? "A former member"}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold text-muted-foreground uppercase">Shared</dt>
            <dd>
              <RelativeTime date={resource.createdAt} />
            </dd>
          </div>
          {resource.spaceName && (
            <div>
              <dt className="text-xs font-bold text-muted-foreground uppercase">Space</dt>
              <dd>
                {resource.spaceSlug ? (
                  <Link
                    href={`/spaces/${resource.spaceSlug}?tab=resources`}
                    className="inline-flex min-h-8 items-center gap-1 font-semibold hover:text-primary"
                  >
                    <Hash className="size-3.5" aria-hidden /> {resource.spaceName}
                  </Link>
                ) : (
                  resource.spaceName
                )}
              </dd>
            </div>
          )}
          {resource.tags.length > 0 && (
            <div>
              <dt className="text-xs font-bold text-muted-foreground uppercase">Tags</dt>
              <dd className="flex flex-wrap gap-1.5 pt-1">
                {resource.tags.map((t) => (
                  <CategoryChip key={t.id}>#{t.name}</CategoryChip>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </article>
    </div>
  );
}
