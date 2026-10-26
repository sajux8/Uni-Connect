import type { Metadata } from "next";

import { TagManager } from "@/components/admin/catalog-managers";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { listAllTags } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin/tags"].title };

export default async function Page() {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Tags"
      description="Topics people add to posts and resources. Merge duplicates so related posts stay together."
    />
  );
  if (user.role !== "super_admin") {
    return (
      <>
        {header}
        <NoAccessState description="Only super admins manage tags." />
      </>
    );
  }
  const tags = await listAllTags();
  return (
    <>
      {header}
      <TagManager tags={tags} />
    </>
  );
}
