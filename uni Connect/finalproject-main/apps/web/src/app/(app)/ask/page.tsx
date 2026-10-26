import { Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { AskPanel } from "@/components/ai/ask-panel";
import { AIBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { aiConfig, aiConfigured } from "@/lib/ai/config";
import { requireApproved } from "@/lib/auth/session";
import { campusDay } from "@/lib/campus-time";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: ROUTES["/ask"].title };

/**
 * Ask AI (Feature 10): answers from UniConnect content the member can read, with
 * numbered sources. `?q=` (from the command palette) is asked straight away.
 */
export default async function Page({ searchParams }: PageProps<"/ask">) {
  const user = await requireApproved();
  const params = await searchParams;
  const header = (
    <PageHeader
      title="Ask AI"
      description="Answers from what's on UniConnect, with the sources shown."
      badge={<AIBadge label="AI" />}
    />
  );
  if (!aiConfigured()) {
    return (
      <>
        {header}
        <EmptyState
          icon={Sparkles}
          title="Ask AI isn't set up yet"
          description="It needs an AI key on this site. Search still works in the meantime."
        />
      </>
    );
  }

  const supabase = await createClient();
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("ask_count")
    .eq("user_id", user.id)
    .eq("day", campusDay(new Date()))
    .maybeSingle();

  const question = typeof params.q === "string" ? params.q.trim().slice(0, 500) : "";
  return (
    <>
      {header}
      <AskPanel
        initialQuestion={question.length >= 3 ? question : undefined}
        initialRemaining={Math.max(aiConfig.dailyAskLimit - (usage?.ask_count ?? 0), 0)}
        limit={aiConfig.dailyAskLimit}
      />
    </>
  );
}
