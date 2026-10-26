/** A titled card inside a settings page. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border bg-card shadow-soft">
      <div className="space-y-5 p-4 sm:p-7">
        <header className="space-y-1">
          <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
        {children}
      </div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-[22px] border-t bg-surface-tint px-4 py-4 sm:px-7">
          {footer}
        </div>
      )}
    </section>
  );
}
