// Preview data for the dossier shelves (RL6): specialty names and dossier totals from dossiers/shelves.json; misses are sample numbers.
import type { Book } from './BookShelf';

export const BOOKS: Book[] = [
  { key: 'cardiology-vascular', name: 'Cardiology & Vascular', spine: 'Cardiology', total: 25, missed: 3 },
  { key: 'pulmonology', name: 'Pulmonology', spine: 'Pulmonology', total: 19, missed: 0 },
  { key: 'gastroenterology-hepatology', name: 'Gastroenterology & Hepatology', spine: 'Gastro & Liver', total: 45, missed: 5 },
  { key: 'nephrology-urology', name: 'Nephrology & Urology', spine: 'Kidney & Uro', total: 24, missed: 1 },
  { key: 'endocrinology-metabolism', name: 'Endocrinology & Metabolism', spine: 'Endocrine', total: 28, missed: 2 },
  { key: 'hematology-oncology', name: 'Hematology & Oncology', spine: 'Blood & Cancer', total: 41, missed: 4 },
  { key: 'infectious-diseases', name: 'Infectious Diseases', spine: 'Infections', total: 38, missed: 0 },
  { key: 'neurology', name: 'Neurology', spine: 'Neurology', total: 48, missed: 6 },
  { key: 'psychiatry-toxicology', name: 'Psychiatry & Toxicology', spine: 'Psych & Tox', total: 17, missed: 1 },
  { key: 'rheumatology-musculoskeletal', name: 'Rheumatology & Musculoskeletal', spine: 'Joints & Bones', total: 43, missed: 0 },
  { key: 'dermatology', name: 'Dermatology', spine: 'Dermatology', total: 49, missed: 2 },
  { key: 'obstetrics-gynecology', name: 'Obstetrics & Gynecology', spine: 'Obs & Gynae', total: 14, missed: 0 },
  { key: 'pediatrics', name: 'Pediatrics', spine: 'Pediatrics', total: 28, missed: 1 },
  { key: 'genetic-metabolic-disorders', name: 'Genetic & Metabolic Disorders', spine: 'Genetics', total: 68, missed: 3 },
  { key: 'ent-ophthalmology', name: 'ENT & Ophthalmology', spine: 'ENT & Eyes', total: 28, missed: 2 },
  { key: 'emergency-surgery', name: 'Emergency & Surgery', spine: 'ER & Surgery', total: 18, missed: 0 },
];
