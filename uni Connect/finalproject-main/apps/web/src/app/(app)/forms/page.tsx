import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FormCard } from "@/components/feedback/form-card";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import { ROUTES } from "@/lib/routes";
import { listStaffForms, listStudentForms, type StaffFormsTab } from "@/server/queries/forms";

export const metadata: Metadata = { title: ROUTES["/forms"].title };

/**
 * Feedback forms (Phase E): students see the forms waiting for them and the ones they've answered;
 * staff see the forms they made, forms about them, and (coordinators) their department's.
 */
export default async function Page({ searchParams }: PageProps<"/forms">) {
  const user = await requireApproved();
  const params = await searchParams;

  if (user.role === "student") {
    const { toAnswer, answered, closed } = await listStudentForms(user.id);
    return (
      <>
        <PageHeader
          title="Feedback"
          description="Tell your lecturers and coordinators what's working. Your answers are always anonymous."
        />
        <section aria-labelledby="to-answer" className="mb-8">
          <h2 id="to-answer" className="mb-3 text-[15px] font-extrabold">
            Waiting for you {toAnswer.length > 0 && `(${toAnswer.length})`}
          </h2>
          {toAnswer.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="You're all caught up"
              description="New feedback forms for your batch appear here, and you're told when one opens."
            />
          ) : (
            <div className="space-y-3">
              {toAnswer.map((f) => (
                <FormCard key={f.id} form={f} href={`/forms/${f.id}`} />
              ))}
            </div>
          )}
        </section>
        {answered.length + closed.length > 0 && (
          <section aria-labelledby="answered">
            <h2 id="answered" className="mb-3 text-[15px] font-extrabold">
              Answered and closed
            </h2>
            <div className="space-y-3">
              {[...answered, ...closed].map((f) => (
                <FormCard
                  key={f.id}
                  form={f}
                  href={`/forms/${f.id}`}
                  note={answered.includes(f) ? <span>You answered</span> : <span>Missed</span>}
                />
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  const tabs: { key: StaffFormsTab; label: string }[] = [
    { key: "mine", label: "My forms" },
    { key: "about", label: "About me" },
    ...(roleAtLeast(user.role, "coordinator")
      ? [
          {
            key: "department" as const,
            label: user.role === "super_admin" ? "All forms" : "Department",
          },
        ]
      : []),
  ];
  const tab = tabs.find((t) => t.key === params.tab)?.key ?? "mine";
  const forms = await listStaffForms(user, tab);

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Anonymous feedback forms for your batches. Results show who was asked and what they said, never who said it."
        actions={
          <Link href="/forms/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" /> New form
          </Link>
        }
      >
        <FilterTabs
          label="Forms"
          items={tabs.map((t) => ({
            href: withParams("/forms", {}, { tab: t.key === "mine" ? undefined : t.key }),
            label: t.label,
            active: tab === t.key,
          }))}
        />
      </PageHeader>
      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === "about" ? "No forms about you yet" : "No forms yet"}
          description={
            tab === "about"
              ? "When a coordinator asks students about your teaching, the form and its results appear here."
              : "Create a form, choose the batches it's for, and publish it. Students are told straight away."
          }
        />
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              href={`/forms/${f.id}`}
              showStatus
              note={tab !== "mine" && f.createdBy ? <span>By {f.createdBy.name}</span> : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
