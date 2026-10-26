"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { iconCircle } from "@/components/layout/icon-circle";
import { cn } from "@/lib/utils";

/**
 * One-click light/dark toggle. The icon swaps purely with CSS (`dark:` variants),
 * so the server-rendered HTML always matches and there's no hydration flash.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(iconCircle, "relative overflow-hidden", className)}
    >
      <Sun
        className="size-[18px] transition-all duration-300 dark:translate-y-6 dark:rotate-90 dark:opacity-0"
        aria-hidden
      />
      <Moon
        className="absolute size-[18px] -translate-y-6 -rotate-90 opacity-0 transition-all duration-300 dark:translate-y-0 dark:rotate-0 dark:opacity-100"
        aria-hidden
      />
    </button>
  );
}
