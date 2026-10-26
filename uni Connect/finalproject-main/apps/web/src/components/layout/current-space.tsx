"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface CurrentSpaceState {
  slug: string | null;
  setSlug: (slug: string | null) => void;
}

const CurrentSpaceContext = createContext<CurrentSpaceState>({ slug: null, setSlug: () => {} });

/** Lets pages that belong to a space but live outside /spaces/[slug] tell the sidebar which one. */
export function CurrentSpaceProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  return (
    <CurrentSpaceContext.Provider value={{ slug, setSlug }}>
      {children}
    </CurrentSpaceContext.Provider>
  );
}

export function useCurrentSpaceSlug(): string | null {
  return useContext(CurrentSpaceContext).slug;
}

/** Rendered by post pages so the sidebar highlights the post's space. */
export function CurrentSpace({ slug }: { slug: string }) {
  const { setSlug } = useContext(CurrentSpaceContext);
  useEffect(() => {
    setSlug(slug);
    return () => setSlug(null);
  }, [slug, setSlug]);
  return null;
}
