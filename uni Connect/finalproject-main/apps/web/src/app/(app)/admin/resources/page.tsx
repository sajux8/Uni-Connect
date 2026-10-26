import { FolderCheck } from "lucide-react";
import type { Metadata } from "next";

import { ResourceReviewButtons } from "@/components/resources/resource-actions";
import { ResourceCard } from "@/components/resources/resource-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listPendingResources } from "@/server/queries/resources";

export const metadata: Metadata = { title: ROUTES["/admin/resources"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Resource approvals"
      description="Check that shared files are useful, safe and allowed to be shared before they go live."
    />
  );
  if (user.role === "lecturer") {
    return (
      <>
        {header}
        <NoAccessState description="Resources are reviewed by coordinators and super admins." />
      </>
    );
  }

  const pending = await listPendingResources();
  return (
    <>
      {header}
      {pending.length === 0 ? (
        <EmptyState
          icon={FolderCheck}
          title="Nothing to review"
          description="New student uploads appear here. You'll get a notification too."
        />
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="space-y-2">
              <ResourceCard resource={r} />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                <a
                  href={`/api/resources/${r.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
                >
                  {r.kind === "link" ? "Check the link" : "Check the file"}
                </a>
                <ResourceReviewButtons id={r.id} title={r.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
