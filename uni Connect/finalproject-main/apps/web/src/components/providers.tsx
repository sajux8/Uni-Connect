"use client";

import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Client-side providers: theme (light by default, dark via the toggle), tooltips, toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider delay={300}>
        {children}
        {/* Navy pill toasts with a cyan icon, matching the UniConnect concept. */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                "flex w-full max-w-[340px] items-center gap-3 rounded-[14px] border border-white/10 bg-brand-navy px-[19px] py-[13px] text-sm font-semibold text-white shadow-[0_18px_44px_rgba(11,31,71,0.35)]",
              icon: "text-brand-cyan [&_svg]:size-[17px]",
              title: "leading-snug",
              description: "text-white/70 text-[13px] font-medium",
              actionButton:
                "ml-auto rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white hover:bg-white/25",
              error: "[&_[data-icon]]:text-[#ff8aa0]",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
