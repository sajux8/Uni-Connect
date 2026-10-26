"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateAvatar } from "@/server/actions/profile";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Uploads straight from the browser to the public `avatars` bucket, inside the
 * user's own folder (the storage policy enforces that), then saves the URL.
 */
export function AvatarUploader({
  userId,
  name,
  initialUrl,
}: {
  userId: string;
  name: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext) return toast.error("Choose a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) return toast.error("That image is over 2 MB. Choose a smaller one.");

    startTransition(async () => {
      const supabase = createClient();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        toast.error("Upload failed. Please try again.");
        return;
      }
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const result = await updateAvatar(publicUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(publicUrl);
      toast.success(result.message ?? "Photo updated.");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await updateAvatar(null);
      if (!result.ok) return void toast.error(result.error);
      setUrl(null);
      toast.success(result.message ?? "Photo removed.");
    });
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} src={url} size="xl" className="ring-4 ring-accent" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera data-icon="inline-start" />
            {pending ? "Saving…" : url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
              <Trash2 data-icon="inline-start" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Profile photo"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
