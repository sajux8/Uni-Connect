import "server-only";

import { addCampusDays, campusDay, campusDayStart } from "@/lib/campus-time";
import type { EventCategory, EventFormat, EventStatus, RegistrationStatus } from "@/lib/events";
import type { UserRole } from "@/lib/campus";
import { createClient } from "@/lib/supabase/server";
import type { EventWhen } from "@/lib/validation/events";

export interface EventSummary {
  id: string;
  title: string;
  category: EventCategory;
  format: EventFormat;
  status: EventStatus;
  organizingUnit: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  registeredCount: number;
  waitlistCount: number;
  departmentIds: string[];
  years: number[];
  coverUrl: string | null;
  organizerId: string | null;
  /** Organised by staff: shows the Official badge (student and club events don't). */
  official: boolean;
  /** Where the event is placed; null = campus-wide. */
  place: { slug: string; name: string } | null;
  reviewNote: string | null;
}

export interface MyRegistration {
  status: RegistrationStatus;
  waitlistPosition: number | null;
}

const SUMMARY_COLUMNS =
  "id, title, category, format, status, organizing_unit, venue, starts_at, ends_at, registration_deadline, capacity, waitlist_enabled, registered_count, waitlist_count, eligibility_department_ids, eligibility_years, cover_url, organizer_id, review_note, organizer:profiles!events_organizer_id_fkey(role), place:spaces!events_space_id_fkey(slug, name)";

type SummaryRow = {
  id: string;
  title: string;
  category: EventCategory;
  format: EventFormat;
  status: EventStatus;
  organizing_unit: string;
  venue: string | null;
  starts_at: string;
  ends_at: string;
  registration_deadline: string | null;
  capacity: number | null;
  waitlist_enabled: boolean;
  registered_count: number;
  waitlist_count: number;
  eligibility_department_ids: string[];
  eligibility_years: number[];
  cover_url: string | null;
  organizer_id: string | null;
  review_note: string | null;
  organizer: { role: UserRole } | null;
  place: { slug: string; name: string } | null;
};

function toSummary(r: SummaryRow): EventSummary {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    format: r.format,
    status: r.status,
    organizingUnit: r.organizing_unit,
    venue: r.venue,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    registrationDeadline: r.registration_deadline,
    capacity: r.capacity,
    waitlistEnabled: r.waitlist_enabled,
    registeredCount: r.registered_count,
    waitlistCount: r.waitlist_count,
    departmentIds: r.eligibility_department_ids,
    years: r.eligibility_years,
    coverUrl: r.cover_url,
    organizerId: r.organizer_id,
    official: r.organizer ? r.organizer.role !== "student" : false,
    place: r.place,
    reviewNote: r.review_note,
  };
}

/** The date window for a filter, in campus days. */
export function whenRange(when: EventWhen, now = new Date()): { from?: string; to?: string } {
  const today = campusDay(now);
  switch (when) {
    case "week":
      return { from: now.toISOString(), to: campusDayStart(addCampusDays(today, 7)) };
    case "month":
      return { from: now.toISOString(), to: campusDayStart(addCampusDays(today, 31)) };
    case "past":
      return { to: now.toISOString() };
    default:
      return { from: now.toISOString() };
  }
}

/** Published and cancelled events for /events (newest last for upcoming, newest first for past). */
export async function listEvents(options: {
  when: EventWhen;
  category?: EventCategory;
  q?: string;
  limit?: number;
}): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { from, to } = whenRange(options.when);
  let query = supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .in("status", ["published", "cancelled"])
    .limit(options.limit ?? 200);
  // Upcoming/week/month: anything not yet over. Past: already ended.
  if (options.when === "past")
    query = query.lt("ends_at", to!).order("starts_at", { ascending: false });
  else {
    query = query.gte("ends_at", from!).order("starts_at", { ascending: true });
    if (to) query = query.lt("starts_at", to);
  }
  if (options.category) query = query.eq("category", options.category);
  if (options.q)
    query = query.textSearch("tsv", options.q, { type: "websearch", config: "english" });

  const { data, error } = await query;
  if (error) {
    console.error("listEvents", error);
    throw new Error("Couldn't load events.");
  }
  return data.map(toSummary);
}

/** Every visible event starting in a campus month ("2026-10"), for the calendar. */
export async function listEventsInMonth(month: string): Promise<EventSummary[]> {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .in("status", ["published", "cancelled"])
    .gte("starts_at", campusDayStart(first))
    .lt("starts_at", campusDayStart(next))
    .order("starts_at")
    .limit(300);
  if (error) {
    console.error("listEventsInMonth", error);
    throw new Error("Couldn't load events.");
  }
  return data.map(toSummary);
}

/** The viewer's registrations, keyed by event id (cancelled ones left out). */
export async function myRegistrations(userId: string): Promise<Map<string, MyRegistration>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select("event_id, status, waitlist_position")
    .eq("user_id", userId)
    .in("status", ["registered", "waitlisted"]);
  return new Map(
    (data ?? []).map((r) => [
      r.event_id,
      { status: r.status, waitlistPosition: r.waitlist_position },
    ]),
  );
}

export type MyEventsTab = "upcoming" | "waitlisted" | "past" | "cancelled" | "organizing";

export async function listMyEvents(
  userId: string,
  tab: MyEventsTab,
): Promise<{ event: EventSummary; registration: MyRegistration | null }[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  if (tab === "organizing") {
    const { data } = await supabase
      .from("events")
      .select(SUMMARY_COLUMNS)
      .eq("organizer_id", userId)
      .order("starts_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r) => ({ event: toSummary(r), registration: null }));
  }

  let query = supabase
    .from("event_registrations")
    .select(`status, waitlist_position, events!inner(${SUMMARY_COLUMNS})`)
    .eq("user_id", userId)
    .limit(100);
  if (tab === "upcoming") query = query.eq("status", "registered").gte("events.ends_at", now);
  if (tab === "waitlisted") query = query.eq("status", "waitlisted").gte("events.ends_at", now);
  if (tab === "past") query = query.eq("status", "registered").lt("events.ends_at", now);
  if (tab === "cancelled") query = query.eq("status", "cancelled");

  const { data, error } = await query;
  if (error) {
    console.error("listMyEvents", error);
    throw new Error("Couldn't load your events.");
  }
  const rows = data.map((r) => ({
    event: toSummary(r.events),
    registration: { status: r.status, waitlistPosition: r.waitlist_position },
  }));
  rows.sort((a, b) =>
    tab === "past"
      ? b.event.startsAt.localeCompare(a.event.startsAt)
      : a.event.startsAt.localeCompare(b.event.startsAt),
  );
  return rows;
}

/** Next few events the viewer is registered for (Home's right rail). */
export async function upcomingForUser(userId: string, limit = 3): Promise<EventSummary[]> {
  const rows = await listMyEvents(userId, "upcoming");
  return rows
    .filter((r) => r.event.status === "published")
    .slice(0, limit)
    .map((r) => r.event);
}

export interface EventDetail extends EventSummary {
  descriptionHtml: string;
  descriptionText: string;
  locationDetails: string | null;
  onlineUrl: string | null;
  eligibilityNote: string | null;
  cancelReason: string | null;
  spaceId: string | null;
  space: { slug: string; name: string } | null;
  updatedAt: string;
  publishedAt: string | null;
  organizer: { name: string; username: string; avatarUrl: string | null; role: UserRole } | null;
  changes: { id: string; summary: string; createdAt: string }[];
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("events")
    .select(
      `${SUMMARY_COLUMNS}, description_html, description_text, location_details, online_url, eligibility_note, cancel_reason, space_id, updated_at, published_at, profiles!events_organizer_id_fkey(full_name, username, avatar_url, role), spaces(slug, name)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;

  const { data: changes } = await supabase
    .from("event_changes")
    .select("id, summary, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    ...toSummary(e),
    descriptionHtml: e.description_html,
    descriptionText: e.description_text,
    locationDetails: e.location_details,
    onlineUrl: e.online_url,
    eligibilityNote: e.eligibility_note,
    cancelReason: e.cancel_reason,
    spaceId: e.space_id,
    space: e.spaces ? { slug: e.spaces.slug, name: e.spaces.name } : null,
    updatedAt: e.updated_at,
    publishedAt: e.published_at,
    organizer: e.profiles
      ? {
          name: e.profiles.full_name,
          username: e.profiles.username,
          avatarUrl: e.profiles.avatar_url,
          role: e.profiles.role,
        }
      : null,
    changes: (changes ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      createdAt: c.created_at,
    })),
  };
}

export async function getMyRegistration(
  eventId: string,
  userId: string,
): Promise<(MyRegistration & { registeredAt: string }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_registrations")
    .select("status, waitlist_position, registered_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status === "cancelled") return null;
  return {
    status: data.status,
    waitlistPosition: data.waitlist_position,
    registeredAt: data.registered_at,
  };
}

export interface Attendee {
  userId: string;
  fullName: string;
  username: string;
  departmentName: string | null;
  yearOfStudy: number | null;
  status: RegistrationStatus;
  waitlistPosition: number | null;
  registeredAt: string;
  cancelledAt: string | null;
}

/** Organizer/admin only (the RPC checks). Returns null when not allowed. */
export async function listAttendees(eventId: string): Promise<Attendee[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("event_attendees", { p_event_id: eventId });
  if (error) {
    if (error.code !== "42501") console.error("listAttendees", error);
    return null;
  }
  return data.map((a) => ({
    userId: a.user_id,
    fullName: a.full_name,
    username: a.username,
    departmentName: a.department_name,
    yearOfStudy: a.year_of_study,
    status: a.status,
    waitlistPosition: a.waitlist_position,
    registeredAt: a.registered_at,
    cancelledAt: a.cancelled_at,
  }));
}

/**
 * Where the signed-in member may place an event and whether it needs approval there
 * (Phase C, `my_event_placements`). An empty id means campus-wide (super admins only).
 */
export async function listEventPlacements(): Promise<
  { id: string; name: string; needsReview: boolean }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_event_placements");
  if (error) {
    console.error("listEventPlacements", error);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.space_id ?? "",
    name: p.type === "department" ? `${p.name} (whole department)` : p.name,
    needsReview: p.needs_review,
  }));
}

/** Can the signed-in member approve events placed here? (null = campus-wide) */
export async function canReviewEventSpace(spaceId: string | null): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_review_event_space", {
    // null means campus-wide; the generated type doesn't know the parameter accepts it.
    p_space_id: spaceId as string,
  });
  return Boolean(data);
}

/** Events waiting for the signed-in member's approval (RLS shows reviewers only theirs). */
export async function listEventsToReview(userId: string): Promise<EventSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .eq("status", "pending_review")
    .neq("organizer_id", userId)
    .order("starts_at");
  if (error) {
    console.error("listEventsToReview", error);
    return [];
  }
  return (data as unknown as SummaryRow[]).map(toSummary);
}
