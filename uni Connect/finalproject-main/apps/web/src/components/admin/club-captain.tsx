"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { describedBy, Field, SelectInput } from "@/components/forms/field";
import { SettingsSection } from "@/components/settings/settings-section";
import { setSpaceRole } from "@/server/actions/batches";

/**
 * The club captain: runs the club space and approves its events. Chosen from the
 * club's members by a super admin or the department's coordinator.
 */
export function ClubCaptain({
  spaceId,
  captainId,
  members,
}: {
  spaceId: string;
  captainId: string | null;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    startTransition(async () => {
      if (captainId) {
        const removed = await setSpaceRole(spaceId, captainId, "member");
        if (!removed.ok) {
          toast.error(removed.error);
          return;
        }
      }
      if (next) {
        const result = await setSpaceRole(spaceId, next, "captain");
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success(next ? "Captain updated." : "Captain removed.");
      router.refresh();
    });
  }

  return (
    <SettingsSection
      title="Club captain"
      description="The captain runs this club's space and approves the club's events. Shown with a cyan badge."
    >
      <Field id="captain" label="Captain" hint="Only members of the club can be captain.">
        <SelectInput
          id="captain"
          value={captainId ?? ""}
          disabled={pending}
          onChange={(event) => choose(event.target.value)}
          {...describedBy("captain", undefined, true)}
        >
          <option value="">No captain</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectInput>
      </Field>
    </SettingsSection>
  );
}
