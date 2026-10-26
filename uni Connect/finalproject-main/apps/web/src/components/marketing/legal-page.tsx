import { Info } from "lucide-react";

export interface LegalSection {
  heading: string;
  body: (string | string[])[];
}

/** Readable long-form layout for the privacy notice and community rules. */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-lg text-pretty text-muted-foreground">{intro}</p>
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        <p className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Draft text for the project. Have your university review and adapt it before real
            students use the platform.
          </span>
        </p>
      </header>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
            {section.body.map((block, i) =>
              Array.isArray(block) ? (
                <ul
                  key={i}
                  className="list-disc space-y-1.5 pl-5 text-[15px] text-muted-foreground marker:text-foreground/40"
                >
                  {block.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="text-[15px] leading-7 text-pretty text-muted-foreground">
                  {block}
                </p>
              ),
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
