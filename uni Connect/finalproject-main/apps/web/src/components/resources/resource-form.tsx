"use client";

import { FileUp, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import * as z from "zod";

import { TagSelect } from "@/components/community/tag-select";
import {
  describedBy,
  Field,
  FormErrorSummary,
  focusField,
  SelectInput,
  TextArea,
  TextInput,
  type FieldErrorMap,
} from "@/components/forms/field";
import { ResourceIcon } from "@/components/resources/resource-card";
import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTRIBUTE,
  fileTypeLabel,
  formatBytes,
  MAX_RESOURCE_BYTES,
  resolveMimeType,
  safeFileName,
} from "@/lib/resources";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { resourceSchema, type ResourceInput } from "@/lib/validation/resources";
import { createResource } from "@/server/actions/resources";

const LABELS: Record<string, string> = {
  file: "File",
  url: "Link",
  title: "Title",
  description: "Description",
  moduleCode: "Module code",
  spaceId: "Space",
  tagIds: "Tags",
};

interface Uploaded {
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

/** Share a file (uploaded straight to the private bucket) or a link (Feature 7). */
export function ResourceForm({
  userId,
  isStaff,
  departments,
  spaces,
  tags,
  defaults,
}: {
  userId: string;
  isStaff: boolean;
  departments: { id: string; name: string }[];
  spaces: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  defaults: { departmentId: string; spaceId: string };
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"file" | "link">("file");
  const [file, setFile] = useState<Uploaded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [departmentId, setDepartmentId] = useState(defaults.departmentId);
  const [moduleCode, setModuleCode] = useState("");
  const [spaceId, setSpaceId] = useState(defaults.spaceId);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrorMap | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(chosen: File | undefined) {
    if (!chosen) return;
    const mimeType = resolveMimeType(chosen.name, chosen.type);
    if (!mimeType) {
      setErrors({ file: ["Use a PDF, Word, PowerPoint, Excel, PNG, JPG or ZIP file."] });
      return;
    }
    if (chosen.size > MAX_RESOURCE_BYTES) {
      setErrors({ file: ["That file is over 25 MB."] });
      return;
    }
    setErrors(null);
    setUploading(true);
    const supabase = createClient();
    const path = `${userId}/${crypto.randomUUID()}-${safeFileName(chosen.name)}`;
    const { error } = await supabase.storage
      .from("resources")
      .upload(path, chosen, { contentType: mimeType, upsert: false });
    setUploading(false);
    if (error) {
      toast.error("Upload failed. Check your connection and try again.");
      return;
    }
    // Remove the previous upload if they swapped files.
    if (file) void supabase.storage.from("resources").remove([file.path]);
    setFile({ path, name: chosen.name.slice(0, 200), size: chosen.size, mimeType });
    if (!title)
      setTitle(
        chosen.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .slice(0, 150),
      );
  }

  function removeFile() {
    if (file) void createClient().storage.from("resources").remove([file.path]);
    setFile(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input: ResourceInput = {
      kind,
      title,
      description,
      url: url.trim(),
      filePath: file?.path ?? "",
      fileName: file?.name ?? "",
      fileSize: file?.size ?? 0,
      mimeType: file?.mimeType ?? "",
      departmentId,
      moduleCode,
      spaceId,
      tagIds,
    };
    const parsed = resourceSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as FieldErrorMap;
      setErrors(fieldErrors);
      const first = Object.keys(LABELS).find((k) => fieldErrors[k]?.[0]);
      if (first) focusField(first === "file" ? "file-drop" : first);
      return;
    }
    startTransition(async () => {
      const result = await createResource(input);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? null);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Shared.");
      router.push(`/resources/${result.data.id}`);
    });
  }

  const err = (key: string) => errors?.[key]?.[0];

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {errors && Object.values(errors).some((e) => e?.[0]) && (
        <FormErrorSummary errors={errors} labels={LABELS} />
      )}

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What are you sharing?">
        {(
          [
            { value: "file", label: "Upload a file", icon: FileUp },
            { value: "link", label: "Share a link", icon: Link2 },
          ] as const
        ).map((k) => (
          <label
            key={k.value}
            className={cn(
              "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] px-2 text-sm font-bold has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
              kind === k.value
                ? "border-primary bg-accent"
                : "border-input hover:border-border-strong",
            )}
          >
            <input
              type="radio"
              name="kind"
              value={k.value}
              checked={kind === k.value}
              onChange={() => setKind(k.value)}
              className="sr-only"
            />
            <k.icon className="size-4" aria-hidden />
            {k.label}
          </label>
        ))}
      </div>

      {kind === "file" ? (
        <div className="space-y-1.5">
          {file ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-surface-tint p-3">
              <ResourceIcon mimeType={file.mimeType} isLink={false} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fileTypeLabel(file.mimeType)} · {formatBytes(file.size)} · Uploaded
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeFile}
                aria-label="Remove file"
              >
                <Trash2 />
              </Button>
            </div>
          ) : (
            <button
              id="file-drop"
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void upload(e.dataTransfer.files?.[0]);
              }}
              disabled={uploading}
              aria-describedby={err("file") ? "file-error" : "file-hint"}
              className={cn(
                "flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed bg-surface-tint px-4 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                dragging ? "border-primary bg-accent" : "border-border-strong hover:border-primary",
                err("file") && "border-destructive",
              )}
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              ) : (
                <UploadCloud className="size-6 text-primary" aria-hidden />
              )}
              <span className="text-sm font-bold">
                {uploading ? "Uploading…" : "Choose a file or drag it here"}
              </span>
              <span id="file-hint" className="text-xs text-muted-foreground">
                PDF, Word, PowerPoint, Excel, PNG, JPG or ZIP · up to 25 MB
              </span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-label="File to upload"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {err("file") && (
            <p id="file-error" role="alert" className="text-[13px] font-medium text-destructive">
              {err("file")}
            </p>
          )}
        </div>
      ) : (
        <Field id="url" label="Link" error={err("url")}>
          <TextInput
            id="url"
            type="url"
            inputMode="url"
            value={url}
            maxLength={1000}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            {...describedBy("url", err("url"))}
          />
        </Field>
      )}

      <Field id="title" label="Title" error={err("title")}>
        <TextInput
          id="title"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Database Systems: normalisation cheat sheet"
          {...describedBy("title", err("title"))}
        />
      </Field>
      <Field
        id="description"
        label="Description"
        optional
        hint="What's in it and who it helps."
        error={err("description")}
      >
        <TextArea
          id="description"
          rows={3}
          value={description}
          maxLength={1000}
          onChange={(e) => setDescription(e.target.value)}
          {...describedBy("description", err("description"), true)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="departmentId" label="Department" optional>
          <SelectInput
            id="departmentId"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">Any department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="moduleCode" label="Module code" optional error={err("moduleCode")}>
          <TextInput
            id="moduleCode"
            value={moduleCode}
            maxLength={20}
            onChange={(e) => setModuleCode(e.target.value)}
            placeholder="e.g. CS2041"
            autoCapitalize="characters"
            {...describedBy("moduleCode", err("moduleCode"))}
          />
        </Field>
      </div>
      <Field
        id="spaceId"
        label="Space"
        optional
        hint="Share it with one space only. Leave empty for everyone."
        error={err("spaceId")}
      >
        <SelectInput id="spaceId" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
          <option value="">Everyone</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <TagSelect
        id="tagIds"
        tags={tags}
        value={tagIds}
        onChange={setTagIds}
        error={err("tagIds")}
      />

      <p className="rounded-xl bg-surface-tint px-3.5 py-2.5 text-[13px] text-muted-foreground">
        {isStaff
          ? "As staff, your resources are published straight away."
          : "A moderator checks every resource before it's published. You'll get a notification when it's live. Only share material you're allowed to share."}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={pending || uploading}>
          {pending ? "Sharing…" : isStaff ? "Publish resource" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
