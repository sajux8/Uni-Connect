"use client";

import { Check, Clock, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { joinSpace, leaveSpace } from "@/server/actions/spaces";

type State = "none" | "active" | "pending";

/** Join / Request / Joined ✓ (hover: Leave). Optimistic, rolls back on error. */
export function JoinButton({
  spaceId,
  spaceName,
  joinPolicy,
  initial,
  size = "sm",
}: {
  spaceId: string;
  spaceName: string;
  joinPolicy: "open" | "approval";
  initial: State;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [state, setState] = useState<State>(initial);
  const [pending, startTransition] = useTransition();

  function join() {
    const optimistic: State = joinPolicy === "open" ? "active" : "pending";
    setState(optimistic);
    startTransition(async () => {
      const result = await joinSpace(spaceId);
      if (!result.ok) {
        setState("none");
        toast.error(result.error);
        return;
      }
      setState(result.data.status);
      toast.success(
        result.data.status === "active"
          ? `You joined ${spaceName}.`
          : "Request sent to the moderators.",
      );
      router.refresh();
    });
  }

  function leave() {
    const previous = state;
    setState("none");
    startTransition(async () => {
      const result = await leaveSpace(spaceId);
      if (!result.ok) {
        setState(previous);
        toast.error(result.error);
        return;
      }
      toast.success(previous === "pending" ? "Request withdrawn." : `You left ${spaceName}.`, {
        action: previous === "active" ? { label: "Undo", onClick: join } : undefined,
      });
      router.refresh();
    });
  }

  if (state === "active") {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={leave}
        disabled={pending}
        aria-label={`Leave ${spaceName}`}
        className="group/join min-w-24"
      >
        <Check data-icon="inline-start" className="group-hover/join:hidden" />
        <span className="group-hover/join:hidden">Joined</span>
        <span className="hidden group-hover/join:inline">Leave</span>
      </Button>
    );
  }
  if (state === "pending") {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={leave}
        disabled={pending}
        aria-label={`Withdraw request to join ${spaceName}`}
      >
        <Clock data-icon="inline-start" />
        Requested
      </Button>
    );
  }
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={join}
      disabled={pending}
      aria-label={`${joinPolicy === "open" ? "Join" : "Request to join"} ${spaceName}`}
    >
      <Plus data-icon="inline-start" />
      {joinPolicy === "open" ? "Join" : "Request"}
    </Button>
  );
}
