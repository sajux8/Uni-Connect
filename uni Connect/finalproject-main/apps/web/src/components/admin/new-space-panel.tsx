"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EMPTY_SPACE, SpaceForm } from "@/components/admin/space-form";
import { Button } from "@/components/ui/button";

/** "New space" on /admin/spaces: the form opens in place. */
export function NewSpacePanel({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Button
        variant={open ? "outline" : "default"}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? <X data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
        {open ? "Close" : "New space"}
      </Button>
      {open && (
        <div className="max-w-3xl">
          <SpaceForm
            initial={EMPTY_SPACE}
            departments={departments}
            onSaved={(slug) => router.push(`/spaces/${slug}/settings`)}
          />
        </div>
      )}
    </div>
  );
}
