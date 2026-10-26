import { Construction, ListChecks, Lock, Target } from "lucide-react";

import { PageHeader, type Crumb } from "@/components/shared/page-header";
import { ACCESS_LABELS, MILESTONE_NAMES, ROUTES, type RoutePattern } from "@/lib/routes";

/** "/events/[id]" -> Events > Event. Parents come from the route registry. */
function breadcrumbsFor(route: RoutePattern): Crumb[] {
  const segments = route.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];

  for (let i = 1; i < segments.length; i++) {
    const parent = `/${segments.slice(0, i).join("/")}`;
    if (parent in ROUTES && !parent.includes("[")) {
      crumbs.push({ label: ROUTES[parent as RoutePattern].title, href: parent });
    }
  }
  if (crumbs.length > 0) crumbs.push({ label: ROUTES[route].title });
  return crumbs;
}

/**
 * Stand-in for a page that ships in a later milestone. It keeps navigation
 * complete from day one and records what the real page must cover.
 * Delete the usage (not this component) when the real page is built.
 */
export function PlaceholderPage({ route }: { route: RoutePattern }) {
  const info: {
    title: string;
    description: string;
    access: keyof typeof ACCESS_LABELS;
    milestone: keyof typeof MILESTONE_NAMES;
    features?: readonly number[];
  } = ROUTES[route];

  return (
    <>
      <PageHeader
        title={info.title}
        description={info.description}
        breadcrumbs={breadcrumbsFor(route)}
        eyebrow={`Coming in ${info.milestone}`}
      />

      <div className="rounded-[22px] border bg-card p-7 shadow-soft sm:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <span className="grid size-[54px] shrink-0 place-items-center rounded-[15px] bg-accent text-accent-foreground">
            <Construction className="size-6" aria-hidden />
          </span>

          <div className="min-w-0 space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight">This page is on the roadmap</h2>
              <p className="max-w-prose text-[15px] text-muted-foreground">
                It&apos;s built in milestone{" "}
                <strong className="text-foreground">{info.milestone}</strong> —{" "}
                {MILESTONE_NAMES[info.milestone]}. The navigation, layout and design system around
                it are already in place.
              </p>
            </div>

            <dl className="grid gap-4 border-t border-border/70 pt-5 text-sm sm:grid-cols-3">
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.12em] text-muted-foreground uppercase">
                  <Lock className="size-3.5" aria-hidden /> Who can open it
                </dt>
                <dd className="font-semibold">{ACCESS_LABELS[info.access]}</dd>
              </div>
              <div className="space-y-1">
                <dt className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.12em] text-muted-foreground uppercase">
                  <Target className="size-3.5" aria-hidden /> Route
                </dt>
                <dd className="font-semibold">{route}</dd>
              </div>
              {info.features && info.features.length > 0 && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.12em] text-muted-foreground uppercase">
                    <ListChecks className="size-3.5" aria-hidden /> Core features
                  </dt>
                  <dd className="font-semibold">{info.features.map((n) => `#${n}`).join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
