import { Hourglass } from "lucide-react";
import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { ApprovalListener, EditApplication } from "@/components/auth/pending-application";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { listDepartments } from "@/server/queries/departments";
import { parseStudentId } from "@/lib/student-id";

export const metadata: Metadata = { title: ROUTES["/pending"].title };

const NEXT_STEPS = [
  "Your department's coordinator checks your details against campus records.",
  "This page updates by itself the moment it's decided. No need to refresh.",
  "Once approved, you'll set up your profile and join your first spaces.",
];

export default async function Page() {
  const user = await requireUser("/pending");
  const supabase = await createClient();
  const [{ data: application }, departments] = await Promise.all([
    supabase
      .from("profile_private")
      .select("id_number, application_note")
      .eq("user_id", user.id)
      .maybeSingle(),
    listDepartments(),
  ]);

  const role = user.requestedRole;
  const details = [
    { label: "Name", value: user.fullName },
    { label: "Email", value: user.email },
    { label: "Joining as", value: role === "staff" ? "Staff" : "Student" },
    { label: "Department", value: user.departmentName ?? "Not set" },
    ...(role === "student"
      ? [
          {
            label: "Batch from your ID",
            value: (() => {
              const intake = parseStudentId(application?.id_number)?.intake;
              return intake ? `Batch ${intake}` : "Not recognised";
            })(),
          },
        ]
      : []),
    {
      label: role === "staff" ? "Staff ID" : "Student ID",
      value: application?.id_number ?? "Not set",
    },
  ];

  return (
    <AuthCard
      icon={<Hourglass aria-hidden />}
      eyebrow="Application received"
      title={ROUTES["/pending"].title}
      description="Thanks for joining UniConnect. Every account is checked by your coordinator so the community stays safe and official information stays trustworthy."
    >
      <ApprovalListener userId={user.id} />

      <ol className="mb-6 space-y-2.5">
        {NEXT_STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-[14.5px]">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-extrabold text-accent-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5 text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mb-5 rounded-2xl border bg-surface-tint p-4">
        <h2 className="mb-3 text-xs font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
          Your application
        </h2>
        <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="truncate font-semibold">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2.5">
        <EditApplication
          departments={departments}
          role={role}
          initial={{
            fullName: user.fullName,
            departmentId: user.departmentId ?? "",
            yearOfStudy: user.yearOfStudy === null ? "" : String(user.yearOfStudy),
            idNumber: application?.id_number ?? "",
            note: application?.application_note ?? "",
          }}
        />
        <SignOutButton variant="ghost" />
      </div>
    </AuthCard>
  );
}
