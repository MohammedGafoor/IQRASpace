-- Expanded Phase 1 scope: a real notifications table backing the topbar
-- bell + Notifications screen. Not a table in the original architecture ER
-- diagram (§12) — added because the demo's Notifications screen needs to be
-- genuinely functional, not a hardcoded array.
--
-- Rows are inserted by application code at the moment of the triggering
-- action (lesson scheduled, attendance marked, lesson note added), via the
-- notify_user() RPC below — never inserted directly by the client, so a
-- student can't spoof a notification onto another user's feed.

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Narrow SECURITY DEFINER insert path, mirroring add_student_to_class():
-- a caller may notify themself, or (if a tutor) notify a student currently
-- in one of their classes. No other write path exists for this table.
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_related_lesson_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.is_tutor_of_student(p_user_id) THEN
    RAISE EXCEPTION 'Not authorized to notify this user';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, related_lesson_id)
  VALUES (p_user_id, p_type, p_title, p_body, p_related_lesson_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
