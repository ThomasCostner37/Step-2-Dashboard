const DEFAULT_RESOURCES = [
  { group:'UWorld',   name:'Unfinished Peds' },
  { group:'UWorld',   name:'Unfinished EM' },
  { group:'UWorld',   name:'Unfinished Neuro' },
  { group:'UWorld',   name:'Unfinished IM' },
  { group:'AMBOSS',   name:'200 Concepts' },
  { group:'AMBOSS',   name:'High Yield Risk Factors' },
  { group:'AMBOSS',   name:'High Yield Biostats' },
  { group:'AMBOSS',   name:'High Yield Ethics' },
  { group:'AMBOSS',   name:'High Yield Nutrition' },
  { group:'Mehlman',  name:'Arrows' },
  { group:'Mehlman',  name:'Risk Factors' },
];

const STEP2_DATE = '2026-08-12';
const CSSE_DATE  = '2026-06-12';
const GOAL_SCORE = 90;

const SHELF_SCORES = [
  { date:'2025-08-12', label:'FM Shelf 1',      score:82 },
  { date:'2025-09-12', label:'FM Shelf 2',      score:87 },
  { date:'2025-10-06', label:'Peds Shelf 1',    score:87 },
  { date:'2025-10-31', label:'Peds Shelf 2',    score:87 },
  { date:'2025-11-12', label:'Surgery Shelf 1', score:75 },
  { date:'2025-12-19', label:'Surgery Shelf 2', score:83 },
  { date:'2026-02-13', label:'Psych Shelf 1',   score:94 },
  { date:'2026-03-20', label:'OB/GYN Shelf 1',  score:83 },
  { date:'2026-04-20', label:'IM Shelf 1',      score:88 },
  { date:'2026-05-29', label:'IM Shelf 2',      score:84 },
];

// ── EPC Subscore Data ─────────────────────────────────────
const EPC_DATA = {
  'Family Med': {
    epc: 87, avg: 73,
    subscores: [
      { label:'MSK & Skin',                    you:95, avg:77 },
      { label:'Cardiovascular & Respiratory',  you:92, avg:70 },
      { label:'Chronic Care',                  you:88, avg:73 },
      { label:'Health Maint, Pharm & Mgmt',    you:86, avg:72 },
      { label:'Diagnosis incl Foundational',   you:94, avg:74 },
      { label:'Pediatric (0–17)',               you:90, avg:71 },
      { label:'Adult (18–65)',                  you:86, avg:72 },
    ]
  },
  'Pediatrics': {
    epc: 87, avg: 76,
    subscores: [
      { label:'Skin, Neuro & MSK',             you:89, avg:76 },
      { label:'Cardiovascular & Respiratory',  you:86, avg:70 },
      { label:'Female Repro, OB & Endo',       you:94, avg:78 },
      { label:'Applying Foundational Science', you:98, avg:75 },
      { label:'Diagnosis',                     you:81, avg:76 },
      { label:'Health Maint, Pharm & Mgmt',    you:86, avg:77 },
    ]
  },
  'Surgery': {
    epc: 83, avg: 76,
    subscores: [
      { label:'Female Repro, Breast & Endo',   you:80, avg:76 },
      { label:'Applying Foundational Science', you:66, avg:73 },
      { label:'Respiratory System',            you:69, avg:73 },
      { label:'Gastrointestinal System',       you:90, avg:78 },
      { label:'Skin, Neuro & MSK',             you:91, avg:75 },
      { label:'Diagnosis',                     you:89, avg:77 },
      { label:'Pharm, Intervention & Mgmt',    you:83, avg:73 },
      { label:'Cardiovascular System',         you:97, avg:75 },
    ]
  },
  'Psychiatry': {
    epc: 94, avg: 85,
    subscores: [
      { label:'Psychotic Disorders',           you:94, avg:84 },
      { label:'Anxiety Disorders',             you:97, avg:86 },
      { label:'Mood Disorders',                you:98, avg:85 },
      { label:'Substance Use Disorders',       you:90, avg:83 },
      { label:'Diseases of Nervous System',    you:65, avg:77 },
      { label:'Diagnosis incl Foundational',   you:94, avg:85 },
      { label:'Pharm, Intervention & Mgmt',    you:90, avg:82 },
    ]
  },
  'OB/GYN': {
    epc: 83, avg: 78,
    subscores: [
      { label:'Female Reproductive & Breast',  you:83, avg:79 },
      { label:'Obstetric Complications',       you:97, avg:74 },
      { label:'Health Maint, Prevention',      you:73, avg:75 },
      { label:'Applying Foundational Science', you:86, avg:80 },
      { label:'Diagnosis',                     you:89, avg:79 },
      { label:'Pharm, Intervention & Mgmt',    you:82, avg:75 },
    ]
  },
  'Internal Med': {
    epc: 84, avg: 73,
    subscores: [
      { label:'Cardiovascular System',         you:67, avg:72 },
      { label:'Respiratory System',            you:81, avg:72 },
      { label:'Gastrointestinal System',       you:75, avg:73 },
      { label:'Female, Male Repro & Endo',     you:90, avg:73 },
      { label:'Skin, Neuro & MSK',             you:81, avg:74 },
      { label:'Applying Foundational Science', you:93, avg:74 },
      { label:'Diagnosis',                     you:81, avg:73 },
      { label:'Health Maint, Pharm & Mgmt',    you:89, avg:74 },
    ]
  },
};

// ── CMS Question Data ─────────────────────────────────────
const CMS_RAW = [
  { topic:'Endo: thyroid disorders',                   total:14, incorrect:6 },
  { topic:'Behavioral: disorders infancy/childhood',   total:10, incorrect:4 },
  { topic:'Gastro: congenital disorders',              total:7,  incorrect:3 },
  { topic:'Resp: upper airway disorders',              total:9,  incorrect:4 },
  { topic:'Biostat: sensitivity/specificity',          total:8,  incorrect:3 },
  { topic:'OB: obstetric complications',               total:20, incorrect:6 },
  { topic:'OB: labor and delivery',                    total:18, incorrect:5 },
  { topic:'OB: supervision of normal pregnancy',       total:12, incorrect:3 },
  { topic:'OB: systemic disorders/pregnancy',         total:10, incorrect:3 },
  { topic:'F Repro: menstrual/endocrine disorders',    total:22, incorrect:5 },
  { topic:'F Repro: infectious/inflammatory',          total:24, incorrect:4 },
  { topic:'F Repro: malignant/precancerous neoplasms', total:10, incorrect:2 },
  { topic:'F Repro: fertility and infertility',        total:8,  incorrect:3 },
  { topic:'F Repro: benign neoplasms and cysts',       total:10, incorrect:1 },
  { topic:'F Repro: menopause',                        total:7,  incorrect:3 },
  { topic:'Cardio: ischemic heart disease',            total:14, incorrect:2 },
  { topic:'Cardio: infectious disorders',              total:7,  incorrect:2 },
  { topic:'Cardio: peripheral arterial vascular',      total:6,  incorrect:2 },
  { topic:'Cardio: dysrhythmias',                      total:6,  incorrect:2 },
  { topic:'Cardio: congenital disorders',              total:6,  incorrect:2 },
  { topic:'Resp: obstructive airway disease',          total:12, incorrect:3 },
  { topic:'Resp: lower airway inf/inflammatory',       total:10, incorrect:1 },
  { topic:'Gastro: immunologic/inflammatory',          total:10, incorrect:3 },
  { topic:'Gastro: small intestine/colon disorders',   total:12, incorrect:2 },
  { topic:'Gastro: bacterial infections',              total:7,  incorrect:2 },
  { topic:'Blood: anemias: decreased production',      total:8,  incorrect:2 },
  { topic:'Blood: reactions to blood components',      total:5,  incorrect:1 },
  { topic:'CNS: cerebrovascular disease',              total:6,  incorrect:1 },
  { topic:'GenPrin: childhood developmental stages',   total:7,  incorrect:3 },
  { topic:'GenPrin: adulthood lifestyle/changes',      total:8,  incorrect:2 },
  { topic:'SocialSci: consent/informed consent',       total:6,  incorrect:2 },
  { topic:'Multi: fluid/electrolyte disorders',        total:7,  incorrect:2 },
  { topic:'MSK: inflammatory disorders',               total:7,  incorrect:1 },
  { topic:'Renal/Urin: adverse effects of drugs',      total:5,  incorrect:2 },
];



const DEFAULT_TOPICS = [
  { name:'FM — Older Adult (66+)',                    pct:73 },
  { name:'Surgery — Applying Foundational Science',  pct:66 },
  { name:'Surgery — Respiratory System',             pct:69 },
  { name:'Surgery — Female Repro, Breast & Endo',   pct:80 },
  { name:'Surgery — Pharmacotherapy & Mgmt',         pct:83 },
  { name:'Psych — Diseases of Nervous System',       pct:65 },
  { name:'OB/GYN — Health Maint & Prevention',       pct:73 },
  { name:'IM — Cardiovascular System',               pct:67 },
  { name:'IM — Gastrointestinal System',             pct:75 },
  { name:'IM — Respiratory System',                  pct:81 },
  { name:'IM — Diagnosis',                           pct:81 },
  { name:'Endo: thyroid disorders',                  pct:57 },
  { name:'Resp: upper airway disorders',             pct:56 },
  { name:'Gastro: congenital disorders',             pct:57 },
  { name:'Behavioral: disorders infancy/childhood',  pct:60 },
  { name:'GenPrin: childhood developmental stages',  pct:57 },
  { name:'F Repro: menopause',                       pct:57 },
  { name:'Renal/Urin: adverse effects of drugs',     pct:60 },
  { name:'Biostat: sensitivity/specificity',         pct:63 },
  { name:'F Repro: fertility and infertility',       pct:63 },
  { name:'Cardio: peripheral arterial vascular',     pct:67 },
  { name:'Cardio: dysrhythmias',                     pct:67 },
  { name:'Cardio: congenital disorders',             pct:67 },
  { name:'OB: obstetric complications',              pct:70 },
  { name:'OB: systemic disorders in pregnancy',      pct:70 },
  { name:'Gastro: immunologic/inflammatory',         pct:70 },
  { name:'OB: labor and delivery',                   pct:72 },
  { name:'Cardio: infectious disorders',             pct:71 },
  { name:'Multi: fluid/electrolyte disorders',       pct:71 },
  { name:'OB: supervision of normal pregnancy',      pct:75 },
  { name:'Resp: obstructive airway disease',         pct:75 },
  { name:'F Repro: menstrual/endocrine disorders',   pct:77 },
  { name:'Blood: reactions to blood components',     pct:80 },
];
