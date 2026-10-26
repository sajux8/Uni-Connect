import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";

import { BatchCard, NewBatchForm } from "@/components/admin/batch-manager";
import { FilterSelect } from "@/components/shared/filter-select";
import { withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { requireRole } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { listBatchOverview, listDepartmentLecturers } from "@/server/queries/batches";
import { listDepartments } from "@/server/queries/departments";

export const metadata: Metadata = { title: ROUTES["/admin/batches"].title };

/**
 * Batches: coordinators run their own department's batches; super admins
 * pick any department.
 */
export default async function Page({ searchParams }: PageProps<"/admin/batches">) {
  const user = await requireRole("lecturer");
  const superAdmin = user.role === "super_admin";
  const header = (description: string, children?: React.ReactNode) => (
    <PageHeader title="Batches" description={description}>
      {children}
    </PageHeader>
  );
  if (!roleAtLeast(user.role, "coordinator")) {
    return (
      <>
        {header("Intake batches, their lecturers and class reps.")}
        <NoAccessState description="Batches are managed by coordinators and super admins." />
      </>
    );
  }

  const departments = superAdmin
    ? await listDepartments()
    : user.departmentId
      ? [{ id: user.departmentId, name: user.departmentName ?? "Your department" }]
      : [];
  if (departments.length === 0) {
    return (
      <>
        {header("Intake batches, their lecturers and class reps.")}
        <EmptyState
          icon={GraduationCap}
          title="No department yet"
          description="Ask a super admin to set your department, then you can manage its batches."
        />
      </>
    );
  }

  const params = await searchParams;
  const requested = typeof params.department === "string" ? params.department : undefined;
  const department =
    departments.find((d) => d.id === requested) ??
    departments.find((d) => d.id === user.departmentId) ??
    departments[0];
  const [batches, lecturers] = await Promise.all([
    listBatchOverview([department.id]),
    listDepartmentLecturers([department.id]),
  ]);

  return (
    <>
      {header(
        `${department.name}: create batches, assign lecturers and choose each batch's class rep.`,
        superAdmin && departments.length > 1 ? (
          <FilterSelect
            label="Department"
            options={departments.map((d) => ({
              href: withParams("/admin/batches", {}, { department: d.id }),
              label: d.name,
              selected: d.id === department.id,
            }))}
          />
        ) : undefined,
      )}
      <NewBatchForm departmentId={department.id} departmentName={department.name} />
      {batches.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No batches yet"
          description="Create the first batch above. Students are placed in it when you approve them."
        />
      ) : (
        <div className="space-y-5">
          {batches.map((b) => (
            <BatchCard key={b.id} batch={b} lecturers={lecturers} />
          ))}
        </div>
      )}
    </>
  );
}
