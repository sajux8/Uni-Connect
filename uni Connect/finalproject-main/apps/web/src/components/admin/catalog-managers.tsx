"use client";

import { Check, Eye, EyeOff, GitMerge, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/community/confirm-dialogs";
import { describedBy, Field, SelectInput, TextInput } from "@/components/forms/field";
import { CategoryChip } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action-result";
import {
  deleteTag,
  mergeTags,
  saveDepartment,
  saveTag,
  setDepartmentActive,
} from "@/server/actions/catalog";

type Errors = Record<string, string | undefined>;

function useSave() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(
          Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])),
        );
        toast.error(result.error);
        return;
      }
      setErrors({});
      toast.success(result.message ?? "Saved.");
      onDone?.();
      router.refresh();
    });
  }
  return { errors, pending, run };
}

// Departments -------------------------------------------------------------------------------

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  members: number;
}

export function DepartmentManager({ departments }: { departments: DepartmentRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <DepartmentEditor onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" /> Add department
        </Button>
      )}
      <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
        {departments.map((d) =>
          editing === d.id ? (
            <li key={d.id} className="p-4">
              <DepartmentEditor department={d} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <CategoryChip tint="indigo">{d.code}</CategoryChip>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{d.name}</span>
                <span className="block text-[13px] text-muted-foreground">
                  {d.members} {d.members === 1 ? "member" : "members"}
                  {!d.is_active && " · hidden from sign-up"}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(d.id)}
                aria-label={`Edit ${d.name}`}
              >
                <Pencil data-icon="inline-start" /> Edit
              </Button>
              <ToggleDepartment department={d} />
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function ToggleDepartment({ department }: { department: DepartmentRow }) {
  const { pending, run } = useSave();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => run(() => setDepartmentActive(department.id, !department.is_active))}
      aria-label={`${department.is_active ? "Hide" : "Show"} ${department.name}`}
    >
      {department.is_active ? (
        <EyeOff data-icon="inline-start" />
      ) : (
        <Eye data-icon="inline-start" />
      )}
      {department.is_active ? "Hide" : "Show"}
    </Button>
  );
}

function DepartmentEditor({
  department,
  onDone,
}: {
  department?: DepartmentRow;
  onDone: () => void;
}) {
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const { errors, pending, run } = useSave();
  const key = department?.id ?? "new";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveDepartment(department?.id ?? null, { name, code }), onDone);
      }}
      className="flex flex-wrap items-start gap-3"
    >
      <Field id={`dept-name-${key}`} label="Name" error={errors.name} className="min-w-56 flex-1">
        <TextInput
          id={`dept-name-${key}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoFocus
          {...describedBy(`dept-name-${key}`, errors.name)}
        />
      </Field>
      <Field id={`dept-code-${key}`} label="Code" error={errors.code} className="w-32">
        <TextInput
          id={`dept-code-${key}`}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={6}
          {...describedBy(`dept-code-${key}`, errors.code)}
        />
      </Field>
      <div className="flex gap-2 sm:pt-7">
        <Button type="submit" disabled={pending}>
          <Check data-icon="inline-start" /> Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          <X data-icon="inline-start" /> Cancel
        </Button>
      </div>
    </form>
  );
}

// Tags -----------------------------------------------------------------------------------------

export interface TagRow {
  id: string;
  name: string;
  description: string | null;
  usage_count: number;
}

export function TagManager({ tags }: { tags: TagRow[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [merging, setMerging] = useState<TagRow | null>(null);
  const [deleting, setDeleting] = useState<TagRow | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <TagEditor onDone={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <Plus data-icon="inline-start" /> Add tag
        </Button>
      )}
      <ul className="divide-y rounded-[22px] border bg-card shadow-soft">
        {tags.map((t) =>
          editing === t.id ? (
            <li key={t.id} className="p-4">
              <TagEditor tag={t} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">#{t.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {t.usage_count} {t.usage_count === 1 ? "post" : "posts"}
                  {t.description ? ` · ${t.description}` : ""}
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(t.id)}
                  aria-label={`Edit ${t.name}`}
                >
                  <Pencil data-icon="inline-start" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMerging(t)}
                  aria-label={`Merge ${t.name}`}
                >
                  <GitMerge data-icon="inline-start" /> Merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleting(t)}
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
      {merging && (
        <MergeDialog
          from={merging}
          tags={tags.filter((t) => t.id !== merging.id)}
          onClose={() => setMerging(null)}
        />
      )}
      <ConfirmAction
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete #${deleting?.name}?`}
        description="It's removed from every post and resource, and people following it stop getting notifications. To keep the posts grouped, merge it into another tag instead."
        confirmLabel="Delete tag"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await deleteTag(deleting.id);
          if (result.ok) {
            toast.success(result.message ?? "Deleted.");
            router.refresh();
          } else toast.error(result.error);
        }}
      />
    </div>
  );
}

function TagEditor({ tag, onDone }: { tag?: TagRow; onDone: () => void }) {
  const [name, setName] = useState(tag?.name ?? "");
  const [description, setDescription] = useState(tag?.description ?? "");
  const { errors, pending, run } = useSave();
  const key = tag?.id ?? "new";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => saveTag(tag?.id ?? null, { name, description }), onDone);
      }}
      className="flex flex-wrap items-start gap-3"
    >
      <Field id={`tag-name-${key}`} label="Name" error={errors.name} className="min-w-44 flex-1">
        <TextInput
          id={`tag-name-${key}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={30}
          autoFocus
          {...describedBy(`tag-name-${key}`, errors.name)}
        />
      </Field>
      <Field
        id={`tag-desc-${key}`}
        label="Description"
        optional
        error={errors.description}
        className="min-w-56 flex-[2]"
      >
        <TextInput
          id={`tag-desc-${key}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={200}
          {...describedBy(`tag-desc-${key}`, errors.description)}
        />
      </Field>
      <div className="flex gap-2 sm:pt-7">
        <Button type="submit" disabled={pending}>
          <Check data-icon="inline-start" /> Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          <X data-icon="inline-start" /> Cancel
        </Button>
      </div>
    </form>
  );
}

function MergeDialog({
  from,
  tags,
  onClose,
}: {
  from: TagRow;
  tags: TagRow[];
  onClose: () => void;
}) {
  const [into, setInto] = useState("");
  const { pending, run } = useSave();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge #{from.name}</DialogTitle>
          <DialogDescription>
            Its {from.usage_count} {from.usage_count === 1 ? "post moves" : "posts move"} to the tag
            you choose, along with resources and followers. Then #{from.name} is deleted.
          </DialogDescription>
        </DialogHeader>
        <Field id="merge-into" label="Merge into">
          <SelectInput
            id="merge-into"
            value={into}
            onChange={(event) => setInto(event.target.value)}
          >
            <option value="" disabled>
              Choose a tag…
            </option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <DialogFooter>
          <Button
            disabled={!into || pending}
            onClick={() => run(() => mergeTags(from.id, into), onClose)}
          >
            <GitMerge data-icon="inline-start" /> Merge tags
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
