"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { iconCircle } from "@/components/layout/icon-circle";
import { ThemeSwitch } from "@/components/layout/theme-switch";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Home", href: "/#top" },
  { label: "Community", href: "/#community" },
  { label: "Student Feed", href: "/#feed" },
  { label: "Discover", href: "/#discover" },
  { label: "Events", href: "/#events" },
  { label: "About", href: "/#about" },
];

/** Public header: transparent at the top, frosted once you scroll (concept: .site-header). */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-[60] border-b border-transparent transition-[background-color,box-shadow,border-color] duration-300",
        (scrolled || open) &&
          "border-border/60 bg-background/85 shadow-[0_8px_28px_rgba(13,47,111,0.08)] backdrop-blur-[14px]",
      )}
    >
      <div className="mx-auto flex h-[76px] max-w-[1180px] items-center gap-6 px-6">
        <Logo href="/" />

        <nav aria-label="Main navigation" className="mx-auto hidden gap-1.5 min-[900px]:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-[14.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-primary dark:hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 min-[900px]:flex">
          <ThemeSwitch />
          <Link
            href="/login"
            className="px-2 py-2.5 text-[15px] font-bold text-foreground transition-colors hover:text-primary"
          >
            Log In
          </Link>
          <Link href="/register" className={cn(buttonVariants(), "h-11 px-5 text-[13.5px]")}>
            Join Community
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2.5 min-[900px]:hidden">
          <ThemeSwitch />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className={iconCircle}
          >
            {open ? (
              <X className="size-[18px]" aria-hidden />
            ) : (
              <Menu className="size-[18px]" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full animate-in border-t bg-background px-6 pt-4 pb-6 shadow-[0_24px_48px_rgba(13,47,111,0.14)] duration-300 fade-in-0 slide-in-from-top-2 min-[900px]:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-border/60 px-1.5 py-3 text-base font-bold"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "flex-1")}
            >
              Log In
            </Link>
            <Link
              href="/register"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "lg" }), "flex-1")}
            >
              Join Community
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
