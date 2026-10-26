import { Check, Search, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SpaceCard } from "@/components/community/space-card";
import { inputClass } from "@/components/forms/field";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { requireApproved } from "@/lib/auth/session";
import { SPACE_TYPES, type SpaceType } from "@/lib/community";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { listSpaces } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/spaces"].title };

export default async function Page({ searchParams }: PageProps<"/spaces">) {
  const user = await requireApproved();
  const params = await searchParams;
  const type = SPACE_TYPES.some((t) => t.value === params.type)
    ? (params.type as SpaceType)
    : undefined;
  const joined = params.joined === "1";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const current = { type, joined: joined ? "1" : undefined, q: q || undefined };

  const all = await listSpaces(user.id);
  const spaces = all.filter(
    (s) =>
      (!type || s.type === type) &&
      (!joined || s.membership?.status === "active") &&
      (!q || `${s.name} ${s.description ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const presentTypes = SPACE_TYPES.filter((t) => all.some((s) => s.type === t.value));

  return (
    <>
      <PageHeader
        title="Find your communities"
        description="Join spaces for your department, clubs and campus topics to see their discussions and questions."
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            label="Space types"
            items={[
              {
                href: withParams("/spaces", current, { type: undefined }),
                label: "All",
                active: !type,
              },
              ...presentTypes.map((t) => ({
                href: withParams("/spaces", current, { type: t.value }),
                label: t.plural,
                active: type === t.value,
              })),
            ]}
          />
          <div className="flex items-center gap-2">
            <form
              action="/spaces"
              className="relative min-w-0 flex-1 lg:w-64 lg:flex-none"
              role="search"
            >
              {type && <input type="hidden" name="type" value={type} />}
              {joined && <input type="hidden" name="joined" value="1" />}
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search spaces"
                aria-label="Search spaces"
                className={cn(inputClass, "h-10 rounded-full pl-10")}
              />
            </form>
            <Link
              href={withParams("/spaces", current, { joined: joined ? undefined : "1" })}
              aria-pressed={joined}
              scroll={false}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-bold transition-colors",
                joined
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:border-border-strong",
              )}
            >
              {joined && <Check className="size-4" aria-hidden />}
              Joined
            </Link>
          </div>
        </div>
      </PageHeader>

      {spaces.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={joined ? "You haven't joined any spaces yet" : "No spaces match"}
          description={
            joined
              ? "Browse all spaces and join the ones you're interested in."
              : "Try another search or type."
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {spaces.map((space) => (
            <li key={space.id}>
              <SpaceCard space={space} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
