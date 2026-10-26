import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";

import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: ROUTES["/messages"].title };

/** The right pane before a conversation is picked (on phones the list fills the screen). */
export default function Page() {
  return (
    <div className="hidden h-[calc(100dvh-17rem)] min-h-[480px] flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-border-strong/70 bg-card px-6 text-center md:flex">
      <span className="grid size-[54px] place-items-center rounded-[15px] bg-accent text-accent-foreground">
        <LockKeyhole className="size-5" aria-hidden />
      </span>
      <h2 className="text-[17px] font-extrabold tracking-tight">Pick a conversation</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Choose someone on the left to read and reply. Your messages are private between the two of
        you.
      </p>
    </div>
  );
}
