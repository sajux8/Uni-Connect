import { Search, SearchX, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { inputClass } from "@/components/forms/field";
import { SearchResult } from "@/components/search/search-result";
import { FilterSelect } from "@/components/shared/filter-select";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import {
  normaliseQuery,
  parseSearchTab,
  parseSince,
  SEARCH_SINCE,
  SEARCH_TABS,
} from "@/lib/search";
import { cn } from "@/lib/utils";
import { search } from "@/server/queries/search";

export const metadata: Metadata = { title: ROUTES["/search"].title };

const PAGE = 20;

export default async function Page({ searchParams }: PageProps<"/search">) {
  await requireApproved();
  const params = await searchParams;
  const q = normaliseQuery(params.q);
  const tab = parseSearchTab(params.tab);
  const since = parseSince(params.since);
  const sort = params.sort === "date" ? "date" : "relevance";
  const page = Math.max(1, Math.min(20, Number(params.page) || 1));
  const current = {
    q: q || undefined,
    tab: tab === "all" ? undefined : tab,
    since: since === "any" ? undefined : since,
    sort: sort === "date" ? "date" : undefined,
  };
  const days = SEARCH_SINCE.find((s) => s.key === since)?.days;

  const result = q
    ? await search({
        q,
        kinds: SEARCH_TABS.find((t) => t.key === tab)?.kinds ?? null,
        sinceDays: days ?? null,
        sort,
        limit: PAGE,
        offset: (page - 1) * PAGE,
      })
    : null;

  return (
    <>
      <PageHeader
        title={q ? `Results for “${q}”` : "Search"}
        description="Discussions, questions, events, announcements, resources and people you're allowed to see."
      >
        <form action="/search" className="flex gap-2" role="search">
          {current.tab && <input type="hidden" name="tab" value={current.tab} />}
          <div className="relative min-w-0 flex-1 sm:max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <label htmlFor="q" className="sr-only">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              autoFocus={!q}
              placeholder="Try “databases viva” or “career fair”"
              className={cn(inputClass, "h-12 rounded-full pl-11 text-base")}
            />
          </div>
          <Button type="submit" className="h-12 px-6">
            Search
          </Button>
        </form>
        {q && (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <FilterTabs
              label="Type"
              items={SEARCH_TABS.map((t) => ({
                href: withParams("/search", current, { tab: t.key === "all" ? undefined : t.key }),
                label: t.label,
                active: tab === t.key,
              }))}
            />
            <div className="flex gap-2">
              <FilterSelect
                label="When"
                className="flex-1 sm:flex-none"
                options={SEARCH_SINCE.map((s) => ({
                  href: withParams("/search", current, {
                    since: s.key === "any" ? undefined : s.key,
                  }),
                  label: s.label,
                  selected: since === s.key,
                }))}
              />
              <FilterSelect
                label="Sort"
                className="flex-1 sm:flex-none"
                options={(["relevance", "date"] as const).map((s) => ({
                  href: withParams("/search", current, { sort: s === "date" ? "date" : undefined }),
                  label: s === "date" ? "Newest first" : "Best match",
                  selected: sort === s,
                }))}
              />
            </div>
          </div>
        )}
      </PageHeader>

      <div className="max-w-3xl">
        {!q ? (
          <EmptyState
            icon={Search}
            title="What are you looking for?"
            description="Search across everything you can see on UniConnect. Press Ctrl K anywhere for quick search."
          />
        ) : result && result.hits.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No results"
            description="Try different words, a broader type or time range. Or ask the community."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href={`/posts/new?type=question&title=${encodeURIComponent(q)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Ask the community
                </Link>
                <Link
                  href={`/ask?q=${encodeURIComponent(q)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Sparkles data-icon="inline-start" className="text-ai" /> Ask AI
                </Link>
              </div>
            }
          />
        ) : (
          result && (
            <>
              {result.broadened && (
                <p className="mb-3 rounded-xl bg-surface-tint px-3.5 py-2.5 text-sm text-muted-foreground">
                  Nothing matched every word, so these match some of them.
                </p>
              )}
              <ul className="space-y-1 rounded-[22px] border bg-card p-2 shadow-soft">
                {result.hits.map((hit) => (
                  <SearchResult key={`${hit.kind}-${hit.id}`} hit={hit} />
                ))}
              </ul>
              {(page > 1 || result.hasMore) && (
                <nav aria-label="Pages" className="mt-5 flex justify-between gap-2">
                  {page > 1 ? (
                    <Link
                      href={withParams("/search", current, {
                        page: page > 2 ? String(page - 1) : undefined,
                      })}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  {result.hasMore && (
                    <Link
                      href={withParams("/search", current, { page: String(page + 1) })}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      More results
                    </Link>
                  )}
                </nav>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}
