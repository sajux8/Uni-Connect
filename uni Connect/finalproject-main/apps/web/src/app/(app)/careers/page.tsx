import { Briefcase, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { OpportunityCard } from "@/components/careers/opportunity-card";
import { FilterSelect } from "@/components/shared/filter-select";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { roleAtLeast } from "@/lib/campus";
import {
  DEADLINE_FILTERS,
  OPPORTUNITY_TYPES,
  parseDeadlineFilter,
  WORK_MODES,
  type OpportunityType,
  type WorkMode,
} from "@/lib/careers";
import { ROUTES } from "@/lib/routes";
import { listOpportunities, savedOpportunityIds } from "@/server/queries/careers";

export const metadata: Metadata = { title: ROUTES["/careers"].title };

/**
 * Careers (Phase G): internships, part-time jobs and graduate roles for the member's department,
 * batch or the whole campus. Past deadlines move to Closed by themselves. Filters live in the URL.
 */
export default async function Page({ searchParams }: PageProps<"/careers">) {
  const user = await requireApproved();
  const params = await searchParams;
  const closed = params.tab === "closed";
  const type = OPPORTUNITY_TYPES.find((t) => t.value === params.type)?.value as
    OpportunityType | undefined;
  const mode = WORK_MODES.find((m) => m.value === params.mode)?.value as WorkMode | undefined;
  const closes = closed ? undefined : parseDeadlineFilter(params.closes);
  const current = {
    tab: closed ? "closed" : undefined,
    type,
    mode,
    closes,
  };
  const [opportunities, saved] = await Promise.all([
    listOpportunities({ closed, type, mode, closes }),
    savedOpportunityIds(user.id),
  ]);
  const canPost = roleAtLeast(user.role, "coordinator");

  return (
    <>
      <PageHeader
        title="Careers"
        description="Internships, part-time jobs and graduate roles shared by your department."
        actions={
          canPost ? (
            <Link href="/careers/new" className={buttonVariants()}>
              <Plus data-icon="inline-start" /> Post an opportunity
            </Link>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <FilterTabs
            label="Opportunities"
            items={[
              {
                href: withParams("/careers", current, { tab: undefined }),
                label: "Open",
                active: !closed,
              },
              {
                href: withParams("/careers", current, { tab: "closed", closes: undefined }),
                label: "Closed",
                active: closed,
              },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="Type"
              options={[
                {
                  href: withParams("/careers", current, { type: undefined }),
                  label: "All types",
                  selected: !type,
                },
                ...OPPORTUNITY_TYPES.map((t) => ({
                  href: withParams("/careers", current, { type: t.value }),
                  label: t.label,
                  selected: type === t.value,
                })),
              ]}
            />
            <FilterSelect
              label="Where"
              options={[
                {
                  href: withParams("/careers", current, { mode: undefined }),
                  label: "Anywhere",
                  selected: !mode,
                },
                ...WORK_MODES.map((m) => ({
                  href: withParams("/careers", current, { mode: m.value }),
                  label: m.label,
                  selected: mode === m.value,
                })),
              ]}
            />
            {!closed && (
              <FilterSelect
                label="Deadline"
                options={[
                  {
                    href: withParams("/careers", current, { closes: undefined }),
                    label: "Any deadline",
                    selected: !closes,
                  },
                  ...DEADLINE_FILTERS.map((d) => ({
                    href: withParams("/careers", current, { closes: d.value }),
                    label: d.label,
                    selected: closes === d.value,
                  })),
                ]}
              />
            )}
          </div>
        </div>
      </PageHeader>
      {opportunities.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={
            closed
              ? "Nothing closed yet"
              : type || mode || closes
                ? "Nothing matches"
                : "No openings right now"
          }
          description={
            closed
              ? "Opportunities move here once their deadline passes or they're closed."
              : type || mode || closes
                ? "Try fewer filters."
                : "Your coordinator posts internships and jobs here. You're told when a new one is for you."
          }
        />
      ) : (
        <div className="space-y-3">
          {opportunities.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} saved={saved.has(o.id)} />
          ))}
        </div>
      )}
    </>
  );
}
