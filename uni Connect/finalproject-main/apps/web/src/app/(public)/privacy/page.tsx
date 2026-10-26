import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      intro="UniConnect is built so you can take part in campus life without handing out your phone number. This page explains what we collect, why, and who can see it."
      updated="1 October 2026"
      sections={[
        {
          heading: "What we collect",
          body: [
            [
              "Your name, university email address and password (stored securely, never in plain text).",
              "Your department, year of study and your student or staff ID number, used only to verify that you belong to the university.",
              "Optional profile details you add: photo, bio, interests and expertise.",
              "Content you create: posts, replies, resources, event registrations, bookmarks and messages.",
            ],
            "We do not ask for, store or display your phone number.",
          ],
        },
        {
          heading: "Who can see what",
          body: [
            [
              "Your student or staff ID and the note you wrote when registering are visible only to you and administrators.",
              "Your email address is never shown to other members.",
              "Your name, photo, department and role are visible to other approved members, according to the profile visibility you choose in Settings › Privacy.",
              "Private mentorship messages are visible only to the two people in the conversation.",
              "Moderators can see a message only if someone reports it.",
            ],
          ],
        },
        {
          heading: "Why we collect it",
          body: [
            "To verify members, so students can tell official information from unofficial posts; to show you relevant content; to send the notifications you choose; and to keep the community safe through reporting and moderation. Every moderation action is recorded in an audit log.",
          ],
        },
        {
          heading: "AI features",
          body: [
            "AI search and discussion summaries use only content that is already visible to you on the platform. Private messages, ID numbers and application notes are never sent to an AI service. The AI provider used for this project may process the text of the posts it is given. Your questions to the AI assistant are not stored, only a daily usage count. Staff can ask for an AI summary of the written answers on a feedback form; those answers are anonymous and are sent without any names.",
          ],
        },
        {
          heading: "How long we keep data",
          body: [
            [
              "Read notifications: 90 days.",
              "Sent email records: 30 days.",
              "Moderation records: for the life of the platform, so decisions stay accountable.",
              "If you delete your account, your profile is anonymised and your private details are removed.",
            ],
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can edit your profile, choose who sees it, choose who can request mentorship, block other members, control which notifications you receive, and ask an administrator to delete your account from Settings › Account.",
          ],
        },
      ]}
    />
  );
}
