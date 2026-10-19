-- Conqueror: duplicate rush answers removed (games.md Needs Yazan #6, done in phase 2).
-- bio_cr_039: "AP Lyase" no longer takes "DNA polymerase beta" (its own answer) as another name.
-- peds_category_rush_002: the repeated "VSD", "Pulmonary stenosis" and "RVH" answers are gone; "Pulmonary stenosis"
-- is now another name of "Pulmonic stenosis". bank.json's sha256 changes, so the function (built by
-- scripts/build-conqueror-function.sh) reads the new row v = '684ee21566ee'. Built from the live row 87a561916756
-- (same content as the old bank.json, checked 2026-10-19) with just these two items swapped, order kept.
-- Apply BEFORE redeploying the conqueror function. The old row stays for the live function until then.
insert into public.cq_bank (v, items)
select '684ee21566ee', jsonb_agg(
  case e->>'id'
    when 'bio_cr_039' then '{"id": "bio_cr_039", "field": "biochemistry", "difficulty": 3, "style": "rush", "prompt": "Enzymes and Factors Required for Eukaryotic Base Excision Repair (BER)", "answers": [{"label": "DNA Glycosylase"}, {"label": "AP Endonuclease"}, {"label": "AP Lyase"}, {"label": "DNA Polymerase beta"}, {"label": "DNA Ligase III"}, {"label": "XRCC1"}], "explanation": "BER machinery: DNA glycosylase, AP endonuclease, AP lyase, DNA polymerase beta, DNA ligase III/XRCC1."}'::jsonb
    when 'peds_category_rush_002' then '{"id": "peds_category_rush_002", "field": "pediatrics", "difficulty": 1, "style": "rush", "prompt": "List the four anatomical anomalies comprising the Tetralogy of Fallot.", "answers": [{"label": "Ventricular septal defect", "aliases": ["VSD"]}, {"label": "Overriding aorta"}, {"label": "Pulmonic stenosis", "note": "right ventricular outflow obstruction", "aliases": ["Pulmonary stenosis"]}, {"label": "Right ventricular hypertrophy", "aliases": ["RVH"]}], "explanation": "VSD, overriding aorta, pulmonary stenosis, and RV hypertrophy define Tetralogy of Fallot."}'::jsonb
    else e
  end order by ord)
from public.cq_bank, jsonb_array_elements(items) with ordinality as t(e, ord)
where v = '87a561916756'
on conflict (v) do nothing;
