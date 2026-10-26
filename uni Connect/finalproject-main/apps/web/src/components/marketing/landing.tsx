"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Check,
  Clock,
  Compass,
  Cpu,
  Heart,
  Infinity as InfinityIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquareMore,
  Send,
  Share2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import heroImage from "@/assets/hero.jpg";

import "./landing.css";

type Delay = { "--d"?: string };
type AvatarStyle = { "--av"?: string; color?: string };
const d = (s: string) => ({ "--d": s }) as React.CSSProperties & Delay;
const av = (bg: string, color?: string) =>
  ({ "--av": bg, color }) as React.CSSProperties & AvatarStyle;

/** The concept's 4-point sparkle. */
function SparkIcon() {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" />
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Small interactive pieces                                         */
/* ---------------------------------------------------------------- */

function LikeButton({
  count,
  className,
  label,
  suffix,
}: {
  count: number;
  className: string;
  label?: string;
  suffix?: string;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <button
      type="button"
      className={cn(className, liked && "liked")}
      aria-label={label ?? "Like"}
      aria-pressed={liked}
      onClick={() => setLiked((v) => !v)}
    >
      <Heart className="i" fill={liked ? "currentColor" : "none"} />
      <span>
        {count + (liked ? 1 : 0)}
        {suffix && ` ${suffix}`}
      </span>
    </button>
  );
}

async function sharePost() {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/#feed`);
  } catch {
    /* clipboard unavailable */
  }
  toast.success("Post link copied to clipboard");
}

function ShareButton({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <button type="button" className="action-btn" onClick={sharePost} aria-label="Share">
      <Share2 className="i" />
      {withLabel && "Share"}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Hero                                                             */
/* ---------------------------------------------------------------- */

function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const [online, setOnline] = useState(128);
  const [tick, setTick] = useState(0);

  // Live-ish "students online" counter, as in the concept (decorative).
  useEffect(() => {
    const id = setInterval(() => {
      setOnline((n) =>
        Math.min(
          136,
          Math.max(121, n + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.round(Math.random()))),
        ),
      );
      setTick((t) => t + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Gentle pointer parallax on the floating cards (desktop only).
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !matchMedia("(hover:hover) and (min-width:900px)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...hero.querySelectorAll<HTMLElement>("[data-parallax]")];
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      for (const el of items) {
        const f = Number(el.dataset.parallax);
        el.style.transform = `translate(${x * f}px, ${y * f}px)`;
      }
    };
    hero.addEventListener("pointermove", onMove);
    return () => hero.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-grid container">
        <div>
          <span className="hero-badge rise" style={d(".05s")}>
            <SparkIcon />
            Built for Students
          </span>
          <h1 className="rise" style={d(".15s")}>
            Your campus.
            <br />
            Your{" "}
            <span className="hl">
              voice
              <svg viewBox="0 0 200 18" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 12 Q 56 3 108 9 Q 156 14 196 5" />
              </svg>
            </span>
            .
            <br />
            Your community.
          </h1>
          <p className="hero-sub rise" style={d(".25s")}>
            A friendly digital space for students to share thoughts, discover campus updates, join
            conversations, help each other and stay connected beyond the classroom.
          </p>
          <div className="hero-cta rise" style={d(".35s")}>
            <Link href="#community" className={buttonVariants({ size: "lg" })}>
              Explore Community <ArrowRight className="i" />
            </Link>
            <Link href="#feed" className={buttonVariants({ size: "lg", variant: "outline" })}>
              See Student Feed
            </Link>
          </div>
          <div className="rise" style={d(".45s")}>
            <div className="av-stack" aria-hidden="true">
              <span className="avatar" style={av("#0D2F6F")}>
                SK
              </span>
              <span className="avatar" style={av("#1D5FD1")}>
                RM
              </span>
              <span className="avatar" style={av("#4C8F6B")}>
                TP
              </span>
              <span className="avatar" style={av("#E9A93D", "#5C4308")}>
                AN
              </span>
            </div>
            <p className="hero-note">
              Connect with students across <b>every program</b>
            </p>
          </div>
        </div>

        <div className="hero-art rise" style={d(".3s")}>
          <div className="hero-img">
            <Image
              src={heroImage}
              alt="Five students together — one on a laptop, one with a tablet, others with phones and a book"
              priority
              sizes="(max-width: 960px) 100vw, 560px"
            />
          </div>

          <div className="float-wrap fw1" data-parallax="14">
            <article className="float-card">
              <header>
                <span className="avatar" style={av("#D6664A")}>
                  NS
                </span>
                <div>
                  <strong>Nimal S.</strong>
                  <small>Computing · 2 min ago</small>
                </div>
              </header>
              <p>“Anyone joining the coding session after lectures today?”</p>
              <div className="float-foot">
                <LikeButton count={24} className="mini-like" />
                <span className="mini-reply">
                  <MessageCircle className="i" />8 replies
                </span>
              </div>
            </article>
          </div>

          <div className="float-wrap fw2" data-parallax="-11">
            <article className="float-card">
              <header>
                <span className="avatar" style={av("#1D5FD1")}>
                  AM
                </span>
                <div>
                  <strong>Ayesha M.</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span className="chip-update">Campus Update</span>
                    <small>· 1 hr</small>
                  </div>
                </div>
              </header>
              <p>“New workshop announced for this Friday 🎓”</p>
              <div className="float-foot">
                <LikeButton count={56} className="mini-like" />
                <span className="mini-reply">
                  <MessageCircle className="i" />
                  12
                </span>
              </div>
            </article>
          </div>

          <div className="float-wrap fw3" data-parallax="9">
            <div className="online-pill">
              <span className="online-dot" />
              <span>
                <b key={tick} className={tick ? "tick" : undefined}>
                  {online}
                </b>{" "}
                students online
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Features                                                         */
/* ---------------------------------------------------------------- */

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: MessageSquareMore,
    title: "Share Your Thoughts",
    body: "Post ideas, questions, experiences and useful information with your student community.",
  },
  {
    icon: Send,
    title: "Live Student Chat",
    body: "Start conversations, ask for help and stay connected with classmates in real time.",
  },
  {
    icon: Megaphone,
    title: "Campus Updates",
    body: "Find student announcements, upcoming events, workshops and important campus information.",
  },
  {
    icon: Users,
    title: "Student Communities",
    body: "Join spaces for your degree, hobbies, tech interests, clubs, projects and study groups.",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Student-Focused",
    body: "A cleaner campus-focused space designed around authentic student conversations.",
  },
  {
    icon: Compass,
    title: "Discover & Contribute",
    body: "Explore useful posts, contribute resources and help other students succeed on campus.",
  },
];

function Features() {
  return (
    <section id="about">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Everything in one place</span>
          <h2>Designed around student life</h2>
          <p>
            More than a notice board — UniConnect gives students a modern place to communicate,
            collaborate and feel part of campus life.
          </p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="feature-card reveal" style={d(`${(i % 3) * 0.08}s`)}>
              <div className="f-icon">
                <f.icon className="i" />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Feed                                                             */
/* ---------------------------------------------------------------- */

function ShowcaseArt() {
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label="Project showcase scene">
      <rect width="640" height="400" fill="#DDEBFD" />
      <path d="M0 24 Q320 64 640 24" stroke="#B9D2F0" strokeWidth="2.5" fill="none" />
      <path d="M59 32 l22 0 -11 19 z" fill="#2D73E8" />
      <path d="M129 40 l22 0 -11 19 z" fill="#F2C14E" />
      <path d="M199 45 l22 0 -11 19 z" fill="#55D6FF" />
      <path d="M269 47 l22 0 -11 19 z" fill="#EF8A73" />
      <path d="M349 47 l22 0 -11 19 z" fill="#2D73E8" />
      <path d="M419 45 l22 0 -11 19 z" fill="#F2C14E" />
      <path d="M489 40 l22 0 -11 19 z" fill="#55D6FF" />
      <path d="M559 32 l22 0 -11 19 z" fill="#EF8A73" />
      <circle cx="60" cy="120" r="4" fill="#2D73E8" opacity=".5" />
      <circle cx="590" cy="100" r="5" fill="#F2C14E" opacity=".7" />
      <path
        d="M584 200 h16 M592 192 v16"
        stroke="#2D73E8"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".4"
      />
      <rect x="118" y="74" width="404" height="224" rx="14" fill="#0D2F6F" />
      <rect x="134" y="90" width="372" height="192" rx="8" fill="#F6FAFF" />
      <rect x="134" y="90" width="372" height="26" rx="8" fill="#2D73E8" />
      <rect x="134" y="104" width="372" height="12" fill="#2D73E8" />
      <circle cx="150" cy="103" r="3" fill="#fff" opacity=".9" />
      <circle cx="161" cy="103" r="3" fill="#fff" opacity=".6" />
      <circle cx="172" cy="103" r="3" fill="#fff" opacity=".4" />
      <rect x="390" y="99" width="82" height="7" rx="3.5" fill="#fff" opacity=".85" />
      <rect x="160" y="196" width="26" height="56" rx="4" fill="#BFD9F7" />
      <rect x="196" y="176" width="26" height="76" rx="4" fill="#2D73E8" />
      <rect x="232" y="210" width="26" height="42" rx="4" fill="#BFD9F7" />
      <rect x="268" y="160" width="26" height="92" rx="4" fill="#2D73E8" />
      <rect x="304" y="186" width="26" height="66" rx="4" fill="#55D6FF" />
      <path d="M160 252 h170" stroke="#D7E4F5" strokeWidth="2" />
      <path
        d="M360 240 L395 214 L430 222 L465 182 L500 190 L500 252 L360 252 Z"
        fill="rgba(29,95,209,.12)"
      />
      <polyline
        points="360,240 395,214 430,222 465,182 500,190"
        fill="none"
        stroke="#1D5FD1"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="360" cy="240" r="3.5" fill="#1D5FD1" />
      <circle cx="395" cy="214" r="3.5" fill="#1D5FD1" />
      <circle cx="430" cy="222" r="3.5" fill="#1D5FD1" />
      <circle cx="465" cy="182" r="3.5" fill="#1D5FD1" />
      <circle cx="500" cy="190" r="3.5" fill="#1D5FD1" />
      <rect x="360" y="272" width="60" height="6" rx="3" fill="#C7DCF6" />
      <path
        d="M300 298 L290 342 M340 298 L350 342"
        stroke="#0D2F6F"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g fill="#0D2F6F">
        <circle cx="80" cy="346" r="15" />
        <path d="M52 400 q0-28 28-28 q28 0 28 28 z" opacity=".95" />
        <circle cx="170" cy="342" r="16" />
        <path d="M140 400 q0-30 30-30 q30 0 30 30 z" opacity=".8" />
        <circle cx="255" cy="347" r="14" />
        <path d="M229 400 q0-26 26-26 q26 0 26 26 z" opacity=".95" />
        <circle cx="340" cy="343" r="16" />
        <path d="M310 400 q0-30 30-30 q30 0 30 30 z" opacity=".8" />
        <circle cx="425" cy="347" r="14" />
        <path d="M399 400 q0-26 26-26 q26 0 26 26 z" opacity=".95" />
        <circle cx="510" cy="342" r="16" />
        <path d="M480 400 q0-30 30-30 q30 0 30 30 z" opacity=".8" />
        <circle cx="588" cy="347" r="14" />
        <path d="M562 400 q0-26 26-26 q26 0 26 26 z" opacity=".95" />
      </g>
      <path
        d="M186 322 q-4 -16 8 -24"
        stroke="#0D2F6F"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity=".8"
      />
      <circle cx="196" cy="296" r="6" fill="#0D2F6F" opacity=".8" />
      <circle cx="118" cy="180" r="4" fill="#EF8A73" />
      <circle cx="536" cy="150" r="4" fill="#2D73E8" opacity=".6" />
    </svg>
  );
}

interface Comment {
  initials: string;
  name: string;
  when: string;
  text: string;
  bg: string;
  color?: string;
}

function Feed() {
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>([
    {
      initials: "RP",
      name: "Rashmi P.",
      when: "4 min",
      text: "Congrats team! The AR demo was unreal 🔥",
      bg: "#2D73E8",
    },
    {
      initials: "MT",
      name: "Malith T.",
      when: "2 min",
      text: "Would love the slides from session two.",
      bg: "#4C8F6B",
    },
  ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [
      ...c,
      { initials: "You", name: "You", when: "just now", text, bg: "#E9A93D", color: "#5C4308" },
    ]);
    setDraft("");
  }

  return (
    <section className="feed" id="feed">
      <div className="feed-grid container">
        <article className="post-card reveal">
          <header className="post-head">
            <span className="avatar av-lg" style={av("#0D2F6F")}>
              KD
            </span>
            <div>
              <strong>Kavindu D.</strong>
              <small>Software Engineering · 10 min ago</small>
            </div>
            <button
              type="button"
              className={cn("follow-btn", following && "on")}
              aria-pressed={following}
              onClick={() => setFollowing((v) => !v)}
            >
              {following ? "Following" : "Follow"}
            </button>
          </header>
          <h3>Great session at the project showcase today! 🚀</h3>
          <p>
            Loved seeing what everyone has been building this semester. Sharing a few highlights
            from campus.
          </p>
          <figure className="post-media">
            <ShowcaseArt />
            <figcaption className="media-chip">Project Showcase · Colombo Campus</figcaption>
          </figure>
          <footer className="post-actions">
            <LikeButton count={126} className="action-btn" label="Like post" suffix="likes" />
            <button
              type="button"
              className="action-btn"
              aria-expanded={showComments}
              onClick={() => setShowComments((v) => !v)}
            >
              <MessageCircle className="i" />
              <span>{16 + comments.length} comments</span>
            </button>
            <ShareButton withLabel />
          </footer>
          {showComments && (
            <div className="comments">
              {comments.map((c, i) => (
                <div className="comment" key={`${c.name}-${i}`}>
                  <span className="avatar av-sm" style={av(c.bg, c.color)}>
                    {c.initials}
                  </span>
                  <div>
                    <strong>
                      {c.name} <small>· {c.when}</small>
                    </strong>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              <form className="comment-form" onSubmit={submit}>
                <span className="avatar av-sm" style={av("#E9A93D", "#5C4308")}>
                  You
                </span>
                <input
                  type="text"
                  placeholder="Write a comment…"
                  aria-label="Write a comment"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  required
                />
                <button className="send" type="submit" aria-label="Post comment">
                  <Send className="i" />
                </button>
              </form>
            </div>
          )}
        </article>

        <div className="feed-copy reveal" style={d(".1s")}>
          <div className="section-head left">
            <span className="eyebrow">A feed that feels useful</span>
            <h2>See what’s happening across your campus.</h2>
            <p>
              Discover real conversations from fellow students instead of hunting through different
              groups and chats for useful information.
            </p>
          </div>
          <ul className="checklist">
            {[
              "Ask academic and project questions",
              "Discover campus activities and workshops",
              "Share achievements, resources and opportunities",
              "Connect across programs and semesters",
            ].map((item) => (
              <li key={item}>
                <span className="ck">
                  <Check className="i" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link className="feed-cta" href="#discover">
            Browse recent posts <ArrowRight className="i" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <div className="stats-wrap">
      <div className="container">
        <div className="stats-band reveal">
          {[
            ["01", "Student Space"],
            ["24/7", "Community Access"],
            ["100%", "Campus Focused"],
            [
              <InfinityIcon
                key="inf"
                className="stat-inf"
                strokeWidth={3}
                aria-label="Unlimited"
              />,
              "Ideas to Share",
            ],
          ].map(([value, label]) => (
            <div className="stat" key={label as string}>
              <b>{value}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Communities                                                      */
/* ---------------------------------------------------------------- */

const COMMUNITIES = [
  {
    name: "Computing & Tech",
    body: "Projects, code and tech discussions",
    emoji: "💻",
    bg: "#EAF3FF",
  },
  { name: "Study Hub", body: "Resources, advice and group study", emoji: "📚", bg: "#FDF3D8" },
  {
    name: "Careers & Internships",
    body: "Opportunities and career support",
    emoji: "🚀",
    bg: "#E4F3E7",
  },
  { name: "Creative Corner", body: "Design, photography and content", emoji: "🎨", bg: "#EFE9FB" },
  {
    name: "Gaming & Esports",
    body: "Find teammates and campus gamers",
    emoji: "🎮",
    bg: "#FDEAE2",
  },
  {
    name: "Clubs & Events",
    body: "Student activities and campus events",
    emoji: "🏆",
    bg: "#E8F7FC",
  },
];

function Communities() {
  const [joined, setJoined] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        toast(`Left ${name}`);
      } else {
        next.add(name);
        toast.success(`You joined ${name}`);
      }
      return next;
    });
  }

  return (
    <section className="communities" id="community">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Find your people</span>
          <h2>Communities for every interest</h2>
          <p>Jump into the spaces that matter to you and meet students with similar interests.</p>
        </div>
        <div className="com-grid">
          {COMMUNITIES.map((c, i) => {
            const on = joined.has(c.name);
            return (
              <button
                key={c.name}
                type="button"
                className={cn("com-card reveal", on && "joined")}
                style={d(`${(i % 3) * 0.07}s`)}
                aria-pressed={on}
                onClick={() => toggle(c.name)}
              >
                <span className="com-emoji" style={{ "--eb": c.bg } as React.CSSProperties}>
                  {c.emoji}
                </span>
                <span className="com-body">
                  <strong>{c.name}</strong>
                  <small>{c.body}</small>
                </span>
                <span className="com-arrow">
                  {on ? <Check className="i" strokeWidth={3} /> : <ArrowRight className="i" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Latest posts                                                     */
/* ---------------------------------------------------------------- */

const TALK = [
  {
    initials: "SP",
    bg: "#1D5FD1",
    name: "Sanduni P.",
    meta: "Software Engineering · 22 min ago",
    text: "“Looking for teammates for our Software Engineering final project. Frontend or backend — two more and we’re set!”",
    cat: "Projects",
    amber: false,
    tags: ["#final-year", "#group-project"],
    likes: 34,
    replies: 9,
  },
  {
    initials: "TR",
    bg: "#4C8F6B",
    name: "Tharindu R.",
    meta: "Computing · 1 hr ago",
    text: "“Anyone attending the AI workshop this Saturday? Trying to figure out if I should register before the slots fill up.”",
    cat: "Events",
    amber: false,
    tags: ["#ai-workshop", "#campus"],
    likes: 51,
    replies: 17,
  },
  {
    initials: "HW",
    bg: "#D6664A",
    name: "Hasini W.",
    meta: "Business Management · 3 hr ago",
    text: "“Sharing my internship interview preparation notes. Everything I learned from last month’s applications — hope it helps!”",
    cat: "Careers",
    amber: true,
    tags: ["#internships", "#resources"],
    likes: 112,
    replies: 26,
  },
];

function Discover() {
  return (
    <section id="discover">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">From the student feed</span>
          <h2>What students are talking about</h2>
          <p>Fresh conversations from across campus, updated by students every day.</p>
        </div>
        <div className="talk-grid">
          {TALK.map((t, i) => (
            <article key={t.name} className="talk-card reveal" style={d(`${i * 0.08}s`)}>
              <header>
                <span className="avatar" style={av(t.bg)}>
                  {t.initials}
                </span>
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.meta}</small>
                </div>
              </header>
              <p>{t.text}</p>
              <div className="tag-row">
                <span className={cn("tag cat", t.amber && "amber")}>{t.cat}</span>
                {t.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <footer className="talk-foot">
                <LikeButton count={t.likes} className="action-btn" />
                <button type="button" className="action-btn" aria-label="Replies">
                  <MessageCircle className="i" />
                  <span>{t.replies}</span>
                </button>
                <ShareButton />
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Events                                                           */
/* ---------------------------------------------------------------- */

const EVENTS: {
  day: string;
  date: string;
  title: string;
  when: string;
  where: string;
  tag: string;
  dateClass: string;
  iconClass: string;
  icon: LucideIcon;
}[] = [
  {
    day: "FRI",
    date: "21",
    title: "AI & Machine Learning Workshop",
    when: "Friday · 2:00 PM",
    where: "Main Auditorium",
    tag: "Workshop",
    dateClass: "ed-navy",
    iconClass: "ei-blue",
    icon: Cpu,
  },
  {
    day: "SAT",
    date: "22",
    title: "Student Tech Meetup",
    when: "Saturday · 10:00 AM",
    where: "Main Campus",
    tag: "Meetup",
    dateClass: "ed-blue",
    iconClass: "ei-cyan",
    icon: Users,
  },
  {
    day: "MON",
    date: "24",
    title: "Career & Internship Session",
    when: "Monday · 3:30 PM",
    where: "Career Centre",
    tag: "Careers",
    dateClass: "ed-cyan",
    iconClass: "ei-amber",
    icon: Briefcase,
  },
];

function Events() {
  const [reminders, setReminders] = useState<Set<string>>(new Set());

  function toggle(title: string) {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
        toast("Reminder removed");
      } else {
        next.add(title);
        toast.success(`Reminder set — ${title}`);
      }
      return next;
    });
  }

  return (
    <section className="events" id="events">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Campus calendar</span>
          <h2>Upcoming on campus</h2>
          <p>Workshops, meetups and sessions you won’t want to miss this week.</p>
        </div>
        <div className="event-grid">
          {EVENTS.map((e, i) => {
            const on = reminders.has(e.title);
            return (
              <article key={e.title} className="event-card reveal" style={d(`${i * 0.08}s`)}>
                <div className="e-top">
                  <div className={cn("e-date", e.dateClass)}>
                    <small>{e.day}</small>
                    <b>{e.date}</b>
                  </div>
                  <div className="e-info">
                    <h3>{e.title}</h3>
                    <p className="e-meta">
                      <Clock className="i" />
                      {e.when}
                    </p>
                    <p className="e-meta">
                      <MapPin className="i" />
                      {e.where}
                    </p>
                  </div>
                  <span className={cn("e-icon", e.iconClass)}>
                    <e.icon className="i" />
                  </span>
                </div>
                <div className="e-foot">
                  <span className="e-tag">{e.tag}</span>
                  <button
                    type="button"
                    className={cn("remind", on && "on")}
                    aria-pressed={on}
                    onClick={() => toggle(e.title)}
                  >
                    <Bell className="i" />
                    {on ? "Reminder on" : "Remind me"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="cta-panel reveal">
          <span className="cta-ring" />
          <span className="cta-dot" />
          <span className="cta-plus">+</span>
          <svg className="cta-bubble" width="60" height="52" viewBox="0 0 60 52" aria-hidden="true">
            <path
              d="M10 2 h40 a10 10 0 0 1 10 10 v18 a10 10 0 0 1-10 10 H24 l-14 12 v-12 h0 a10 10 0 0 1-10-10 V12 a10 10 0 0 1 10-10 z"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
            />
          </svg>
          <h2>One campus. Thousands of ideas. Start connecting.</h2>
          <p>Join the student community and make campus life more connected.</p>
          <Link href="/register" className={buttonVariants({ variant: "white", size: "lg" })}>
            Create Your Account <ArrowRight className="i" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll, staggered by each element's --d delay.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".reveal");
    if (!els) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp" ref={rootRef} id="top">
      <Hero />
      <Features />
      <Feed />
      <Stats />
      <Communities />
      <Discover />
      <Events />
      <Cta />
    </div>
  );
}
