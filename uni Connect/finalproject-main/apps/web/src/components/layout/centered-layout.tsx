import { ThemeSwitch } from "@/components/layout/theme-switch";
import { Logo } from "@/components/shared/logo";

/**
 * Centered layout for sign-in, registration and onboarding. Same backdrop as the
 * landing hero (soft tint, dotted corner, outline ring) so the journey feels continuous.
 */
export function CenteredLayout({
  children,
  width = "md",
}: {
  children: React.ReactNode;
  width?: "md" | "lg";
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-clip bg-surface-tint px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(color-mix(in_oklch,var(--primary)_18%,transparent)_1.5px,transparent_1.5px)] [mask-image:radial-gradient(460px_340px_at_8%_16%,#000_25%,transparent_72%)] bg-[size:26px_26px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-36 -bottom-44 size-[380px] rounded-full border-[1.5px] border-border-strong"
      />
      <div className="absolute top-5 right-5">
        <ThemeSwitch />
      </div>
      <Logo className="relative mb-8" />
      <main
        id="main"
        className={width === "lg" ? "relative w-full max-w-2xl" : "relative w-full max-w-[440px]"}
      >
        {children}
      </main>
    </div>
  );
}
