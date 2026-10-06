// Sample questions the engine tests run on. The game itself plays from bank.json (WC10).
import type { Question } from '../core';
import type { BossSet, FullBank } from '../offline';

const questions: Question[] = [
  // Direct MCQ
  { id: 'mcq-1', style: 'mcq', field: 'pharmacology', difficulty: 'easy', prompt: 'Which drug reverses heparin?', choices: ['Protamine sulfate', 'Vitamin K', 'Naloxone', 'Flumazenil'], answer: 0 },
  { id: 'mcq-2', style: 'mcq', field: 'anatomy', difficulty: 'easy', prompt: 'Which nerve supplies the deltoid?', choices: ['Radial nerve', 'Axillary nerve', 'Musculocutaneous nerve', 'Ulnar nerve'], answer: 1 },
  { id: 'mcq-3', style: 'mcq', field: 'medicine', difficulty: 'medium', prompt: 'Which electrolyte problem gives peaked T waves on the ECG?', choices: ['Hypokalaemia', 'Hypocalcaemia', 'Hyperkalaemia', 'Hypomagnesaemia'], answer: 2 },
  // True or False
  { id: 'tf-1', style: 'tf', field: 'physiology', difficulty: 'easy', prompt: 'Insulin raises blood glucose.', answer: false },
  { id: 'tf-2', style: 'tf', field: 'microbiology', difficulty: 'easy', prompt: 'Malaria is spread by the female Anopheles mosquito.', answer: true },
  { id: 'tf-3', style: 'tf', field: 'anatomy', difficulty: 'easy', prompt: 'The right lung has three lobes.', answer: true },
  { id: 'tf-4', style: 'tf', field: 'pharmacology', difficulty: 'medium', prompt: 'Metformin on its own commonly causes hypoglycaemia.', answer: false },
  { id: 'tf-5', style: 'tf', field: 'pediatrics', difficulty: 'medium', prompt: 'Kawasaki disease can cause coronary artery aneurysms.', answer: true },
  { id: 'tf-6', style: 'tf', field: 'biochemistry', difficulty: 'easy', prompt: 'Vitamin C deficiency causes scurvy.', answer: true },
  { id: 'tf-7', style: 'tf', field: 'surgery', difficulty: 'easy', prompt: 'The pain of acute appendicitis classically starts around the umbilicus.', answer: true },
  { id: 'tf-8', style: 'tf', field: 'obgyn', difficulty: 'easy', prompt: 'Folic acid before pregnancy lowers the risk of neural tube defects.', answer: true },
  { id: 'tf-9', style: 'tf', field: 'pathology', difficulty: 'medium', prompt: 'Squamous cell carcinoma is a tumour of glandular epithelium.', answer: false },
  { id: 'tf-10', style: 'tf', field: 'physiology', difficulty: 'easy', prompt: 'The sinoatrial node is the normal pacemaker of the heart.', answer: true },
  { id: 'tf-11', style: 'tf', field: 'medicine', difficulty: 'easy', prompt: 'Type 1 diabetes is mainly caused by insulin resistance.', answer: false },
  { id: 'tf-12', style: 'tf', field: 'microbiology', difficulty: 'easy', prompt: 'Antibiotics cure the common cold.', answer: false },
  // Rule 2 Out
  { id: 'r2o-1', style: 'r2o', field: 'microbiology', difficulty: 'medium', prompt: 'Rule out the 2 that are NOT gram-positive.', items: ['Staphylococcus aureus', 'Streptococcus pyogenes', 'Escherichia coli', 'Clostridioides difficile', 'Neisseria meningitidis', 'Listeria monocytogenes'], out: [2, 4] },
  { id: 'r2o-2', style: 'r2o', field: 'pharmacology', difficulty: 'easy', prompt: 'Rule out the 2 that are NOT beta-blockers.', items: ['Atenolol', 'Propranolol', 'Amlodipine', 'Bisoprolol', 'Losartan', 'Metoprolol'], out: [2, 4] },
  { id: 'r2o-3', style: 'r2o', field: 'obgyn', difficulty: 'medium', prompt: 'Rule out the 2 that are NOT risk factors for ectopic pregnancy.', items: ['Previous ectopic pregnancy', 'Combined oral contraceptive pill', 'Pelvic inflammatory disease', 'Tubal surgery', 'Breastfeeding', 'Smoking'], out: [1, 4] },
  // Matching
  { id: 'match-1', style: 'match', field: 'anatomy', difficulty: 'hard', prompt: 'Match each nerve to the muscle it supplies.', pairs: [['Axillary', 'Deltoid'], ['Musculocutaneous', 'Biceps brachii'], ['Radial', 'Triceps brachii'], ['Ulnar', 'Adductor pollicis'], ['Median', 'Pronator teres'], ['Long thoracic', 'Serratus anterior']] },
  { id: 'match-2', style: 'match', field: 'biochemistry', difficulty: 'medium', prompt: 'Match each vitamin to its deficiency.', pairs: [['Thiamine (B1)', 'Beriberi'], ['Niacin (B3)', 'Pellagra'], ['Vitamin C', 'Scurvy'], ['Vitamin D', 'Rickets'], ['Vitamin A', 'Night blindness'], ['Vitamin K', 'Bleeding tendency']] },
  { id: 'match-3', style: 'match', field: 'microbiology', difficulty: 'medium', prompt: 'Match each organism to its disease.', pairs: [['Treponema pallidum', 'Syphilis'], ['Borrelia burgdorferi', 'Lyme disease'], ['Mycobacterium leprae', 'Leprosy'], ['Vibrio cholerae', 'Cholera'], ['Corynebacterium diphtheriae', 'Diphtheria'], ['Bordetella pertussis', 'Whooping cough']] },
  // Riddle MCQ
  { id: 'riddle-1', style: 'riddle', field: 'medicine', difficulty: 'medium', prompt: 'I turn your skin bronze and your sugar high, and I come from too much iron. Who am I?', choices: ['Haemochromatosis', 'Wilson disease', 'Addison disease', 'Porphyria'], answer: 0 },
  { id: 'riddle-2', style: 'riddle', field: 'anatomy', difficulty: 'medium', prompt: 'I sit in your neck and touch no other bone. Who am I?', choices: ['Patella', 'Stapes', 'Hyoid', 'Coccyx'], answer: 2 },
  { id: 'riddle-3', style: 'riddle', field: 'pediatrics', difficulty: 'easy', prompt: "I leave a child's cheeks looking slapped, and I'm the fifth of the childhood rashes. Who am I?", choices: ['Measles', 'Erythema infectiosum', 'Roseola', 'Scarlet fever'], answer: 1 },
  // Reverse Question
  { id: 'reverse-1', style: 'reverse', field: 'surgery', difficulty: 'medium', prompt: "McBurney's point", choices: ['Where is tenderness greatest in acute appendicitis?', "Where is the gallbladder felt in Murphy's sign?", 'Where does an indirect inguinal hernia start?', 'Where is a chest drain put in?'], answer: 0 },
  { id: 'reverse-2', style: 'reverse', field: 'pharmacology', difficulty: 'easy', prompt: 'Naloxone', choices: ['Which drug reverses a benzodiazepine overdose?', 'Which drug reverses warfarin?', 'Which drug reverses an opioid overdose?', 'Which drug treats paracetamol overdose?'], answer: 2 },
  { id: 'reverse-3', style: 'reverse', field: 'physiology', difficulty: 'medium', prompt: 'Erythropoietin', choices: ['Which hormone lowers blood calcium?', 'Which kidney hormone drives red cell production?', 'Which hormone controls water uptake in the collecting duct?', 'Which hormone raises blood glucose when fasting?'], answer: 1 },
  // Three Truths and a Lie
  { id: 'lie-1', style: 'lie', field: 'pediatrics', difficulty: 'medium', prompt: 'Find the lie.', statements: ['Kawasaki disease can cause coronary aneurysms.', 'Croup gives a barking cough.', 'Pyloric stenosis typically presents at birth.', 'Intussusception can cause redcurrant-jelly stool.'], lie: 2 },
  { id: 'lie-2', style: 'lie', field: 'pathology', difficulty: 'hard', prompt: 'Find the lie.', statements: ['Caseating granulomas are typical of tuberculosis.', 'Reed-Sternberg cells are typical of Hodgkin lymphoma.', 'Auer rods are typical of chronic lymphocytic leukaemia.', 'Psammoma bodies are seen in papillary thyroid carcinoma.'], lie: 2 },
  { id: 'lie-3', style: 'lie', field: 'obgyn', difficulty: 'medium', prompt: 'Find the lie.', statements: ['Pre-eclampsia is diagnosed after 20 weeks of pregnancy.', 'Placenta praevia classically causes painless bleeding.', 'Placental abruption classically causes painless bleeding.', 'Oxytocin stimulates uterine contractions.'], lie: 2 },
];

const set = (id: string, field: BossSet['field'], category: string, fits: string[], not: string[]): BossSet => ({
  id, field, category, items: [...fits.map((label) => ({ label, fits: true })), ...not.map((label) => ({ label, fits: false }))],
});

const boss: BossSet[] = [
  set('boss-gram', 'microbiology', 'Gram-positive bacteria',
    ['Staphylococcus aureus', 'Staphylococcus epidermidis', 'Streptococcus pyogenes', 'Streptococcus pneumoniae', 'Streptococcus agalactiae', 'Enterococcus faecalis', 'Clostridioides difficile', 'Clostridium perfringens', 'Clostridium tetani', 'Listeria monocytogenes', 'Bacillus anthracis', 'Bacillus cereus', 'Corynebacterium diphtheriae', 'Actinomyces israelii', 'Nocardia asteroides'],
    ['Escherichia coli', 'Neisseria meningitidis', 'Neisseria gonorrhoeae', 'Pseudomonas aeruginosa', 'Klebsiella pneumoniae', 'Haemophilus influenzae', 'Salmonella Typhi', 'Shigella sonnei', 'Vibrio cholerae', 'Helicobacter pylori', 'Campylobacter jejuni', 'Bordetella pertussis', 'Legionella pneumophila', 'Moraxella catarrhalis', 'Proteus mirabilis']),
  set('boss-hyperk', 'pharmacology', 'Drugs that can raise potassium',
    ['Spironolactone', 'Eplerenone', 'Amiloride', 'Triamterene', 'Lisinopril', 'Ramipril', 'Losartan', 'Trimethoprim', 'Heparin', 'Suxamethonium', 'Tacrolimus', 'Ciclosporin', 'Ibuprofen', 'Pentamidine', 'Drospirenone'],
    ['Furosemide', 'Bumetanide', 'Hydrochlorothiazide', 'Indapamide', 'Chlorthalidone', 'Acetazolamide', 'Salbutamol', 'Terbutaline', 'Insulin', 'Amphotericin B', 'Fludrocortisone', 'Hydrocortisone', 'Theophylline', 'Sodium bicarbonate', 'Bisacodyl']),
  set('boss-clubbing', 'medicine', 'Causes of finger clubbing',
    ['Lung cancer', 'Bronchiectasis', 'Cystic fibrosis', 'Idiopathic pulmonary fibrosis', 'Lung abscess', 'Empyema', 'Mesothelioma', 'Asbestosis', 'Cyanotic congenital heart disease', 'Infective endocarditis', 'Crohn disease', 'Ulcerative colitis', 'Liver cirrhosis', 'Coeliac disease', 'Graves disease'],
    ['COPD', 'Asthma', 'Uncomplicated pneumonia', 'Chronic bronchitis', 'Hypertension', 'Hypothyroidism', 'Iron deficiency anaemia', 'Psoriasis', 'Gout', 'Rheumatoid arthritis', 'Pulmonary embolism', 'Type 2 diabetes', 'Heart failure', 'Osteoarthritis', 'Migraine']),
];

// Redemption's own set (WC13): easy to medium true/false.
const redemption: Question[] = [
  { id: 'red-1', style: 'tf', field: 'physiology', difficulty: 'easy', prompt: 'Red blood cells carry oxygen bound to haemoglobin.', answer: true },
  { id: 'red-2', style: 'tf', field: 'anatomy', difficulty: 'easy', prompt: 'The femur is the longest bone in the body.', answer: true },
  { id: 'red-3', style: 'tf', field: 'pharmacology', difficulty: 'easy', prompt: 'Paracetamol is an opioid.', answer: false },
  { id: 'red-4', style: 'tf', field: 'microbiology', difficulty: 'easy', prompt: 'Tuberculosis is caused by a virus.', answer: false },
  { id: 'red-5', style: 'tf', field: 'medicine', difficulty: 'medium', prompt: 'A raised troponin points to heart muscle injury.', answer: true },
  { id: 'red-6', style: 'tf', field: 'surgery', difficulty: 'medium', prompt: 'A strangulated hernia is a surgical emergency.', answer: true },
  { id: 'red-7', style: 'tf', field: 'pediatrics', difficulty: 'easy', prompt: 'Measles is prevented by the MMR vaccine.', answer: true },
  { id: 'red-8', style: 'tf', field: 'obgyn', difficulty: 'easy', prompt: 'A normal pregnancy lasts about 40 weeks from the last period.', answer: true },
  { id: 'red-9', style: 'tf', field: 'biochemistry', difficulty: 'medium', prompt: 'Glycolysis happens in the mitochondria.', answer: false },
  { id: 'red-10', style: 'tf', field: 'pathology', difficulty: 'medium', prompt: 'A benign tumour spreads to distant organs.', answer: false },
];

export const SAMPLE_BANK: FullBank = { questions, boss, redemption };
