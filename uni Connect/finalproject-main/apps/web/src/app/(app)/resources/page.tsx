import { Library, Search, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { inputClass, SelectInput } from "@/components/forms/field";
import { ResourceCard } from "@/components/resources/resource-card";
import { FilterTabs, withParams } from "@/components/shared/filter-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { normaliseQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { listDepartments } from "@/server/queries/departments";
import { listResources } from "@/server/queries/resources";

export const metadata: Metadata = { title: ROUTES["/resources"].title };

export default async function Page({ searchParams }: PageProps<"/resources">) {
  const user = await requireApproved();
  const params = await searchParams;
  const mine = params.mine === "1";
  const q = normaliseQuery(params.q);
  const departments = await listDepartments();
  const departmentId = departments.find((d) => d.id === params.department)?.id;
  const kind = params.kind === "file" || params.kind === "link" ? params.kind : undefined;
  const current = {
    mine: mine ? "1" : undefined,
    q: q || undefined,
    department: departmentId,
    kind,
  };

  const resources = await listResources({
    q: q || undefined,
    departmentId,
    kind,
    mineOf: mine ? user.id : undefined,
    limit: 60,
  });
  const filtered = Boolean(q || departmentId || kind);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Notes, slides, past papers and useful links shared by students and staff."
        actions={
          <Link href="/resources/new" className={buttonVariants()}>
            <Upload data-icon="inline-start" /> Share a resource
          </Link>
        }
      >
        <div className="space-y-2">
          <FilterTabs
            label="Show"
            items={[
              {
                href: withParams("/resources", current, { mine: undefined }),
                label: "Library",
                active: !mine,
              },
              {
                href: withParams("/resources", current, { mine: "1" }),
                label: "My uploads",
                active: mine,
              },
            ]}
          />
          <form action="/resources" className="flex flex-wrap items-end gap-2">
            {mine && <input type="hidden" name="mine" value="1" />}
            <div className="relative w-full sm:w-auto sm:min-w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="resource-search" className="sr-only">
                Search resources
              </label>
              <input
                id="resource-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search by title, module or file name"
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
            <label className="sr-only" htmlFor="kind">
              Type
            </label>
            <SelectInput
              id="kind"
              name="kind"
              defaultValue={kind ?? ""}
              className="h-10 w-auto min-w-0 flex-1 rounded-full sm:flex-none"
            >
              <option value="">Files and links</option>
              <option value="file">Files</option>
              <option value="link">Links</option>
            </SelectInput>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </div>
      </PageHeader>

      {resources.length === 0 ? (
        <EmptyState
          icon={Library}
          title={
            mine
              ? "You haven't shared anything yet"
              : filtered
                ? "Nothing matches"
                : "The library is empty"
          }
          description={
            mine
              ? "Upload notes or share a useful link. A moderator checks it before it goes live."
              : filtered
                ? "Try fewer words or another department."
                : "Be the first to share notes, slides or a useful link."
          }
          action={
            filtered ? (
              <Link
                href={mine ? "/resources?mine=1" : "/resources"}
                className={buttonVariants({ variant: "outline" })}
              >
                Clear filters
              </Link>
            ) : (
              <Link href="/resources/new" className={buttonVariants({ variant: "outline" })}>
                Share a resource
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </>
  );
}
