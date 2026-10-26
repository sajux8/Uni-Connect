"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatCampus } from "@/lib/campus-time";

/**
 * The campus time on Home's Now line. Starts from the server's time and keeps itself current; when
 * the board's next change is due (`refreshAt`: a class starting or ending) it reloads Home's data,
 * so "Now", "Next" and Mark present never lag behind the clock.
 */
export function NowClock({ initial, refreshAt }: { initial: string; refreshAt: string | null }) {
  const router = useRouter();
  const [time, setTime] = useState(initial);
  useEffect(() => {
    const due = refreshAt ? new Date(refreshAt).getTime() : null;
    let refreshed = false;
    const id = setInterval(() => {
      setTime(formatCampus(new Date(), "time"));
      if (due !== null && !refreshed && Date.now() >= due) {
        refreshed = true;
        router.refresh();
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [refreshAt, router]);
  return (
    <time title="Sri Lanka time" className="tabular-nums">
      {time}
    </time>
  );
}
