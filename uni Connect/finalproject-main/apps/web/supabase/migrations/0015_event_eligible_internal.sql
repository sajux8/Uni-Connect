-- 0015: event_eligible(event, user) is only used inside register_for_event. Calling it
-- directly would let anyone test another person's department/year, so it's internal now.
revoke execute on function public.event_eligible(uuid, uuid) from authenticated;
