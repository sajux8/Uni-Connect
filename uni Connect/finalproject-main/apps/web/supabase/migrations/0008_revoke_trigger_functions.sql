-- 0008: trigger functions are not API endpoints
-- Postgres won't run a trigger function outside a trigger, but they still appeared as
-- callable RPCs. Revoking EXECUTE doesn't stop the triggers (that permission is only
-- checked when a trigger is created).

revoke execute on function
  public.set_updated_at(),
  public.prevent_moderation_log_changes(),
  public.check_reply_parent(),
  public.prevent_self_reply_vote(),
  public.prevent_self_post_vote(),
  public.update_member_count(),
  public.update_post_reply_stats(),
  public.update_reply_helpful_count(),
  public.update_post_vote_score(),
  public.update_tag_usage(),
  public.follow_own_post()
from public, anon, authenticated;
