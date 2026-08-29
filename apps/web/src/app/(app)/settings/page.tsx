"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { supabase } from "@/lib/supabaseClient";
import type { TutorProfile } from "@/lib/types";
import { getStoredTheme, setTheme, type ThemeChoice } from "@/lib/theme";
import { Card, Eyebrow, SectionHead } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Never `select("*")` on tutors — see lib/types.ts's TutorProfile comment;
// google_refresh_token_enc must never reach the browser.
const TUTOR_COLUMNS =
  "id, bio, default_lesson_duration_minutes, default_reminder_minutes, email_reminders_enabled, lesson_start_reminders_enabled";

export default function SettingsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const isTutor = profile?.role === "tutor";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getStoredTheme());
    if (!profile || !isTutor) return;
    supabase
      .from("tutors")
      .select(TUTOR_COLUMNS)
      .eq("id", profile.id)
      .single()
      .then(({ data }) => setTutor(data as TutorProfile | null));
  }, [profile, isTutor]);

  async function handleSaveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase.from("users").update({ full_name: fullName }).eq("id", profile.id);
    setSavingProfile(false);
    showToast(error ? error.message : "Profile updated");
  }

  async function handleSaveTutorSettings() {
    if (!profile || !tutor) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("tutors")
      .update({
        default_lesson_duration_minutes: tutor.default_lesson_duration_minutes,
        default_reminder_minutes: tutor.default_reminder_minutes,
        email_reminders_enabled: tutor.email_reminders_enabled,
        lesson_start_reminders_enabled: tutor.lesson_start_reminders_enabled,
      })
      .eq("id", profile.id);
    setSavingSettings(false);
    showToast(error ? error.message : "Settings saved");
  }

  function handleThemeChange(choice: ThemeChoice) {
    setThemeState(choice);
    setTheme(choice);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="text-2xl font-semibold">Your account, your defaults, your app</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHead title="Profile" />
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={profile?.email ?? ""} disabled />
          </Field>
          <Button variant="outline" size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save changes"}
          </Button>
        </Card>

        <Card>
          <SectionHead title="Google Account" />
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span>Google Drive</span>
            <Badge tone={GOOGLE_CLIENT_ID ? "green" : "amber"}>{GOOGLE_CLIENT_ID ? "Connected" : "Not configured"}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Calendar / Meet</span>
            <Badge tone="teal">Manual link — no OAuth needed</Badge>
          </div>
        </Card>

        {isTutor && tutor && (
          <>
            <Card>
              <SectionHead title="Lesson Settings" />
              <Field label="Default lesson duration">
                <Select
                  value={tutor.default_lesson_duration_minutes}
                  onChange={(e) => setTutor({ ...tutor, default_lesson_duration_minutes: Number(e.target.value) })}
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </Select>
              </Field>
              <Field label="Reminder time">
                <Select
                  value={tutor.default_reminder_minutes}
                  onChange={(e) => setTutor({ ...tutor, default_reminder_minutes: Number(e.target.value) })}
                >
                  <option value={5}>5 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                </Select>
              </Field>
            </Card>

            <Card>
              <SectionHead title="Notifications" />
              <label className="mb-2.5 flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={tutor.email_reminders_enabled}
                  onChange={(e) => setTutor({ ...tutor, email_reminders_enabled: e.target.checked })}
                />
                Email reminders
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={tutor.lesson_start_reminders_enabled}
                  onChange={(e) => setTutor({ ...tutor, lesson_start_reminders_enabled: e.target.checked })}
                />
                Lesson start reminders
              </label>
              <Button variant="outline" size="sm" onClick={handleSaveTutorSettings} disabled={savingSettings} className="mt-3.5">
                {savingSettings ? "Saving…" : "Save"}
              </Button>
            </Card>
          </>
        )}

        <Card className="lg:col-span-2">
          <SectionHead title="Appearance" />
          <div className="flex gap-2.5">
            {(
              [
                ["light", "☀️ Light"],
                ["dark", "🌙 Dark"],
                ["system", "🖥️ System"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={theme === value ? "primary" : "outline"}
                onClick={() => handleThemeChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
