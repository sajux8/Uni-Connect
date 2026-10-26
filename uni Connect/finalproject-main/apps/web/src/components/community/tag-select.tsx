"use client";

import { Check, Search } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/utils";

/** Pick up to `max` existing tags (search + toggle chips). */
export function TagSelect({
  id,
  tags,
  value,
  onChange,
  max = 5,
  error,
}: {
  id: string;
  tags: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const full = value.length >= max;
  const shown = tags.filter(
    (t) => value.includes(t.id) || t.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <fieldset className="space-y-2.5" aria-describedby={error ? `${id}-error` : `${id}-hint`}>
      <legend className="flex w-full items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-bold">
          Tags <span className="text-xs font-medium text-muted-foreground">Optional</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {value.length}/{max}
        </span>
      </legend>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={id}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Filter tags"
          aria-label="Filter tags"
          className={cn(inputClass, "h-10 pl-9")}
        />
      </div>
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        {shown.map((tag) => {
          const selected = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() =>
                onChange(selected ? value.filter((v) => v !== tag.id) : [...value, tag.id])
              }
              className={cn(
                "inline-flex h-10 items-center gap-1 rounded-full border-[1.5px] px-3 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40 sm:h-8",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card hover:border-border-strong",
              )}
            >
              {selected && <Check className="size-3.5" aria-hidden />}#{tag.name}
            </button>
          );
        })}
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">No tags match “{q}”.</p>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          Tags help people find your post later.
        </p>
      )}
    </fieldset>
  );
}
