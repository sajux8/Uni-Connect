import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { FormBuilder } from "@/components/feedback/form-builder";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import type { FormQuestion } from "@/lib/forms";
import { ROUTES } from "@/lib/routes";
import { canManageForm, getForm, getResults, listFormAudiences } from "@/server/queries/forms";

export const metadata: Metadata = { title: ROUTES["/forms/[id]/edit"].title };

/** Edit a feedback form (Phase E). Once students have answered, only the wording around it changes. */
export default async function Page({ params }: PageProps<"/forms/[id]/edit">) {
  const user = await requireRole("lecturer");
  const { id } = await params;
  const form = z.uuid().safeParse(id).success ? await getForm(id) : null;
  if (!form) notFound();
  const crumbs = [
    { label: "Feedback", href: "/forms" },
    { label: form.title, href: `/forms/${form.id}` },
    { label: "Edit" },
  ];
  if (!(await canManageForm(form.id))) {
    return (
      <>
        <PageHeader title="Edit form" breadcrumbs={crumbs} />
        <NoAccessState description="Only the form's creator and the department's coordinator can edit it." />
      </>
    );
  }

  const [audiences, { counts }] = await Promise.all([listFormAudiences(user), getResults(form.id)]);
  const locked = counts.some((c) => c.responded > 0);
  // Keep the form's own department selectable even if this member couldn't pick it themselves.
  const options = audiences.some((d) => d.id === form.departmentId)
    ? audiences
    : [
        {
          id: form.departmentId,
          name: form.departmentName,
          wholeDepartment: form.batchIds.length === 0,
          batches: [],
          lecturers: [],
        },
        ...audiences,
      ];

  return (
    <>
      <PageHeader
        title="Edit form"
        description={
          locked
            ? "Students have answered, so you can change the title, description and closing time only."
            : "Changes apply as soon as you save."
        }
        breadcrumbs={crumbs}
      />
      <FormBuilder
        audiences={options}
        canAskAboutLecturer={roleAtLeast(user.role, "coordinator")}
        locked={locked}
        initial={{
          formId: form.id,
          title: form.title,
          description: form.description,
          departmentId: form.departmentId,
          batchIds: form.batchIds,
          aboutLecturerId: form.aboutLecturer?.id ?? "",
          closesAt: form.closesAt,
          questions: form.questions.map((q): FormQuestion => ({
            type: q.type,
            prompt: q.prompt,
            help: q.help,
            required: q.required,
            options: q.options,
            scaleMax: q.scaleMax === 10 ? 10 : 5,
            minLabel: q.minLabel ?? "",
            maxLabel: q.maxLabel ?? "",
          })),
        }}
      />
    </>
  );
}
