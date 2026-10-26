"use client";

import { Check, Plus, X } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/utils";

/**
 * Pick from suggestions or add your own (interests, expertise).
 * Chips are toggle buttons with aria-pressed, so they work with a keyboard and screen readers.
 */
export function TagPicker({
  id,
  label,
  description,
  suggestions,
  value,
  onChange,
  max = 15,
  error,
}: {
  id: string;
  label: string;
  description?: string;
  suggestions: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  error?: string;
}) {
  const [draft, setDraft] = useState("");
  const custom = value.filter((tag) => !suggestions.includes(tag));
  const full = value.length >= max;

  function toggle(tag: string) {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else if (!full) onChange([...value, tag]);
  }

  function addDraft() {
    const tag = draft.trim().replace(/\s+/g, " ");
    if (tag.length < 2 || tag.length > 40) return;
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!exists && !full) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <fieldset className="space-y-3" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="flex w-full items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-bold">{label}</span>
        <span className="text-xs text-muted-foreground">
          {value.length}/{max} selected
        </span>
      </legend>
      {description && <p className="-mt-1 text-[13px] text-muted-foreground">{description}</p>}

      <div className="flex flex-wrap gap-2">
        {[...suggestions, ...custom].map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() => toggle(tag)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-foreground hover:border-border-strong",
              )}
            >
              {selected &&
                (suggestions.includes(tag) ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                ))}
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
          maxLength={40}
          placeholder="Add your own…"
          aria-label={`Add to ${label.toLowerCase()}`}
          disabled={full}
          className={cn(inputClass, "h-10 flex-1")}
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={full || draft.trim().length < 2}
          className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-input bg-card px-4 text-sm font-semibold outline-none hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
