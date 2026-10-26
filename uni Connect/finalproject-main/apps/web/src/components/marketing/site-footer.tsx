import Link from "next/link";

import { APP_NAME, Logo } from "@/components/shared/logo";

const LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Community Guidelines", href: "/terms" },
  { label: "Terms", href: "/terms" },
  { label: "Log In", href: "/login" },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-background py-[34px]">
      <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-5 px-6 text-center sm:flex-row sm:flex-wrap sm:text-left">
        <Logo href="/" />
        <p className="text-sm font-semibold text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. Student Community.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2.5">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
