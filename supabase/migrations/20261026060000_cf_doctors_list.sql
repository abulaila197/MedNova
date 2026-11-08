-- Case Files (#65, #66, #67, Yazan 2026-10-26). One answer list per case, "The doctor's list" (the doc's first list,
-- the narrowed list and the final, each name once), replaces the narrowed-list slots. Both of the player's lists score
-- against it, each name once across both: +10 right, -2 wrong, floored at 0. The final now scores like any right name.
-- Parent/child pairs keep the broader name as the final (4 cases), so the parent column goes unused.

alter table public.cf_cases add column if not exists answers text[];
alter table public.race_results add column if not exists dd_first text[];

update public.cf_cases c set answers = v.answers, final = v.final, parent = null
  from (values
  ('MP-2291', 'Acute appendicitis', array['Acute appendicitis', 'Ectopic pregnancy', 'Ruptured ovarian cyst', 'Ovarian torsion', 'Pelvic inflammatory disease', 'Mesenteric adenitis']::text[]),
  ('MP-2301', 'Ruptured ectopic pregnancy', array['Ruptured ectopic pregnancy', 'Ruptured ovarian cyst', 'Ovarian torsion', 'Threatened miscarriage', 'Incomplete miscarriage', 'Acute appendicitis', 'Pelvic inflammatory disease']::text[]),
  ('MP-2302', 'Acute cholecystitis', array['Acute cholecystitis', 'Acute pancreatitis', 'Acute cholangitis', 'Peptic ulcer disease', 'Community-acquired pneumonia']::text[]),
  ('MP-2303', 'Acute pulmonary embolism', array['Acute pulmonary embolism', 'Community-acquired pneumonia', 'Pneumothorax', 'Musculoskeletal chest pain', 'Acute coronary syndrome']::text[]),
  ('MP-2304', 'Bacterial meningitis', array['Bacterial meningitis', 'Viral meningitis', 'Viral encephalitis', 'Febrile seizure', 'Urinary tract infection', 'Sepsis']::text[]),
  ('MP-2305', 'Ovarian torsion', array['Ovarian torsion', 'Ruptured ovarian cyst', 'Acute appendicitis', 'Urinary tract infection', 'Ovulation pain']::text[]),
  ('MP-2306', 'Testicular torsion', array['Testicular torsion', 'Epididymo-orchitis', 'Torsion of testicular appendage', 'Incarcerated inguinal hernia', 'Hematoma']::text[]),
  ('MP-2307', 'Acute epiglottitis', array['Acute epiglottitis', 'Croup', 'Retropharyngeal abscess', 'Foreign body aspiration', 'Bacterial tracheitis']::text[]),
  ('MP-2308', 'Community-acquired pneumonia with sepsis', array['Community-acquired pneumonia with sepsis', 'Urinary tract infection', 'Exacerbation of chronic lung disease', 'Acute pulmonary embolism', 'Heart failure']::text[]),
  ('MP-2309', 'Placental abruption', array['Placental abruption', 'Placenta previa', 'Preterm labor', 'Uterine rupture', 'Chorioamnionitis']::text[]),
  ('MP-2310', 'Guillain-Barré syndrome', array['Guillain-Barré syndrome', 'Transverse myelitis', 'Spinal cord compression', 'Myasthenia gravis', 'Electrolyte imbalance']::text[]),
  ('MP-2311', 'Acute diverticulitis', array['Acute diverticulitis', 'Acute appendicitis', 'Colorectal cancer', 'Ischemic colitis', 'Ovarian cyst']::text[]),
  ('MP-2312', 'Myocardial infarction', array['Myocardial infarction', 'Unstable angina', 'Aortic dissection', 'Acute pericarditis', 'Gastroesophageal reflux disease']::text[]),
  ('MP-2313', 'Diabetic foot osteomyelitis', array['Diabetic foot osteomyelitis', 'Cellulitis', 'Peripheral arterial disease', 'Charcot foot', 'Skin cancer']::text[]),
  ('MP-2314', 'Ruptured abdominal aortic aneurysm', array['Ruptured abdominal aortic aneurysm', 'Renal colic', 'Acute pancreatitis', 'Mechanical back pain', 'Vertebral fracture']::text[]),
  ('MP-2315', 'Acute urinary retention due to BPH', array['Acute urinary retention due to BPH', 'Urinary tract infection', 'Urethral stricture', 'Neurogenic bladder', 'Prostate cancer']::text[]),
  ('MP-2316', 'Kawasaki disease', array['Kawasaki disease', 'Scarlet fever', 'Measles', 'Viral exanthem', 'Adenovirus infection']::text[]),
  ('MP-2317', 'Addisonian crisis', array['Addisonian crisis', 'Hypothyroidism', 'Depression', 'Sepsis', 'Hypoglycemia']::text[]),
  ('MP-2318', 'Acute cholangitis', array['Acute cholangitis', 'Acute cholecystitis', 'Viral hepatitis', 'Pancreatic cancer', 'Hemolytic jaundice']::text[]),
  ('MP-2319', 'Necrotizing fasciitis', array['Necrotizing fasciitis', 'Cellulitis', 'Deep vein thrombosis', 'Acute compartment syndrome', 'Gas gangrene']::text[]),
  ('MP-2320', 'Acute severe asthma exacerbation', array['Acute severe asthma exacerbation', 'Bronchiolitis', 'Community-acquired pneumonia', 'Foreign body aspiration', 'Anaphylaxis']::text[]),
  ('MP-2321', 'Acute ischemic stroke', array['Acute ischemic stroke', 'Intracerebral hemorrhage', 'Hypoglycemia', 'Todd''s paralysis', 'Bell''s palsy']::text[]),
  ('MP-2322', 'Anaphylaxis', array['Anaphylaxis', 'Acute asthma exacerbation', 'Angioedema', 'Panic attack', 'Vasovagal syncope']::text[]),
  ('MP-2323', 'Acute compartment syndrome', array['Acute compartment syndrome', 'Post-fracture pain', 'Deep vein thrombosis', 'Nerve injury', 'Tight cast']::text[]),
  ('MP-2324', 'Subdural hematoma', array['Subdural hematoma', 'Delirium', 'Dementia', 'Stroke', 'Drug overdose', 'Adverse drug reaction']::text[]),
  ('MP-2325', 'Deep vein thrombosis', array['Deep vein thrombosis', 'Cellulitis', 'Ruptured Baker''s cyst', 'Superficial thrombophlebitis', 'Chronic venous insufficiency']::text[]),
  ('MP-2326', 'Acute pyelonephritis', array['Acute pyelonephritis', 'Urinary tract infection', 'Renal colic', 'Acute appendicitis', 'Ovarian cyst']::text[]),
  ('MP-2327', 'Herpes zoster ophthalmicus', array['Herpes zoster ophthalmicus', 'Bacterial conjunctivitis', 'Contact dermatitis', 'Periorbital cellulitis', 'Migraine']::text[]),
  ('MP-2328', 'Cardiac tamponade', array['Cardiac tamponade', 'Heart failure', 'Massive pulmonary embolism', 'Anemia', 'Acute pericarditis']::text[]),
  ('MP-2329', 'Splenic rupture', array['Splenic rupture', 'Rib fracture', 'Kidney injury', 'Diaphragmatic rupture', 'Soft tissue bruising']::text[]),
  ('MP-2330', 'Acute angle-closure glaucoma', array['Acute angle-closure glaucoma', 'Migraine with aura', 'Acute anterior uveitis', 'Corneal abrasion', 'Keratitis', 'Gastroenteritis']::text[]),
  ('MP-2331', 'Sickle cell vaso-occlusive crisis', array['Sickle cell vaso-occlusive crisis', 'Acute chest syndrome', 'Osteomyelitis', 'Acute pulmonary embolism', 'Community-acquired pneumonia']::text[]),
  ('MP-2332', 'Acute leukemia', array['Acute leukemia', 'Immune thrombocytopenic purpura', 'Viral infection', 'Aplastic anemia', 'Henoch-Schönlein purpura']::text[]),
  ('MP-2333', 'Multiple sclerosis', array['Multiple sclerosis', 'Migraine with aura', 'Optic nerve compression', 'Ischemic optic neuropathy', 'Viral conjunctivitis']::text[]),
  ('MP-2334', 'Tubo-ovarian abscess', array['Tubo-ovarian abscess', 'Pelvic inflammatory disease', 'Ruptured ovarian cyst', 'Ectopic pregnancy', 'Acute appendicitis']::text[]),
  ('MP-2335', 'Wernicke''s encephalopathy', array['Wernicke''s encephalopathy', 'Alcohol withdrawal', 'Hepatic encephalopathy', 'Stroke', 'Subdural hematoma']::text[]),
  ('MP-2336', 'Breast abscess', array['Breast abscess', 'Mastitis', 'Inflammatory breast cancer', 'Blocked milk duct', 'Cellulitis']::text[]),
  ('MP-2337', 'Perforated peptic ulcer', array['Perforated peptic ulcer', 'Acute pancreatitis', 'Acute cholecystitis', 'Ruptured abdominal aortic aneurysm', 'Myocardial infarction']::text[]),
  ('MP-2338', 'Tension pneumothorax', array['Tension pneumothorax', 'Pneumothorax', 'Acute pulmonary embolism', 'Acute asthma exacerbation', 'Cardiac tamponade']::text[]),
  ('MP-2339', 'Acute mastoiditis', array['Acute mastoiditis', 'Acute otitis media', 'Cellulitis', 'Insect bite reaction', 'Lymphadenitis']::text[]),
  ('MP-2340', 'Toxic shock syndrome', array['Toxic shock syndrome', 'Sepsis', 'Meningococcal septicemia', 'Allergic drug reaction', 'Scarlet fever']::text[]),
  ('MP-2341', 'Malaria', array['Malaria', 'Typhoid fever', 'Dengue fever', 'Influenza', 'Traveler''s diarrhea']::text[]),
  ('MP-2342', 'Hyperosmolar hyperglycemic state', array['Hyperosmolar hyperglycemic state', 'Diabetic ketoacidosis', 'Stroke', 'Urinary tract infection', 'Sepsis']::text[]),
  ('MP-2343', 'Acute limb ischemia', array['Acute limb ischemia', 'Deep vein thrombosis', 'Peripheral arterial disease', 'Sciatica', 'Acute compartment syndrome']::text[]),
  ('MP-2344', 'Bell''s palsy', array['Bell''s palsy', 'Stroke', 'Ramsay Hunt syndrome', 'Lyme disease', 'Facial nerve tumor']::text[]),
  ('MP-2345', 'Foreign body aspiration', array['Foreign body aspiration', 'Acute asthma exacerbation', 'Croup', 'Bronchiolitis', 'Viral upper respiratory infection']::text[]),
  ('MP-2346', 'Malignant otitis externa', array['Malignant otitis externa', 'Otitis externa', 'Acute mastoiditis', 'Ear canal tumor', 'Bell''s palsy']::text[]),
  ('MP-2347', 'Post-streptococcal glomerulonephritis', array['Post-streptococcal glomerulonephritis', 'Nephrotic syndrome', 'Henoch-Schönlein purpura', 'Urinary tract infection', 'IgA nephropathy']::text[]),
  ('MP-2348', 'Ruptured corpus luteal cyst', array['Ruptured corpus luteal cyst', 'Ectopic pregnancy', 'Ovarian torsion', 'Acute appendicitis', 'Ovulation pain']::text[]),
  ('MP-2349', 'Acute intermittent porphyria', array['Acute intermittent porphyria', 'Acute appendicitis', 'Primary psychiatric disorder', 'Lead poisoning', 'Bowel obstruction']::text[]),
  ('MP-2350', 'Thyroid storm', array['Thyroid storm', 'Sepsis', 'Neuroleptic malignant syndrome', 'Serotonin syndrome', 'Delirium tremens']::text[]),
  ('MP-2351', 'Cauda equina syndrome', array['Cauda equina syndrome', 'Mechanical back pain', 'Sciatica', 'Spinal cord compression', 'Urinary tract infection', 'Conus medullaris syndrome']::text[]),
  ('MP-2352', 'Ludwig''s angina', array['Ludwig''s angina', 'Dental abscess', 'Peritonsillar abscess', 'Acute epiglottitis', 'Cellulitis']::text[]),
  ('MP-2353', 'Herpes simplex encephalitis', array['Herpes simplex encephalitis', 'Bacterial meningitis', 'Epilepsy', 'Autoimmune encephalitis', 'Stroke']::text[]),
  ('MP-2354', 'Peripartum cardiomyopathy', array['Peripartum cardiomyopathy', 'Acute pulmonary embolism', 'Normal postpartum changes', 'Anemia', 'Panic attack', 'Anxiety disorder']::text[]),
  ('MP-2355', 'Retinal detachment', array['Retinal detachment', 'Vitreous hemorrhage', 'Migraine with aura', 'Posterior vitreous detachment', 'Transient ischemic attack']::text[]),
  ('MP-2356', 'Acute cerebellar hemorrhage', array['Acute cerebellar hemorrhage', 'Cerebellar stroke', 'Vestibular neuritis', 'Transient ischemic attack', 'Cerebellar tumor']::text[]),
  ('MP-2357', 'Necrotizing enterocolitis', array['Necrotizing enterocolitis', 'Feed intolerance', 'Sepsis', 'Bowel obstruction', 'Spontaneous intestinal perforation']::text[]),
  ('MP-2358', 'Boerhaave syndrome', array['Boerhaave syndrome', 'Myocardial infarction', 'Perforated peptic ulcer', 'Acute pancreatitis', 'Mallory-Weiss tear']::text[]),
  ('MP-2359', 'Whooping cough', array['Whooping cough', 'Bronchiolitis', 'Viral upper respiratory infection', 'Foreign body aspiration', 'Gastroesophageal reflux disease']::text[]),
  ('MP-2360', 'Acute exacerbation of COPD', array['Acute exacerbation of COPD', 'Community-acquired pneumonia', 'Acute heart failure', 'Acute pulmonary embolism', 'Pneumothorax']::text[]),
  ('MP-2361', 'Decompensated congestive heart failure', array['Decompensated congestive heart failure', 'Acute exacerbation of COPD', 'Acute pulmonary embolism', 'Community-acquired pneumonia', 'Kidney failure']::text[]),
  ('MP-2362', 'Atrial fibrillation with rapid ventricular response', array['Atrial fibrillation with rapid ventricular response', 'Supraventricular tachycardia', 'Panic attack', 'Thyrotoxicosis', 'Anemia']::text[]),
  ('MP-2363', 'Urinary tract infection', array['Urinary tract infection', 'Acute pyelonephritis', 'Vaginal candidiasis', 'Sexually transmitted infection', 'Interstitial cystitis']::text[]),
  ('MP-2364', 'Migraine with aura', array['Migraine with aura', 'Subarachnoid hemorrhage', 'Tension-type headache', 'Cluster headache', 'Meningitis']::text[]),
  ('MP-2365', 'Acute gout', array['Acute gout', 'Septic arthritis', 'Cellulitis', 'Pseudogout', 'Traumatic injury']::text[]),
  ('MP-2366', 'Cellulitis', array['Cellulitis', 'Necrotizing fasciitis', 'Deep vein thrombosis', 'Contact dermatitis', 'Erysipelas']::text[]),
  ('MP-2367', 'Influenza', array['Influenza', 'COVID-19', 'Common cold', 'Streptococcal pharyngitis', 'Community-acquired pneumonia']::text[]),
  ('MP-2368', 'Chickenpox', array['Chickenpox', 'Hand-foot-and-mouth disease', 'Allergic reaction', 'Impetigo', 'Insect bite reaction']::text[]),
  ('MP-2369', 'Measles', array['Measles', 'Rubella', 'Scarlet fever', 'Viral exanthem', 'Allergic drug reaction']::text[]),
  ('MP-2370', 'Hand-foot-and-mouth disease', array['Hand-foot-and-mouth disease', 'Chickenpox', 'Herpetic gingivostomatitis', 'Herpangina', 'Allergic reaction']::text[]),
  ('MP-2371', 'Acute otitis media', array['Acute otitis media', 'Otitis media with effusion', 'Acute mastoiditis', 'Ear canal foreign body', 'Teething']::text[]),
  ('MP-2372', 'Croup', array['Croup', 'Acute epiglottitis', 'Foreign body aspiration', 'Bacterial tracheitis', 'Anaphylaxis']::text[]),
  ('MP-2373', 'Bronchiolitis', array['Bronchiolitis', 'Viral-induced wheeze', 'Community-acquired pneumonia', 'Whooping cough', 'Congenital heart disease']::text[]),
  ('MP-2374', 'Pyloric stenosis', array['Pyloric stenosis', 'Gastroesophageal reflux disease', 'Overfeeding', 'Cow''s milk protein allergy', 'Urinary tract infection']::text[]),
  ('MP-2375', 'Myxedema coma', array['Myxedema coma', 'Hypothermia', 'Stroke', 'Sepsis', 'Drug overdose']::text[]),
  ('MP-2376', 'Rheumatic fever', array['Rheumatic fever', 'Septic arthritis', 'Juvenile idiopathic arthritis', 'Reactive arthritis', 'Infective endocarditis']::text[]),
  ('MP-2377', 'Infectious mononucleosis', array['Infectious mononucleosis', 'Streptococcal pharyngitis', 'Acute HIV infection', 'Cytomegalovirus infection', 'Peritonsillar abscess']::text[]),
  ('MP-2378', 'Scarlet fever', array['Scarlet fever', 'Kawasaki disease', 'Viral exanthem', 'Allergic drug reaction', 'Measles']::text[]),
  ('MP-2379', 'Iron deficiency anemia', array['Iron deficiency anemia', 'Anemia of chronic disease', 'Vitamin B12 deficiency anemia', 'Folate deficiency anemia', 'Hypothyroidism', 'Hyperthyroidism', 'Depression']::text[]),
  ('MP-2380', 'Hypoglycemia', array['Hypoglycemia', 'Stroke', 'Seizure', 'Alcohol intoxication', 'Diabetic ketoacidosis', 'Hyperosmolar hyperglycemic state']::text[]),
  ('MP-2381', 'Peptic ulcer disease', array['Peptic ulcer disease', 'Gastroesophageal reflux disease', 'Gastritis', 'Gallstone disease', 'Functional dyspepsia']::text[]),
  ('MP-2382', 'Concussion', array['Concussion', 'Intracranial hemorrhage', 'Skull fracture', 'Cervical spine injury', 'Post-traumatic headache']::text[]),
  ('MP-2383', 'Alzheimer''s disease', array['Alzheimer''s disease', 'Vascular dementia', 'Delirium', 'Depression', 'Age-related memory changes']::text[]),
  ('MP-2384', 'Parkinson''s disease', array['Parkinson''s disease', 'Essential tremor', 'Drug-induced parkinsonism', 'Normal pressure hydrocephalus', 'Vascular parkinsonism']::text[]),
  ('MP-2385', 'Osteoarthritis', array['Osteoarthritis', 'Rheumatoid arthritis', 'Acute gout', 'Meniscal tear', 'Hip osteoarthritis']::text[]),
  ('MP-2386', 'Rheumatoid arthritis', array['Rheumatoid arthritis', 'Osteoarthritis', 'Psoriatic arthritis', 'Viral arthritis', 'Systemic lupus erythematosus']::text[]),
  ('MP-2387', 'Benign paroxysmal positional vertigo', array['Benign paroxysmal positional vertigo', 'Vestibular neuritis', 'Ménière''s disease', 'Posterior circulation stroke', 'Vestibular migraine']::text[]),
  ('MP-2388', 'Crohn''s disease', array['Crohn''s disease', 'Ulcerative colitis', 'Gastroenteritis', 'Acute appendicitis', 'Intestinal tuberculosis']::text[]),
  ('MP-2389', 'Alcoholic hepatitis', array['Alcoholic hepatitis', 'Viral hepatitis', 'Choledocholithiasis', 'Decompensated cirrhosis', 'Liver cancer']::text[]),
  ('MP-2390', 'Preeclampsia', array['Preeclampsia', 'Chronic hypertension', 'Tension-type headache', 'Migraine', 'Gallstone disease']::text[]),
  ('MP-2391', 'Hypertensive emergency', array['Hypertensive emergency', 'Acute ischemic stroke', 'Subarachnoid hemorrhage', 'Acute coronary syndrome', 'Panic attack', 'Anxiety disorder']::text[]),
  ('MP-2392', 'Acute bacterial sinusitis', array['Acute bacterial sinusitis', 'Viral upper respiratory infection', 'Tension-type headache', 'Migraine', 'Dental abscess']::text[]),
  ('MP-2393', 'Bacterial conjunctivitis', array['Bacterial conjunctivitis', 'Viral conjunctivitis', 'Allergic conjunctivitis', 'Eye foreign body', 'Periorbital cellulitis']::text[]),
  ('MP-2394', 'Costochondritis', array['Costochondritis', 'Acute coronary syndrome', 'Acute pulmonary embolism', 'Acute pericarditis', 'Muscle strain']::text[]),
  ('MP-2395', 'Otitis externa', array['Otitis externa', 'Acute otitis media', 'Malignant otitis externa', 'Ear canal foreign body', 'Otomycosis']::text[]),
  ('MP-2396', 'Bacterial tonsillitis', array['Bacterial tonsillitis', 'Infectious mononucleosis', 'Viral pharyngitis', 'Peritonsillar abscess', 'Scarlet fever']::text[]),
  ('MP-2397', 'Impetigo', array['Impetigo', 'Herpes simplex', 'Eczema herpeticum', 'Insect bite reaction', 'Contact dermatitis']::text[]),
  ('MP-2398', 'Herpes zoster', array['Herpes zoster', 'Contact dermatitis', 'Cellulitis', 'Herpes simplex', 'Musculoskeletal chest pain']::text[]),
  ('MP-2399', 'Trigeminal neuralgia', array['Trigeminal neuralgia', 'Dental abscess', 'Temporomandibular joint dysfunction', 'Cluster headache', 'Multiple sclerosis']::text[])
  ) v(id, final, answers)
 where c.id = v.id;

create or replace function public.cf_dd_score2(answers text[], a text[], b text[]) returns integer
language sql immutable set search_path = '' as $$
  select greatest(0, 10 * count(*) filter (where x = any(answers)) - 2 * count(*) filter (where not x = any(answers)))::int
    from (select distinct x from unnest(coalesce(a, '{}') || coalesce(b, '{}')) x where x is not null) z;
$$;
revoke all on function public.cf_dd_score2(text[], text[], text[]) from public, anon, authenticated;

drop function if exists public.cf_step(uuid, text, text[], text, text);
create or replace function public.cf_step(m uuid, stage text, filtered text[] default null::text[], provisional text default null::text, redemption text default null::text, first text[] default null::text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); x public.matches; rr public.race_results; c public.cf_cases; ms int; dd int; solved boolean; complete boolean; total int;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'case-files-unsolved' then raise exception 'not a case files match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return jsonb_build_object('result', 'over'); end if;
  select * into rr from public.race_results r where r.match_id = m and r.item_index = x.case_index and r.user_id = me;
  if not found then raise exception 'not playing'; end if;
  if rr.done then return jsonb_build_object('result', 'done'); end if;
  select * into c from public.cf_cases cc where cc.n = x.case_numbers[x.case_index + 1];
  ms := (extract(epoch from (now() - x.phase_started_at)) * 1000)::int;
  if stage in ('Examination', 'Investigations', 'Treatment', 'Finished') then rr.stage := stage; end if;
  -- #67: the first list arrives with the narrowed one; both are kept once (at most 5 names each).
  if filtered is not null and rr.dd is null then
    rr.dd := (select array_agg(f) from (select distinct f from unnest(filtered) f limit 5) z);
    rr.dd_first := (select array_agg(f) from (select distinct f from unnest(first) f limit 5) z);
  end if;
  if provisional is not null and rr.prov is null and rr.dd is not null then rr.prov := provisional; end if;
  if redemption is not null and rr.redeem is null and rr.prov is not null and rr.prov <> c.final then rr.redeem := redemption; end if;
  solved := coalesce(rr.prov = c.final, false) or coalesce(rr.redeem = c.final, false);
  complete := coalesce(rr.prov = c.final, false) or rr.redeem is not null;
  dd := case when rr.dd is null then 0 else public.cf_dd_score2(c.answers, rr.dd_first, rr.dd) end;
  total := dd + case when rr.prov = c.final then 20 else 0 end + case when rr.redeem = c.final then 10 else 0 end
    + case when solved then round(10 * greatest(0, 1 - ms / 300000.0))::int else 0 end;
  if complete then rr.stage := 'Finished'; end if;
  update public.race_results r set stage = rr.stage, dd = rr.dd, dd_first = rr.dd_first, prov = rr.prov, redeem = rr.redeem, points = total,
    done = complete, solved_ms = case when solved then ms end, answered_ms = case when complete then ms end
   where r.match_id = m and r.item_index = x.case_index and r.user_id = me;
  -- Points add up over the cases; tie on points = faster finish.
  perform public.cf_total(m, me);
  return jsonb_build_object('result', 'ok', 'complete', complete);
end $function$;
revoke all on function public.cf_step(uuid, text, text[], text, text, text[]) from public, anon;
grant execute on function public.cf_step(uuid, text, text[], text, text, text[]) to authenticated;
