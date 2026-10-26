/**
 * Single source of truth for every page in the product.
 *
 * Placeholder pages, breadcrumbs and the sitemap read from here.
 * Delete a placeholder's registry entry only when the real page ships.
 */

import { roleAtLeast, type UserRole } from "@/lib/campus";

export type Access =
  | "public" // anyone
  | "signed-in" // any status
  | "approved" // approved users
  | "lecturer" // lecturers and above (staff)
  | "coordinator" // coordinators and super admins
  | "super_admin"; // super admins only

export type Milestone = "M0" | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9" | "P2";

export interface RouteInfo {
  title: string;
  description: string;
  access: Access;
  milestone: Milestone;
  /** Feature numbers from the Core Features doc, for traceability. */
  features?: number[];
}

export const ROUTES = {
  // --- public / auth ---------------------------------------------------
  "/login": {
    title: "Welcome back",
    description: "Sign in to your UniConnect account.",
    access: "public",
    milestone: "M1",
    features: [1],
  },
  "/register": {
    title: "Join your campus",
    description: "Create an account. An admin verifies every new member.",
    access: "public",
    milestone: "M1",
    features: [1],
  },
  "/forgot-password": {
    title: "Reset your password",
    description: "We'll email you a link to choose a new password.",
    access: "public",
    milestone: "M1",
    features: [1],
  },
  "/reset-password": {
    title: "Choose a new password",
    description: "Enter a new password for your account.",
    access: "signed-in",
    milestone: "M1",
    features: [1],
  },
  "/pending": {
    title: "Your account is waiting for approval",
    description: "An admin is checking your details. This page updates as soon as you're approved.",
    access: "signed-in",
    milestone: "M1",
    features: [1, 12],
  },
  "/rejected": {
    title: "Your application wasn't approved",
    description: "See the reason and how to contact an administrator.",
    access: "signed-in",
    milestone: "M1",
    features: [1, 12],
  },
  "/suspended": {
    title: "Your account is suspended",
    description: "See the reason and how to contact an administrator.",
    access: "signed-in",
    milestone: "M1",
    features: [12],
  },
  "/privacy": {
    title: "Privacy notice",
    description: "What we collect, why, and who can see it.",
    access: "public",
    milestone: "M0",
  },
  "/terms": {
    title: "Community rules & terms",
    description: "How we keep UniConnect useful and safe for everyone.",
    access: "public",
    milestone: "M0",
  },
  "/onboarding": {
    title: "Set up your profile",
    description: "Tell us a little about you so we can show what matters.",
    access: "approved",
    milestone: "M1",
    features: [1],
  },

  // --- core ------------------------------------------------------------
  "/home": {
    title: "Home",
    description: "Everything new in the spaces you follow.",
    access: "approved",
    milestone: "M2",
    features: [2, 5, 6, 9],
  },
  "/announcements": {
    title: "Announcements",
    description: "Official updates from the university.",
    access: "approved",
    milestone: "M3",
    features: [5],
  },
  "/announcements/[id]": {
    title: "Announcement",
    description: "Official announcement details.",
    access: "approved",
    milestone: "M3",
    features: [5],
  },
  "/announcements/new": {
    title: "New announcement",
    description: "Publish an official update to students.",
    access: "lecturer",
    milestone: "M3",
    features: [5],
  },
  "/announcements/[id]/edit": {
    title: "Edit announcement",
    description: "Update an official announcement.",
    access: "lecturer",
    milestone: "M3",
    features: [5],
  },
  "/events": {
    title: "Events",
    description: "Discover what's on across campus.",
    access: "approved",
    milestone: "M4",
    features: [6, 8],
  },
  "/timetable": {
    title: "Timetable",
    description: "Your week of classes. Mark yourself present while a class is on.",
    access: "approved",
    milestone: "P2",
  },
  "/timetable/sessions/[id]": {
    title: "Class",
    description: "One class: when and where, who was there, and any changes.",
    access: "approved",
    milestone: "P2",
  },
  "/attendance": {
    title: "Attendance",
    description: "Attendance by module, and who has missed several classes in a row.",
    access: "approved",
    milestone: "P2",
  },
  "/forms": {
    title: "Feedback",
    description: "Anonymous feedback forms: the ones waiting for you, or the ones you run.",
    access: "approved",
    milestone: "P2",
  },
  "/forms/new": {
    title: "New feedback form",
    description: "Build an anonymous feedback form for your batches.",
    access: "lecturer",
    milestone: "P2",
  },
  "/forms/[id]": {
    title: "Feedback form",
    description: "Answer a feedback form anonymously, or manage one you run.",
    access: "approved",
    milestone: "P2",
  },
  "/forms/[id]/edit": {
    title: "Edit form",
    description: "Change a feedback form's questions and who it's for.",
    access: "lecturer",
    milestone: "P2",
  },
  "/forms/[id]/results": {
    title: "Form results",
    description: "Anonymous answers to a feedback form, with response rates per batch.",
    access: "approved",
    milestone: "P2",
  },
  "/support": {
    title: "Support",
    description: "Your support requests and complaints, and where they are.",
    access: "approved",
    milestone: "P2",
  },
  "/support/new": {
    title: "Contact support",
    description: "Ask for help, or file a complaint (anonymously if you like).",
    access: "approved",
    milestone: "P2",
  },
  "/support/[id]": {
    title: "Ticket",
    description: "A support request or complaint: replies and status changes.",
    access: "approved",
    milestone: "P2",
  },
  "/careers": {
    title: "Careers",
    description: "Internships, part-time jobs and graduate roles for your department.",
    access: "approved",
    milestone: "P2",
  },
  "/careers/new": {
    title: "Post an opportunity",
    description: "Share an internship, part-time job or graduate role with your students.",
    access: "coordinator",
    milestone: "P2",
  },
  "/careers/[id]": {
    title: "Opportunity",
    description: "An internship, part-time job or graduate role, and how to apply.",
    access: "approved",
    milestone: "P2",
  },
  "/careers/[id]/edit": {
    title: "Edit opportunity",
    description: "Change an opportunity's details or who it's for.",
    access: "coordinator",
    milestone: "P2",
  },
  "/events/[id]": {
    title: "Event",
    description: "Event details, eligibility and registration.",
    access: "approved",
    milestone: "M4",
    features: [6],
  },
  "/events/new": {
    title: "New event",
    description: "Create an event and open registration.",
    access: "lecturer",
    milestone: "M4",
    features: [6],
  },
  "/events/[id]/edit": {
    title: "Edit event",
    description: "Update event details. Registrants are notified of changes.",
    access: "lecturer",
    milestone: "M4",
    features: [6],
  },
  "/events/[id]/attendees": {
    title: "Attendees",
    description: "Who's registered, waitlisted or cancelled.",
    access: "lecturer",
    milestone: "M4",
    features: [6],
  },
  "/events/review": {
    title: "Events to review",
    description: "Events waiting for your approval: your club's, batch's or department's.",
    access: "approved",
    milestone: "M4",
    features: [6],
  },
  "/events/mine": {
    title: "My events",
    description: "Your registrations: upcoming, waitlisted and past.",
    access: "approved",
    milestone: "M4",
    features: [6],
  },
  "/spaces": {
    title: "Spaces",
    description: "Find your communities by department, batch, module or club.",
    access: "approved",
    milestone: "M2",
    features: [2],
  },
  "/spaces/[slug]": {
    title: "Space",
    description: "Discussions, questions and resources.",
    access: "approved",
    milestone: "M2",
    features: [2, 3],
  },
  "/spaces/[slug]/settings": {
    title: "Space settings",
    description: "Rules, join policy and moderators.",
    access: "approved",
    milestone: "M2",
    features: [2, 12],
  },
  "/posts/new": {
    title: "New post",
    description: "Start a discussion or ask a question.",
    access: "approved",
    milestone: "M2",
    features: [2, 3, 10],
  },
  "/posts/[id]": {
    title: "Thread",
    description: "A discussion with replies.",
    access: "approved",
    milestone: "M2",
    features: [2, 3, 11],
  },
  "/posts/[id]/edit": {
    title: "Edit post",
    description: "Update your post.",
    access: "approved",
    milestone: "M2",
    features: [2, 3],
  },
  "/questions": {
    title: "Questions",
    description: "Find answers, or help someone who is stuck.",
    access: "approved",
    milestone: "M2",
    features: [3],
  },
  "/mentors": {
    title: "Mentors",
    description: "Get guidance from senior students.",
    access: "approved",
    milestone: "M6",
    features: [4],
  },
  "/mentorship": {
    title: "Mentorship",
    description: "Your incoming, outgoing and active mentorships.",
    access: "approved",
    milestone: "M6",
    features: [4],
  },
  "/messages": {
    title: "Messages",
    description: "Private conversations with your mentors and mentees.",
    access: "approved",
    milestone: "M6",
    features: [4],
  },
  "/messages/[id]": {
    title: "Conversation",
    description: "A private conversation.",
    access: "approved",
    milestone: "M6",
    features: [4],
  },
  "/resources": {
    title: "Resources",
    description: "Study materials, guides and useful links shared by students and staff.",
    access: "approved",
    milestone: "M5",
    features: [7],
  },
  "/resources/[id]": {
    title: "Resource",
    description: "Resource details and download.",
    access: "approved",
    milestone: "M5",
    features: [7],
  },
  "/resources/new": {
    title: "Share a resource",
    description: "Upload a file or add a link. Resources are reviewed before they're published.",
    access: "approved",
    milestone: "M5",
    features: [7],
  },
  "/search": {
    title: "Search",
    description: "Discussions, questions, events, announcements, resources and people.",
    access: "approved",
    milestone: "M5",
    features: [8],
  },
  "/ask": {
    title: "Ask UniConnect AI",
    description: "Get answers from posts and resources you can access, with sources.",
    access: "approved",
    milestone: "M8",
    features: [10],
  },
  "/bookmarks": {
    title: "Bookmarks",
    description: "Posts, events, announcements and resources you saved.",
    access: "approved",
    milestone: "M5",
    features: [8],
  },
  "/notifications": {
    title: "Notifications",
    description: "Replies, announcements, reminders and more.",
    access: "approved",
    milestone: "M3",
    features: [9],
  },
  "/u/[username]": {
    title: "Profile",
    description: "A member's profile.",
    access: "approved",
    milestone: "M1",
    features: [1],
  },

  // --- settings --------------------------------------------------------
  "/settings/profile": {
    title: "Profile",
    description: "Your photo, name, bio, interests and expertise.",
    access: "approved",
    milestone: "M1",
    features: [1],
  },
  "/settings/account": {
    title: "Account",
    description: "Email, password and account deletion.",
    access: "signed-in",
    milestone: "M1",
    features: [1],
  },
  "/settings/notifications": {
    title: "Notifications",
    description: "Choose what you hear about, in the app and by email.",
    access: "approved",
    milestone: "M3",
    features: [9],
  },
  "/settings/privacy": {
    title: "Privacy",
    description: "Control who sees your profile and who can contact you.",
    access: "approved",
    milestone: "M1",
    features: [1],
  },
  "/settings/mentor": {
    title: "Mentor profile",
    description: "Offer guidance to junior students.",
    access: "approved",
    milestone: "M6",
    features: [4],
  },

  // --- admin -----------------------------------------------------------
  "/admin": {
    title: "Admin overview",
    description: "Queues and activity across the platform.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/approvals": {
    title: "Account approvals",
    description: "Verify new members before they can use UniConnect.",
    access: "coordinator",
    milestone: "M1",
    features: [1, 12],
  },
  "/admin/users": {
    title: "Users",
    description: "Manage roles and account status.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/users/[id]": {
    title: "User",
    description: "Profile, role, history and actions.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/reports": {
    title: "Reports",
    description: "Review reported content.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/reports/[id]": {
    title: "Report",
    description: "Review and act on a report.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/moderation-log": {
    title: "Moderation log",
    description: "An append-only record of every moderation action.",
    access: "coordinator",
    milestone: "M7",
    features: [12],
  },
  "/admin/resources": {
    title: "Resource approvals",
    description: "Review uploaded resources before they're published.",
    access: "coordinator",
    milestone: "M5",
    features: [7, 12],
  },
  "/admin/spaces": {
    title: "Manage spaces",
    description: "Create and configure spaces and their moderators.",
    access: "super_admin",
    milestone: "M7",
    features: [12],
  },
  "/admin/batches": {
    title: "Batches",
    description: "Intake batches: their lecturers, class reps and students.",
    access: "coordinator",
    milestone: "M7",
    features: [1, 2, 12],
  },
  "/admin/timetable": {
    title: "Timetables",
    description: "Build each batch's weekly timetable for the term.",
    access: "coordinator",
    milestone: "P2",
  },
  "/admin/inbox": {
    title: "Inbox",
    description: "Support requests and complaints for your department.",
    access: "coordinator",
    milestone: "P2",
  },
  "/admin/departments": {
    title: "Departments",
    description: "The departments students can belong to.",
    access: "super_admin",
    milestone: "M7",
    features: [12],
  },
  "/admin/tags": {
    title: "Tags",
    description: "Manage and merge discussion tags.",
    access: "super_admin",
    milestone: "M7",
    features: [12],
  },
  "/admin/announcements": {
    title: "All announcements",
    description: "Drafts, scheduled and published announcements.",
    access: "lecturer",
    milestone: "M3",
    features: [5, 12],
  },
} as const satisfies Record<string, RouteInfo>;

export type RoutePattern = keyof typeof ROUTES;

export const MILESTONE_NAMES: Record<Milestone, string> = {
  M0: "Foundation",
  M1: "Accounts & approval",
  M2: "Spaces, posts & Q&A",
  M3: "Announcements & notifications",
  M4: "Events",
  M5: "Resources, search & bookmarks",
  M6: "Mentorship & messaging",
  M7: "Moderation & admin",
  M8: "AI features",
  M9: "Polish & launch",
  P2: "Phase 2: campus structure",
};

export const ACCESS_LABELS: Record<Access, string> = {
  public: "Public",
  "signed-in": "Signed-in users",
  approved: "Approved members",
  lecturer: "Staff",
  coordinator: "Coordinators & super admins",
  super_admin: "Super admins only",
};

/** Can someone with this role open a page with this access level? (Account status aside.) */
export function roleAllows(role: UserRole, access: Access): boolean {
  switch (access) {
    case "super_admin":
    case "coordinator":
    case "lecturer":
      return roleAtLeast(role, access);
    default:
      return true;
  }
}
