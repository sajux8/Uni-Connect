"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markAttendance } from "@/server/actions/timetable";

/** Students mark themselves present while the class runs; the server re-checks the time. */
export function MarkPresentButton({
  sessionId,
  moduleName,
  className,
}: {
  sessionId: string;
  moduleName: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className={cn("w-full", className)}
      disabled={pending}
      aria-label={`Mark me present for ${moduleName}`}
      onClick={() =>
        startTransition(async () => {
          const result = await markAttendance(sessionId);
          if (!result.ok) {
            toast.error(result.error);
            router.refresh();
            return;
          }
          toast.success(result.message ?? "You're marked present.");
          router.refresh();
        })
      }
    >
      <Check data-icon="inline-start" /> {pending ? "Marking…" : "Mark present"}
    </Button>
  );
}
