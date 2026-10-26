"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { describedBy, Field, SelectInput, TextInput } from "@/components/forms/field";
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
import { shortTime, WEEKDAYS } from "@/lib/timetable";
import { deleteTimetableEntry, saveTimetableEntry } from "@/server/actions/timetable";
import type { PersonRef, TimetableEntry } from "@/server/queries/timetable";

type Values = {
  moduleName: string;
  moduleCode: string;
  lecturerId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  room: string;
  startsOn: string;
  endsOn: string;
};

/** Add or edit one weekly class in a batch's timetable (coordinators, Phase D). */
export function EntryForm({
  batchId,
  batchName,
  staff,
  entry,
  defaultTerm,
}: {
  batchId: string;
  batchName: string;
  staff: PersonRef[];
  entry?: TimetableEntry;
  /** Pre-filled term dates for a new class (the batch's current term, or the next 4 months). */
  defaultTerm: { startsOn: string; endsOn: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const initial: Values = {
    moduleName: entry?.moduleName ?? "",
    moduleCode: entry?.moduleCode ?? "",
    lecturerId: entry?.lecturer?.id ?? "",
    weekday: String(entry?.weekday ?? 1),
    startTime: entry ? shortTime(entry.startTime) : "09:00",
    endTime: entry ? shortTime(entry.endTime) : "11:00",
    room: entry?.room ?? "",
    startsOn: entry?.startsOn ?? defaultTerm.startsOn,
    endsOn: entry?.endsOn ?? defaultTerm.endsOn,
  };
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const prefix = entry ? `entry-${entry.id}` : "entry-new";

  const set = (key: keyof Values) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function submit() {
    startTransition(async () => {
      const result = await saveTimetableEntry({
        ...values,
        entryId: entry?.id ?? "",
        batchId,
        weekday: Number(values.weekday),
      });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v?.[0]])));
        if (!result.fieldErrors) toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      setOpen(false);
      if (!entry) setValues(initial);
      router.refresh();
    });
  }

  const id = (name: string) => `${prefix}-${name}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setErrors({});
      }}
    >
      <DialogTrigger
        render={
          entry ? (
            <Button variant="outline" size="sm" aria-label={`Edit ${entry.moduleName}`} />
          ) : (
            <Button />
          )
        }
      >
        {entry ? (
          <>
            <Pencil data-icon="inline-start" /> Edit
          </>
        ) : (
          <>
            <Plus data-icon="inline-start" /> Add class
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry ? `Edit ${entry.moduleName}` : `Add a class to ${batchName}`}
          </DialogTitle>
          <DialogDescription>
            It repeats every week of the term. Classes are created from today on; past classes and
            their attendance never change.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field id={id("module")} label="Module" error={errors.moduleName}>
            <TextInput
              id={id("module")}
              value={values.moduleName}
              onChange={set("moduleName")}
              maxLength={120}
              placeholder="e.g. Database Systems"
              {...describedBy(id("module"), errors.moduleName)}
            />
          </Field>
          <Field id={id("code")} label="Code" optional error={errors.moduleCode}>
            <TextInput
              id={id("code")}
              value={values.moduleCode}
              onChange={set("moduleCode")}
              maxLength={20}
              placeholder="CS201"
              {...describedBy(id("code"), errors.moduleCode)}
            />
          </Field>
        </div>
        <Field id={id("lecturer")} label="Lecturer" optional error={errors.lecturerId}>
          <SelectInput id={id("lecturer")} value={values.lecturerId} onChange={set("lecturerId")}>
            <option value="">No lecturer yet</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={id("day")} label="Day" error={errors.weekday}>
            <SelectInput id={id("day")} value={values.weekday} onChange={set("weekday")}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id={id("start")} label="Starts" error={errors.startTime}>
            <TextInput
              id={id("start")}
              type="time"
              value={values.startTime}
              onChange={set("startTime")}
              {...describedBy(id("start"), errors.startTime)}
            />
          </Field>
          <Field id={id("end")} label="Ends" error={errors.endTime}>
            <TextInput
              id={id("end")}
              type="time"
              value={values.endTime}
              onChange={set("endTime")}
              {...describedBy(id("end"), errors.endTime)}
            />
          </Field>
        </div>
        <Field id={id("room")} label="Room" optional error={errors.room}>
          <TextInput
            id={id("room")}
            value={values.room}
            onChange={set("room")}
            maxLength={80}
            placeholder="e.g. Lab 4"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={id("from")} label="Term starts" error={errors.startsOn}>
            <TextInput
              id={id("from")}
              type="date"
              value={values.startsOn}
              onChange={set("startsOn")}
              {...describedBy(id("from"), errors.startsOn)}
            />
          </Field>
          <Field id={id("to")} label="Term ends" error={errors.endsOn}>
            <TextInput
              id={id("to")}
              type="date"
              value={values.endsOn}
              onChange={set("endsOn")}
              {...describedBy(id("to"), errors.endsOn)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : entry ? "Save changes" : "Add class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEntryButton({
  entryId,
  moduleName,
}: {
  entryId: string;
  moduleName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Remove ${moduleName}`}
      >
        <Trash2 data-icon="inline-start" /> Remove
      </Button>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        title={`Remove ${moduleName} from the timetable?`}
        description="Upcoming classes are deleted. Past classes and their attendance are kept."
        confirmLabel="Remove"
        onConfirm={async () => {
          const result = await deleteTimetableEntry(entryId);
          if (!result.ok) return void toast.error(result.error);
          toast.success(result.message ?? "Removed.");
          router.refresh();
        }}
      />
    </>
  );
}
