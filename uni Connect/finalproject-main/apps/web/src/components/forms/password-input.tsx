"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle and an optional strength meter. */
export function PasswordInput({
  showStrength,
  className,
  onChange,
  ...props
}: React.ComponentProps<"input"> & { showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const score = strength(value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          className={cn(inputClass, "pr-11", className)}
          onChange={(event) => {
            setValue(event.target.value);
            onChange?.(event);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1.5 rounded-full bg-muted transition-colors",
                  score >= step &&
                    (score <= 1 ? "bg-destructive" : score === 2 ? "bg-warning" : "bg-success"),
                )}
              />
            ))}
          </div>
          <span className="w-16 text-right text-xs font-semibold text-muted-foreground">
            {["Too weak", "Weak", "Fair", "Good", "Strong"][score]}
          </span>
        </div>
      )}
    </div>
  );
}

/** 0-4: length, mixed case, digits, symbols. Guidance only; the server enforces the rules. */
export function strength(password: string): number {
  if (password.length < 8) return password.length === 0 ? 0 : 1;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}
