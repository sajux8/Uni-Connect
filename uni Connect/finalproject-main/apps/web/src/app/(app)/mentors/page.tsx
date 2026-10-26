import { Handshake, Search, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { inputClass, SelectInput } from "@/components/forms/field";
import { MentorCard } from "@/components/mentorship/mentor-card";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { YEAR_OPTIONS } from "@/lib/campus";
import { canBeMentor } from "@/lib/mentorship";
import { ROUTES } from "@/lib/routes";
import { normaliseQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { listDepartments } from "@/server/queries/departments";
import { listMentors, mentorSubjects } from "@/server/queries/mentorship";

export const metadata: Metadata = { title: ROUTES["/mentors"].title };

export default async function Page({ searchParams }: PageProps<"/mentors">) {
  const user = await requireApproved();
  const params = await searchParams;
  const q = normaliseQuery(params.q);
  const subject = typeof params.subject === "string" ? params.subject.slice(0, 40) : "";
  const accepting = params.accepting === "1";
  const [departments, subjects] = await Promise.all([listDepartments(), mentorSubjects()]);
  const departmentId = departments.find((d) => d.id === params.department)?.id;
  const year = YEAR_OPTIONS.find((y) => String(y.value) === params.year)?.value;
  const current = {
    q: q || undefined,
    subject: subject || undefined,
    department: departmentId,
    year: year === undefined ? undefined : String(year),
    accepting: accepting ? "1" : undefined,
  };

  const mentors = await listMentors({ q, subject, departmentId, year, accepting });
  const filtered = Boolean(q || subject || departmentId || year !== undefined || accepting);
  const isMentor = mentors.some((m) => m.userId === user.id);
  const showBecomeCta = !isMentor && canBeMentor(user.yearOfStudy) && !filtered;

  return (
    <>
      <PageHeader
        title="Get guidance from senior students"
        description="Find a Year 2+ student who has been where you are. Send a request; if they accept, you can chat privately here."
        actions={
          <Link href="/mentorship" className={buttonVariants({ variant: "outline" })}>
            <Handshake data-icon="inline-start" /> My mentorships
          </Link>
        }
      >
        <div className="space-y-3">
          <form action="/mentors" className="flex flex-wrap items-end gap-2">
            {subject && <input type="hidden" name="subject" value={subject} />}
            <div className="relative w-full sm:w-auto sm:min-w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="mentor-search" className="sr-only">
                Search mentors
              </label>
              <input
                id="mentor-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search by name, subject or skill"
                className={cn(inputClass, "h-10 rounded-full pl-10")}
              />
            </div>
            <label className="sr-only" htmlFor="department">
              Department
            </label>
            <SelectInput
              id="department"
              name="department"
              defaultValue={departmentId ?? ""}
              className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectInput>
            <label className="sr-only" htmlFor="year">
              Year
            </label>
            <SelectInput
              id="year"
              name="year"
              defaultValue={year === undefined ? "" : String(year)}
              className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
            >
              <option value="">Any year</option>
              {YEAR_OPTIONS.filter((y) => canBeMentor(y.value)).map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </SelectInput>
            <label className="flex h-10 items-center gap-2 rounded-full border-[1.5px] bg-card px-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="accepting"
                value="1"
                defaultChecked={accepting}
                className="size-4 accent-primary"
              />
              Accepting now
            </label>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
          {subjects.length > 0 && (
            <FilterTabs
              label="Subjects"
              items={[
                {
                  href: withParams("/mentors", current, { subject: undefined }),
                  label: "All subjects",
                  active: !subject,
                },
                ...subjects.map((s) => ({
                  href: withParams("/mentors", current, { subject: s.subject }),
                  label: s.subject,
                  active: subject.toLowerCase() === s.subject.toLowerCase(),
                  count: s.mentors,
                })),
              ]}
            />
          )}
        </div>
      </PageHeader>

      {showBecomeCta && (
        <section className="mb-6 flex flex-col gap-4 rounded-[22px] border bg-[linear-gradient(120deg,var(--accent),var(--card))] p-5 sm:flex-row sm:items-center sm:p-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="flex-1 space-y-1">
            <h2 className="font-extrabold">Become a mentor</h2>
            <p className="text-sm text-muted-foreground">
              Help a junior student with the things you&apos;ve already figured out. You choose your
              subjects and how many mentees you take.
            </p>
          </div>
          <Link href="/settings/mentor" className={buttonVariants()}>
            Set up my mentor profile
          </Link>
        </section>
      )}

      {mentors.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title={filtered ? "No mentors match" : "No mentors yet"}
          description={
            filtered
              ? "Try another subject, or clear the filters to see everyone."
              : "Senior students can offer to mentor from Settings → Mentoring."
          }
          action={
            filtered ? (
              <Link href="/mentors" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            ) : canBeMentor(user.yearOfStudy) ? (
              <Link href="/settings/mentor" className={buttonVariants({ variant: "outline" })}>
                Become a mentor
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {mentors.map((m) => (
            <MentorCard key={m.userId} mentor={m} own={m.userId === user.id} />
          ))}
        </div>
      )}
    </>
  );
}
