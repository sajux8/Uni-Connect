import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as z from "zod";

import { PostComposer } from "@/components/community/post-composer";
import { CurrentSpace } from "@/components/layout/current-space";
import { PageHeader } from "@/components/shared/page-header";
import { NoAccessState } from "@/components/shared/states";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getPost } from "@/server/queries/posts";
import { listTags } from "@/server/queries/spaces";

export const metadata: Metadata = { title: ROUTES["/posts/[id]/edit"].title };

export default async function Page({ params }: PageProps<"/posts/[id]/edit">) {
  const user = await requireApproved();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [post, tags] = await Promise.all([getPost(id, user.id), listTags()]);
  if (!post || post.status === "deleted") notFound();

  const header = (
    <>
      <CurrentSpace slug={post.space.slug} />
      <PageHeader
        title="Edit post"
        breadcrumbs={[
          { label: post.space.name, href: `/spaces/${post.space.slug}` },
          { label: post.title, href: `/posts/${post.id}` },
          { label: "Edit" },
        ]}
      />
    </>
  );

  if (!post.viewer.isAuthor || post.isLocked || post.status !== "visible") {
    return (
      <>
        {header}
        <NoAccessState
          title="You can't edit this post"
          description={post.isLocked ? "The thread is locked." : "Only the author can edit a post."}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="max-w-3xl rounded-[22px] border bg-card p-4 shadow-soft sm:p-8">
        <PostComposer
          postId={post.id}
          spaces={[
            {
              id: post.space.id,
              name: post.space.name,
              batchOf: post.space.type === "batch" ? (user.departmentName ?? "department") : null,
            },
          ]}
          tags={tags}
          initial={{
            spaceId: post.space.id,
            type: post.type,
            title: post.title,
            bodyHtml: post.bodyHtml,
            tagIds: post.tags.map((t) => t.id),
            audience: post.space.type === "batch" ? post.audience : undefined,
          }}
        />
      </div>
    </>
  );
}
