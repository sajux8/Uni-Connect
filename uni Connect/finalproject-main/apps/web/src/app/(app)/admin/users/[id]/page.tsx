import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DeletionRequestActions,
  RoleSelect,
  StatusActions,
} from "@/components/admin/user-admin-actions";
import { StudentBatchSelect } from "@/components/admin/student-batch-select";
import { RelativeTime } from "@/components/community/relative-time";
import { CategoryChip } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, roleAtLeast, USER_ROLES, yearLabel } from "@/lib/campus";
import { formatCampus } from "@/lib/campus-time";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TINTS,
  MODERATION_ACTION_LABELS,
  reasonLabel,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from "@/lib/moderation";
import { ROUTES } from "@/lib/routes";
import { getUserDetail } from "@/server/queries/admin";
import { listDepartmentBatches } from "@/server/queries/batches";

export const metadata: Metadata = { title: ROUTES["/admin/users/[id]"].title };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: PageProps<"/admin/users/[id]">) {
  const viewer = await requireRole("lecturer");
  if (!roleAtLeast(viewer.role, "coordinator")) {
    return <NoAccessState description="Only coordinators and super admins manage accounts." />;
  }
  const { id } = await params;
  const detail = UUID.test(id) ? await getUserDetail(id) : null;
  if (!detail) notFound();
  const { user: u, history, reports } = detail;
  const self = u.id === viewer.id;
  const superAdmin = viewer.role === "super_admin";
  // Coordinators can make someone a student or a lecturer, and can't change other coordinators.
  const grantable = superAdmin
    ? USER_ROLES
    : USER_ROLES.filter((r) => !roleAtLeast(r, "coordinator"));
  const canChangeRole =
    !self && u.status === "approved" && (superAdmin || !roleAtLeast(u.role, "coordinator"));
  const batches =
    u.role === "student" && u.status === "approved" && u.department_id
      ? await listDepartmentBatches(u.department_id)
      : [];

  const facts: [string, React.ReactNode][] = [
    ["Email", u.email],
    ["Username", `@${u.username}`],
    ["Department", u.department_name ?? "—"],
    ...(u.role === "student"
      ? ([
          ["Batch", u.batch_name ? `${u.batch_name}${u.is_class_rep ? " (class rep)" : ""}` : "—"],
        ] as [string, React.ReactNode][])
      : []),
    ["Year", yearLabel(u.year_of_study) ?? "—"],
    ["Asked to join as", u.requested_role === "staff" ? "Staff" : "Student"],
    ["Student / staff ID", u.id_number ?? "—"],
    ["Joined", formatCampus(u.created_at, "dayTime")],
    ["Approved", u.approved_at ? formatCampus(u.approved_at, "dayTime") : "—"],
    [
      "Last signed in",
      u.last_sign_in_at ? <RelativeTime key="s" date={u.last_sign_in_at} /> : "Never",
    ],
  ];
  const counts: [string, number][] = [
    ["Posts", u.post_count],
    ["Replies", u.reply_count],
    ["Resources", u.resource_count],
    ["Reports against", u.reports_against],
    ["Reports made", u.reports_made],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={[{ label: "Users", href: "/admin/users" }, { label: u.full_name }]}
        title={u.full_name}
        className="sr-only"
      />
      <section className="mb-6 flex flex-col gap-4 rounded-[22px] border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:p-6">
        <UserAvatar name={u.full_name} src={u.avatar_url} size="lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-[24px] leading-tight font-extrabold tracking-tight">{u.full_name}</h2>
          <p className="flex flex-wrap gap-1.5">
            <CategoryChip tint="indigo">{ROLE_LABELS[u.role]}</CategoryChip>
            <CategoryChip tint={ACCOUNT_STATUS_TINTS[u.status]}>
              {ACCOUNT_STATUS_LABELS[u.status]}
              {u.status === "suspended" && u.suspended_until
                ? ` until ${formatCampus(u.suspended_until, "day")}`
                : ""}
            </CategoryChip>
            {u.open_reports_against > 0 && (
              <CategoryChip tint="amber">{u.open_reports_against} open reports</CategoryChip>
            )}
          </p>
          {u.status_reason && (
            <p className="text-sm text-muted-foreground">Reason shown to them: {u.status_reason}</p>
          )}
          <Link
            href={`/u/${u.username}`}
            className="text-sm font-bold text-primary hover:underline dark:text-accent-foreground"
          >
            View public profile
          </Link>
        </div>
        {!self && superAdmin && (
          <StatusActions userId={u.id} status={u.status} name={u.full_name} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {u.deletion_request_id && (
            <section className="space-y-3 rounded-[22px] border border-warning/30 bg-warning/8 p-5">
              <h2 className="font-extrabold">Asked to delete their account</h2>
              <p className="text-sm text-muted-foreground">
                {u.deletion_requested_at && <RelativeTime date={u.deletion_requested_at} />}
                {u.deletion_reason ? ` · “${u.deletion_reason}”` : " · No reason given."}
              </p>
              {!self && superAdmin && (
                <DeletionRequestActions requestId={u.deletion_request_id} name={u.full_name} />
              )}
            </section>
          )}

          <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="text-[17px] font-extrabold tracking-tight">Moderation history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing recorded.</p>
            ) : (
              <ol className="divide-y">
                {history.map((h) => (
                  <li key={h.id} className="space-y-0.5 py-3 text-sm">
                    <p>
                      <span className="font-semibold">{MODERATION_ACTION_LABELS[h.action]}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        by {h.actor.name ?? (h.actor.id ? "former member" : "the system")} ·{" "}
                        {formatCampus(h.createdAt, "dayTime")}
                      </span>
                    </p>
                    {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="text-[17px] font-extrabold tracking-tight">
              Reports about their content
            </h2>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/reports/${r.id}`}
                      className="flex flex-wrap items-center gap-2 py-3 text-sm hover:text-primary"
                    >
                      <CategoryChip tint="amber">{reasonLabel(r.reason)}</CategoryChip>
                      <span className="font-semibold">{REPORT_TARGET_LABELS[r.targetType]}</span>
                      <span className="min-w-0 flex-1 truncate">{r.snapshot.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {REPORT_STATUS_LABELS[r.status]} · <RelativeTime date={r.createdAt} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {(canChangeRole || batches.length > 0) && (
            <section className="space-y-4 rounded-[22px] border bg-card p-5 shadow-soft">
              {canChangeRole && (
                <RoleSelect userId={u.id} role={u.role} name={u.full_name} roles={grantable} />
              )}
              {batches.length > 0 && (
                <StudentBatchSelect userId={u.id} batchId={u.batch_id} batches={batches} />
              )}
            </section>
          )}
          <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft">
            <h2 className="text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
              Account
            </h2>
            <dl className="space-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 text-right font-semibold break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {u.application_note && (
              <p className="rounded-xl bg-surface-tint px-3 py-2 text-sm text-muted-foreground">
                Application note: {u.application_note}
              </p>
            )}
          </section>
          <section className="space-y-3 rounded-[22px] border bg-card p-5 shadow-soft">
            <h2 className="text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
              Activity
            </h2>
            <dl className="grid grid-cols-2 gap-3">
              {counts.map(([label, value]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
