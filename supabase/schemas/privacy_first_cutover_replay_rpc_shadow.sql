-- SHADOW ONLY. Apply after privacy_first_shadow.sql; do not apply without explicit migration approval.
-- Restricts the cutover approval replay table to one atomic consume operation.

revoke all on table identity.cutover_approval_replays from service_role;

create or replace function identity.consume_cutover_approval_replay(
  p_digest text,
  p_expires_at timestamptz,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, identity
as $rpc$
declare
  claimed text;
begin
  if p_digest !~ '^[0-9a-f]{64}$'
     or p_expires_at <= p_now
     or p_expires_at > p_now + interval '1 hour' then
    raise exception 'invalid replay claim';
  end if;

  insert into identity.cutover_approval_replays (nonce_digest, expires_at, created_at)
  values (p_digest, p_expires_at, p_now)
  on conflict (nonce_digest) do update
    set expires_at = excluded.expires_at,
        created_at = excluded.created_at
    where identity.cutover_approval_replays.expires_at <= excluded.created_at
  returning nonce_digest into claimed;

  return claimed is not null;
end;
$rpc$;

revoke all on function identity.consume_cutover_approval_replay(text,timestamptz,timestamptz) from public;
revoke all on function identity.consume_cutover_approval_replay(text,timestamptz,timestamptz) from anon;
revoke all on function identity.consume_cutover_approval_replay(text,timestamptz,timestamptz) from authenticated;
grant execute on function identity.consume_cutover_approval_replay(text,timestamptz,timestamptz) to service_role;
