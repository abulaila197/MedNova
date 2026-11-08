-- Publish list task 1 (Yazan 2026-11-02): old-version cleanup. Testers always get the newest APK, so the old places
-- can move. Run when nobody is mid-match (a running match could show a wrong word or question).
-- 1) Silent Artist: delete the retired "Medicine cup" (b186, place 486); later words move down one (1,000 words).
-- 2) Quiz Parade: the retired TB question (place 1238) is already gone from pq_keys; later questions move down one
--    (6,863 questions), and their ids follow their places (n1239 becomes n1238).
-- 3) Crossword: puzzles are now stored in play order, so the online number = the level on the Solo map.
-- Each move goes through negative numbers first, so no two rows ever share a number midway.
begin;

delete from public.sa_words where n = 486 and id = 'b186';
update public.sa_words set n = -(n - 1) where n > 486 and owner is null;
update public.sa_words set n = -n where n < 0;

update public.pq_keys set n = -(n - 1), id = 'm' || (n - 1) where n > 1238;
update public.pq_keys set n = -n, id = 'n' || (-n) where n < 0;

update public.cw_words set n = -(case n when 1 then 1 when 2 then 2 when 3 then 3 when 4 then 4 when 5 then 5 when 6 then 18 when 7 then 8 when 8 then 24 when 9 then 41 when 10 then 35 when 11 then 6 when 12 then 33 when 13 then 49 when 14 then 46 when 15 then 28 when 16 then 7 when 17 then 13 when 18 then 22 when 19 then 47 when 20 then 39 when 21 then 12 when 22 then 44 when 23 then 32 when 24 then 15 when 25 then 26 when 26 then 42 when 27 then 10 when 28 then 20 when 29 then 30 when 30 then 37 when 31 then 16 when 32 then 45 when 33 then 43 when 34 then 19 when 35 then 38 when 36 then 34 when 37 then 11 when 38 then 40 when 39 then 29 when 40 then 17 when 41 then 48 when 42 then 36 when 43 then 50 when 44 then 21 when 45 then 9 when 46 then 31 when 47 then 25 when 48 then 14 when 49 then 27 when 50 then 23 end);
update public.cw_words set n = -n where n < 0;

commit;

-- Check: expect sa_words 1000 rows numbered 1-1000 with none retired; pq_keys 6863 rows numbered 1-6863;
-- cw_words 50 puzzles; the first word of puzzle 6 is from cw-11 (p11-1).
select (select count(*) from public.sa_words where owner is null) as sa_words,
       (select max(n) from public.sa_words where owner is null) as sa_last,
       (select count(*) from public.sa_words where retired) as sa_retired,
       (select count(*) from public.pq_keys) as pq_keys,
       (select max(n) from public.pq_keys) as pq_last,
       (select count(distinct n) from public.cw_words) as cw_puzzles,
       (select min(id) from public.cw_words where n = 6) as cw_6;
