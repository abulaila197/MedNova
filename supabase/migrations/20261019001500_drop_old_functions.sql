-- Leftovers the MCP tools could not drop (run by hand in the SQL Editor on 2026-10-19).
-- my_level used the old curve and is not called by the app; the guest Contact/Report
-- forwarders without a device argument are replaced by the device versions (230300).
drop function if exists public.my_level();
drop function if exists public.submit_contact(text, text);
drop function if exists public.submit_report(text, text, jsonb);
