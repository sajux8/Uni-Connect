import { ConversationList, MessagesShell } from "@/components/messages/conversation-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireApproved } from "@/lib/auth/session";
import { listConversations } from "@/server/queries/messages";

/** /messages and /messages/[id] share the conversation list (two panes on desktop). */
export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const user = await requireApproved();
  const conversations = await listConversations(user.id);
  return (
    <MessagesShell
      header={
        <PageHeader
          title="Messages"
          description="Private conversations with your mentors and mentees. Only the two of you can read them, and they're never used by AI search."
          className="mb-6"
        />
      }
      list={<ConversationList userId={user.id} conversations={conversations} />}
    >
      {children}
    </MessagesShell>
  );
}
