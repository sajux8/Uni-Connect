import { Eyebrow } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

/**
 * The card every sign-in, registration and account-status page sits in:
 * eyebrow, title, short description, then the form or message.
 */
export function AuthCard({
  eyebrow,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** md: a narrow card (sign-in, messages); lg: the full width of the auth layout (long forms). */
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("mx-auto space-y-5", size === "md" && "max-w-[460px]", className)}>
      <section className="rounded-[22px] border bg-card p-6 shadow-lift sm:p-8">
        <header className="mb-6 space-y-2.5">
          {icon && (
            <span className="mb-1 grid size-[54px] place-items-center rounded-[15px] bg-accent text-accent-foreground [&_svg]:size-6">
              {icon}
            </span>
          )}
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[28px]">
            {title}
          </h1>
          {description && (
            <p className="text-[15px] text-pretty text-muted-foreground">{description}</p>
          )}
        </header>
        {children}
      </section>
      {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
    </div>
  );
}
