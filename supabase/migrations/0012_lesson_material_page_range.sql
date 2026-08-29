-- Qaida – Beginners curriculum (docs/qaida-beginners-curriculum.md): each
-- lesson attaches the same PDF but needs to open at a *specific* page range
-- (e.g. Lesson 7 -> Noorani_Qaida.pdf p.7 only), not always page 1. Adds the
-- missing page-range columns to lesson_materials so the Teach screen can
-- jump straight there.

ALTER TABLE lesson_materials
  ADD COLUMN page_start INT,
  ADD COLUMN page_end INT;
