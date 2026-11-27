-- SellMate: allow a signed-in user to delete their own account and data.
-- Run this once in Supabase SQL Editor (SQL Editor → New query → Run).
-- After this, the "Delete account" button in the app works without any service-role key.

create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.';
  end if;

  delete from public.workspaces where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
