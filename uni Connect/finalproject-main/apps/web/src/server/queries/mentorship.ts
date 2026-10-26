import "server-only";

import type { MentorshipStatus } from "@/lib/mentorship";
import { createClient } from "@/lib/supabase/server";

export interface MentorCardData {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  departmentName: string | null;
  yearOfStudy: number | null;
  headline: string;
  about: string;
  subjects: string[];
  skills: string[];
  availabilityNote: string | null;
  maxActiveMentees: number;
  activeMenteeCount: number;
  isAccepting: boolean;
  myRequestStatus: MentorshipStatus | null;
  /** Why the viewer can't send a request (null = they can). */
  blockReason: string | null;
}

export async function listMentors(filters: {
  q?: string;
  subject?: string;
  departmentId?: string;
  year?: number;
  accepting?: boolean;
}): Promise<MentorCardData[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_mentors", {
    p_query: filters.q || undefined,
    p_subject: filters.subject || undefined,
    p_department: filters.departmentId || undefined,
    p_year: filters.year,
    p_accepting: filters.accepting ?? false,
  });
  if (error) {
    console.error("listMentors", error);
    return [];
  }
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    name: m.full_name ?? "Member",
    username: m.username ?? "",
    avatarUrl: m.avatar_url,
    departmentName: m.department_name,
    yearOfStudy: m.year_of_study,
    headline: m.headline,
    about: m.about,
    subjects: m.subjects ?? [],
    skills: m.skills ?? [],
    availabilityNote: m.availability_note,
    maxActiveMentees: m.max_active_mentees,
    activeMenteeCount: m.active_mentee_count,
    isAccepting: m.is_accepting,
    myRequestStatus: m.my_request_status,
    blockReason: m.request_block_reason,
  }));
}

/** One mentor's card (profile pages), or null when they aren't mentoring. */
export async function getMentorCard(
  userId: string,
  viewerId: string,
): Promise<MentorCardData | null> {
  const supabase = await createClient();
  const [{ data: mp }, { data: card }, { data: reason }, { data: mine }] = await Promise.all([
    supabase
      .from("mentor_profiles")
      .select(
        "headline, about, subjects, skills, availability_note, max_active_mentees, active_mentee_count, is_accepting",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profile_cards")
      .select("full_name, username, avatar_url, department_name, year_of_study")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("mentor_request_block_reason", { p_mentor_id: userId }),
    supabase
      .from("mentorship_requests")
      .select("status")
      .eq("mentee_id", viewerId)
      .eq("mentor_id", userId)
      .in("status", ["pending", "accepted"])
      .maybeSingle(),
  ]);
  if (!mp || !card) return null;
  return {
    userId,
    name: card.full_name ?? "Member",
    username: card.username ?? "",
    avatarUrl: card.avatar_url,
    departmentName: card.department_name,
    yearOfStudy: card.year_of_study,
    headline: mp.headline,
    about: mp.about,
    subjects: mp.subjects,
    skills: mp.skills,
    availabilityNote: mp.availability_note,
    maxActiveMentees: mp.max_active_mentees,
    activeMenteeCount: mp.active_mentee_count,
    isAccepting: mp.is_accepting,
    myRequestStatus: mine?.status ?? null,
    blockReason: reason ?? null,
  };
}

export async function mentorSubjects(): Promise<{ subject: string; mentors: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mentor_subjects", { p_limit: 16 });
  return data ?? [];
}

export interface MyMentorProfile {
  headline: string;
  about: string;
  subjects: string[];
  skills: string[];
  availabilityNote: string;
  maxActiveMentees: number;
  isAccepting: boolean;
  activeMenteeCount: number;
}

export async function getMyMentorProfile(userId: string): Promise<MyMentorProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mentor_profiles")
    .select(
      "headline, about, subjects, skills, availability_note, max_active_mentees, is_accepting, active_mentee_count",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    headline: data.headline,
    about: data.about,
    subjects: data.subjects,
    skills: data.skills,
    availabilityNote: data.availability_note ?? "",
    maxActiveMentees: data.max_active_mentees,
    isAccepting: data.is_accepting,
    activeMenteeCount: data.active_mentee_count,
  };
}

export interface MentorshipRequestItem {
  id: string;
  topic: string;
  message: string;
  status: MentorshipStatus;
  responseNote: string | null;
  conversationId: string | null;
  createdAt: string;
  respondedAt: string | null;
  endedAt: string | null;
  /** The viewer is the mentor on this request. */
  iAmMentor: boolean;
  other: { id: string; name: string; username: string | null; avatarUrl: string | null };
}

const REQUEST_COLUMNS =
  "id, topic, message, status, response_note, conversation_id, created_at, responded_at, ended_at, mentee_id, mentor_id, mentee:profiles!mentorship_requests_mentee_id_fkey(full_name, username, avatar_url), mentor:profiles!mentorship_requests_mentor_id_fkey(full_name, username, avatar_url)";

type Person = { full_name: string; username: string | null; avatar_url: string | null } | null;

/** Every request the viewer is part of, newest first (RLS limits it to their own). */
export async function listMyMentorships(userId: string): Promise<MentorshipRequestItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mentorship_requests")
    .select(REQUEST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("listMyMentorships", error);
    return [];
  }
  return (data ?? []).map((r) => {
    const iAmMentor = r.mentor_id === userId;
    const person = (iAmMentor ? r.mentee : r.mentor) as Person;
    return {
      id: r.id,
      topic: r.topic,
      message: r.message,
      status: r.status,
      responseNote: r.response_note,
      conversationId: r.conversation_id,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
      endedAt: r.ended_at,
      iAmMentor,
      other: {
        id: iAmMentor ? r.mentee_id : r.mentor_id,
        name: person?.full_name ?? "Former member",
        username: person?.username ?? null,
        avatarUrl: person?.avatar_url ?? null,
      },
    };
  });
}

/** Pending requests waiting for the viewer's answer (badge on /mentorship). */
export async function incomingRequestCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("mentorship_requests")
    .select("id", { count: "exact", head: true })
    .eq("mentor_id", userId)
    .eq("status", "pending");
  return count ?? 0;
}
