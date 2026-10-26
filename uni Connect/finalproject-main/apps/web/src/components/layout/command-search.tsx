"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { KIND_ICONS } from "@/components/search/search-result";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { KIND_LABELS } from "@/lib/search";
import type { UserRole } from "@/lib/campus";
import { adminNavFor, MAIN_NAV } from "@/lib/navigation";
import type { SearchHit } from "@/server/queries/search";
import { quickSearch } from "@/server/actions/search";

/**
 * ⌘K / Ctrl+K command palette (Feature 8): live results as you type, "Search for…",
 * "Ask AI about…" and page shortcuts. Filtering is ours (cmdk's fuzzy filter would hide
 * server results that matched on body text).
 */
export function CommandSearch({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Debounced live search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await quickSearch(q);
        setHits(result.ok ? result.data : []);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    setHits([]);
    router.push(href);
  }

  const q = query.trim();
  const needle = q.toLowerCase();
  const pages = MAIN_NAV.filter((item) => !needle || item.label.toLowerCase().includes(needle));
  const adminPages = adminNavFor(role).filter(
    (item) => !needle || item.label.toLowerCase().includes(needle),
  );
  const shownHits = q.length >= 2 ? hits : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setQuery("");
          setHits([]);
        }
      }}
      title="Search UniConnect"
      description="Search discussions, events, announcements, resources and people, or jump to a page."
    >
      {/* This shadcn version's CommandDialog doesn't wrap children in <Command>; the input and list need it. */}
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search or jump to…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-4 text-muted-foreground">
              <Search className="size-5" aria-hidden />
              <span>Nothing found. Press Enter on “Search for…” to see everything.</span>
            </div>
          </CommandEmpty>

          {q.length >= 2 && (
            <CommandGroup heading="Search">
              <CommandItem
                value={`search ${q}`}
                onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Search />} Search for “{q}”
              </CommandItem>
              <CommandItem
                value={`ask ${q}`}
                onSelect={() => go(`/ask?q=${encodeURIComponent(q)}`)}
              >
                <Sparkles className="text-ai" /> Ask AI about “{q}”
              </CommandItem>
            </CommandGroup>
          )}

          {shownHits.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Results">
                {shownHits.map((hit) => {
                  const Icon = KIND_ICONS[hit.kind];
                  return (
                    <CommandItem
                      key={`${hit.kind}-${hit.id}`}
                      value={`${hit.kind}-${hit.id}`}
                      onSelect={() => go(hit.url)}
                    >
                      <Icon />
                      <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {KIND_LABELS[hit.kind]}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {q.length < 2 && (
            <CommandGroup heading="Ask">
              <CommandItem onSelect={() => go("/ask")} value="ask ai assistant question">
                <Sparkles className="text-ai" /> Ask UniConnect AI
              </CommandItem>
            </CommandGroup>
          )}

          {pages.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Go to">
                {pages.map((item) => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => go(item.href)}
                    value={`go ${item.label}`}
                  >
                    <item.icon /> {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {adminPages.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Admin">
                {adminPages.map((item) => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => go(item.href)}
                    value={`admin ${item.label}`}
                  >
                    <item.icon /> {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
