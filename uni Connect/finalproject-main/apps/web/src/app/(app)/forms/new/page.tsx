import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { FormBuilder } from "@/components/feedback/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { listFormAudiences } from "@/server/queries/forms";

export const metadata: Metadata = { title: ROUTES["/forms/new"].title };

/** Build a feedback form (Phase E): staff only; lecturers for the batches they teach. */
export default async function Page() {
  const user = await requireRole("lecturer");
  const audiences = await listFormAudiences(user);
  return (
    <>
      <PageHeader
        title="New feedback form"
        description="Students answer anonymously, once each. You can preview it before publishing."
        breadcrumbs={[{ label: "Feedback", href: "/forms" }, { label: "New form" }]}
      />
      {audiences.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No batches to ask yet"
          description="Lecturers can send forms to the batches they teach. Ask your coordinator to assign you to a batch."
        />
      ) : (
        <FormBuilder
          audiences={audiences}
          canAskAboutLecturer={roleAtLeast(user.role, "coordinator")}
        />
      )}
    </>
  );
}
