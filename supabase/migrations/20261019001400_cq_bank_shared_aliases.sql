-- Conqueror: two rush items no longer share another name between two answers (Yazan 2026-10-19), so one typed word
-- can't match both. obgyn_category_rush_035: the 'IgG' / 'IgM' other names (on both antibody answers) are gone.
-- path_cat_035: 'Tau' and 'TDP-43' stay on Alzheimer disease and ALS and come off Frontotemporal lobar degeneration.
-- bank.json's sha256 changes again: built from row '684ee21566ee' (20261019000100) with just these two items
-- swapped, order kept. Apply AFTER 20261019000100 and BEFORE redeploying the conqueror function (now reads v = '949d33208b1a').
insert into public.cq_bank (v, items)
select '949d33208b1a', jsonb_agg(
  case e->>'id'
    when 'obgyn_category_rush_035' then '{"id": "obgyn_category_rush_035", "field": "obgyn", "difficulty": 3, "style": "rush", "prompt": "List laboratory findings characteristic of antiphospholipid syndrome in pregnancy.", "answers": [{"label": "Lupus anticoagulant positive"}, {"label": "Anticardiolipin antibodies"}, {"label": "Anti-beta-2-glycoprotein I antibodies"}, {"label": "Prolonged aPTT in vitro that does not correct with 1:1 mix"}], "explanation": "Diagnostic serologies confirmed on two occasions at least 12 weeks apart."}'::jsonb
    when 'path_cat_035' then '{"id": "path_cat_035", "field": "pathology", "difficulty": 3, "style": "rush", "prompt": "Neurodegenerative Diseases with Protein Aggregates", "answers": [{"label": "Alzheimer disease", "aliases": ["Amyloid-beta", "Tau"]}, {"label": "Parkinson disease", "aliases": ["Alpha-synuclein"]}, {"label": "Huntington disease", "aliases": ["Huntingtin"]}, {"label": "Amyotrophic lateral sclerosis", "aliases": ["TDP-43", "FUS"]}, {"label": "Frontotemporal lobar degeneration"}, {"label": "Creutzfeldt-Jakob disease", "aliases": ["PrPSc"]}], "explanation": "Disorders defined by selective progressive neuronal loss and misfolded protein deposition."}'::jsonb
    else e
  end order by ord)
from public.cq_bank, jsonb_array_elements(items) with ordinality as t(e, ord)
where v = '684ee21566ee'
on conflict (v) do nothing;
