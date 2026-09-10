-- Restrict the transactional check-in implementation to authenticated callers.
revoke all on function private.checkin_ingresso_v25_3_impl(uuid, uuid) from public, anon, authenticated;
grant execute on function private.checkin_ingresso_v25_3_impl(uuid, uuid) to authenticated;