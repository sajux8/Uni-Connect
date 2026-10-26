import { Search, UserMinus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RelativeTime } from "@/components/community/relative-time";
import { inputClass, SelectInput } from "@/components/forms/field";
import { CategoryChip } from "@/components/shared/badges";
import { withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoAccessState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, yearLabel, type AccountStatus, type UserRole } from "@/lib/campus";
import { roleAtLeast } from "@/lib/campus";
import { formatCampus } from "@/lib/campus-time";
import { ACCOUNT_STATUS_LABELS, ACCOUNT_STATUS_TINTS } from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { normaliseQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { listDepartments } from "@/server/queries/departments";
import { listPendingDeletionRequests, searchUsers, USERS_PAGE_SIZE } from "@/server/queries/admin";

export const metadata: Metadata = { title: ROUTES["/admin/users"].title };

const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
const STATUSES = Object.keys(ACCOUNT_STATUS_LABELS) as AccountStatus[];

export default async function Page({ searchParams }: PageProps<"/admin/users">) {
  const user = await requireRole("lecturer");
  const header = (
    <PageHeader
      title="Users"
      description={
        user.role === "super_admin"
          ? "Find any account, change roles, suspend or reinstate, and handle deletion requests."
          : "Students and staff in your department: change roles and batches."
      }
    />
  );
  if (!roleAtLeast(user.role, "coordinator")) {
    return (
      <>
        {header}
        <NoAccessState description="Only coordinators and super admins manage accounts." />
      </>
    );
  }

  const params = await searchParams;
  const q = normaliseQuery(params.q);
  const role = ROLES.find((r) => r === params.role);
  const status = STATUSES.find((s) => s === params.status);
  const page = Math.max(1, Number(params.page) || 1);
  const departments = await listDepartments();
  const departmentId = departments.find((d) => d.id === params.department)?.id;
  const current = { q: q || undefined, role, status, department: departmentId };
  const [{ users, total }, deletions] = await Promise.all([
    searchUsers({ q, role, status, departmentId, page }),
    user.role === "super_admin" ? listPendingDeletionRequests() : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const filtered = Boolean(q || role || status || departmentId);

  return (
    <>
      {header}

      {deletions.length > 0 && (
        <section
          aria-labelledby="deletions-title"
          className="mb-6 space-y-2 rounded-[22px] border border-warning/30 bg-warning/8 p-4 sm:p-5"
        >
          <h2 id="deletions-title" className="flex items-center gap-2 font-extrabold">
            <UserMinus className="size-4" aria-hidden /> Deletion requests ({deletions.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {deletions.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/users/${d.userId}`}
                  className="font-semibold text-primary hover:underline dark:text-accent-foreground"
                >
                  {d.name}
                </Link>{" "}
                <span className="text-muted-foreground">
                  · asked <RelativeTime date={d.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action="/admin/users" className="mb-6 flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-auto sm:min-w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name, username or email"
            className={cn(inputClass, "h-10 rounded-full pl-10")}
          />
        </div>
        {[
          {
            id: "role",
            label: "Role",
            value: role ?? "",
            options: [["", "Any role"], ...ROLES.map((r) => [r, ROLE_LABELS[r]])],
          },
          {
            id: "status",
            label: "Status",
            value: status ?? "",
            options: [["", "Any status"], ...STATUSES.map((s) => [s, ACCOUNT_STATUS_LABELS[s]])],
          },
          {
            id: "department",
            label: "Department",
            value: departmentId ?? "",
            options: [["", "All departments"], ...departments.map((d) => [d.id, d.name])],
          },
        ].map((f) => (
          <div key={f.id}>
            <label className="sr-only" htmlFor={f.id}>
              {f.label}
            </label>
            <SelectInput
              id={f.id}
              name={f.id}
              defaultValue={f.value}
              className="h-10 w-auto min-w-0 rounded-full"
            >
              {f.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </div>
        ))}
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {total} {total === 1 ? "account" : "accounts"}
      </p>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts match"
          action={
            filtered ? (
              <Link href="/admin/users" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-accent/50 focus-visible:bg-accent sm:px-5"
              >
                <UserAvatar name={u.fullName} src={u.avatarUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{u.fullName}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {u.email}
                    {u.departmentName ? ` · ${u.departmentName}` : ""}
                    {yearLabel(u.yearOfStudy) ? ` · ${yearLabel(u.yearOfStudy)}` : ""}
                  </span>
                </span>
                <span className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                  {u.role !== "student" && (
                    <CategoryChip tint="indigo">{ROLE_LABELS[u.role]}</CategoryChip>
                  )}
                  <CategoryChip tint={ACCOUNT_STATUS_TINTS[u.status]}>
                    {u.status === "suspended" && u.suspendedUntil
                      ? `Suspended until ${formatCampus(u.suspendedUntil, "day")}`
                      : ACCOUNT_STATUS_LABELS[u.status]}
                  </CategoryChip>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={withParams("/admin/users", current, { page: String(page - 1) })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link
              href={withParams("/admin/users", current, { page: String(page + 1) })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
