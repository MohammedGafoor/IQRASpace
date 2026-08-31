"use client";

import { useAuth } from "@/lib/authContext";
import { LinkButton } from "@/components/ui/Button";
import { Card, Eyebrow } from "@/components/ui/Card";

const PILLARS = [
  {
    icon: "📖",
    title: "Teach",
    items: ["Organise lessons", "Open lesson material", "Highlight Qur'anic content", "Share exactly what you're teaching"],
  },
  {
    icon: "🎥",
    title: "Connect",
    items: ["Schedule online lessons", "Join Google Meet", "Keep students connected"],
  },
  {
    icon: "📈",
    title: "Track",
    items: ["Attendance", "Lesson history", "Student progress", "Teacher notes"],
  },
  {
    icon: "🗂️",
    title: "Manage",
    items: ["Students", "Classes", "Lesson materials", "Teaching schedule"],
  },
];

const FLOW = ["Tutor", "Lesson", "Qur'an Material", "Share", "Student", "Google Meet", "Attendance", "Progress"];

export default function Home() {
  const { loading } = useAuth();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <div className="pattern-geo rounded-[var(--radius-l)] border border-line bg-surface p-9">
        <Eyebrow>IQRASpace</Eyebrow>
        <h1 className="max-w-xl font-display text-4xl leading-tight">
          A calm digital workspace for Qur&rsquo;an teachers.
        </h1>
        <p className="mt-4 max-w-lg text-ink-soft">
          Organise your students and lessons, share exactly the verse you&rsquo;re explaining the instant
          you&rsquo;re explaining it, and keep every Google Meet, attendance record and progress note in one
          calm place — built around how you already teach.
        </p>
        {!loading && (
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/signup" variant="primary">
              Get started
            </LinkButton>
            <LinkButton href="/login" variant="outline">
              I already have an account
            </LinkButton>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-[var(--radius-m)] border border-line bg-surface p-4">
              <span className="mb-2 block text-xl">{p.icon}</span>
              <h4 className="mb-1.5 text-[0.95rem] font-semibold">{p.title}</h4>
              <ul className="list-disc space-y-1 pl-4 text-[0.83rem] text-ink-soft">
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <Card className="mt-6">
        <Eyebrow>The shape of a lesson</Eyebrow>
        <h3 className="mb-3.5">From &ldquo;good morning&rdquo; to a saved progress note</h3>
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="whitespace-nowrap rounded-full bg-primary-tint px-3.5 py-2 text-[0.82rem] font-bold text-primary-deep">
                {step}
              </span>
              {i < FLOW.length - 1 && <span className="text-accent">→</span>}
            </span>
          ))}
        </div>
      </Card>
    </main>
  );
}
