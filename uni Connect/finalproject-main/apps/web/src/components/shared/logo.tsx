import Image from "next/image";
import Link from "next/link";

import logoMark from "@/assets/logo.png";
import { cn } from "@/lib/utils";

/** Product name. Change it here only. */
export const APP_NAME = "UniConnect";
export const APP_TAGLINE = "Student Community";

/** The UniConnect mark: two people forming a "U". The picture is transparent, so it sits on any surface. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src={logoMark}
      alt=""
      aria-hidden
      width={42}
      height={42}
      className={cn("size-[42px] shrink-0", className)}
    />
  );
}

export function Logo({
  className,
  href = "/",
  iconOnly = false,
  tagline = true,
}: {
  className?: string;
  href?: string;
  iconOnly?: boolean;
  /** The small "Student community" line; hidden where space is tight (the app sidebar). */
  tagline?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={`${APP_NAME} home`}
      className={cn("inline-flex items-center gap-3 rounded-md outline-none", className)}
    >
      <BrandMark />
      {!iconOnly && (
        <span className="leading-tight">
          <strong className="block text-[17.5px] font-extrabold tracking-tight">{APP_NAME}</strong>
          {tagline && (
            <small className="block text-[9.5px] font-bold tracking-[0.22em] text-muted-foreground uppercase">
              {APP_TAGLINE}
            </small>
          )}
        </span>
      )}
    </Link>
  );
}
