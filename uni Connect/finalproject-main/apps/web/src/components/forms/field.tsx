import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form building blocks in the UniConnect style: 44px inputs with 14px corners,
 * bold labels, hints below, errors linked to the input for screen readers.
 * Plain elements on purpose so they work with FormData and Server Actions.
 */

export type FieldErrorMap = Record<string, string[] | undefined>;

export const inputClass =
  "h-11 w-full min-w-0 rounded-[14px] border-[1.5px] border-input bg-card px-3.5 text-[15px] text-foreground shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/80 hover:border-border-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="flex items-baseline gap-1.5 text-[13.5px] font-bold text-foreground"
      >
        {label}
        {optional && <span className="text-xs font-medium text-muted-foreground">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props that tie an input to its Field's hint or error. */
export function describedBy(id: string, error?: string, hint?: unknown) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function TextArea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "h-auto min-h-24 resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function SelectInput({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(inputClass, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

/** Banner for a form-level error or success message. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-3.5 py-2.5 text-[14px] font-medium",
        tone === "error" && "border-destructive/25 bg-destructive/8 text-destructive",
        tone === "success" && "tint tint-emerald",
        tone === "info" && "border-primary/20 bg-accent text-accent-foreground",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Error banner that names every field to fix, each a link that moves focus to it.
 * Long forms need this: field errors can sit below the fold.
 */
export function FormErrorSummary({
  errors,
  labels,
  message = "Please fix the following:",
}: {
  errors: FieldErrorMap;
  /** Field id → label, in the order the fields appear on the page. */
  labels: Record<string, string>;
  message?: string;
}) {
  const problems = Object.keys(labels).filter((key) => errors[key]?.[0]);
  if (problems.length === 0) return null;

  return (
    <div
      role="alert"
      tabIndex={-1}
      className="rounded-xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-[14px] text-destructive outline-none"
    >
      <p className="font-semibold">{message}</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {problems.map((key) => (
          <li key={key}>
            <a
              href={`#${key}`}
              onClick={(event) => {
                event.preventDefault();
                focusField(key);
              }}
              className="font-medium underline underline-offset-2"
            >
              {labels[key]}
            </a>
            : {errors[key]?.[0]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Scrolls a field into the middle of the screen and focuses it. */
export function focusField(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.focus({ preventScroll: true });
}
