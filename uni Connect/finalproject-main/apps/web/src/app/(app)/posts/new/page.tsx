import type { Metadata } from "next";

import { PostComposer } from "@/components/community/post-composer";
import { CurrentSpace } from "@/components/layout/current-space";
import { PageHeader } from "@/components/shared/page-header";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getSpace, listJoinedSpaces, listSpaces, listTags } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/posts/new"].title };

export default async function Page({ searchParams }: PageProps<"/posts/new">) {
  const user = await requireApproved();
  const params = await searchParams;
  const [directory, joined, tags] = await Promise.all([
    listSpaces(user.id),
    listJoinedSpaces(user.id),
    listTags(),
  ]);
  // The directory leaves out batches; your own batch comes from your memberships.
  const spaces = [...directory, ...joined.filter((j) => !directory.some((d) => d.id === j.id))];

  // Spaces you can post in: ones you've joined, plus open spaces (posting joins them).
  const postable = spaces
    .filter((s) => s.membership?.status === "active" || (s.joinPolicy === "open" && !s.membership))
    .sort(
      (a, b) =>
        Number(b.membership?.status === "active") - Number(a.membership?.status === "active") ||
        a.name.localeCompare(b.name),
    );
  // Staff can post in batch and department spaces they look after without being members.
  if (typeof params.space === "string" && !postable.some((s) => s.slug === params.space)) {
    const space = await getSpace(params.space, user.id);
    if (space?.canPost) postable.unshift(space);
  }
  const fromSpace = postable.find((s) => s.slug === params.space);
  const preselected = fromSpace?.id ?? "";

  return (
    <>
      {fromSpace && <CurrentSpace slug={fromSpace.slug} />}
      <PageHeader
        title="New post"
        description="Ask a question or start a discussion. Be kind, be specific, and never share phone numbers."
        breadcrumbs={
          fromSpace
            ? [
                { label: "Spaces", href: "/spaces" },
                { label: fromSpace.name, href: `/spaces/${fromSpace.slug}` },
                { label: "New post" },
              ]
            : [{ label: "Spaces", href: "/spaces" }, { label: "New post" }]
        }
      />
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <PostComposer
          spaces={postable.map((s) => ({
            id: s.id,
            name:
              s.membership?.status === "active" || s.type === "department" || s.type === "batch"
                ? s.name
                : `${s.name} (you'll join)`,
            batchOf:
              s.type === "batch"
                ? (spaces.find((d) => d.id === s.parentId)?.name ?? user.departmentName)
                : null,
          }))}
          tags={tags}
          initial={{
            spaceId: preselected,
            type: params.type === "discussion" ? "discussion" : "question",
            title: typeof params.title === "string" ? params.title.slice(0, 150) : "",
            bodyHtml: "",
            tagIds: [],
          }}
        />
      </div>
    </>
  );
}
