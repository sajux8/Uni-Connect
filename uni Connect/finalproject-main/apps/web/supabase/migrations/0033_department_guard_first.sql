-- 0033: triggers fire in name order. The department guard (0030) should refuse a student's own
-- department change before the batch check (0029) does, so they see "Your department can only be
-- changed by your coordinator" rather than a batch error.

alter trigger profiles_guard_department on public.profiles rename to profiles_a_guard_department;
