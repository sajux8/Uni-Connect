import { format } from "date-fns";
import { Inbox, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ApprovalQueue, type Application } from "@/components/admin/approval-queue";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { roleAtLeast, USER_ROLES } from "@/lib/campus";

export const metadata: Metadata = { title: ROUTES["/admin/approvals"].title };

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "decided", label: "Recently decided" },
] as const;

export default async function Page({ searchParams }: PageProps<"/admin/approvals">) {
  const user = await requireRole("coordinator");
  const tab = (await searchParams).tab === "decided" ? "decided" : "pending";
  const supabase = await createClient();

  const [pending, approved, rejected, batches] = await Promise.all([
    supabase.rpc("admin_list_accounts", { p_status: "pending", p_limit: 200 }),
    tab === "decided"
      ? supabase.rpc("admin_list_accounts", { p_status: "approved", p_limit: 25 })
      : null,
    tab === "decided"
      ? supabase.rpc("admin_list_accounts", { p_status: "rejected", p_limit: 25 })
      : null,
    supabase.from("batches").select("id, department_id, number, name").order("number"),
  ]);
  if (pending.error) throw new Error("Couldn't load the approval queue.");

  const applications: Application[] = (pending.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    requestedRole: row.requested_role,
    departmentId: row.department_id,
    departmentName: row.department_name,
    idNumber: row.id_number,
    note: row.application_note,
    createdAt: row.created_at,
  }));

  const decided = [...(approved?.data ?? []), ...(rejected?.data ?? [])].sort((a, b) =>
    (b.approved_at ?? b.created_at).localeCompare(a.approved_at ?? a.created_at),
  );

  return (
    <>
      <PageHeader
        title={ROUTES["/admin/approvals"].title}
        description={
          user.role === "super_admin"
            ? "Check each applicant's details, then approve students into their batch and staff with their role."
            : "Applicants in your department. Approve students into their batch and staff as lecturers."
        }
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Approvals" }]}
      >
        <nav aria-label="Approval tabs" className="flex gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "pending" ? "/admin/approvals" : "/admin/approvals?tab=decided"}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors",
                tab === t.key
                  ? "bg-accent text-primary ring-1 ring-primary/20 ring-inset dark:text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t.label}
              {t.key === "pending" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    tab === "pending" ? "bg-primary/15" : "bg-muted",
                  )}
                >
                  {applications.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {tab === "pending" ? (
        applications.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No accounts waiting for approval"
            description="New registrations will appear here. You're all caught up."
          />
        ) : (
          <ApprovalQueue
            applications={applications}
            batches={(batches.data ?? []).map((b) => ({
              id: b.id,
              departmentId: b.department_id,
              number: b.number,
              name: b.name,
            }))}
            roles={
              user.role === "super_admin"
                ? USER_ROLES
                : USER_ROLES.filter((r) => !roleAtLeast(r, "coordinator"))
            }
          />
        )
      ) : decided.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No decisions yet"
          description="Approved and rejected accounts will be listed here."
        />
      ) : (
        <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
          {decided.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <UserAvatar name={row.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{row.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.email}
                  {row.department_name ? ` · ${row.department_name}` : ""}
                </p>
                {row.status === "rejected" && row.status_reason && (
                  <p className="mt-1 text-xs text-muted-foreground">Reason: {row.status_reason}</p>
                )}
              </div>
              {row.status === "approved" ? (
                <CategoryChip tint="emerald">Approved · {ROLE_LABELS[row.role]}</CategoryChip>
              ) : (
                <CategoryChip tint="red">Rejected</CategoryChip>
              )}
              <span className="w-24 text-right text-xs text-muted-foreground">
                {format(new Date(row.approved_at ?? row.created_at), "d MMM yyyy")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
