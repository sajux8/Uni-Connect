import type { Metadata } from "next";
import Link from "next/link";

import { ChatThread } from "@/components/messages/chat-thread";
import { NoAccessState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { requireApproved } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getConversation } from "@/server/queries/messages";

export const metadata: Metadata = { title: ROUTES["/messages/[id]"].title };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: PageProps<"/messages/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const conversation = UUID.test(id) ? await getConversation(id, user.id) : null;

  if (!conversation) {
    return (
      <NoAccessState
        title="Conversation not found"
        description="It may not exist, or it's between other people. Only the two people in a conversation can read it."
        action={
          <Link href="/messages" className={buttonVariants({ variant: "outline" })}>
            Back to messages
          </Link>
        }
      />
    );
  }

  return <ChatThread key={conversation.id} conversation={conversation} userId={user.id} />;
}
