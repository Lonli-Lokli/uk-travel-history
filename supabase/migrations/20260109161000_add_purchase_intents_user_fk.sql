do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_intents_clerk_user_id_fkey'
  ) then
    alter table public.purchase_intents
      add constraint purchase_intents_clerk_user_id_fkey
      foreign key (clerk_user_id)
      references public.users (clerk_user_id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists idx_purchase_intents_stripe_checkout_session_id
  on public.purchase_intents (stripe_checkout_session_id);
