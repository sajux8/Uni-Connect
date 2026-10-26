"use client";

import { useRouter } from "next/navigation";

import { SelectInput } from "@/components/forms/field";
import { cn } from "@/lib/utils";

/**
 * A compact dropdown filter whose state lives in the URL, for long option lists that would
 * otherwise be a crowded row of pills. Each option carries the href it leads to.
 */
export function FilterSelect({
  label,
  options,
  className,
}: {
  label: string;
  options: { href: string; label: string; selected: boolean }[];
  className?: string;
}) {
  const router = useRouter();
  const value = options.find((o) => o.selected)?.href ?? options[0]?.href;
  return (
    <div className={cn("w-full sm:w-fit", className)}>
      <SelectInput
        aria-label={label}
        value={value}
        onChange={(event) => router.push(event.target.value, { scroll: false })}
        className="h-10 rounded-full text-sm font-semibold sm:min-w-44"
      >
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}
