-- SellMate phone OTP delivery via textbee Free SMS gateway.
-- Works with Pakistan numbers (+92) because the SMS goes out from your own paired Android SIM.
--
-- BEFORE RUNNING: replace PASTE_TEXTBEE_API_KEY_HERE with your textbee API key.
-- Then run this whole file in Supabase SQL Editor.
-- Then enable the hook in: Authentication > Hooks > Add hook > Send SMS > Postgres Function > public.sellmate_send_sms

create extension if not exists pg_net with schema extensions;

create or replace function public.sellmate_send_sms(event jsonb)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_phone text := event->'user'->>'phone';
  v_otp text := event->'sms'->>'otp';
  v_key text := 'PASTE_TEXTBEE_API_KEY_HERE';
begin
  if v_phone is null or v_otp is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Missing phone number or OTP.'
      )
    );
  end if;

  -- Supabase sometimes sends the number without a leading +.
  if left(v_phone, 1) <> '+' then
    v_phone := '+' || v_phone;
  end if;

  -- pg_net is async: the request is sent right after this transaction commits,
  -- so the hook returns within the 2-second Postgres hook budget.
  perform net.http_post(
    url := 'https://api.textbee.dev/api/v1/gateway/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-api-key', v_key
    ),
    body := jsonb_build_object(
      'recipients', jsonb_build_array(v_phone),
      'message', 'SellMate code: ' || v_otp || '. Do not share it.'
    )
  );

  return event;
end;
$$;

-- Only Supabase Auth may call this hook.
grant usage on schema public to supabase_auth_admin;
grant usage on schema extensions to supabase_auth_admin;
grant execute on function public.sellmate_send_sms(jsonb) to supabase_auth_admin;
revoke execute on function public.sellmate_send_sms(jsonb) from authenticated, anon, public;
