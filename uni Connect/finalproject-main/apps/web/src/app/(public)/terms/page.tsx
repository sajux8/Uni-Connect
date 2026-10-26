import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Community rules & terms" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Community rules & terms"
      intro="A few simple rules keep UniConnect useful and safe for everyone. By joining you agree to follow them."
      updated="1 October 2026"
      sections={[
        {
          heading: "Be respectful",
          body: [
            [
              "No harassment, hate speech, threats or abuse of any kind.",
              "Don't impersonate other people, staff or the university.",
              "Disagree with ideas, not with people.",
            ],
          ],
        },
        {
          heading: "Share responsibly",
          body: [
            [
              "Only post material you have the right to share. Don't upload exam papers or content you aren't allowed to distribute.",
              "Don't share other people's private information.",
              "Keep posts in the right space and mark questions as questions.",
              "No spam, advertising or unrelated links.",
            ],
          ],
        },
        {
          heading: "Official information",
          body: [
            "Only authorised staff and organisers can publish announcements and events. These carry an Official badge and show who published them. Student posts, AI answers and summaries are never official, even when they quote official content. Always check the linked source.",
          ],
        },
        {
          heading: "Moderation",
          body: [
            "Anyone can report a post, reply, resource, message, event or member. Moderators review reports and may hide or remove content, warn members, or suspend accounts. Every action is recorded with a reason. If you disagree with a decision, contact an administrator.",
          ],
        },
        {
          heading: "Accounts",
          body: [
            "Every account is verified by an administrator. Provide accurate details and keep your password private. Accounts can be suspended or removed for breaking these rules.",
          ],
        },
      ]}
    />
  );
}
