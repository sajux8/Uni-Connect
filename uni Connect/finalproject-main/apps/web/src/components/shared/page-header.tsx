import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Every page starts with this: title, optional description, optional breadcrumbs,
 * and the page's single primary action on the right.
 *
 * Sub-pages get a Back button: pass `back`, or it's taken from the last linked breadcrumb.
 * On phones the button replaces the breadcrumb trail.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  back,
  actions,
  badge,
  className,
  children,
}: {
  /** Small uppercase label above the title, with the cyan dash (concept: .eyebrow). */
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  /** Where Back goes when there's no in-app history (defaults to the last linked crumb). */
  back?: string | false;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  /** Rendered below the title row, e.g. tabs. */
  children?: React.ReactNode;
}) {
  const backHref =
    back === false ? undefined : (back ?? breadcrumbs?.findLast((crumb) => crumb.href)?.href);
  const hasCrumbs = !!breadcrumbs && breadcrumbs.length > 0;

  return (
    <header className={cn("mb-8 space-y-4", className)}>
      {(backHref || hasCrumbs) && (
        <div className="flex items-center gap-3">
          {backHref && <BackButton href={backHref} />}
          {hasCrumbs && <Breadcrumbs crumbs={breadcrumbs} hideOnPhone={!!backHref} />}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[32px] sm:leading-[1.16]">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="max-w-prose text-[16.5px] text-pretty text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>

      {children}
    </header>
  );
}

function Breadcrumbs({ crumbs, hideOnPhone }: { crumbs: Crumb[]; hideOnPhone: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", hideOnPhone && "hidden sm:block")}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="-my-1.5 inline-block rounded-sm py-1.5 font-semibold hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-foreground">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Uppercase section label with a short cyan dash, from the UniConnect concept. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-xs font-extrabold tracking-[0.18em] text-primary uppercase before:h-[3px] before:w-[26px] before:rounded-full before:bg-brand-cyan dark:text-accent-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
