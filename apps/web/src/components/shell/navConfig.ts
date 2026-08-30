export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/students", label: "Students", icon: "🎓" },
  { href: "/classes", label: "Classes", icon: "📚" },
  { href: "/lessons", label: "Lessons", icon: "📖" },
  { href: "/materials", label: "Lesson Materials", icon: "📄" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/attendance", label: "Attendance", icon: "✅" },
  { href: "/progress", label: "Student Progress", icon: "📈" },
  { href: "/notes", label: "Lesson Notes", icon: "📝" },
  { href: "/meet", label: "Google Meet", icon: "🎥" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

// Shown instead of NAV_ITEMS for role: admin/super_admin (src/lib/roles.ts).
// Admin/super_admin now have full CRUD access across every table (see
// 0018_admin_full_access.sql), so they get the two admin-only screens
// prepended to the SAME full tutor nav below, rather than a separate
// curated list — every one of those routes is now a genuine, working
// platform-wide (all-tutors) view once its page-level `canManage` check
// recognizes admin (src/lib/roles.ts's isAdminRole()).
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Admin Dashboard", icon: "🛡️" },
  { href: "/admin/users", label: "Manage Users", icon: "🗂️" },
  ...NAV_ITEMS,
];

export const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/admin/users": { title: "Manage Users", subtitle: "Every account on the platform — view, manage, and assign roles" },
  "/admin": { title: "Admin Dashboard", subtitle: "Platform-wide oversight and management" },
  "/dashboard": { title: "Dashboard", subtitle: "A calm, connected workspace for online Qur'an teaching" },
  "/students": { title: "Students", subtitle: "Every learner, their class and their progress in one place" },
  "/classes": { title: "Classes", subtitle: "Groups of students taught together" },
  "/lessons": { title: "Lessons", subtitle: "Your library of prepared lessons" },
  "/materials": { title: "Lesson Materials", subtitle: "Files you've uploaded, ready to attach to a lesson" },
  "/schedule": { title: "Schedule", subtitle: "This week's lessons at a glance" },
  "/attendance": { title: "Attendance", subtitle: "Mark it once, see it everywhere" },
  "/progress": { title: "Student Progress", subtitle: "What each student has learned, and where they're headed" },
  "/notes": { title: "Lesson Notes", subtitle: "A short record after every lesson" },
  "/meet": { title: "Google Meet", subtitle: "Every lesson's meeting link, kept with the lesson" },
  "/notifications": { title: "Notifications", subtitle: "Reminders that stay out of your way" },
  "/settings": { title: "Settings", subtitle: "Your account, your defaults, your app" },
  "/teach": { title: "Teaching · Sharing", subtitle: "The heart of the workspace — live during a lesson" },
};

export function pageMetaFor(pathname: string) {
  const key = Object.keys(PAGE_META).find((k) => pathname.startsWith(k));
  return key ? PAGE_META[key] : { title: "IQRASpace", subtitle: "" };
}
