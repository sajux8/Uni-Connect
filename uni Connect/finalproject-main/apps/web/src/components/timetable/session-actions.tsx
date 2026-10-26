"use client";

import { CalendarClock, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ReasonDialog } from "@/components/community/confirm-dialogs";
import { describedBy, Field, TextArea, TextInput } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toCampusInput } from "@/lib/campus-time";
import type { SessionState } from "@/lib/timetable";
import {
  cancelClassSession,
  moveClassSession,
  restoreClassSession,
} from "@/server/actions/timetable";

/** Coordinators cancel, restore or move one class; the batch is told (Phase D). */
export function SessionActions({
  sessionId,
  moduleName,
  state,
  startsAt,
  endsAt,
  room,
}: {
  sessionId: string;
  moduleName: string;
  state: SessionState;
  startsAt: string;
  endsAt: string;
  room: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (state === "cancelled") {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await restoreClassSession(sessionId);
            if (!result.ok) return void toast.error(result.error);
            toast.success(result.message ?? "Done.");
            router.refresh();
          })
        }
      >
        <RotateCcw data-icon="inline-start" /> Restore class
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {state === "upcoming" && (
        <MoveDialog
          sessionId={sessionId}
          moduleName={moduleName}
          startsAt={startsAt}
          endsAt={endsAt}
          room={room}
        />
      )}
      <Button variant="outline" onClick={() => setCancelOpen(true)}>
        <X data-icon="inline-start" /> Cancel class
      </Button>
      <ReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel ${moduleName}?`}
        description={
          state === "upcoming" || state === "live"
            ? "Students in the batch and the lecturer are told, with your reason."
            : "This class has ended. Cancelling it means nobody is counted absent for it."
        }
        confirmLabel="Cancel class"
        onConfirm={async (reason) => {
          const result = await cancelClassSession(sessionId, reason);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(result.message ?? "Cancelled.");
          router.refresh();
          return true;
        }}
      />
    </div>
  );
}

function MoveDialog({
  sessionId,
  moduleName,
  startsAt,
  endsAt,
  room,
}: {
  sessionId: string;
  moduleName: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({
    startsAt: toCampusInput(startsAt, "datetime"),
    endsAt: toCampusInput(endsAt, "datetime"),
    room: room ?? "",
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function submit() {
    startTransition(async () => {
      const result = await moveClassSession({ sessionId, ...values });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0]])));
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Moved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <CalendarClock data-icon="inline-start" /> Move class
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {moduleName}</DialogTitle>
          <DialogDescription>
            Only this class moves. Students in the batch and the lecturer are told.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="moveStart" label="New start" error={errors.startsAt}>
            <TextInput
              id="moveStart"
              type="datetime-local"
              value={values.startsAt}
              onChange={set("startsAt")}
              {...describedBy("moveStart", errors.startsAt)}
            />
          </Field>
          <Field id="moveEnd" label="New end" error={errors.endsAt}>
            <TextInput
              id="moveEnd"
              type="datetime-local"
              value={values.endsAt}
              onChange={set("endsAt")}
              {...describedBy("moveEnd", errors.endsAt)}
            />
          </Field>
        </div>
        <Field id="moveRoom" label="Room" optional>
          <TextInput id="moveRoom" value={values.room} onChange={set("room")} maxLength={80} />
        </Field>
        <Field id="moveReason" label="Reason" error={errors.reason}>
          <TextArea
            id="moveReason"
            rows={2}
            maxLength={300}
            value={values.reason}
            onChange={set("reason")}
            placeholder="e.g. The lab is booked for exams that morning."
            {...describedBy("moveReason", errors.reason)}
          />
        </Field>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Moving…" : "Move class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
