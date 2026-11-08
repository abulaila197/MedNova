-- My diseases (Yazan 2026-10-26, #37 #21 #26): players write a Diagnostic Pursuit case or add a word for Silent Artist,
-- Medicordle, Streak Master, Imposter or Password. Each waits for Admin review (approve, decline, edit, a note the
-- player sees); an approved item pays its maker 10 tokens once, at most 5 a day.

alter table public.custom_cases add column if not exists note text;

create table if not exists public.player_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('the-silent-artist', 'nova-medicordle', 'the-streak-master', 'imposter', 'nova-password')),
  data jsonb not null,
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'declined')),
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists player_words_user on public.player_words (user_id, created_at desc);
alter table public.player_words enable row level security;
drop policy if exists player_words_own on public.player_words;
create policy player_words_own on public.player_words for select to authenticated using (user_id = auth.uid());
revoke all on public.player_words from anon, authenticated;
grant select on public.player_words to authenticated;

-- The word, cleaned to its game's shape; raises 'missing' when a needed part is empty or wrong.
create or replace function public.word_clean(game text, w jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare t text := left(trim(coalesce(w->>'name', '')), 80); x jsonb; n int;
begin
  case game
  when 'the-silent-artist' then
    if length(t) < 2 or length(trim(coalesce(w->>'field', ''))) < 2 then raise exception 'missing'; end if;
    x := jsonb_build_object('name', t, 'field', left(trim(w->>'field'), 40),
      'aliases', coalesce((select jsonb_agg(left(trim(a), 60)) from (select a from jsonb_array_elements_text(coalesce(w->'aliases', '[]')) a where trim(a) <> '' limit 2) z), '[]'));
  when 'nova-medicordle' then
    t := upper(regexp_replace(coalesce(w->>'word', ''), '[^A-Za-z]', '', 'g'));
    if length(t) not between 6 and 15 or length(trim(coalesce(w->>'definition', ''))) < 5 then raise exception 'missing'; end if;
    x := jsonb_build_object('word', t, 'definition', left(trim(w->>'definition'), 200));
  when 'the-streak-master' then
    n := jsonb_array_length(coalesce(w->'choices', '[]'));
    if length(trim(coalesce(w->>'stem', ''))) < 10 or n not between 4 and 6
       or exists (select 1 from jsonb_array_elements_text(w->'choices') c where trim(c) = '')
       or coalesce((w->>'answer')::int, -1) not between 0 and n - 1 then raise exception 'missing'; end if;
    x := jsonb_build_object('stem', left(trim(w->>'stem'), 400), 'answer', (w->>'answer')::int,
      'choices', (select jsonb_agg(left(trim(c), 120)) from jsonb_array_elements_text(w->'choices') c));
  when 'imposter' then
    if length(trim(coalesce(w->>'a', ''))) < 2 or length(trim(coalesce(w->>'b', ''))) < 2 or length(trim(coalesce(w->>'category', ''))) < 2
       or lower(trim(w->>'a')) = lower(trim(w->>'b')) then raise exception 'missing'; end if;
    x := jsonb_build_object('a', left(trim(w->>'a'), 80), 'b', left(trim(w->>'b'), 80), 'category', left(trim(w->>'category'), 40));
  when 'nova-password' then
    if length(t) < 2 or (select count(*) from jsonb_array_elements_text(coalesce(w->'forbidden', '[]')) f where trim(f) <> '') <> 5 then raise exception 'missing'; end if;
    x := jsonb_build_object('name', t, 'forbidden', (select jsonb_agg(left(lower(trim(f)), 40)) from jsonb_array_elements_text(w->'forbidden') f where trim(f) <> ''));
  else raise exception 'game';
  end case;
  return x;
end $$;

create or replace function public.save_word(game text, w jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.player_words x where x.user_id = uid and x.created_at > now() - interval '1 day') >= 20 then raise exception 'too many'; end if;
  insert into public.player_words (user_id, game, data) values (uid, game, public.word_clean(game, w)) returning id into rid;
  return rid;
end $$;
revoke all on function public.save_word(text, jsonb) from public, anon;
grant execute on function public.save_word(text, jsonb) to authenticated;

-- Everything players sent in, for the Admin page: cases and words together, newest first.
create or replace function public.admin_submissions(show text default 'waiting') returns jsonb
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
    select jsonb_build_object('kind', 'case', 'id', c.id, 'game', 'the-diagnostic-pursuit', 'status', c.status, 'note', c.note, 'created_at', c.created_at,
      'username', p.username, 'data', jsonb_build_object('diagnosis', c.diagnosis, 'answer_id', c.answer_id, 'field', c.field, 'gender', c.gender, 'age', c.age,
        'presentation', c.presentation, 'history', c.history, 'exam', c.exam, 'investigation', c.investigation, 'findings', to_jsonb(c.findings))) x
    from public.custom_cases c left join public.profiles p on p.id = c.user_id where show = 'all' or c.status = show
    union all
    select jsonb_build_object('kind', 'word', 'id', w.id, 'game', w.game, 'status', w.status, 'note', w.note, 'created_at', w.created_at,
      'username', p.username, 'data', w.data)
    from public.player_words w left join public.profiles p on p.id = w.user_id where show = 'all' or w.status = show
    order by 1 limit 300) y(x)), '[]');
end $$;
revoke all on function public.admin_submissions(text) from public, anon;
grant execute on function public.admin_submissions(text) to authenticated;

-- Approve or decline one item, with an optional note and (for approving) the edited item.
create or replace function public.admin_review(kind text, item uuid, status text, note text default null, edit jsonb default null) returns jsonb
language plpgsql security definer set search_path = 'public' as $$
declare maker uuid; was text; paid boolean := false; d date := (now() at time zone 'utc')::date;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if status not in ('approved', 'declined', 'waiting') then raise exception 'status'; end if;
  note := nullif(left(trim(coalesce(note, '')), 300), '');
  if kind = 'case' then
    select c.user_id, c.status into maker, was from public.custom_cases c where c.id = item for update;
    if maker is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
    if edit is not null then
      if length(trim(coalesce(edit->>'diagnosis', ''))) < 2 or length(trim(coalesce(edit->>'presentation', ''))) < 10 then raise exception 'missing'; end if;
      update public.custom_cases c set diagnosis = left(trim(edit->>'diagnosis'), 120),
        answer_id = coalesce(nullif(left(trim(coalesce(edit->>'answer_id', '')), 120), ''), c.answer_id),
        field = nullif(left(trim(coalesce(edit->>'field', '')), 40), ''), age = coalesce((edit->>'age')::int, c.age),
        presentation = left(trim(edit->>'presentation'), 1500), history = left(trim(coalesce(edit->>'history', '')), 600),
        exam = left(trim(coalesce(edit->>'exam', '')), 600), investigation = left(trim(coalesce(edit->>'investigation', '')), 600),
        findings = coalesce((select array_agg(left(trim(x), 300)) from jsonb_array_elements_text(coalesce(edit->'findings', '[]')) x where trim(x) <> ''), '{}')
      where c.id = item;
    end if;
    update public.custom_cases c set status = admin_review.status, note = admin_review.note, decided_at = now() where c.id = item;
  elsif kind = 'word' then
    select w.user_id, w.status into maker, was from public.player_words w where w.id = item for update;
    if maker is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
    update public.player_words w set status = admin_review.status, note = admin_review.note, decided_at = now(),
      data = case when edit is null then w.data else public.word_clean(w.game, edit) end
    where w.id = item;
  else raise exception 'kind';
  end if;
  -- 10 tokens the first time an item is approved, at most 5 paid a day per player.
  if status = 'approved' and not exists (select 1 from public.wallet_ledger l where l.user_id = maker and l.reason = 'item:' || item)
     and (select count(*) from public.wallet_ledger l where l.user_id = maker and l.reason like 'item:%' and l.at >= d::timestamptz) < 5 then
    perform public.pay_free(maker, 'grant', 10, 'item:' || item, 'Approved: your ' || case when kind = 'case' then 'case' else 'word' end);
    paid := true;
  end if;
  return jsonb_build_object('ok', true, 'paid', paid);
end $$;
revoke all on function public.admin_review(text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_review(text, uuid, text, text, jsonb) to authenticated;
