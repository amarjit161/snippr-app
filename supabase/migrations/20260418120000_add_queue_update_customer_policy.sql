do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'queue'
      and policyname = 'queue_update_customer'
  ) then
    create policy queue_update_customer
      on public.queue
      for update
      to authenticated
      using (
        user_id = auth.uid()
        and coalesce(status, '') in ('waiting', 'cancelled')
      )
      with check (
        user_id = auth.uid()
        and coalesce(status, '') in ('waiting', 'cancelled')
      );
  end if;
end
$$;
