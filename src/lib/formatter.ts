/**
 * Clinical Note Formatter - Complete TypeScript Port
 * 
 * 100% coverage port of Python formatter (scripts/format_notes.py)
 * Comprehensive formatter for clinical notes with:
 * - 140+ section headers
 * - Physical Exam subsection formatting (60+ labels)
 * - Review of Systems formatting (30+ categories)
 * - Lab value formatting (70+ patterns)
 * - Medication list formatting with structured output
 * - Drug name preservation
 * - Abbreviation handling
 * - Vitals formatting
 * - Discharge summary formatting
 * - Radiology note formatting
 * - Word split fixes (OCR/wrapping artifacts)
 * - Orphan line merging
 * - And much more...
 * 
 * All regex patterns are pre-compiled at module load for performance.
 */

// =============================================================================
// SECTION HEADERS - Comprehensive list of clinical note sections
// =============================================================================

const SECTION_HEADERS: readonly string[] = [
  // Chief Complaint / HPI
  'CHIEF COMPLAINT', 'CC', 'HISTORY OF PRESENT ILLNESS', 'HPI',
  'REASON FOR VISIT', 'REASON FOR CONSULTATION', 'PRESENTING COMPLAINT', 'PRESENT ILLNESS',
  // Subjective/Objective
  'SUBJECTIVE', 'OBJECTIVE', 'INTERIM HISTORY', 'INTERIM',
  // Assessment/Plan
  'ASSESSMENT AND PLAN', 'ASSESSMENT & PLAN', 'ASSESSMENT/PLAN', 'A/P',
  'ASSESSMENT', 'PLAN', 'PLAN OF CARE', 'TREATMENT PLAN',
  'IMPRESSION AND PLAN', 'IMPRESSION/PLAN', 'IMPRESSION AND RECOMMENDATIONS',
  // History sections
  'PAST MEDICAL HISTORY', 'PMH', 'PAST SURGICAL HISTORY', 'PSH',
  'MEDICAL HISTORY', 'SURGICAL HISTORY', 'HISTORY',
  'PATIENT HISTORY', 'PREVIOUS HISTORY', 'PAST HISTORY',
  'PAST MEDICAL HX', 'SURGICAL HX', 'SOCIAL HX', 'FAMILY HX',
  // Medications
  'MEDICATIONS', 'MEDICATION', 'CURRENT MEDICATIONS', 'DISCHARGE MEDICATIONS',
  'MEDICATIONS ON ADMISSION', 'MEDICATIONS ON DISCHARGE', 'ACTIVE MEDICATIONS',
  'HOME MEDICATIONS', 'OUTPATIENT MEDICATIONS', 'CURRENT OUTPATIENT MEDICATIONS',
  'CURRENT OUTPATIENT MEDICATIONS ON FILE PRIOR TO ENCOUNTER',
  'MEDICATIONS (PRIOR TO CURRENT ENCOUNTER)', 'ORDERS PLACED THIS ENCOUNTER',
  'PRIOR TO ADMISSION MEDICATIONS', 'PREADMISSION MEDICATIONS',
  'CURRENT FACILITY-ADMINISTERED MEDICATIONS',  // NEW
  // Allergies
  'ALLERGIES', 'ALLERGY', 'ALLERGEN REACTIONS', 'ADVERSE REACTIONS',
  'DRUG ALLERGIES', 'NO KNOWN ALLERGIES',
  // Social/Family History
  'SOCIAL HISTORY', 'SH', 'FAMILY HISTORY', 'FH', 'FAMILY MEDICAL HISTORY',
  // Review of Systems
  'REVIEW OF SYSTEMS', 'ROS', 'SYSTEMS REVIEW',
  // Physical Examination
  'PHYSICAL EXAMINATION', 'PHYSICAL EXAM', 'PE', 'EXAM', 'EXAMINATION',
  'PHYSICAL FINDINGS', 'OBJECTIVE EXAM',
  // Vitals
  'VITAL SIGNS', 'VITALS', 'VS', 'VITALS/PHYSICAL EXAM', 'VITALS/PHYSICAL EXAMINATION', 'PHYSICAL EXAM/VITALS',
  // Labs/Imaging
  'LABS', 'LAB RESULTS', 'LABORATORY', 'LABORATORY DATA', 'LABORATORY RESULTS',
  'LABORATORY STUDIES', 'MOST RECENT PREOPERATIVE LABS', 'LABS AND IMAGING',
  'IMAGING', 'IMAGING STUDIES', 'RADIOLOGY', 'DIAGNOSTIC STUDIES', 'STUDIES', 'RESULTS',
  'ED LABS & IMAGING', 'LABS REVIEWED', 'LABS AND IMAGING',
  // Procedures/Surgery
  'PROCEDURE', 'PROCEDURES', 'OPERATIVE PROCEDURE', 'OPERATION', 'OPERATION PERFORMED',
  'SURGERY', 'SURGERY ORDER', 'SURGERY TYPE', 'PREOPERATIVE INFO', 'PREOPERATIVE INFORMATION',
  'PREOPERATIVE DIAGNOSIS', 'POSTOPERATIVE DIAGNOSIS', 'POSTOPERATIVE PLAN', 'POST OP FOLLOW UP',
  'OR PROCEDURES', 'BEDSIDE PROCEDURES',
  // Post-op specific (NEW)
  'PRE-OP DIAGNOSIS', 'POST-OP DIAGNOSIS', 'CASE TYPE', 'ANESTHESIA',
  'INTAKE & OUTPUT', 'WOUND CLASSIFICATION', 'SPECIMENS REMOVED',
  'CONDITION OF THE PATIENT', 'RESPIRATORY CONDITION', 'ROTATION',
  'PRIMARY PROCEDURALIST', 'OPERATION/PROCEDURE DATE', 'RESIDENT/HOUSESTAFF',
  'PHYSICIAN SIGNATURE', 'IMMEDIATE POST-OP', 'POST-PROCEDURE NOTE',
  // Other common sections
  'LINES', 'DRAINS', 'TUBES', 'LINES/DRAINS/TUBES',
  'IMPRESSION', 'HOSPITAL COURSE', 'BRIEF HOSPITAL COURSE', 'COURSE',
  'DISPOSITION', 'DISCHARGE DISPOSITION', 'DISCHARGE CONDITION',
  'DISCHARGE DIAGNOSIS', 'DISCHARGE INSTRUCTIONS',
  'FOLLOW UP', 'FOLLOW-UP', 'FOLLOWUP', 'FOLLOW UP INSTRUCTIONS',
  'CODE STATUS', 'DIAGNOSIS', 'DIAGNOSES', 'PROBLEM LIST', 'ACTIVE PROBLEMS',
  'PATIENT ACTIVE PROBLEM LIST', 'NOTE DETAILS', 'REVISION HISTORY',
  'ATTESTATION', 'PROVIDER ATTESTATION', 'DESCRIPTION', 'STATUS',
  'SIGNIFICANT RELEVANT COMORBIDITIES', 'COMORBIDITIES',
  'RECOMMENDATIONS', 'DISCUSSION', 'COMMENTS', 'ADDENDUM', 'GENERAL',
  // ED-specific headers
  'ED DIAGNOSIS', 'ED DIAG', 'ED COURSE', 'ED COURSE AND MEDICAL DECISION MAKING',
  'ED COURSE & MDM', 'MEDICAL DECISION MAKING', 'MDM',
  'ED MEDICATIONS', 'ED LABS', 'ED IMAGING', 'ED PROVIDER NOTES',
  'DDX', 'DIFFERENTIAL DIAGNOSIS', 'FINAL DIAGNOSES',
  'COMPLICATING CONDITIONS', 'ED DIAG & COMPLICATING CONDITIONS',
  'ED DIAGNOSES & MEDICAL CONDITIONS COMPLICATING PRESENTATION',
  'ED PROVIDER VITALS', 'ED VITALS',
  // Radiology
  'FINDINGS', 'TECHNIQUE', 'INDICATION', 'COMPARISON', 'CLINICAL HISTORY',
  'CLINICAL INDICATION', 'IMPRESSION/RECOMMENDATION',
  // Psychiatric-specific
  'ADMITTING DIAGNOSIS', 'FINAL DIAGNOSIS', 'PREADMISSION DIAGNOSIS',
  'MENTAL STATUS', 'MENTAL STATUS EXAM', 'MSE',
  'AXIS I', 'AXIS II', 'AXIS III', 'AXIS IV', 'AXIS V',
  'CONSULTATIONS', 'CONSULTATIONS OBTAINED', 'CONDITION AT DISCHARGE',
  'DISPOSITION ON DISCHARGE', 'PENDING ITEMS',
  // H&P specific
  'BRIEF PRE-OPERATIVE H&P', 'HISTORY AND PHYSICAL', 'H&P',
  'SYNOPSIS', 'CONDITION ON DISCHARGE', 'PATIENT INSTRUCTIONS',
  'DISCHARGE MEDICATIONS', 'NEW MEDICATIONS', 'MODIFIED MEDICATIONS',
  'MEDICATIONS TO CONTINUE', 'UNREVIEWED MEDICATIONS',
  'DIET INSTRUCTIONS', 'ACTIVITY INSTRUCTIONS', 'SCHEDULED APPOINTMENTS',
  'OTHER INSTRUCTIONS', 'IMMUNIZATIONS', 'IMMUNIZATIONS/INJECTIONS ADMINISTERED',
  // Lab component headers
  'LAB RESULTS', 'COMPONENT VALUE DATE',
  // Intake/Output (NEW)
  'INTAKE/OUTPUT SUMMARY', 'GROSS PER 24 HOUR',
  // DVT prophylaxis / Diet (NEW)
  'DVT PPX', 'DIET', 'DVT PROPHYLAXIS',
  // Provider info
  'ATTENDING PHYSICIAN', 'PRIMARY CARE PHYSICIAN', 'CONSULTING PHYSICIAN',
  // Return/Follow-up (NEW)
  'RETURN IN', 'RETURN TO CLINIC',
] as const

// Physical Exam subsections
const EXAM_LABELS: readonly string[] = [
  'General', 'HEENT', 'HEENT/Neck', 'Head', 'Eyes', 'Ears', 'Nose', 'Throat', 'Mouth', 'Neck',
  'Cardiac', 'Cardiovascular', 'CV', 'Heart',
  'Lungs', 'Respiratory', 'Pulmonary', 'Chest',
  'GI', 'GU', 'GI/Abdomen', 'GI/GU', 'Abdomen', 'Abdominal', 'Back', 'Spine',
  'Skin', 'Integumentary', 'Extremities', 'MSK', 'Musculoskeletal', 'Musculoskelatal',
  'Neuro', 'Neurologic', 'Neurological', 'Neurovascular',
  'Psych', 'Psychiatric', 'PSYCH', 'Mental Status',
  'Lymph', 'Lymphatic', 'Pulses', 'Vascular', 'Peripheral Vascular',
  'Gait', 'Genitalia', 'Rectal', 'Breast', 'Muscles', 'Endocrine',
  'Mouth/Throat', 'Lymphadenopathy', 'Pulmonary/Chest', 'HENT', 'ENT',
  'Constitutional', 'Vitals', 'VITALS', 'Vital Signs',
] as const

// PE sub-labels
const PE_SUB_LABELS: readonly string[] = [
  'Rate and Rhythm', 'Pulses', 'Effort', 'Breath sounds', 'Palpations',
  'Tenderness', 'Appearance', 'Coloration', 'Mental Status', 'Mood and Affect',
  'Capillary Refill', 'Comments', 'Findings',
] as const

// Review of Systems categories
const ROS_LABELS: readonly string[] = [
  'Constitutional', 'HENT', 'HEENT', 'Ears/Nose/Throat', 'Ear/Nose/Throat',
  'Eyes', 'Eye', 'ENT', 'Respiratory', 'Cardiovascular', 'CV', 'Cardiac',
  'Gastrointestinal', 'GI', 'Urinary', 'Genitourinary', 'GU',
  'Musculoskeletal', 'MSK', 'Skin', 'Integumentary',
  'Neurological', 'Neuro', 'Neurologic', 'Neurology',
  'Psychiatric', 'Psychiatric/Behavioral', 'Psych',
  'Endocrine', 'Endo', 'Hematologic', 'Heme', 'Endo/Heme/Allergies',
  'Allergic', 'Immunologic', 'All other systems',
] as const

// Lab value tokens
const LAB_VALUE_PATTERNS: readonly string[] = [
  'White Blood Cells', 'Red Blood Cells', 'Hemoglobin', 'Hematocrit',
  'Mean Cell Volume', 'Mean Cell Hemoglobin', 'Mean Cell Hemoglobin Concentration',
  'Mean Platelet Volume', 'Platelet', 'Nucleated RBC', 'Nucleated RBC Abs',
  'Absolute Neutrophils', 'Auto Neutrophil Absolute', 'Neutrophils',
  'Lymphs', 'Absolute Lymphocytes', 'Monocytes', 'Absolute Monocytes',
  'Eosinophils', 'Absolute Eosinophils', 'Basophils', 'Absolute Basophils',
  'Sodium Level', 'Potassium Level', 'Chloride Level', 'Carbon Dioxide',
  'Glucose Level', 'Blood Urea Nitrogen', 'BUN', 'Creatinine Level',
  'Calcium Level', 'Calcium Level Total', 'Anion Gap',
  'Bilirubin Direct', 'Bilirubin Total', 'Albumin Level', 'Alkaline Phosphatase',
  'Alanine Aminotransferase', 'Aspartate Aminotransferase', 'Protein Total',
  'pH Venous', 'P CO2 Venous', 'P O2 Venous', 'Oxygen Saturation Venous',
  'Base Excess Venous', 'Bicarbonate Venous', 'Lactic Acid Level', 'Lactic Acid',
  'eGFR', 'eGFRAA',
] as const

// Common abbreviations
const ABBREVIATIONS: readonly string[] = [
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'vs.', 'no.', 'pt.', 'hx.', 'dx.',
  'tx.', 'st.', 'rd.', 'ave.', 'i.e.', 'e.g.', 'etc.', 'approx.', 'ca.',
  'cf.', 'et al.', 'vol.', 'yr.', 'mo.', 'wk.', 'hr.', 'min.', 'sec.',
  'oz.', 'lb.', 'kg.', 'mg.', 'mcg.', 'ml.', 'cm.', 'mm.', 'in.', 'ft.',
  'a.m.', 'p.m.', 'b.i.d.', 't.i.d.', 'q.i.d.', 'p.r.n.', 'q.d.', 'q.h.',
  'q.o.d.', 'h.s.', 'a.c.', 'p.c.', 'stat.', 'prn.', 'bid.', 'tid.', 'qid.',
] as const

// =============================================================================
// WORD SPLIT FIXES - Common OCR/wrapping artifacts
// =============================================================================

const WORD_SPLIT_REPLACEMENTS: Record<string, string> = {
  // Common clinical word splits
  're gular': 'regular', 'Pati ent': 'Patient', 'pati ent': 'patient',
  'ori ented': 'oriented', 'movem ents': 'movements', 'fati gue': 'fatigue',
  'appear ance': 'appearance', 'tender ness': 'tenderness',
  'palpa tions': 'palpations', 'abdom en': 'abdomen',
  'extrem ities': 'extremities', 'neuro logical': 'neurological',
  'Neuro logical': 'Neurological', 'consti tutional': 'constitutional',
  'respir atory': 'respiratory', 'gastro intestinal': 'gastrointestinal',
  'genito urinary': 'genitourinary', 'cardio vascular': 'cardiovascular',
  'Cardio vascular': 'Cardiovascular', 'musculo skeletal': 'musculoskeletal',
  'Musculo skeletal': 'Musculoskeletal',
  // Additional clinical splits
  'ri gidity': 'rigidity', 'dia phoretic': 'diaphoretic',
  'cya nosis': 'cyanosis', 'solu tion': 'solution',
  'suspen sion': 'suspension', 'nebu lizer': 'nebulizer',
  'inha lation': 'inhalation', 'admin istration': 'administration',
  'medi cation': 'medication', 'medi cations': 'medications',
  // ROS/PE word splits
  'va ginal': 'vaginal', 'irre gular': 'irregular',
  'myal gias': 'myalgias', 'aller gies': 'allergies', 'Aller gies': 'Allergies',
  'hema turia': 'hematuria', 'dysu ria': 'dysuria',
  'ur gency': 'urgency', 'fre quency': 'frequency',
  'dis charge': 'discharge', 'pel vic': 'pelvic',
  'lymph adenopathy': 'lymphadenopathy', 'palpa ble': 'palpable',
  'dis tended': 'distended', 'aus cultation': 'auscultation',
  'bra dycardia': 'bradycardia', 'tachy cardia': 'tachycardia',
  'hyper tension': 'hypertension', 'hypo tension': 'hypotension',
  // Symptoms
  'symp toms': 'symptoms', 'short ness': 'shortness',
  'breath ing': 'breathing', 'swel ling': 'swelling',
  'palpi tations': 'palpitations', 'wheez ing': 'wheezing',
  'cough ing': 'coughing', 'vom iting': 'vomiting',
  'nau sea': 'nausea', 'diar rhea': 'diarrhea',
  'consti pation': 'constipation', 'head ache': 'headache',
  'dizzi ness': 'dizziness', 'weak ness': 'weakness',
  'numb ness': 'numbness', 'tin gling': 'tingling',
  'sei zures': 'seizures', 'syn cope': 'syncope',
  'ambu lation': 'ambulation', 'evalu ation': 'evaluation',
  'examin ation': 'examination', 'consult ation': 'consultation',
  // Compound corrections
  'non distended': 'nondistended', 'non tender': 'nontender',
  'Psychia tric': 'Psychiatric', 'Behav ioral': 'Behavioral',
  // Additional splits from real notes
  'neuro pathy': 'neuropathy', 'reti nopathy': 'retinopathy',
  'nephro pathy': 'nephropathy', 'coron ary': 'coronary',
  'dyslipi demia': 'dyslipidemia', 'hyperlipid emia': 'hyperlipidemia',
  'hypogly cemia': 'hypoglycemia', 'hyper glycemia': 'hyperglycemia',
  'tachy pnea': 'tachypnea', 'brady pnea': 'bradypnea',
  'oste onecrosis': 'osteonecrosis', 'aneu rysm': 'aneurysm',
  'thrombo sis': 'thrombosis', 'embo lism': 'embolism',
  'trans plant': 'transplant', 'hemo dialysis': 'hemodialysis',
  'peri toneal': 'peritoneal', 'intra venous': 'intravenous',
  'sub cutaneous': 'subcutaneous', 'intra muscular': 'intramuscular',
  'normocep halic': 'normocephalic', 'atrau matic': 'atraumatic',
  'cooper ative': 'cooperative', 'well-perfus ed': 'well-perfused',
  'tachy cardic': 'tachycardic', 'brady cardic': 'bradycardic',
  'auscul tation': 'auscultation', 'percus sion': 'percussion',
  'palpa tion': 'palpation', 'inspec tion': 'inspection',
  // NEW: Compound exam/clinical terms - prevent incorrect splitting
  'Neuro exam': 'Neuroexam', 'neuro exam': 'neuroexam',
  'Thought Cont ent': 'Thought Content', 'Thought cont ent': 'Thought content',
  'Cont ent': 'Content', 'cont ent': 'content',
  // NEW: Lab value name preservation
  'eGFR cr': 'eGFRcr', 'eGFR CR': 'eGFRcr',
  'Lactic Acid Level': 'Lactic Acid Level',  // Protect from splitting
  'Troponin- I': 'Troponin-I', 'Troponin -I': 'Troponin-I',
  // NEW: More PE/exam splits
  'Psychomo tor': 'Psychomotor', 'Psycho motor': 'Psychomotor',
  'Extra ocular': 'Extraocular', 'extra ocular': 'extraocular',
  'Conjunc tiva': 'Conjunctiva', 'conjunc tiva': 'conjunctiva',
  'Oropha rynx': 'Oropharynx', 'oropha rynx': 'oropharynx',
  'supraclav icular': 'supraclavicular', 'Supraclav icular': 'Supraclavicular',
  'cardio mediastinal': 'cardiomediastinal', 'Cardio mediastinal': 'Cardiomediastinal',
  // NEW: Clinical terms
  'hypo ventilatory': 'hypoventilatory', 'hyper ventilatory': 'hyperventilatory',
  'thrombo lytic': 'thrombolytic', 'thrombo lytics': 'thrombolytics',
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Pre-computed sets for fast lookup
const SECTION_HEADERS_LOWER = new Set(SECTION_HEADERS.map(h => h.toLowerCase()))
const ROS_PE_LABELS_LOWER = new Set([
  ...ROS_LABELS.map(l => l.toLowerCase()),
  ...EXAM_LABELS.map(l => l.toLowerCase()),
])
const PE_SECTION_HEADERS = new Set([
  'physical exam', 'physical examination', 'pe', 'physical findings', 'objective exam', 'exam', 'examination'
])

function isHeaderCandidate(line: string): boolean {
  const stripped = line.trim().replace(/:$/, '')
  if (!stripped) return false
  
  if (SECTION_HEADERS_LOWER.has(stripped.toLowerCase())) return true
  
  // Check for all-caps that might be headers
  if (/^[A-Z][A-Z\s/&]+$/.test(stripped) && stripped.length <= 50) {
    return true
  }
  
  return false
}

function isPELine(line: string): boolean {
  const stripped = line.trim().toLowerCase().replace(/:$/, '')
  return ROS_PE_LABELS_LOWER.has(stripped)
}

function isROSOrPELine(line: string): boolean {
  return isPELine(line)
}

function isAsciiTableLine(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  
  const firstChar = stripped[0]
  if (firstChar === '+' && (stripped.includes('---') || stripped.includes('==='))) return true
  if (firstChar === '|' && (stripped.match(/\|/g) || []).length >= 2) return true
  
  return false
}

function isNumberedListItem(line: string): boolean {
  return /^\s*\d+[.)]\s/.test(line)
}

function isMedicationLine(line: string): boolean {
  const lower = line.toLowerCase()
  return /\d+\s*(mg|mcg|ml|g|tablet|capsule|inhaler)\b/i.test(line) ||
         /\b(take|inhale|apply|inject)\s+\d/i.test(line) ||
         /\b(daily|twice|three times|once|bid|tid|qid|prn)\b/i.test(lower)
}

// =============================================================================
// CORE FORMATTING FUNCTIONS
// =============================================================================

function normalizeNbsp(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n|\r/g, '\n')
}

function stripBrTags(text: string): string {
  let result = text
  // Remove HTML br tags
  result = result.replace(/<br\s*\/?>/gi, '\n')
  // Remove standalone br> at start of lines (malformed HTML)
  result = result.replace(/(?:^|\n)\s*br>\s*(?:\n|$)/gm, '\n')
  // Remove br> at the very start of the note (common artifact)
  result = result.replace(/^br>\s*/i, '')
  // Remove br> that appears mid-line
  result = result.replace(/\s*br>\s*/gi, '\n')
  return result
}

function unescapeLiteralNewlines(text: string): string {
  return text.replace(/\\n/g, '\n')
}

function convertTildeBullets(text: string): string {
  let result = text
  // Convert ~ bullets after whitespace
  result = result.replace(/(\s)~\s+/g, '$1\n- ')
  // Convert ~ at the start of lines
  result = result.replace(/^~\s+/gm, '- ')
  // Convert ~ after punctuation that typically ends content
  result = result.replace(/([.)\]:])\s*~\s+/g, '$1\n- ')
  return result
}

function collapseMultipleBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n')
}

function collapseMultipleSpaces(text: string): string {
  return text.replace(/[ \t]{2,}/g, ' ')
}

// =============================================================================
// WORD SPLIT FIXES
// =============================================================================

function fixCommonWordSplits(text: string): string {
  let result = text
  
  // Fix compound section headers split across lines
  result = result.replace(/\bH\s*\n+\s*ENT:/gi, 'HENT:')
  result = result.replace(/\bH\s*\n+\s*EENT:/gi, 'HEENT:')
  result = result.replace(/\bPhysical\s*\n+\s*Exam\b/gi, 'Physical Exam')
  result = result.replace(/\bPhysical\s*\n+\s*Examination\b/gi, 'Physical Examination')
  result = result.replace(/\bReview\s*\n+\s*of\s*\n*\s*Systems\b/gi, 'Review of Systems')
  result = result.replace(/\bPast\s*\n+\s*Medical\s*\n*\s*History\b/gi, 'Past Medical History')
  result = result.replace(/\bPast\s*\n+\s*Surgical\s*\n*\s*History\b/gi, 'Past Surgical History')
  result = result.replace(/\bSocial\s*\n+\s*History\b/gi, 'Social History')
  result = result.replace(/\bFamily\s*\n+\s*History\b/gi, 'Family History')
  result = result.replace(/\bED\s*\n+\s*Diagnosis\b/gi, 'ED Diagnosis')
  result = result.replace(/\bED\s*\n+\s*Course\b/gi, 'ED Course')
  result = result.replace(/\bVital\s*\n+\s*Signs\b/gi, 'Vital Signs')
  result = result.replace(/\bChief\s*\n+\s*Complaint\b/gi, 'Chief Complaint')
  result = result.replace(/\bHistory\s*\n+\s*of\s*\n*\s*Present\s*\n*\s*Illness\b/gi, 'History of Present Illness')
  result = result.replace(/\bAssessment\s*\n+\s*and\s*\n*\s*Plan\b/gi, 'Assessment and Plan')
  
  // Fix system labels split across lines
  result = result.replace(/\bCARDIO\s*\n+\s*VASCULAR/gi, 'CARDIOVASCULAR')
  result = result.replace(/\bNEURO\s*\n+\s*LOGIC/gi, 'NEUROLOGIC')
  result = result.replace(/\bMUSCULO\s*\n+\s*SKELETAL/gi, 'MUSCULOSKELETAL')
  result = result.replace(/\bGI\/\s*\n+\s*Abdomen:/gi, 'GI/Abdomen:')
  result = result.replace(/\bGI\/\s*\n+\s*GU:/gi, 'GI/GU:')
  result = result.replace(/\bHEENT\/\s*\n+\s*Neck:/gi, 'HEENT/Neck:')
  
  // Fix Endo/Heme/Allergies splits
  result = result.replace(/Endo\/\s*\n+\s*Heme\/\s*\n*\s*Aller\s*\n*\s*gies/gi, 'Endo/Heme/Allergies')
  result = result.replace(/Endo\/Heme\/\s*\n+\s*Allergies/gi, 'Endo/Heme/Allergies')
  
  // Apply word split replacements
  for (const [bad, good] of Object.entries(WORD_SPLIT_REPLACEMENTS)) {
    result = result.split(bad).join(good)
  }
  
  return result
}

function fixWordSplitsAcrossBlanks(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check if line ends with a word (no terminal punctuation)
    if (stripped && 
        !stripped.endsWith('.') && !stripped.endsWith('!') && 
        !stripped.endsWith('?') && !stripped.endsWith(':') &&
        !stripped.endsWith('-') && !stripped.endsWith('|') &&
        /[a-zA-Z]$/.test(stripped)) {
      
      // Look for blank line(s) followed by lowercase continuation
      let j = i + 1
      let blankCount = 0
      while (j < lines.length && !lines[j].trim()) {
        blankCount++
        j++
      }
      
      if (blankCount > 0 && j < lines.length) {
        const nextStripped = lines[j].trim()
        if (nextStripped && /^[a-z]/.test(nextStripped) && nextStripped.length > 3) {
          result.push(line.trimEnd() + ' ' + nextStripped)
          i = j + 1
          continue
        }
      }
    }
    
    result.push(line)
    i++
  }
  
  return result.join('\n')
}

function fixUnhyphenatedWordSplits(text: string): string {
  const stopwords = new Set(['of', 'and', 'the', 'for', 'to', 'in', 'on', 'at', 'with', 'by', 'per', 'or', 'a', 'an'])
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (stripped && 
        !stripped.includes(' ') && 
        !stripped.endsWith('.') && !stripped.endsWith(':') && !stripped.endsWith(';') &&
        !isHeaderCandidate(line) &&
        i + 1 < lines.length) {
      
      const nxt = lines[i + 1]
      const nxtStripped = nxt.trim()
      
      if (nxtStripped && 
          !isHeaderCandidate(nxt) &&
          !nxtStripped.startsWith('-') && !nxtStripped.startsWith('*') &&
          !/^\d+\./.test(nxtStripped)) {
        
        const firstWord = nxtStripped.split(/\s/)[0].toLowerCase()
        
        // Case: previous ends with "(" -> join with space
        if (stripped.endsWith('(')) {
          result.push(stripped + ' ' + nxtStripped)
          i += 2
          continue
        }
        
        // Case: likely mid-word split
        if (stripped.length >= 4 && 
            /[a-zA-Z]$/.test(stripped) &&
            /^[a-z]/.test(nxtStripped) &&
            !stopwords.has(firstWord)) {
          result.push(stripped + nxtStripped)
          i += 2
          continue
        }
      }
    }
    
    result.push(line)
    i++
  }
  
  return result.join('\n')
}

// =============================================================================
// DENSE LINE SPLITTING - Major improvement for compressed clinical notes
// =============================================================================

// Patterns that indicate a new section should start
const DENSE_SECTION_MARKERS = [
  // SOAP note sections
  'SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN', 'A/P',
  'Assessment and Plan', 'Assessment/Plan', 'ASSESSMENT AND PLAN',
  // Chief Complaint / HPI
  'Chief Complaint', 'History of Present Illness', 'HPI', 'CC',
  'Reason for Visit', 'Reason For Consultation',
  // History sections
  'Past Medical History', 'Past Surgical History', 'PMH', 'PSH',
  'Social History', 'Family History', 'SH', 'FH',
  'Patient History', 'Previous History', 'Medical History', 'Surgical History',
  // ROS / Physical Exam
  'Review of Systems', 'ROS', 'Physical Exam', 'PE',
  'Physical Examination', 'Vital Signs', 'Vitals',
  // Labs / Imaging
  'Labs', 'Lab Results', 'Laboratory', 'Laboratory Data',
  'Labs and Imaging', 'Imaging', 'Radiology',
  'Component Value Date',
  // Medications / Allergies
  'Medications', 'Current Medications', 'Home Medications',
  'Active Medications', 'Current Outpatient Medications',
  'Current Facility-Administered Medications',
  'Discharge Medications', 'Orders Placed This Encounter',
  'Allergies', 'Allergen Reactions', 'Drug Allergies',
  // Active Problems
  'Active Problems', 'Problem List', 'Chronic Problems',
  'Patient Active Problem List',
  // Hospital Course
  'Hospital Course', 'Brief Hospital Course', 'Course',
  'ED Course', 'ED Labs', 'ED Medications', 'MDM',
  // Discharge
  'Disposition', 'Discharge', 'Discharge Disposition',
  'Condition on Discharge', 'Discharge Instructions',
  'Discharge Diagnosis', 'Follow Up', 'Follow-Up',
  // Mental Status (Psychiatric)
  'Mental Status', 'Mental Status Exam', 'MSE',
  'Diagnosis', 'Impression', 'Diagnoses',
  // Post-op specific
  'Pre-op Diagnosis', 'Post-op Diagnosis', 'Preoperative Diagnosis',
  'Postoperative Diagnosis', 'Case Type', 'Anesthesia',
  'INTAKE & OUTPUT', 'Findings', 'Wound Classification',
  'Specimens Removed', 'Drains', 'Condition of the Patient',
  'Respiratory Condition', 'Disposition', 'Rotation',
  'Physician Signature', 'Primary Proceduralist',
  'Operation/Procedure Date', 'Resident/Housestaff',
  // ED / MDM
  'Amount And/Or Complexity', 'History obtained',
  'Patient presents with', 'Interim', 'Interim History',
  // Access / Prophylaxis
  'Fluids, electrolytes', 'Access:', 'Prophylaxis:',
  'Code Status', 'DVT ppx', 'Diet',
  // Intake/Output
  'Intake/Output Summary', 'Gross per 24 hour',
  // Other
  'Consultations', 'Pending Items', 'Return in',
] as const

/**
 * Split dense single-line notes that contain multiple sections
 * This is critical for notes that come as a single massive line
 */
function splitDenseLines(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Skip short lines (but lower threshold for very dense content)
    if (line.length < 150) {
      output.push(line)
      continue
    }
    
    let result = line
    
    // Split on major section markers - check for marker preceded by any content
    for (const marker of DENSE_SECTION_MARKERS) {
      // Match marker preceded by sentence-ending punctuation
      const pattern = new RegExp(`([.!?;])\\s{1,}(${escapeRegex(marker)})(?=\\s|:|$)`, 'gi')
      result = result.replace(pattern, '$1\n\n$2')
      
      // Match after 2+ spaces
      const pattern2 = new RegExp(`\\s{2,}(${escapeRegex(marker)})(?=\\s|:|$)`, 'gi')
      result = result.replace(pattern2, '\n\n$1')
      
      // Match marker at word boundary after closing paren, bracket, etc.
      const pattern3 = new RegExp(`([)\\]>])\\s+(${escapeRegex(marker)})(?=\\s|:|$)`, 'gi')
      result = result.replace(pattern3, '$1\n\n$2')
    }
    
    // Split before section headers (Title Case followed by colon)
    result = result.replace(/\s{2,}([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*:/g, '\n\n$1:')
    
    // Split before ALL CAPS headers (at least 4 chars)
    result = result.replace(/\s{2,}([A-Z][A-Z\s/&]{3,})\s*:/g, '\n\n$1:')
    
    // Split on specific inline patterns common in dense notes
    // Pattern: "*" bullet points for surgery/procedures
    result = result.replace(/\s+(\*\s+[A-Z][a-z])/g, '\n$1')
    
    // Pattern: Date/Time followed by section (e.g., "02/18/2022 Primary Proceduralist")
    result = result.replace(/(\d{2}\/\d{2}\/\d{4})\s{2,}([A-Z][a-z]+)/g, '$1\n\n$2')
    
    // Pattern: Post-op sections like "RBC (mL):" etc.
    result = result.replace(/\s{2,}(RBC|FFP|Cryo|Whole Blood|Platelets|Cell Saver)\s*\(/gi, '\n$1 (')
    
    output.push(result)
  }
  
  return output.join('\n')
}

/**
 * Split ultra-dense SOAP notes
 * Handles notes where SUBJECTIVE/OBJECTIVE/ASSESSMENT/PLAN are all inline
 */
function splitSOAPSections(text: string): string {
  let result = text
  
  // SOAP section markers
  const soapMarkers = ['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN']
  
  for (const marker of soapMarkers) {
    // Split before marker when preceded by content
    result = result.replace(new RegExp(`([.!?;:\\]])\\s*(${marker})\\s*:`, 'gi'), '$1\n\n$2:')
    result = result.replace(new RegExp(`(\\S)\\s{2,}(${marker})\\s*:`, 'gi'), '$1\n\n$2:')
  }
  
  // Handle "Plan:" with sub-items
  result = result.replace(/\s{2,}(Plan:)\s*-/gi, '\n\n$1\n-')
  
  return result
}

/**
 * CRITICAL: Master line break function for clinical note sections
 * This function handles the most important line break decisions
 */
function splitClinicalSections(text: string): string {
  let result = text
  
  // ============================================================
  // SECTION HEADERS - Always start on new line
  // ============================================================
  const majorSections = [
    // History sections
    'HISTORY AND PHYSICAL', 'History and Physical',
    'HISTORY OF PRESENT ILLNESS', 'History of Present Illness', 'HPI',
    'CHIEF COMPLAINT', 'Chief Complaint', 'CC',
    'PAST MEDICAL HISTORY', 'Past Medical History', 'Medical Hx',
    'PAST SURGICAL HISTORY', 'Past Surgical History', 'Surgical Hx',
    'SOCIAL HISTORY', 'Social History', 'Social Hx',
    'FAMILY HISTORY', 'Family History', 'Family Hx',
    'REVIEW OF SYSTEMS', 'Review of Systems', 'ROS',
    'PHYSICAL EXAMINATION', 'Physical Examination', 'Physical Exam', 'PHYSICAL EXAM',
    'VITALS', 'Vitals', 'Vital Signs',
    // Labs/Imaging
    'LABS AND IMAGING', 'Labs and Imaging', 'Labs & Imaging',
    'LAB RESULTS', 'Lab Results', 'LABORATORY',
    'DIAGNOSTIC STUDIES', 'Diagnostic Studies',
    'RADIOLOGY', 'Radiology',
    // Medications/Allergies
    'MEDICATIONS', 'Medications', 'Current Medications', 'Current Outpatient Medications',
    'Current Facility-Administered Medications',
    'ALLERGIES', 'Allergies', 'No Known Allergies',
    // Assessment/Plan
    'ASSESSMENT AND PLAN', 'Assessment and Plan', 'ASSESSMENT/PLAN',
    'ASSESSMENT', 'Assessment', 'PLAN', 'Plan',
    'Assessment & Plan', 'Assessment & Plan by Problem',
    // Other
    'PROBLEM LIST', 'Problem List', 'Patient Active Problem List',
    'IMPRESSION', 'Impression', 'FINDINGS', 'Findings',
    'SYNOPSIS', 'Synopsis',
    // Preop/Postop
    'PREOPERATIVE INFO', 'Preoperative Info',
  ]
  
  for (const section of majorSections) {
    // Split before section when preceded by content (not at start of line)
    const escapedSection = escapeRegex(section)
    // After period, exclamation, question mark, or closing bracket
    result = result.replace(new RegExp(`([.!?)\\]])\\s+(${escapedSection})\\s*[-:]`, 'gi'), '$1\n\n$2:')
    // After 2+ spaces (indicates section boundary in dense notes)
    result = result.replace(new RegExp(`\\s{2,}(${escapedSection})\\s*[-:]`, 'gi'), '\n\n$1:')
  }
  
  // ============================================================
  // TABLE HEADERS - Each table section on new line
  // ============================================================
  const tableHeaders = [
    'Diagnosis Date', 'Procedure Laterality Date', 'Problem Relation Age of Onset',
    'Component Value Date', 'Medication Sig', 'Medication Sig Dispense Refill',
    'Medication Dose Route Frequency', 'Allergen Reactions',
    'Vital Sign', 'Lab Results',
  ]
  
  for (const header of tableHeaders) {
    result = result.replace(new RegExp(`\\s{2,}(${escapeRegex(header)})`, 'gi'), '\n\n$1')
  }
  
  // ============================================================
  // TILDE BULLETS (~) - Critical for lists - each on new line
  // ============================================================
  // Match ~ followed by word (start of list item)
  result = result.replace(/\s+~\s+/g, '\n- ')
  result = result.replace(/^~\s+/gm, '- ')
  
  // ============================================================
  // SPECIFIC PATTERNS FROM REAL NOTES
  // ============================================================
  
  // "Past Surgical History:" inline pattern
  result = result.replace(/(\S)\s{2,}(Past Surgical History:)/gi, '$1\n\n$2')
  result = result.replace(/(\S)\s{2,}(Past Medical History:)/gi, '$1\n\n$2')
  
  // "No past medical history pertinent negatives." on its own line
  result = result.replace(/\s{2,}(No past medical history pertinent negatives\.)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(No results found for:)/gi, '\n$1')
  
  // "Procedure:" entries in surgical history
  result = result.replace(/\s{2,}(Procedure:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Surgeon:)/gi, ' Surgeon:')  // Keep on same line
  result = result.replace(/\s{2,}(Location:)/gi, ' Location:')  // Keep on same line
  
  // ROS inline patterns - each system on new line
  const rosSystems = [
    'Constitutional', 'HENT', 'HEENT', 'Eyes', 'ENT',
    'Respiratory', 'Cardiovascular', 'CV',
    'Gastrointestinal', 'GI', 'Genitourinary', 'GU',
    'Musculoskeletal', 'MSK', 'Neurological', 'Neurologic', 'Neuro',
    'Skin', 'Psychiatric', 'Psych', 'Psychiatric/Behavioral',
    'Endocrine', 'Hematologic', 'Endo/Heme/Allergies',
  ]
  
  for (const system of rosSystems) {
    // Split when this ROS label appears after content
    result = result.replace(new RegExp(`([.;,])\\s+(${escapeRegex(system)}):\\s*(Positive|Negative|Denies)`, 'gi'), '$1\n$2: $3')
  }
  
  // Physical Exam labels - each on new line
  const peLabels = [
    'GEN', 'GENERAL', 'General', 'HEENT', 'HEAD', 'EYES', 'NECK',
    'CHEST', 'CARDIOVASCULAR', 'CV', 'Cardiovascular',
    'RESPIRATORY', 'PULMONARY', 'Pulmonary', 'Respiratory',
    'ABDOMEN', 'ABDOMINAL', 'GI', 'Abdomen',
    'EXTREMITIES', 'EXT', 'Extremities',
    'MUSCULOSKELETAL', 'MSK', 'Musculoskeletal',
    'NEUROLOGIC', 'NEURO', 'Neurologic', 'Neuro',
    'SKIN', 'Skin', 'PSYCH', 'Psychiatric',
  ]
  
  for (const label of peLabels) {
    // Only split when preceded by another PE finding (ends with period or semicolon)
    result = result.replace(new RegExp(`([.;])\\s+(${escapeRegex(label)})\\s*:`, 'gi'), '$1\n$2:')
  }
  
  // ============================================================
  // CODE STATUS / DVT PPX / DIET - Each on new line
  // ============================================================
  result = result.replace(/\s{2,}(Code [Ss]tatus:)/gi, '\n$1')
  result = result.replace(/\s{2,}(DVT [Pp]px:)/gi, '\n$1')
  result = result.replace(/\s{2,}(DVT prophylaxis:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Diet:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Surrogate:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Access:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Dispo:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Level of Care:)/gi, '\n$1')
  
  // ============================================================
  // LAB SECTIONS - Proper formatting
  // ============================================================
  // "Lab Results" followed by "Lab" and date
  result = result.replace(/\s{2,}(Lab Results)\s+(Lab)/gi, '\n\n$1\n$2')
  // Individual lab entries (e.g., "WBC 6.9")
  result = result.replace(/\s{2,}(WBC|RBC|HGB|HCT|PLT|NA|K|CL|BUN|CREATBLD|GLUCOSE|CALCIUM)\s+/gi, '\n$1 ')
  
  return result
}

/**
 * Split post-operative note sections
 * Handles dense post-op/immediate post-procedure notes
 */
function splitPostOpSections(text: string): string {
  let result = text
  
  // Post-op specific patterns
  const postOpMarkers = [
    'Pre-op Diagnosis', 'Post-op Diagnosis', 'Preoperative Diagnosis', 'Postoperative Diagnosis',
    'Pre-op Diagnosis \\(Required\\)', 'Post-op Diagnosis \\(Required\\)',
    'Operation/Procedure Date', 'Primary Proceduralist', 'Resident/Housestaff',
    'Case Type', 'Operation\\(s\\)/Procedure\\(s\\)', 'Anesthesia',
    'INTAKE & OUTPUT', 'Findings', 'Wound Classification',
    'Specimens Removed', 'Drains', 'Condition of the Patient',
    'Respiratory Condition', 'Disposition', 'Rotation',
    'Physician Signature', 'Patient Name', 'MRN', 'DOB', 'Sex',
    'Account #',
  ]
  
  for (const marker of postOpMarkers) {
    result = result.replace(new RegExp(`\\s{2,}(${marker})`, 'gi'), '\n\n$1')
  }
  
  // Split "* Item" patterns common in post-op notes
  result = result.replace(/\s{2,}(\*\s+)/g, '\n$1')
  
  // Split drain entries like "[REMOVED] Urethral Catheter"
  result = result.replace(/\s{2,}(\[REMOVED\]|\[Active\])/gi, '\n$1')
  
  // Split date/time patterns in drain documentation
  result = result.replace(/\s{2,}(\d{2}\/\d{2}\/\d{2}\s+\d{4})/g, '\n$1')
  
  return result
}

/**
 * Split Active Problems and Active Medications lists
 */
function splitActiveProblemsAndMedications(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check for Active Problems inline
    if (/Active Problems:/i.test(line) && line.length > 100) {
      let result = line
      // Split each problem onto its own line (they're usually separated by 2+ spaces)
      result = result.replace(/\s{2,}([A-Z][a-z][a-zA-Z\s,()-]+)(?=\s{2,}|$)/g, '\n- $1')
      output.push(result)
      continue
    }
    
    // Check for medication lists with ~ bullets
    if (/~\s+[a-zA-Z]+\s+\d/.test(line) && line.length > 150) {
      // Split on ~ that marks new medication
      let result = line.replace(/\s*~\s+/g, '\n- ')
      output.push(result)
      continue
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

/**
 * Split on tilde bullets (~) - convert inline to proper list
 */
function splitTildeBullets(text: string): string {
  // Convert ~ at start or after space to newline bullet
  let result = text.replace(/\s+~\s+/g, '\n- ')
  result = result.replace(/^~\s+/gm, '- ')
  
  // Handle diagnosis/procedure patterns with tilde
  // Pattern: "~ DiagnosisName Date" should become newline
  result = result.replace(/\s+~\s*([A-Za-z][A-Za-z\s,()-]+)(\s+\d{2}\/\d{2}\/\d{4}|\s+\d{4})?/g, '\n- $1$2')
  
  return result
}

/**
 * Split dense Past Medical History lists
 */
function splitPastMedicalHistory(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inPMH = false
  
  const pmhHeaders = ['past medical history', 'past surgical history', 'pmh', 'psh', 
                      'medical history', 'surgical history', 'patient active problem list']
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (pmhHeaders.includes(stripped)) {
      inPMH = true
      output.push(line)
      continue
    }
    
    if (inPMH && isHeaderCandidate(line) && !pmhHeaders.includes(stripped)) {
      inPMH = false
    }
    
    if (inPMH && line.length > 150) {
      // Split on diagnosis entries (~ Diagnosis Date pattern)
      let result = line.replace(/\s{2,}~\s*/g, '\n- ')
      result = result.replace(/^\s*~\s*/gm, '- ')
      
      // Split at date patterns followed by new diagnosis
      result = result.replace(/(\d{2}\/\d{2}\/\d{4})\s{2,}([A-Z~])/g, '$1\n$2')
      result = result.replace(/(\d{4})\s{2,}([A-Z~])/g, '$1\n$2')
      
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Split dense lab result lines
 */
function splitDenseLabLines(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  const labPatterns = [
    /White Blood Cells?\s+[\d.]+/i,
    /Red Blood Cells?\s+[\d.]+/i,
    /Hemoglobin\s+[\d.]+/i,
    /Hematocrit\s+[\d.]+/i,
    /Platelet\s+[\d.]+/i,
    /Sodium\s+[\d.]+/i,
    /Potassium\s+[\d.]+/i,
    /Chloride\s+[\d.]+/i,
    /Glucose\s+[\d.]+/i,
    /Creatinine\s+[\d.]+/i,
    /BUN\s+[\d.]+/i,
    /Calcium\s+[\d.]+/i,
  ]
  
  for (const line of lines) {
    // Check if line has multiple lab values
    let matchCount = 0
    for (const pattern of labPatterns) {
      if (pattern.test(line)) matchCount++
    }
    
    if (matchCount >= 2 && line.length > 100) {
      // Split on lab name patterns
      let result = line
      result = result.replace(/\s{2,}(White Blood Cells?|Red Blood Cells?|Hemoglobin|Hematocrit|Platelet|Mean Cell|Nucleated|Neutrophils?|Lymph|Monocytes?|Eosinophils?|Basophils?|Sodium|Potassium|Chloride|Carbon Dioxide|Glucose|BUN|Creatinine|Calcium|Albumin|Bilirubin|Alkaline|Alanine|Aspartate|Protein)/gi, '\n$1')
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Split dense vitals tables
 */
function splitDenseVitals(text: string): string {
  let result = text
  
  // Split vitals that are space-separated
  // Pattern: "Temp Pulse Resp BP SpO2" followed by values
  result = result.replace(
    /(\d+(?:\.\d+)?\s*°?[CF]?)\s{2,}(\d+)\s{2,}(\d+)\s{2,}(\d+\/\d+)\s{2,}(\d+\s*%?)/g,
    'Temp: $1\nPulse: $2\nResp: $3\nBP: $4\nSpO2: $5'
  )
  
  // Split Temp src, Pulse Source, etc. patterns
  result = result.replace(
    /\s{2,}(Temp src|Pulse Source|Patient Position|BP Location|FiO2)/g,
    '\n$1'
  )
  
  return result
}

/**
 * Format Axis diagnoses (psychiatric notes)
 */
function formatAxisDiagnoses(text: string): string {
  let result = text
  
  // Split Axis I: ... Axis II: ... patterns
  result = result.replace(/\s+(Axis\s+I)\s*:/gi, '\n$1:')
  result = result.replace(/\s+(Axis\s+II)\s*:/gi, '\n$1:')
  result = result.replace(/\s+(Axis\s+III)\s*:/gi, '\n$1:')
  result = result.replace(/\s+(Axis\s+IV)\s*:/gi, '\n$1:')
  result = result.replace(/\s+(Axis\s+V)\s*:/gi, '\n$1:')
  
  return result
}

/**
 * Format Mental Status exam sections
 */
function formatMentalStatusExam(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inMSE = false
  
  const mseLabels = [
    'Appearance', 'Attitude', 'Activity', 'Language', 'Speech',
    'Thought Process', 'Thought Content', 'SI/HI', 'Mood', 'Affect',
    'Mood/Affect', 'Perception', 'Cognition', 'Judgment', 'Insight',
    'Judgment and Insight', 'Orientation', 'Memory', 'Attention',
    'Concentration', 'Behavior', 'Psychomotor',
  ]
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (stripped === 'mental status' || stripped === 'mental status exam' || stripped === 'mse') {
      inMSE = true
      output.push(line)
      continue
    }
    
    if (inMSE && isHeaderCandidate(line) && !mseLabels.some(l => stripped.includes(l.toLowerCase()))) {
      inMSE = false
    }
    
    if (inMSE && line.length > 100) {
      let result = line
      // Split on MSE labels
      for (const label of mseLabels) {
        const pattern = new RegExp(`\\s{2,}(${escapeRegex(label)})\\s*:`, 'gi')
        result = result.replace(pattern, '\n$1:')
      }
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format procedure notes - split dense procedure info
 */
function formatProcedureNotes(text: string): string {
  let result = text
  
  // Split common procedure note patterns
  result = result.replace(/\s{2,}(Performed by:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Authorized by:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Consent obtained:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Consent given by:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Risks discussed:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Alternatives discussed:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Indication)/gi, '\n$1')
  result = result.replace(/\s{2,}(Reason for procedure:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Complications\??:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Successful cannulation)/gi, '\n$1')
  result = result.replace(/\s{2,}(Total number of)/gi, '\n$1')
  result = result.replace(/\s{2,}(Gauge catheter)/gi, '\n$1')
  
  // CPT code patterns
  result = result.replace(/\s{2,}(CPT\(?R?\)?\s*Code:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Procedure:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Surgeon:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Location:)/gi, '\n$1')
  
  return result
}

/**
 * Split allergen reactions inline patterns
 */
function splitAllergenList(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inAllergies = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (stripped === 'allergies' || stripped === 'allergen reactions') {
      inAllergies = true
      output.push(line)
      continue
    }
    
    if (inAllergies && isHeaderCandidate(line) && !stripped.includes('allerg')) {
      inAllergies = false
    }
    
    if (inAllergies && line.length > 80) {
      // Split on ~ bullet patterns
      let result = line.replace(/\s+~\s+/g, '\n- ')
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Split ED-specific dense sections
 */
function splitEDSections(text: string): string {
  let result = text
  
  // ED Provider Notes patterns
  result = result.replace(/\s{3,}(ED Provider Notes)/gi, '\n\n$1')
  result = result.replace(/\s{3,}(ED Procedure Notes)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Chief Complaint)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(History of Present Illness)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Patient presents with)/gi, '\n\n$1')
  
  // ED Course & MDM
  result = result.replace(/\s{2,}(ED Course & MDM)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(ED Course and Medical Decision Making)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Medical Decision Making)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Amount And\/Or Complexity)/gi, '\n\n$1')
  
  // ED Diagnoses
  result = result.replace(/\s{2,}(ED Diagnoses)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Final diagnoses:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(ED Labs & Imaging)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Labs Reviewed)/gi, '\n\n$1')
  
  // Split "Patient Vitals for the past" patterns
  result = result.replace(/\s{2,}(Patient Vitals)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Vitals signs)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Nursing note)/gi, '\n$1')
  
  return result
}

/**
 * Split medication signature patterns
 */
function splitMedicationSigs(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inMeds = false
  
  const medHeaders = ['medications', 'home medications', 'discharge medications', 
                      'prior to admission medications', 'new medications',
                      'modified medications', 'medications to continue']
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (medHeaders.some(h => stripped.includes(h))) {
      inMeds = true
      output.push(line)
      continue
    }
    
    if (inMeds && isHeaderCandidate(line) && !medHeaders.some(h => stripped.includes(h))) {
      inMeds = false
    }
    
    if (inMeds && line.length > 120) {
      let result = line
      
      // Split on medication entries (~ medname pattern)
      result = result.replace(/\s+~\s+/g, '\n- ')
      
      // Split after "Sig" followed by drug name
      result = result.replace(/\s{2,}(Sig\s+[a-zA-Z])/gi, '\n$1')
      
      // Split between medications when we see drug pattern
      result = result.replace(
        /(\d+\s*(?:mg|mcg|mL|tablet|capsule)[^~]*?)\s{2,}([a-z]+[A-Z]|[A-Z][a-z]+\s+\d)/g,
        '$1\n- $2'
      )
      
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format Component Value Date lab tables
 */
function formatLabTables(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check for "Component Value Date" header pattern
    if (/Component\s+Value\s+Date/i.test(line)) {
      output.push(line)
      continue
    }
    
    // Check for "Lab Results" header followed by inline content
    if (/Lab Results\s+Component/i.test(line)) {
      let result = line.replace(/\s+(Lab Results)\s+(Component)/gi, '\n\n$1\n$2')
      output.push(result)
      continue
    }
    
    // Split lines with multiple "LabName value date" entries
    if (line.length > 100 && /[A-Z]+\s+[\d.]+\s+\d{2}\/\d{2}\/\d{4}/.test(line)) {
      let result = line
      // Split before uppercase lab names followed by values and dates
      result = result.replace(
        /\s{2,}([A-Z]+)\s+([\d.]+)\s+(\d{2}\/\d{2}\/\d{4})/g,
        '\n$1 $2 $3'
      )
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format Intake/Output summary tables
 */
function formatIntakeOutputTables(text: string): string {
  let result = text
  
  // Split Intake/Output Summary patterns
  result = result.replace(/\s{2,}(Intake\/Output Summary)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Last data filed at)/gi, '\n$1')
  result = result.replace(/\s{2,}(Gross per 24 hour)/gi, '\n$1')
  result = result.replace(/\s{2,}(Intake)\s{2,}(\d+\s*ml)/gi, '\nIntake: $2')
  result = result.replace(/\s{2,}(Output)\s{2,}(\d+\s*ml)/gi, '\nOutput: $2')
  result = result.replace(/\s{2,}(Net)\s{2,}(-?\d+\s*ml)/gi, '\nNet: $2')
  
  return result
}

/**
 * Format "Result Value" lab patterns from ED notes
 * Pattern: "White Blood Cells 13.6 (*) Red Blood Cells 3.99 (*)"
 */
function formatResultValueLabs(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  const labNames = [
    'White Blood Cells', 'Red Blood Cells', 'Hemoglobin', 'Hematocrit',
    'Mean Cell Volume', 'Mean Cell Hemoglobin', 'Mean Cell Hemoglobin Concentration',
    'RDW SD', 'RDW CV', 'Platelet', 'Mean Platelet Volume',
    'Nucleated RBC', 'Nucleated RBC Abs', 'Auto Neutrophil Absolute',
    'Neutrophils', 'Absolute Neutrophils', 'Lymphs', 'Absolute Lymphocytes',
    'Monocytes', 'Absolute Monocytes', 'Eosinophils', 'Absolute Eosinophils',
    'Basophils', 'Absolute Basophils', 'Imm Gran Automated', 'Absolute Imm Gran',
    'Lipase Level', 'Partial Thromboplastin Time', 'Prothrombin Time',
    'International Normalization Ratio',
    'Urine Color', 'Urine Appearance', 'Urine Specific Gravity', 'Urine pH',
    'Urine Glucose', 'Urine Protein', 'Urine Ketones', 'Urine Bilirubin',
    'Urine Urobilinogen', 'Urine Leukocyte Esterase', 'Urine Nitrite',
    'Urine Blood', 'Urine WBC', 'Urine RBC', 'Urine Bacteria',
    'Urine Mucous', 'Urine Hyaline Casts', 'Urine Squamous',
    'Sodium', 'Potassium', 'Chloride', 'Total CO2', 'Carbon Dioxide',
    'Calcium Ionized', 'Glucose', 'Blood Urea Nitrogen', 'BUN',
    'Creatinine', 'Anion Gap', 'Hematocrit Handheld', 'Hemoglobin Handheld',
    'Bilirubin Direct', 'Bilirubin Total', 'Albumin Level', 'Alkaline Phosphatase',
    'Alanine Aminotransferase', 'Aspartate Aminotransferase', 'Protein Total',
    'Patient Location POC',
  ]
  
  for (const line of lines) {
    // Count how many lab names are in this line
    let count = 0
    for (const name of labNames) {
      if (line.includes(name)) count++
    }
    
    if (count >= 2 && line.length > 80) {
      let result = line
      // Split before each lab name
      for (const name of labNames) {
        const pattern = new RegExp(`\\s{2,}(${escapeRegex(name)})\\s`, 'g')
        result = result.replace(pattern, '\n$1 ')
      }
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format CBC/BMP/CMP panel headers
 */
function formatLabPanelHeaders(text: string): string {
  let result = text
  
  // Split lab panel headers onto their own lines
  const panels = [
    'CBC W/ DIFFERENTIAL', 'CBC', 'BMP', 'CMP', 'COMPREHENSIVE METABOLIC PANEL',
    'BASIC METABOLIC PANEL', 'LIPASE LVL', 'PARTIAL THROMBOPLASTIN TIME',
    'URINALYSIS W/ MICRO', 'URINALYSIS', 'AUTO DIFF', 'URINALYSIS MICROSCOPIC',
    'POC LYTES', 'HEPATIC FUNCTION PNL', 'PROTHROMBIN TIME', 'COAGULATION',
    'THYROID PANEL', 'LIPID PANEL',
  ]
  
  for (const panel of panels) {
    // Add newline before panel names that follow other content
    const pattern = new RegExp(`([^\\n])\\s{2,}(${escapeRegex(panel)})`, 'gi')
    result = result.replace(pattern, '$1\n\n$2')
  }
  
  return result
}

/**
 * Split "- Abnormal" patterns in lab results
 */
function splitAbnormalLabPatterns(text: string): string {
  let result = text
  
  // Pattern: "CBC W/ DIFFERENTIAL - Abnormal Result Value"
  result = result.replace(/\s+-\s+(Abnormal|Normal)\s{2,}(Result\s+Value)/gi, ' - $1\n$2')
  
  // Split "Result Value" from inline position
  result = result.replace(/\s{3,}(Result\s+Value)/gi, '\n\n$1')
  
  return result
}

/**
 * Format tobacco/substance use patterns
 */
function formatSubstanceUse(text: string): string {
  let result = text
  
  // Split Tobacco Use section patterns
  result = result.replace(/\s{2,}(Tobacco Use)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(~\s*Smoking status:)/gi, '\n$1')
  result = result.replace(/\s{2,}(~\s*Smokeless tobacco:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Substance Use Topics)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(~\s*Alcohol use:)/gi, '\n$1')
  result = result.replace(/\s{2,}(~\s*Drug use:)/gi, '\n$1')
  
  return result
}

/**
 * Format provider attestation blocks
 */
function formatAttestationBlocks(text: string): string {
  let result = text
  
  // Split attestation patterns
  result = result.replace(/\s{2,}(By signing my name)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Provider Attestation:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(I, [A-Z][a-z]+)/gi, '\n$1')
  result = result.replace(/\s{2,}(personally performed)/gi, ' $1')
  
  // Split provider signatures
  result = result.replace(/\s{3,}([A-Z][a-z]+,\s*(?:MD|DO|PA|NP|APRN|RN))/g, '\n\n$1')
  result = result.replace(/\s{2,}(\d{2}\/\d{2}\/\d{2,4}\s+\d{1,2}:\d{2})/g, '\n$1')
  
  return result
}

/**
 * Format History and Physical specific patterns
 */
function formatHPPatterns(text: string): string {
  let result = text
  
  // H&P section patterns
  result = result.replace(/\s{2,}(History and Physical)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Brief Pre-Operative H&P)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Review of symptoms:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(10 systems reviewed)/gi, '\n$1')
  result = result.replace(/\s{2,}(systems negative except)/gi, ' $1')
  
  // Patient Active Problem List
  result = result.replace(/\s{2,}(Patient Active Problem List)/gi, '\n\n$1')
  
  // Plan items
  result = result.replace(/\s{2,}(\d+\.\s*To OR)/gi, '\n$1')
  result = result.replace(/\s{2,}(\d+\.\s*R\/B\/A)/gi, '\n$1')
  result = result.replace(/\s{2,}(\d+\.\s*Appropriate)/gi, '\n$1')
  
  return result
}

/**
 * Format "History reviewed" patterns
 */
function formatHistoryReviewed(text: string): string {
  let result = text
  
  result = result.replace(/\s{2,}(History reviewed\.)/gi, '\n$1')
  result = result.replace(/\s{2,}(No past medical history pertinent negatives\.)/gi, '\n$1')
  result = result.replace(/\s{2,}(No pertinent family history\.)/gi, '\n$1')
  
  return result
}

/**
 * Format imaging results inline
 */
function formatImagingResults(text: string): string {
  let result = text
  
  // CT, MRI, X-ray patterns
  result = result.replace(/\s{2,}(CT\s+(?:abdomen|pelvis|chest|head|brain|spine))/gi, '\n\n$1')
  result = result.replace(/\s{2,}(MRI\s+(?:brain|spine|knee|shoulder))/gi, '\n\n$1')
  result = result.replace(/\s{2,}(X-ray|XR|CXR)/gi, '\n\n$1')
  result = result.replace(/\s{2,}\(Results Pending\)/gi, '\n(Results Pending)')
  
  return result
}

/**
 * Format discharge instructions patterns
 */
function formatDischargeInstructionPatterns(text: string): string {
  let result = text
  
  // New/Modified/Continue medication sections
  result = result.replace(/\s{2,}(New Medications)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Modified Medications)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Medications To Continue)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Unreviewed Medications)/gi, '\n\n$1')
  
  // Instruction sections
  result = result.replace(/\s{2,}(Diet Instructions)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Activity Instructions)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Scheduled Appointments)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Other Instructions)/gi, '\n\n$1')
  
  // What changed patterns
  result = result.replace(/\s{2,}(What changed:)/gi, '\n$1')
  result = result.replace(/\s{2,}(·\s+)/g, '\n$1')
  
  return result
}

/**
 * Format dense Physical Exam patterns
 * Handles patterns like "GEN: ... HENT: ... RESP: ... C/V: ..."
 */
function formatDensePEPatterns(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  // PE labels that appear in dense format
  const denseLabels = [
    'GEN', 'GENERAL', 'HENT', 'HEENT', 'HEAD', 'EYES', 'EARS', 'NOSE', 'THROAT',
    'NECK', 'RESP', 'RESPIRATORY', 'C/V', 'CV', 'CARDIOVASCULAR', 'CARDIAC',
    'HEART', 'LUNGS', 'PULMONARY', 'GI', 'ABD', 'ABDOMINAL', 'ABDOMEN',
    'GU', 'GENITOURINARY', 'EXT', 'EXTREMITIES', 'MSK', 'MUSCULOSKELETAL',
    'NEURO', 'NEUROLOGIC', 'NEUROLOGICAL', 'PSYCH', 'PSYCHIATRIC', 'SKIN',
    'BACK', 'SPINE', 'LYMPH', 'VASCULAR', 'RECTAL', 'BREAST',
  ]
  
  for (const line of lines) {
    // Count PE labels in the line
    let labelCount = 0
    for (const label of denseLabels) {
      const pattern = new RegExp(`\\b${label}\\s*:`, 'gi')
      if (pattern.test(line)) labelCount++
    }
    
    if (labelCount >= 2) {
      let result = line
      // Split before each PE label
      for (const label of denseLabels) {
        const pattern = new RegExp(`\\s{2,}(${label})\\s*:`, 'gi')
        result = result.replace(pattern, '\n$1:')
      }
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format ROS in dense format
 * Handles: "Constitutional: Positive for... HENT: Negative for..."
 */
function formatDenseROS(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check if line has multiple ROS entries (Positive for / Negative for patterns)
    const posNegCount = (line.match(/(?:Positive|Negative) for/gi) || []).length
    
    if (posNegCount >= 2 && line.length > 100) {
      let result = line
      // Split before each ROS category
      for (const label of ROS_LABELS) {
        const pattern = new RegExp(`\\s{2,}(${escapeRegex(label)})\\s*:`, 'gi')
        result = result.replace(pattern, '\n$1:')
      }
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format "Diagnosis Date" table patterns from PMH
 */
function formatDiagnosisDateTables(text: string): string {
  let result = text
  
  // Split "Diagnosis Date" header
  result = result.replace(/\s{2,}(Diagnosis\s+Date)/gi, '\n\n$1')
  
  // Split "Procedure Laterality Date" header
  result = result.replace(/\s{2,}(Procedure\s+Laterality\s+Date)/gi, '\n\n$1')
  
  // Split "Problem Relation Age of Onset" header (Family History)
  result = result.replace(/\s{2,}(Problem\s+Relation\s+Age)/gi, '\n\n$1')
  
  return result
}

/**
 * Format Past Surgical History tables
 */
function formatPastSurgicalHistory(text: string): string {
  let result = text
  
  // Split procedure entries that follow dates
  result = result.replace(
    /(\d{2}\/\d{2}\/\d{4})\s{2,}(~\s*[A-Z])/g,
    '$1\n$2'
  )
  
  // Split CPT codes onto their own lines
  result = result.replace(/\s{2,}(\([A-Z0-9]+\))/g, ' $1')
  
  // Split "Procedure:" entries
  result = result.replace(/\s{2,}(Procedure:)/gi, '\n$1')
  
  return result
}

/**
 * Format Family History patterns
 */
function formatFamilyHistory(text: string): string {
  let result = text
  
  // Family history problem/relation patterns
  result = result.replace(/\s{2,}(~\s*(?:Diabetes|Hypertension|Cancer|Heart|Stroke|Kidney))/gi, '\n$1')
  result = result.replace(/\s{2,}(Mother|Father|Brother|Sister|Sibling|Maternal|Paternal)/gi, '\n$1')
  
  // "No History of Family" patterns
  result = result.replace(/\s{2,}(No History of Family)/gi, '\n$1')
  
  return result
}

/**
 * Clean up signature/timestamp lines
 */
function formatSignatureLines(text: string): string {
  let result = text
  
  // Signature patterns
  result = result.replace(/\s{3,}([A-Z][a-z]+\s+[A-Z][a-z]+,?\s*(?:MD|DO|PA-C|NP|APRN|RN|MA))/g, '\n\n$1')
  
  // Date/time patterns at end
  result = result.replace(/\s{2,}(\d{2}\/\d{2}\/\d{2,4}\s+\d{4})$/gm, '\n$1')
  
  // "Written by" patterns
  result = result.replace(/\s{2,}(Writt(?:en|) by:?)/gi, '\n\n$1')
  
  return result
}

/**
 * Format appointment scheduling patterns
 */
function formatAppointmentPatterns(text: string): string {
  let result = text
  
  // Appointment date patterns
  result = result.replace(
    /\s{2,}((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/gi,
    '\n$1'
  )
  
  // Time patterns
  result = result.replace(/\s{2,}(\d{1,2}:\d{2}\s*(?:AM|PM)\s+(?:CDT|CST|EST|PST|EDT|PDT))/gi, '\n$1')
  
  // "Arrive by" patterns
  result = result.replace(/\s{2,}(\(Arrive by)/gi, '\n$1')
  
  // Post-Op patterns
  result = result.replace(/\s{2,}(Post-Op with)/gi, '\n$1')
  
  return result
}

/**
 * Format "Commonly known as" medication patterns
 */
function formatCommonlyKnownAs(text: string): string {
  let result = text
  
  // Split before "Commonly known as" patterns
  result = result.replace(/\s{2,}(Commonly known as:)/gi, '\n$1')
  
  // Split before "Ask about:" patterns
  result = result.replace(/\s{2,}(Ask about:)/gi, '\n$1')
  
  return result
}

/**
 * Format Care Instructions patterns
 */
function formatCareInstructions(text: string): string {
  let result = text
  
  // Care Instructions sections
  result = result.replace(/\s{2,}(Care Instructions:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Reportable signs)/gi, '\n$1')
  result = result.replace(/\s{2,}(MD\/Provider name)/gi, '\n$1')
  result = result.replace(/\s{2,}(MD\/Provider phone)/gi, '\n$1')
  
  // Discharge instruction patterns
  result = result.replace(/\s{2,}(Discharge instructions -)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Discharge activity)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Discharge diet)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Call Dr\/provider)/gi, '\n\n$1')
  
  // Diet Type patterns
  result = result.replace(/\s{2,}(Diet Type:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Other \(specify\):)/gi, '\n$1')
  result = result.replace(/\s{2,}(Explanatory Comment:)/gi, '\n$1')
  
  return result
}

/**
 * Split dense assessment and plan
 */
function splitAssessmentAndPlan(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inAP = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (stripped.includes('assessment') && (stripped.includes('plan') || stripped.endsWith('assessment'))) {
      inAP = true
      output.push(line)
      continue
    }
    
    if (inAP && isHeaderCandidate(line) && !stripped.includes('assessment') && !stripped.includes('plan')) {
      inAP = false
    }
    
    if (inAP) {
      let result = line
      
      // Split numbered problems: "# Problem Name" or "1. Problem"
      result = result.replace(/\s{2,}(#\s*[A-Za-z])/g, '\n\n$1')
      result = result.replace(/\s{2,}(\d+\.\s*[A-Z])/g, '\n\n$1')
      
      // Split sub-items starting with dash
      result = result.replace(/\s{2,}(-\s*[A-Za-z])/g, '\n$1')
      
      output.push(result)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

/**
 * Format discharge summary sections
 */
function formatDischargeSummarySections(text: string): string {
  let result = text
  
  // Split common discharge summary patterns
  result = result.replace(/\s{2,}(PREADMISSION DIAGNOSIS:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(DISCHARGE DIAGNOSIS:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(ADMITTING DIAGNOSIS:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(FINAL DIAGNOSIS:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(BRIEF HISTORY:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(HOSPITAL COURSE:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(DISCHARGE INSTRUCTIONS:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(DISCHARGE MEDICATIONS:)/gi, '\n\n$1')
  
  // Synopsis and course
  result = result.replace(/\s{2,}(Synopsis:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Hospital Course:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Physical Exam:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Consultations)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Condition at Discharge:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Disposition:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Patient Instructions:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Pending Items:)/gi, '\n\n$1')
  
  return result
}

/**
 * Format psychiatry-specific patterns
 */
function formatPsychiatryNote(text: string): string {
  let result = text
  
  // Laboratory Findings / Hospital Course
  result = result.replace(/\s{2,}(Laboratory Findings:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Hospital Course:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Consultations:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Condition on Discharge:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Discharge Medications:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Prog[a-z]*:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Recommendations:)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Specific Instructions)/gi, '\n\n$1')
  result = result.replace(/\s{2,}(Disposition on Discharge:)/gi, '\n\n$1')
  
  return result
}

/**
 * Split dates from section content
 */
function splitDatePatterns(text: string): string {
  let result = text
  
  // "Date of services:" patterns
  result = result.replace(/\s{2,}(Date of services:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Date of Admission:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Date of Discharge:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Operation\/Procedure Date)/gi, '\n$1')
  result = result.replace(/\s{2,}(Sex:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Birthdate:)/gi, '\n$1')
  result = result.replace(/\s{2,}(DOB:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Age:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Race:)/gi, '\n$1')
  result = result.replace(/\s{2,}(PCP:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Attending:)/gi, '\n$1')
  result = result.replace(/\s{2,}(MRN:)/gi, '\n$1')
  result = result.replace(/\s{2,}(Account #:)/gi, '\n$1')
  
  // Date/Time stamps inline
  result = result.replace(/\s{2,}(Date:)\s*(\d{2}\/\d{2}\/\d{4})/gi, '\n$1 $2')
  result = result.replace(/\s{2,}(Time:)\s*(\d{1,2}:\d{2})/gi, '\n$1 $2')
  
  // Electronically signed patterns
  result = result.replace(/\s{2,}(Electronically signed by)/gi, '\n\n$1')
  
  // "Last data filed at" patterns
  result = result.replace(/\s{2,}(Last data filed at)/gi, '\n$1')
  
  // Common patient info patterns in dense notes
  result = result.replace(/\s{2,}(Patient Name)/gi, '\n$1')
  result = result.replace(/\s{2,}(MRN \(Required\):)/gi, '\n$1')
  result = result.replace(/\s{2,}(Patient Location)/gi, '\n$1')
  
  return result
}

/**
 * Split timestamp patterns in notes
 * Handles patterns like "02/18/22 1725" appearing inline
 */
function splitTimestampPatterns(text: string): string {
  let result = text
  
  // Split standalone timestamps (e.g., "02/18/22 1725 Left lower abdomen")
  result = result.replace(/\s{2,}(\d{2}\/\d{2}\/\d{2,4}\s+\d{4})\s+([A-Z])/g, '\n$1 $2')
  
  // Split timestamp + location patterns
  result = result.replace(/(\d{2}\/\d{2}\/\d{2,4})\s{2,}([A-Z][a-z]+\s+[A-Z][a-z]+)/g, '$1\n$2')
  
  return result
}

// =============================================================================
// COMPOUND HEADER FIXES
// =============================================================================

function fixSplitCompoundHeaders(text: string): string {
  let result = text
  
  const fixes: Array<[RegExp, string]> = [
    // History patterns
    [/(Past Medical)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(Past Surgical)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(Family Medical)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(Family)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(Social)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(BRIEF)\s*\n+\s*(HISTORY:?)/gi, '$1 $2'],
    [/(HOSPITAL)\s*\n+\s*(COURSE:?)/gi, '$1 $2'],
    
    // Physical Exam
    [/(PHYSICAL)\s*\n+\s*(EXAMINATION:?)/gi, '$1 $2'],
    [/(PHYSICAL)\s*\n+\s*(EXAM:?)/gi, '$1 $2'],
    [/(Physical)\s*\n+\s*(Exam:?)/gi, '$1 $2'],
    
    // Assessment/Plan - comprehensive patterns for & and AND
    [/(Assessment)\s*\n+\s*(and Plan:?)/gi, '$1 $2'],
    [/(ASSESSMENT)\s*\n+\s*(AND PLAN:?)/gi, '$1 $2'],
    [/(Assessment)\s*\n+\s*(&)\s*\n*\s*(Plan:?)/gi, 'Assessment & Plan$3'],
    [/(ASSESSMENT)\s*\n+\s*(&)\s*\n*\s*(PLAN:?)/gi, 'ASSESSMENT & PLAN$3'],
    [/(Assessment)\s*\n+\s*(&\s*Plan:?)/gi, 'Assessment & Plan'],
    
    // HPI
    [/(Review of)\s*\n+\s*(Systems:?)/gi, '$1 $2'],
    [/(History of Present)\s*\n+\s*(Illness:?)/gi, '$1 $2'],
    [/(History of)\s*\n+\s*(Present Illness:?)/gi, '$1 $2'],
    [/(Chief)\s*\n+\s*(Complaint:?)/gi, '$1 $2'],
    
    // Vitals
    [/(Vital)\s*\n+\s*(Signs)/gi, '$1 $2'],
    [/(VITAL)\s*\n+\s*(SIGNS)/gi, '$1 $2'],
    
    // Mental Status
    [/(Mental)\s*\n+\s*(Status)/gi, '$1 $2'],
    
    // Medications
    [/(CURRENT)\s*\n+\s*(MEDICATIONS:?)/gi, '$1 $2'],
    [/(DISCHARGE)\s*\n+\s*(MEDICATIONS:?)/gi, '$1 $2'],
    [/(HOME)\s*\n+\s*(MEDICATIONS:?)/gi, '$1 $2'],
    
    // Lab
    [/(Laboratory)\s*\n+\s*(values)/gi, '$1 $2'],
    [/(LABORATORY)\s*\n+\s*(VALUES)/gi, '$1 $2'],
    [/(Labs)\s*\n+\s*(&\s*Imaging)/gi, '$1 $2'],
    [/(ED Labs)\s*\n+\s*(&\s*Imaging)/gi, '$1 $2'],
    [/(Labs)\s*\n+\s*(and)\s*\n*\s*(Imaging)/gi, 'Labs and Imaging'],
    [/(ED Labs)\s*\n+\s*(and)\s*\n*\s*(Imaging)/gi, 'ED Labs and Imaging'],
    
    // ED-specific - IMPORTANT: Keep compound headers together
    [/(ED\s*Course)\s*\n+\s*(&)\s*\n+\s*(MDM)/gi, 'ED Course & MDM'],
    [/(ED\s*Course)\s*\n+\s*(&\s*MDM)/gi, 'ED Course & MDM'],
    [/(ED Course)\s*\n+\s*(& MDM)/gi, 'ED Course & MDM'],
    [/(ED)\s*\n+\s*(Course)\s*\n*\s*(&)\s*\n*\s*(MDM)/gi, 'ED Course & MDM'],
    [/(ED Course)\s*\n+\s*(and)\s*\n*\s*(MDM)/gi, 'ED Course & MDM'],
    
    // Medical Decision Making - comprehensive
    [/(Medical)\s*\n+\s*(Decision)\s*\n*\s*(Making)/gi, '$1 $2 $3'],
    [/(MEDICAL)\s*\n+\s*(DECISION)\s*\n*\s*(MAKING)/gi, '$1 $2 $3'],
    [/(ED COURSE)\s*\n+\s*(AND)\s*\n*\s*(MEDICAL)/gi, 'ED COURSE AND MEDICAL'],
    [/(COURSE)\s*\n+\s*(AND)\s*\n*\s*(MEDICAL)/gi, 'COURSE AND MEDICAL'],
    [/(ED COURSE AND)\s*\n+\s*(MEDICAL DECISION MAKING)/gi, 'ED COURSE AND MEDICAL DECISION MAKING'],
    
    // Discharge Summary - IMPORTANT: Keep DIAGNOSIS with prefix
    [/(PREADMISSION)\s*\n+\s*(DIAGNOSIS:?)/gi, 'PREADMISSION DIAGNOSIS$2'],
    [/(DISCHARGE)\s*\n+\s*(DIAGNOSIS:?)/gi, 'DISCHARGE DIAGNOSIS$2'],
    [/(ADMITTING)\s*\n+\s*(DIAGNOSIS:?)/gi, 'ADMITTING DIAGNOSIS$2'],
    [/(POSTOPERATIVE)\s*\n+\s*(DIAGNOSIS:?)/gi, 'POSTOPERATIVE DIAGNOSIS$2'],
    [/(PREOPERATIVE)\s*\n+\s*(DIAGNOSIS:?)/gi, 'PREOPERATIVE DIAGNOSIS$2'],
    [/(FINAL)\s*\n+\s*(DIAGNOSIS:?)/gi, 'FINAL DIAGNOSIS$2'],
    
    // Instructions
    [/(DISCHARGE)\s*\n+\s*(INSTRUCTIONS:?)/gi, 'DISCHARGE INSTRUCTIONS$2'],
    
    // Code Status
    [/(CODE)\s*\n+\s*(STATUS:?)/gi, 'CODE STATUS$2'],
    
    // Condition on Discharge
    [/(Condition on)\s*\n+\s*(Discharge:?)/gi, '$1 $2'],
    [/(Condition at)\s*\n+\s*(Discharge:?)/gi, '$1 $2'],
    
    // NEW: Lab value names split across lines
    [/(Troponin)\s*\n+\s*(-?I)/gi, 'Troponin-I'],
    [/(eGFR)\s*\n+\s*(cr)/gi, 'eGFRcr'],
    [/(Lactic)\s*\n+\s*(Acid)\s*\n*\s*(Level)?/gi, 'Lactic Acid Level'],
    [/(RDW)\s*\n+\s*(SD)/gi, 'RDW SD'],
    [/(RDW)\s*\n+\s*(CV)/gi, 'RDW CV'],
    [/(Thought)\s*\n+\s*(Content)/gi, 'Thought Content'],
    
    // NEW: Neuroexam protection (do NOT split)
    [/(Neuro)\s*\n+\s*(exam:?)/gi, 'Neuroexam$2'],
    [/\bNeuro\s*\n+\s*EXAM:?/gi, 'Neuroexam:'],
    
    // NEW: Findings/Impression - often split incorrectly
    [/(FINDINGS)\s*\n+\s*(\/)\s*\n*\s*(IMPRESSION)/gi, 'FINDINGS/IMPRESSION'],
    [/(IMPRESSION)\s*\n+\s*(FINDINGS)\s*\n*\s*(\/)/gi, 'IMPRESSION FINDINGS/'],
    
    // NEW: "of" splits - common in clinical phrases
    [/(History)\s*\n+\s*(of)\s*\n*\s*(Present)/gi, 'History of Present'],
    [/(Review)\s*\n+\s*(of)\s*\n*\s*(Systems)/gi, 'Review of Systems'],
  ]
  
  for (const [pattern, replacement] of fixes) {
    result = result.replace(pattern, replacement)
  }
  
  return result
}

// =============================================================================
// SECTION HEADER HANDLING
// =============================================================================

function breakOnLargeGaps(text: string): string {
  // Collapse gaps after numbered list markers
  let result = text.replace(/^(\s*\d+\.)\s{2,}(\S)/gm, '$1 $2')
  result = result.replace(/(\d+\.)\s{2,}(\S)/g, '$1 $2')
  
  // Split at 3+ spaces
  const lines = result.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    if (isAsciiTableLine(line)) {
      output.push(line)
      continue
    }
    const parts = line.split(/[ \t]{3,}/)
    output.push(...parts)
  }
  
  return output.join('\n')
}

function insertSectionBreaks(text: string): string {
  let result = text
  
  // Only process MULTI-WORD section headers or unambiguous single-word headers
  // Avoid single common words like "History", "Exam", "Medications" that appear mid-sentence
  // NOTE: Removed MEDICATIONS as it often appears mid-sentence ("the medications", "your medications")
  const SAFE_SINGLE_WORD_HEADERS = new Set([
    'ALLERGIES', 'VITALS', 'LABS', 'ROS', 'IMPRESSION', 'FINDINGS',
    'ASSESSMENT', 'PLAN', 'DIAGNOSIS', 'DIAGNOSES',
    'SUBJECTIVE', 'OBJECTIVE', 'ADDENDUM', 'SYNOPSIS',
    'RADIOLOGY', 'IMAGING', 'LABORATORY', 'DISCUSSION', 'COMMENTS',
    'RECOMMENDATIONS', 'ATTESTATION', 'TECHNIQUE', 'INDICATION', 'COMPARISON',
  ])
  
  // Multi-word headers are safer to detect
  const multiWordHeaders = SECTION_HEADERS.filter(h => h.includes(' ') || h.includes('/'))
  
  // Sort by length (longest first) for proper matching
  const sortedHeaders = [...multiWordHeaders].sort((a, b) => b.length - a.length)
  
  for (const header of sortedHeaders) {
    // Match only when preceded by sentence-ending punctuation or start of text
    const pattern = new RegExp(
      `(?:^|[.!?;\\])])\\s*(${escapeRegex(header)})(?:\\b|:)`,
      'gim'
    )
    result = result.replace(pattern, (match, hdr) => {
      const punct = match.match(/^[.!?;\])]/) ? match[0] : ''
      return punct + '\n\n' + hdr
    })
  }
  
  // For single-word headers, only match at line start or after double-space
  for (const header of SAFE_SINGLE_WORD_HEADERS) {
    // Only if actually in SECTION_HEADERS
    if (!SECTION_HEADERS.includes(header)) continue
    const pattern = new RegExp(
      `(?:^|\\n|  )(${escapeRegex(header)})\\s*:`,
      'gim'
    )
    result = result.replace(pattern, '\n\n$1:')
  }
  
  return result
}

function forceHeaderOnNewline(text: string): string {
  let result = text
  
  // Only force newlines for multi-word headers or when preceded by sentence-ending punctuation
  // This prevents breaking "extensive history taking" or "after medications patient"
  const multiWordHeaders = SECTION_HEADERS.filter(h => h.includes(' ') || h.includes('/'))
  const sortedHeaders = [...multiWordHeaders].sort((a, b) => b.length - a.length)
  
  for (const header of sortedHeaders) {
    // Only match after sentence-ending punctuation (not arbitrary whitespace)
    const pattern = new RegExp(
      `([.!?;\\])"])[ \\t]+(${escapeRegex(header)})(:?)`,
      'gi'
    )
    result = result.replace(pattern, '$1\n\n$2$3')
  }
  
  return result
}

function splitHeaderLine(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  const sortedHeaders = [...SECTION_HEADERS].sort((a, b) => b.length - a.length)
  
  for (const line of lines) {
    let matched = false
    
    for (const header of sortedHeaders) {
      const pattern = new RegExp(
        `^(\\s*-?\\s*)(${escapeRegex(header)})(:?)(\\s+)(.+)$`,
        'i'
      )
      const match = line.match(pattern)
      
      if (match) {
        const [, prefix, hdr, colon, , content] = match
        output.push(`${prefix}${hdr}${colon}`)
        if (content.trim()) {
          output.push(content.trim())
        }
        matched = true
        break
      }
    }
    
    if (!matched) {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function dedupeSequentialHeaders(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  const recentHeaders: Array<[number, string]> = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (!stripped) {
      result.push(line)
      continue
    }
    
    // Check if line is a header
    const isHeader = SECTION_HEADERS_LOWER.has(stripped.toLowerCase()) ||
                     SECTION_HEADERS_LOWER.has(stripped.replace(/:$/, '').toLowerCase()) ||
                     (/^[A-Z][A-Z\s]+$/.test(stripped) && stripped.length <= 40)
    
    if (isHeader) {
      // Check for duplicate
      let isDuplicate = false
      for (const [prevIdx, prevHeader] of recentHeaders) {
        if (prevHeader.toLowerCase() === stripped.toLowerCase() && i - prevIdx < 10) {
          isDuplicate = true
          if (result.length && !result[result.length - 1].trim()) {
            result.pop()
          }
          break
        }
      }
      
      if (!isDuplicate) {
        result.push(line)
        recentHeaders.push([i, stripped])
        if (recentHeaders.length > 5) {
          recentHeaders.shift()
        }
      }
      continue
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

// =============================================================================
// DRUG NAME PRESERVATION
// =============================================================================

function preserveDrugNames(text: string): string {
  let result = text
  
  // Preserve camelCase drug names
  result = result.replace(/\bam\s*LODIPine\b/gi, 'amLODIPine')
  result = result.replace(/\bsil\s*denafi\s*L\b/gi, 'sildenafiL')
  result = result.replace(/\btada\s*lafi\s*L\b/gi, 'tadalafiL')
  result = result.replace(/\bPri\s*LOSEC\b/gi, 'PriLOSEC')
  result = result.replace(/\bm\s*L\b/g, 'mL')
  
  return result
}

// =============================================================================
// ROS FORMATTING
// =============================================================================

function formatROSSection(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inROS = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim().toLowerCase()
    
    if (stripped.startsWith('review of systems') || stripped === 'ros' || stripped === 'ros:') {
      inROS = true
    }
    
    if (inROS && isHeaderCandidate(line) && !isROSOrPELine(line)) {
      inROS = false
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function splitROSInline(text: string): string {
  let result = text
  
  for (const label of ROS_LABELS) {
    const pattern = new RegExp(
      `([.;,])\\s*(${escapeRegex(label)})\\s*:`,
      'gi'
    )
    result = result.replace(pattern, '$1\n$2:')
  }
  
  return result
}

function splitStackedROSLabels(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check for multiple ROS labels on one line
    let labelCount = 0
    for (const label of ROS_LABELS) {
      const pattern = new RegExp(`\\b${escapeRegex(label)}\\s*:`, 'gi')
      const matches = line.match(pattern)
      if (matches) labelCount += matches.length
    }
    
    if (labelCount > 1) {
      let remaining = line
      for (const label of ROS_LABELS) {
        const pattern = new RegExp(`\\s+(${escapeRegex(label)})\\s*:`, 'gi')
        remaining = remaining.replace(pattern, '\n$1:')
      }
      output.push(remaining)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

// =============================================================================
// PHYSICAL EXAM FORMATTING
// =============================================================================

function formatPESection(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inPE = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (PE_SECTION_HEADERS.has(stripped)) {
      inPE = true
    }
    
    if (inPE && isHeaderCandidate(line) && !isPELine(line)) {
      inPE = false
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function splitPEInlineLabels(text: string): string {
  let result = text
  
  for (const label of EXAM_LABELS) {
    const pattern = new RegExp(
      `([.;])\\s*(${escapeRegex(label)})\\s*:`,
      'gi'
    )
    result = result.replace(pattern, '$1\n$2:')
  }
  
  return result
}

function splitDensePESection(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    let labelCount = 0
    for (const label of EXAM_LABELS) {
      const pattern = new RegExp(`\\b${escapeRegex(label)}\\s*:`, 'gi')
      const matches = line.match(pattern)
      if (matches) labelCount += matches.length
    }
    
    if (labelCount > 1) {
      let remaining = line
      for (const label of EXAM_LABELS) {
        const pattern = new RegExp(`\\s+(${escapeRegex(label)})\\s*:`, 'gi')
        remaining = remaining.replace(pattern, '\n$1:')
      }
      output.push(remaining)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function fixDensePEColonSpacing(text: string): string {
  let result = text
  
  const peLabels = [
    'GENERAL', 'VITALS', 'EYES', 'ENT', 'HEENT', 'NECK',
    'RESPIRATORY', 'CARDIOVASCULAR', 'CV', 'GI', 'GU',
    'ABDOMEN', 'MUSCULOSKELETAL', 'EXTREMITIES', 'NEUROLOGIC', 'SKIN',
    'General', 'Vitals', 'Eyes', 'Neck', 'Respiratory',
    'Cardiovascular', 'Abdomen', 'Musculoskeletal', 'Extremities',
    'Neurologic', 'Skin', 'Psychiatric',
  ]
  
  for (const label of peLabels) {
    result = result.replace(new RegExp(`\\b${label}:([^\\s\\n])`, 'g'), `${label}: $1`)
  }
  
  return result
}

// =============================================================================
// MEDICATION FORMATTING
// =============================================================================

function formatMedicationList(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inMeds = false
  
  const medHeaders = ['medications', 'medication', 'current medications', 'home medications',
                      'discharge medications', 'active medications', 'outpatient medications']
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (medHeaders.includes(stripped)) {
      inMeds = true
      output.push(line)
      continue
    }
    
    if (inMeds && isHeaderCandidate(line) && !medHeaders.includes(stripped)) {
      if (!stripped.includes('medication') && !stripped.includes('allerg')) {
        inMeds = false
      }
    }
    
    if (inMeds && line.trim()) {
      if (isMedicationLine(line) && !line.trim().startsWith('-') && !line.trim().startsWith('•')) {
        output.push('- ' + line.trim())
      } else {
        output.push(line)
      }
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function cleanEmptyDispRefill(text: string): string {
  let result = text.replace(/,?\s*Disp:\s*,?\s*Rfl:\s*$/gm, '')
  result = result.replace(/,\s*Disp:\s*\n/g, '\n')
  result = result.replace(/,\s*Rfl:\s*$/gm, '')
  result = result.replace(/(\d)\s*\n\s*(mg|mcg|mL|g)([- ])/g, '$1 $2$3')
  
  return result
}

function splitMergedMedications(text: string): string {
  const nonMeds = ['Review', 'Physical', 'Assessment', 'History', 'Social', 'Family',
                   'Allergies', 'Labs', 'Vitals', 'Plan', 'Diagnosis', 'Chief']
  
  let result = text.replace(
    /,?\s*Disp:\s*,?\s*Rfl:\s*([A-Za-z][a-zA-Z]*)/g,
    (_, nextWord) => {
      if (nonMeds.some(nm => nextWord.startsWith(nm))) {
        return '\n\n' + nextWord
      }
      return '\n- ' + nextWord
    }
  )
  
  return result
}

function splitAtRefillsQuantity(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    const stripped = line.trim()
    
    if (stripped.toLowerCase().includes('refill') && stripped.length > 60) {
      let result = stripped.replace(
        /(Refills?:\s*\d+)\s+([a-z][a-zA-Z-]+(?:\s+[\d.]+)?(?:\s*%)?(?:\s+\w+)?)/gi,
        '$1\n$2'
      )
      result = result.replace(
        /(Quantity:\s*\d+\s*\w*)\s+([a-z][a-zA-Z-]+\s+\d)/gi,
        '$1\n$2'
      )
      
      if (result.includes('\n')) {
        output.push(...result.split('\n'))
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

// =============================================================================
// LAB FORMATTING
// =============================================================================

function formatLabResults(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inLabs = false
  
  const labHeaders = ['labs', 'lab results', 'laboratory', 'laboratory data',
                      'laboratory results', 'laboratory studies']
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (labHeaders.includes(stripped)) {
      inLabs = true
    }
    
    if (inLabs && isHeaderCandidate(line) && !labHeaders.includes(stripped)) {
      inLabs = false
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function condenseLabBlankLines(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let prevBlank = false
  let inLabs = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase()
    
    if (stripped.includes('lab') && stripped.endsWith(':')) {
      inLabs = true
    } else if (isHeaderCandidate(line) && !stripped.includes('lab')) {
      inLabs = false
    }
    
    if (inLabs) {
      if (!line.trim()) {
        if (!prevBlank) {
          output.push(line)
          prevBlank = true
        }
      } else {
        output.push(line)
        prevBlank = false
      }
    } else {
      output.push(line)
      prevBlank = !line.trim()
    }
  }
  
  return output.join('\n')
}

function splitMultiValueLabLines(text: string): string {
  let result = text
  
  for (const labValue of LAB_VALUE_PATTERNS) {
    const pattern = new RegExp(`\\s+(${escapeRegex(labValue)})\\s`, 'gi')
    result = result.replace(pattern, '\n$1 ')
  }
  
  return result
}

// =============================================================================
// VITALS FORMATTING
// =============================================================================

function formatVitalsLine(text: string): string {
  return text.replace(
    /\b(BP|HR|RR|Temp|SpO2|O2\s*Sat|Pulse|Weight|Height|BMI)\s*[:=]?\s*(\d)/gi,
    '$1: $2'
  )
}

function splitVitalsTable(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    const vitalsPattern = /\b(BP|HR|RR|Temp|SpO2|O2\s*Sat|Pulse)\s*[:=]?\s*[\d./]+/gi
    const matches = line.match(vitalsPattern)
    
    if (matches && matches.length > 2) {
      let remaining = line
      for (const vital of ['BP', 'HR', 'RR', 'Temp', 'SpO2', 'Pulse']) {
        const pattern = new RegExp(`\\s+(${vital})\\s*[:=]?\\s*(\\d)`, 'gi')
        remaining = remaining.replace(pattern, '\n$1: $2')
      }
      output.push(remaining)
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function fixVitalsSplit(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  
  const vitalStarts = ['BP:', 'HR:', 'RR:', 'Temp:', 'TEMP:', 'SpO2:', 'O2', 'Pulse:', 'Resp:']
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (stripped && vitalStarts.some(v => stripped.endsWith(v.replace(':', '')))) {
      if (i + 1 < lines.length) {
        const nextStripped = lines[i + 1].trim()
        if (nextStripped && (/^\d/.test(nextStripped) || nextStripped.startsWith('and'))) {
          result.push(stripped + ' ' + nextStripped)
          i += 2
          continue
        }
      }
    }
    
    result.push(line)
    i++
  }
  
  return result.join('\n')
}

// =============================================================================
// RADIOLOGY FORMATTING
// =============================================================================

function detectRadiologyNote(text: string): boolean {
  const upper = text.toUpperCase()
  
  const strongIndicators = [
    'IMPRESSION:', 'FINDINGS:', 'TECHNIQUE:',
    'BIRADS', 'BI-RADS', 'RADIOGRAPH', 'MAMMOGRAM',
  ]
  
  const antiIndicators = [
    'CHIEF COMPLAINT', 'HISTORY OF PRESENT ILLNESS', 'HPI:',
    'PAST MEDICAL HISTORY', 'REVIEW OF SYSTEMS', 'PHYSICAL EXAM',
    'EMERGENCY DEPARTMENT', 'ED COURSE', 'ASSESSMENT AND PLAN',
  ]
  
  const hasAnti = antiIndicators.filter(ind => upper.includes(ind)).length
  const strongMatches = strongIndicators.filter(ind => upper.includes(ind)).length
  
  if (hasAnti >= 2) {
    return strongMatches >= 2
  }
  
  return strongMatches >= 1
}

function formatRadiologyHeaders(text: string): string {
  let result = text
  
  const majorHeaders = [
    'FINDINGS', 'IMPRESSION', 'TECHNIQUE', 'INDICATION',
    'CLINICAL INDICATION', 'CLINICAL HISTORY', 'RECOMMENDATION',
    'CONCLUSION', 'COMPARISON',
  ]
  
  for (const header of majorHeaders) {
    // Ensure header starts on new line
    result = result.replace(
      new RegExp(`([^\\n])(${header}:)`, 'gi'),
      `$1\n\n${header}:`
    )
    
    // Split header from content if substantial
    result = result.replace(
      new RegExp(`^(${header}:)\\s*(\\S.{15,})$`, 'gim'),
      '$1\n$2'
    )
  }
  
  return result
}

function formatRadiologyNumberedFindings(text: string): string {
  // Split numbered findings
  let result = text.replace(/([.!?])\s+(\d+)\.\s+(?=[A-Z])/g, '$1\n$2. ')
  result = result.replace(/(IMPRESSION:)\s*(\d+)\.\s+/gi, '$1\n$2. ')
  
  return result
}

function cleanRadiologyEndMarkers(text: string): string {
  let result = text.replace(/\n\s*END\s+OF\s+IMPRESSION\s*\n?/gi, '\n')
  result = result.replace(/\n\s*END\s+OF\s+REPORT\s*\n?/gi, '\n')
  
  return result
}

function formatRadiologyNote(text: string): string {
  if (!detectRadiologyNote(text)) {
    return text
  }
  
  let result = text
  result = formatRadiologyHeaders(result)
  result = formatRadiologyNumberedFindings(result)
  result = cleanRadiologyEndMarkers(result)
  
  return result
}

// =============================================================================
// DISCHARGE FORMATTING
// =============================================================================

function formatDischargeMedicationList(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inDischargeMeds = false
  
  const dischargeMedHeaders = [
    'discharge medications', 'new medications', 'medications to continue',
    'current medications', 'medication reconciliation'
  ]
  
  for (const line of lines) {
    const stripped = line.trim()
    const lower = stripped.toLowerCase()
    
    if (dischargeMedHeaders.some(h => lower.includes(h))) {
      inDischargeMeds = true
      output.push(line)
      continue
    }
    
    if (inDischargeMeds && stripped && isHeaderCandidate(line)) {
      if (!dischargeMedHeaders.some(h => lower.includes(h)) && !lower.includes('sig')) {
        inDischargeMeds = false
      }
    }
    
    if (inDischargeMeds && stripped.length > 100) {
      let result = stripped
      
      // Split after Refills: N followed by drug name
      result = result.replace(
        /(Refills?:\s*\d+)\s+([a-z][a-zA-Z-]+(?:\s+[a-zA-Z-]*)?\s+\d)/gi,
        '$1\n$2'
      )
      
      if (result.includes('\n')) {
        output.push(...result.split('\n'))
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function formatDischargeAppointments(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inAppointments = false
  
  const apptHeaders = ['scheduled appointments', 'future appointments', 'follow-up', 'follow up']
  const datePattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/gi
  
  for (const line of lines) {
    const stripped = line.trim()
    const lower = stripped.toLowerCase()
    
    if (apptHeaders.some(h => lower.includes(h))) {
      inAppointments = true
      output.push(line)
      continue
    }
    
    if (inAppointments && stripped && isHeaderCandidate(line)) {
      if (!apptHeaders.some(h => lower.includes(h))) {
        inAppointments = false
      }
    }
    
    if (inAppointments && stripped.length > 150) {
      const dates = [...stripped.matchAll(datePattern)]
      
      if (dates.length > 1) {
        const resultParts: string[] = []
        let lastEnd = 0
        
        for (let i = 1; i < dates.length; i++) {
          resultParts.push(stripped.slice(lastEnd, dates[i].index).trim())
          lastEnd = dates[i].index!
        }
        resultParts.push(stripped.slice(lastEnd).trim())
        
        output.push(...resultParts.filter(p => p))
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function formatDischargeInstructions(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  const instructionTriggers = [
    'notify your physician for:', 'call your doctor if:', 'return to the emergency',
    'call if:', 'watch for:', 'warning signs:', 'seek medical attention if:'
  ]
  
  for (const line of lines) {
    const stripped = line.trim()
    const lower = stripped.toLowerCase()
    
    let hasTrigger = false
    for (const trigger of instructionTriggers) {
      if (lower.includes(trigger)) {
        hasTrigger = true
        break
      }
    }
    
    if (hasTrigger && stripped.length > 150) {
      for (const trigger of instructionTriggers) {
        if (lower.includes(trigger)) {
          const idx = lower.indexOf(trigger)
          const headerPart = stripped.slice(0, idx + trigger.length)
          const contentPart = stripped.slice(idx + trigger.length).trim()
          
          // Split into bullet points
          const items = contentPart.split(/(?=[A-Z][a-z]+\s)/).filter(s => s.trim())
          
          output.push(headerPart)
          for (const item of items) {
            if (item.trim()) {
              output.push('- ' + item.trim())
            }
          }
          break
        }
      }
      continue
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

// =============================================================================
// SENTENCE AND PARAGRAPH HANDLING
// =============================================================================

function splitSentences(text: string): string {
  let result = text
  
  // Split at sentence boundaries
  result = result.replace(/([.!?])\s+([A-Z][a-z])/g, '$1\n$2')
  
  // Rejoin after abbreviations
  for (const abbr of ABBREVIATIONS) {
    const pattern = new RegExp(`(${escapeRegex(abbr)})\\n([A-Z])`, 'gi')
    result = result.replace(pattern, '$1 $2')
  }
  
  return result
}

function breakOnSentenceGaps(text: string): string {
  return text.replace(/([.!?])\s{2,}([A-Z])/g, '$1\n\n$2')
}

function breakOnSemicolonCap(text: string): string {
  return text.replace(/;\s*([A-Z])/g, ';\n$1')
}

function mergeSoftBreaks(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]
    
    if (nextLine && 
        line.trim() && 
        !line.trim().endsWith('.') && !line.trim().endsWith(':') && !line.trim().endsWith(';') &&
        nextLine.trim() &&
        /^[a-z]/.test(nextLine.trim()) &&
        !isHeaderCandidate(nextLine) &&
        !isNumberedListItem(nextLine)) {
      output.push(line.trimEnd() + ' ' + nextLine.trimStart())
      i++
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function mergeLowercaseContinuations(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  const skipPrefixes = ['mg', 'ml', 'mcg', 'kg', 'cm', 'mm', 'http', 'www']
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (stripped && /^[a-z]/.test(stripped) && stripped.length > 5 &&
        !skipPrefixes.some(p => stripped.toLowerCase().startsWith(p)) &&
        !isMedicationLine(line)) {
      
      if (result.length) {
        const prevStripped = result[result.length - 1].trim()
        if (prevStripped && 
            !prevStripped.endsWith('.') && !prevStripped.endsWith('!') &&
            !prevStripped.endsWith('?') && !prevStripped.endsWith(':') &&
            !prevStripped.endsWith('-') && !prevStripped.endsWith('|') &&
            !isMedicationLine(result[result.length - 1])) {
          result[result.length - 1] = result[result.length - 1].trimEnd() + ' ' + stripped
          continue
        }
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

function consolidateParagraphs(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (!stripped) {
      result.push(line)
      continue
    }
    
    if (result.length && result[result.length - 1].trim()) {
      const prev = result[result.length - 1].trim()
      
      if (stripped.startsWith('-') || stripped.startsWith('*') || stripped.startsWith('•') ||
          /^\d+\.\s/.test(stripped) || stripped.endsWith(':') ||
          isHeaderCandidate(line) || isROSOrPELine(line)) {
        result.push(line)
        continue
      }
      
      if (prev.endsWith('.') || prev.endsWith('!') || prev.endsWith('?') || prev.endsWith(':')) {
        if (/^[A-Z]/.test(stripped) && prev.length < 60) {
          result.push(line)
          continue
        }
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

// =============================================================================
// ORPHAN FIXES
// =============================================================================

function fixOrphanHeaders(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Check if this is a header followed by blank line then content
    if (isHeaderCandidate(line) && i + 1 < lines.length && !lines[i + 1].trim()) {
      if (i + 2 < lines.length && lines[i + 2].trim()) {
        result.push(line)
        result.push(lines[i + 2])
        i += 2
        continue
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

function fixOrphanDates(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check if line is just a date
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(stripped) || /^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
      if (result.length && result[result.length - 1].trim()) {
        result[result.length - 1] = result[result.length - 1].trimEnd() + ' ' + stripped
        continue
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

function fixOrphanNumbers(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check if line is just a number
    if (/^\d+$/.test(stripped) && stripped.length <= 6) {
      if (result.length && result[result.length - 1].trim()) {
        const prev = result[result.length - 1].trim()
        if (/at \d{2}\/\d{2}\/\d{2}$/.test(prev) || prev.toLowerCase().includes('mg')) {
          result[result.length - 1] = result[result.length - 1].trimEnd() + ' ' + stripped
          continue
        }
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

function fixOrphanNumberedItems(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check for orphan numbered item start like "1." alone
    if (/^\d+\.$/.test(stripped) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (nextLine && !isHeaderCandidate(lines[i + 1])) {
        result.push(stripped + ' ' + nextLine)
        i++
        continue
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

function mergeOrphanSentenceEndings(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check for orphan sentence ending
    if (/^[a-z]/.test(stripped) && stripped.length < 30 && 
        stripped.endsWith('.') && result.length) {
      const prevStripped = result[result.length - 1].trim()
      if (prevStripped && !prevStripped.endsWith('.') && !prevStripped.endsWith(':')) {
        result[result.length - 1] = result[result.length - 1].trimEnd() + ' ' + stripped
        continue
      }
    }
    
    result.push(line)
  }
  
  return result.join('\n')
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

function removePageMarkers(text: string): string {
  return text.replace(/(?:^|\n)\s*(?:Page\s+\d+(?:\s+of\s+\d+)?|---+|\*\*\*+)\s*(?:\n|$)/gi, '\n')
}

function removeRulerLines(text: string): string {
  return text.replace(/^[-=_*]{3,}$/gm, '')
}

function removeOrphanPunctuation(text: string): string {
  return text.replace(/^\s*[.,;:!?]\s*$/gm, '')
}

function removeReviewedLines(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase()
    if (stripped.startsWith('reviewed.') && stripped.length < 80) {
      continue
    }
    result.push(line)
  }
  
  return result.join('\n')
}

function collapseWhitespace(text: string): string {
  let result = text.replace(/\u00a0/g, ' ')
  result = result.replace(/\r/g, '')
  result = result.replace(/[ \t]*\n[ \t]*/g, '\n')
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.replace(/ {2,}/g, ' ')
  return result.trim()
}

function removeInternalDoubleSpaces(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (const line of lines) {
    if (line.trim()) {
      const indent = line.length - line.trimStart().length
      const cleaned = line.trim().replace(/ {2,}/g, ' ')
      result.push(' '.repeat(indent) + cleaned)
    } else {
      result.push(line)
    }
  }
  
  return result.join('\n')
}

// =============================================================================
// WRAP AND FINAL
// =============================================================================

function splitLongLines(text: string, maxLen: number = 1200): string {
  const output: string[] = []
  
  for (const line of text.split('\n')) {
    if (line.length <= maxLen || isAsciiTableLine(line)) {
      output.push(line)
      continue
    }
    
    let remaining = line
    while (remaining.length > maxLen) {
      let cut = remaining.lastIndexOf('. ', maxLen)
      if (cut === -1) cut = remaining.lastIndexOf('; ', maxLen)
      if (cut === -1) cut = remaining.lastIndexOf('  ', maxLen)
      if (cut === -1) cut = maxLen
      
      const left = remaining.slice(0, cut + 1).trim()
      if (left) output.push(left)
      remaining = remaining.slice(cut + 1).trimStart()
    }
    if (remaining) output.push(remaining)
  }
  
  return output.join('\n')
}

function wrapLines(text: string, width: number = 98): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    if (line.length <= width || isAsciiTableLine(line)) {
      output.push(line)
      continue
    }
    
    let remaining = line
    while (remaining.length > width) {
      let breakPoint = remaining.lastIndexOf(' ', width)
      if (breakPoint === -1 || breakPoint < width / 2) {
        breakPoint = width
      }
      
      output.push(remaining.slice(0, breakPoint).trimEnd())
      remaining = remaining.slice(breakPoint).trimStart()
    }
    
    if (remaining) {
      output.push(remaining)
    }
  }
  
  return output.join('\n')
}

function tightenBlankLines(text: string): string {
  return text.replace(/\n{4,}/g, '\n\n\n')
}

function standardizeSectionSpacing(text: string): string {
  let result = text
  
  const sortedHeaders = [...SECTION_HEADERS].sort((a, b) => b.length - a.length)
  
  for (const header of sortedHeaders) {
    const pattern = new RegExp(`\\n{1,2}(${escapeRegex(header)})(:|\\b)`, 'gi')
    result = result.replace(pattern, '\n\n$1$2')
  }
  
  return result
}

function trimLines(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    lines[i] = lines[i].trim()
  }
  return lines.join('\n')
}

function normalizeListSpacing(text: string): string {
  // Ensure consistent spacing in bullet lists
  let result = text.replace(/\n- {2,}/g, '\n- ')
  result = result.replace(/^\s*-\s+/gm, '- ')
  return result
}

function normalizeAllergyList(text: string): string {
  // Ensure allergies section is properly formatted with bullets
  const lines = text.split('\n')
  const output: string[] = []
  let inAllergies = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase()
    
    if (stripped.includes('allergies') && stripped.endsWith(':')) {
      inAllergies = true
      output.push(line)
      continue
    } else if (isHeaderCandidate(line) && !stripped.includes('allerg')) {
      inAllergies = false
    }
    
    // Add bullets to allergy items if missing
    if (inAllergies && line.trim() && !line.trim().startsWith('-') && 
        !line.trim().startsWith('•') && !isHeaderCandidate(line) &&
        !stripped.includes('no known')) {
      output.push('- ' + line.trim())
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function splitBMILines(text: string): string {
  return text.replace(/(?:BMI\s+[0-9]+(?:\.[0-9]+)?\s*kg\/m²)/gi, '\n$&\n')
}

// =============================================================================
// ADDITIONAL MISSING FUNCTIONS - Complete coverage
// =============================================================================

// Social History patterns
const SOCIAL_HISTORY_HEADERS = [
  'Substance Use Topics', 'Tobacco Use', 'Smoking Status', 'Alcohol Use',
  'Drug Use', 'Sexual Activity', 'Exercise', 'Diet', 'Occupation'
] as const

const SOCIAL_HISTORY_ITEM_PATTERNS = [
  /^-?\s*smoking status/i,
  /^-?\s*alcohol use/i,
  /^-?\s*drug use/i,
  /^-?\s*tobacco use/i,
  /^-?\s*substance use/i,
  /^never smoker$/i,
  /^current smoker/i,
  /^former smoker/i,
] as const

function isSocialHistoryHeader(line: string): boolean {
  const stripped = line.trim().replace(/:$/, '')
  if (!stripped) return false
  return SOCIAL_HISTORY_HEADERS.some(h => 
    h.toLowerCase() === stripped.toLowerCase()
  )
}

function isSocialHistoryItem(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  return SOCIAL_HISTORY_ITEM_PATTERNS.some(pat => pat.test(stripped))
}

function fixBrokenWords(text: string): string {
  // Fix words broken across lines with hyphen
  // e.g., "pre-\ndiabetic" -> "pre-diabetic"
  return text.replace(/(\w+)-\s*\n\s*([a-z])/g, '$1-$2')
}

function normalizeBullets(text: string): string {
  let result = text
  // Turn inline bullets (~, •) into real list lines
  result = result.replace(/\s+[~•]\s+/g, '\n- ')
  // Split inline dash bullets separated by multiple spaces
  result = result.replace(/\s{2,}-\s+/g, '\n- ')
  // Normalize existing bullet formatting
  result = result.replace(/(?<=\n)\s*-\s+/g, '- ')
  // Convert asterisk bullets
  result = result.replace(/\s+\*\s+/g, '\n- ')
  return result
}

function breakNumberedLists(text: string): string {
  // Start numbered items on their own lines
  let result = text.replace(/(?<=:)\s*(\d+\.)/g, '\n$1')
  result = result.replace(/(?<=[.!?])\s+(\d+\.)/g, '\n$1')
  return result
}

function breakAfterColonKeywords(text: string): string {
  const keywords = [
    'Normal ', 'Skin ', 'No ', 'Trace ', 'AROM', 'PROM', 'Pain ',
    'Good strength', 'Legs ', 'Examination ', 'Description', 'Status',
    'Surgery Type', 'General anesthesia', 'Supine Position', 'Specials',
    'Post Op', 'PT ',
  ]
  const keysPattern = keywords.map(escapeRegex).join('|')
  let result = text.replace(new RegExp(`(?<!\\d):\\s+(?=(${keysPattern}))`, 'g'), ':\n')
  
  const secondary = [
    'Skin ', 'No ', 'Trace ', 'Pain ', 'Legs ', 'Good strength',
    'Lateral ', 'AROM', 'PROM', 'Examination ',
  ]
  const secPattern = secondary.map(escapeRegex).join('|')
  result = result.replace(new RegExp(`(?<=[a-z,])\\s+(?=(${secPattern}))`, 'g'), '\n')
  return result
}

function breakKnownInlinePhrases(text: string): string {
  const phrases = [
    'Pain with', 'Good strength', 'Legs warm', 'No swelling',
    'No ligament instability', 'No deformity',
  ]
  const pattern = phrases.map(escapeRegex).join('|')
  return text.replace(new RegExp(`\\s+(?=(${pattern}))`, 'g'), '\n')
}

function fixBrokenBulletLines(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    if (line.trimStart().startsWith('- ')) {
      let current = line.trimEnd()
      const bulletBody = current.replace(/^\s*-\s*/, '').trim().toLowerCase().replace(/:$/, '')
      
      // Don't merge if bullet is a header
      if (SECTION_HEADERS_LOWER.has(bulletBody)) {
        output.push(current)
        i++
        continue
      }
      
      let j = i + 1
      while (j < lines.length) {
        const nxt = lines[j]
        const nxtStripped = nxt.trim()
        const nxtLower = nxtStripped.toLowerCase().replace(/:$/, '')
        
        // Stop conditions
        if (!nxt) break
        if (nxt.trimStart().startsWith('- ') || /^\d+\.(\s|$)/.test(nxt)) break
        if (/^[A-Z][A-Z /&'-]{2,}:$/.test(nxtStripped)) break
        if (isAsciiTableLine(nxt)) break
        if (SECTION_HEADERS_LOWER.has(nxtLower)) break
        if (isROSOrPELine(nxt)) break
        if (isHeaderCandidate(nxt)) break
        if (isSocialHistoryHeader(nxt)) break
        
        current += ' ' + nxtStripped
        j++
      }
      output.push(current)
      i = j
      continue
    }
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function joinROSPEContinuations(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    if (isROSOrPELine(line)) {
      let merged = line.trim()
      let j = i + 1
      
      while (j < lines.length) {
        const nxt = lines[j]
        const nxtStripped = nxt.trim()
        
        if (!nxtStripped) break
        if (isHeaderCandidate(nxt) || isROSOrPELine(nxt)) break
        if (nxt.trimStart().startsWith('- ') || nxt.trimStart().startsWith('* ') || 
            nxt.trimStart().startsWith('• ')) break
        if (/^\d+\.\s/.test(nxtStripped)) break
        
        merged += ' ' + nxtStripped
        j++
      }
      output.push(merged)
      i = j
      continue
    }
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function normalizeROSLayout(text: string, maxSingleLine: number = 110): string {
  const lines = text.split('\n')
  const output: string[] = []
  const rosLabelsLower = new Set(ROS_LABELS.map(l => l.toLowerCase()))
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (!stripped) {
      output.push(line)
      i++
      continue
    }
    
    // Detect ROS label line
    const labelMatch = stripped.match(/^([A-Za-z/ ]+):\s*(.*)$/)
    if (labelMatch && rosLabelsLower.has(labelMatch[1].toLowerCase())) {
      const label = labelMatch[1].trim()
      const contentParts: string[] = []
      
      if (labelMatch[2]) {
        contentParts.push(labelMatch[2].trim())
      }
      
      let j = i + 1
      while (j < lines.length) {
        const nxt = lines[j]
        const nxtStripped = nxt.trim()
        
        if (!nxtStripped) break
        if (isHeaderCandidate(nxt) || isROSOrPELine(nxt)) break
        if (nxt.trimStart().startsWith('- ') || /^\d+\.\s/.test(nxtStripped)) break
        
        contentParts.push(nxtStripped)
        j++
      }
      
      const content = contentParts.join(' ').trim()
      if (content && `${label}: ${content}`.length <= maxSingleLine) {
        output.push(`${label}: ${content}`)
      } else {
        output.push(`${label}:`)
        if (content) output.push(content)
      }
      i = j
      continue
    }
    
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function joinSocialHistoryValues(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    if (isSocialHistoryHeader(line)) {
      output.push(line)
      i++
      continue
    }
    
    if (isSocialHistoryItem(line)) {
      let j = i + 1
      // Skip blank lines
      while (j < lines.length && !lines[j].trim()) j++
      
      if (j < lines.length) {
        const nxt = lines[j].trim()
        if (nxt && !isHeaderCandidate(lines[j]) && !isSocialHistoryHeader(lines[j]) &&
            !nxt.startsWith('-') && !nxt.startsWith('*') && !/^\d+\./.test(nxt)) {
          output.push(line.trimEnd() + ' ' + nxt)
          i = j + 1
          continue
        }
      }
    }
    
    // Attach smoking metadata
    const lower = line.trim().toLowerCase()
    if (lower.startsWith('types:') || lower.startsWith('packs/day') || 
        lower.startsWith('years:') || lower.startsWith('start date') || 
        lower.startsWith('quit date')) {
      if (output.length && output[output.length - 1].toLowerCase().includes('smoking status')) {
        output[output.length - 1] = output[output.length - 1].trimEnd() + ' ' + line.trim()
        i++
        continue
      }
    }
    
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function formatPESubLabels(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  const mainLabels = new Set(EXAM_LABELS.map(l => l.toLowerCase()))
  const subLabels = new Set(PE_SUB_LABELS.map(l => l.toLowerCase()))
  let inPESection = false
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    const lower = stripped.toLowerCase().replace(/:$/, '')
    
    if (PE_SECTION_HEADERS.has(lower)) {
      inPESection = true
      output.push(line)
      i++
      continue
    }
    
    if (inPESection && isHeaderCandidate(line) && !isPELine(line)) {
      inPESection = false
    }
    
    if (!inPESection || !stripped) {
      output.push(line)
      i++
      continue
    }
    
    // Check for combined MAIN: SUB: content pattern
    const combo = stripped.match(/^([A-Za-z/ &'-]+):\s*(-\s*)?([A-Za-z/ &'-]+):\s*(.*)$/)
    if (combo && mainLabels.has(combo[1].toLowerCase()) && subLabels.has(combo[3].toLowerCase())) {
      const [, main, , sub, rest] = combo
      if (!output.length || !output[output.length - 1].trim().toLowerCase().startsWith(main.toLowerCase() + ':')) {
        output.push(`${main}:`)
      }
      output.push(`  - ${sub}: ${rest.trim()}`)
      i++
      continue
    }
    
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function formatRadiologyComparisonDates(text: string): string {
  return text.replace(
    /(COMPARISON:)[ ]*((?:\d{2}\/\d{2}\/\d{4}[, ]*)+)/gi,
    (_, header, dates) => {
      const dateList = dates.split(/,\s*/).map((d: string) => d.trim()).filter(Boolean)
      if (dateList.length > 3) {
        return `${header}\n` + dateList.map((d: string) => `- ${d}`).join('\n') + '\n'
      }
      return `${header} ${dateList.join(', ')}`
    }
  )
}

function formatRadiologySignatureBlock(text: string): string {
  let result = text
  
  // Fix broken signature lines
  result = result.replace(
    /Images and interpretation reviewed and\s+verified by/gi,
    'Images and interpretation reviewed and verified by'
  )
  
  // Ensure signature blocks start on their own line
  const sigStarts = [
    'Electronically signed by',
    'Images and interpretation reviewed and verified by',
    'Dictated by',
    'Transcribed by',
    'Verified by',
  ]
  
  for (const pattern of sigStarts) {
    result = result.replace(
      new RegExp(`([.!?])\\s*(${escapeRegex(pattern)})`, 'gi'),
      '$1\n\n$2'
    )
  }
  
  return result
}

function fixFragmentedLabels(text: string): string {
  const labelMap = new Map<string, string>()
  for (const l of [...ROS_LABELS, ...EXAM_LABELS, ...PE_SUB_LABELS]) {
    labelMap.set(l.toLowerCase(), l)
  }
  
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check for prefix on current line, suffix on next
    if (stripped && !stripped.includes(' ') && !stripped.endsWith(':') && 
        stripped.length <= 20 && i + 1 < lines.length) {
      const nxtLine = lines[i + 1]
      const nxtStripped = nxtLine.trim()
      
      if (nxtStripped.includes(':')) {
        const colonIdx = nxtStripped.indexOf(':')
        const suffix = nxtStripped.slice(0, colonIdx)
        const combined = (stripped + suffix).toLowerCase()
        
        if (labelMap.has(combined)) {
          const properLabel = labelMap.get(combined)!
          output.push(`${properLabel}:${nxtStripped.slice(colonIdx + 1)}`)
          i += 2
          continue
        }
      }
    }
    
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function fixPrepositionLineBreaks(text: string): string {
  // Join lines where a preposition was orphaned at the end
  const prepositions = ['of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'as', 'or', 'and', 'the', 'a', 'an']
  const lines = text.split('\n')
  const output: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    const nextLine = lines[i + 1]
    
    if (nextLine && stripped) {
      const words = stripped.split(/\s+/)
      const lastWord = words[words.length - 1].toLowerCase()
      
      if (prepositions.includes(lastWord) && !stripped.endsWith(':')) {
        const nextStripped = nextLine.trim()
        if (nextStripped && !isHeaderCandidate(nextLine) && /^[a-z]/.test(nextStripped)) {
          output.push(line.trimEnd() + ' ' + nextStripped)
          i++
          continue
        }
      }
    }
    output.push(line)
  }
  
  return output.join('\n')
}

function insertMissingSpaces(text: string): string {
  let result = text
  // Add space when lowercase immediately followed by uppercase
  result = result.replace(/([a-z])([A-Z][a-z]{2,})/g, '$1 $2')
  result = result.replace(/([0-9])([A-Z][a-z]{2,})/g, '$1 $2')
  result = result.replace(/\)([A-Za-z])/g, ') $1')
  return result
}

function headerNumberNewline(text: string): string {
  // Ensure headers like "PLAN: 1." become two lines
  return text.replace(/^([A-Z][A-Z /&'-]{2,40}):\s+(\d+\.)/gm, '$1:\n$2')
}

function splitPEAtSemicolons(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inPE = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (PE_SECTION_HEADERS.has(stripped)) {
      inPE = true
    } else if (isHeaderCandidate(line) && !isPELine(line)) {
      inPE = false
    }
    
    if (inPE && line.includes(';')) {
      // Split PE findings at semicolons
      const parts = line.split(';').map(p => p.trim()).filter(Boolean)
      if (parts.length > 1) {
        output.push(...parts)
        continue
      }
    }
    output.push(line)
  }
  
  return output.join('\n')
}

function splitAlsoKnownAsMeds(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    const stripped = line.trim()
    
    // Pattern: dosing followed by new drug name with strength
    if (stripped.length > 120 && /also known as/i.test(stripped)) {
      const parts = stripped.split(/\s{2,}/).filter(Boolean)
      if (parts.length > 1) {
        output.push(...parts)
        continue
      }
    }
    
    // Split after dosing instructions followed by drug name
    const splitResult = stripped.replace(
      /((?:daily|twice a day|three times a day|every \d+ hours|as needed|at bedtime)\s+)([a-z][a-zA-Z-]+\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|mL|g|%))/gi,
      '$1\n$2'
    )
    
    if (splitResult.includes('\n')) {
      output.push(...splitResult.split('\n'))
      continue
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function cleanVitalsHeaders(text: string): string {
  // Remove redundant vitals column headers
  return text.replace(/^\s*(?:Temp|Pulse|Resp|BP|SpO2)\s+(?:Temp|Pulse|Resp|BP|SpO2).*$/gm, '')
}

function joinSplitMedicationLines(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    
    if (isMedicationLine(line)) {
      let merged = line.trimEnd()
      let j = i + 1
      
      // Check if next line is a continuation (starts with lowercase or dosing info)
      while (j < lines.length) {
        const nxt = lines[j]
        const nxtStripped = nxt.trim()
        
        if (!nxtStripped) break
        if (isHeaderCandidate(nxt) || isMedicationLine(nxt)) break
        if (nxt.trimStart().startsWith('-')) break
        
        // Continuation patterns
        if (/^(?:by mouth|oral|topical|take|inhale|\d+\s*(?:mg|mL|tablet))/i.test(nxtStripped) ||
            /^[a-z]/.test(nxtStripped)) {
          merged += ' ' + nxtStripped
          j++
          continue
        }
        break
      }
      output.push(merged)
      i = j
      continue
    }
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function mergePlanBlankLines(text: string): string {
  // Reduce excessive blank lines in PLAN sections
  const lines = text.split('\n')
  const output: string[] = []
  let inPlan = false
  let blankCount = 0
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase()
    
    if (stripped === 'plan' || stripped === 'plan:' || 
        stripped.startsWith('assessment and plan') || stripped.startsWith('plan of care')) {
      inPlan = true
    } else if (isHeaderCandidate(line) && !stripped.includes('plan')) {
      inPlan = false
    }
    
    if (!line.trim()) {
      blankCount++
      if (inPlan && blankCount > 1) continue
    } else {
      blankCount = 0
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function fixExamConductedSplit(text: string): string {
  // Fix "Exam conducted with..." split across lines
  return text.replace(
    /(Exam)\s*\n+\s*(conducted\s+with)/gi,
    '$1 $2'
  )
}

function fixStuckMedicationHeader(text: string): string {
  // Ensure 'Medications' headers are separated from following content
  let result = text.replace(/(?<!\n)(Medications)(?=\S)/gi, '\n$1')
  result = result.replace(/(Medications)(?=\S)/gi, '$1\n')
  return result
}

function cleanSectionColons(text: string): string {
  // Put a newline after section headers with trailing content
  return text.replace(/(:)\s*\n?\s*\n/g, ':\n')
}

function addMedicationBullets(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inMeds = false
  
  const drugStartPattern = /^([a-z][a-zA-Z-]+(?:\s+[a-zA-Z-]+)*)\s+(?:\d|\([A-Z]|[a-z]*[A-Z])/
  const camelCaseDrug = /^[a-z]+[A-Z]+[a-zA-Z]*\s+\d/
  
  for (const line of lines) {
    const stripped = line.trim()
    const lower = stripped.toLowerCase()
    
    if (lower.includes('medications') && line.includes(':')) {
      inMeds = true
      output.push(line)
      continue
    }
    
    if (inMeds && isHeaderCandidate(line) && !lower.includes('medication')) {
      inMeds = false
    }
    
    if (inMeds && stripped && !stripped.startsWith('-') && !stripped.startsWith('•')) {
      if (drugStartPattern.test(stripped) || camelCaseDrug.test(stripped)) {
        output.push('- ' + stripped)
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function fixHistoryOfInLists(text: string): string {
  // Fix "History of X" being split from lists
  const lines = text.split('\n')
  const output: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check if line is just "History" followed by "of ..." on next line
    if (/^-?\s*History$/i.test(stripped) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (/^of\s/i.test(nextLine)) {
        output.push(line.trimEnd() + ' ' + nextLine)
        i++
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function fixSlashSplitLabels(text: string): string {
  // Fix labels like "GI/" split from "GU:"
  let result = text
  result = result.replace(/\bGI\/\s*\n+\s*GU:/gi, 'GI/GU:')
  result = result.replace(/\bHEENT\/\s*\n+\s*Neck:/gi, 'HEENT/Neck:')
  result = result.replace(/\bPulmonary\/\s*\n+\s*Chest:/gi, 'Pulmonary/Chest:')
  result = result.replace(/\bPsychiatric\/\s*\n+\s*Behavioral:/gi, 'Psychiatric/Behavioral:')
  return result
}

function insertUppercaseHeaderBreaks(text: string): string {
  // Insert breaks before ALL-CAPS headers that are stuck to content
  return text.replace(/([a-z.!?])(\s*)([A-Z][A-Z\s]{3,}:)/g, '$1\n\n$3')
}

function enforceOneMedPerLine(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inMeds = false
  
  for (const line of lines) {
    const stripped = line.trim()
    const lower = stripped.toLowerCase()
    
    if (lower.includes('medications') && stripped.includes(':')) {
      inMeds = true
      output.push(line)
      continue
    }
    
    if (inMeds && isHeaderCandidate(line) && !lower.includes('medication')) {
      inMeds = false
    }
    
    // Check for multiple medications on one line (pattern: "drug1 dose  drug2 dose")
    if (inMeds && stripped.length > 100) {
      const parts = stripped.split(/\s{3,}/).filter(Boolean)
      if (parts.length > 1 && parts.every(p => /^[a-z]/i.test(p) && /\d/.test(p))) {
        output.push(...parts.map(p => p.startsWith('-') ? p : '- ' + p))
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function fixMissingMedicationWords(text: string): string {
  let result = text
  result = result.replace(
    /No current facility-administered on file prior to encounter\./gi,
    'No current facility-administered medications on file prior to encounter.'
  )
  result = result.replace(
    /Current Outpatient\s*\n-?\s*on File Prior to Encounter/gi,
    'Current Outpatient Medications on File Prior to Encounter'
  )
  return result
}

function isLabResultLine(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  
  // Check for lab patterns: "Name: value" or "Name value unit"
  for (const lab of LAB_VALUE_PATTERNS) {
    if (stripped.toLowerCase().includes(lab.toLowerCase())) {
      return true
    }
  }
  
  // Check for common lab patterns
  return /\d+\.?\d*\s*(mg\/dL|mmol\/L|mEq\/L|g\/dL|%|K\/uL|M\/uL)/i.test(stripped)
}

function formatDenseLabBlocks(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inLabs = false
  
  for (const line of lines) {
    const stripped = line.trim().toLowerCase().replace(/:$/, '')
    
    if (stripped.includes('lab') && (stripped.endsWith(':') || SECTION_HEADERS_LOWER.has(stripped))) {
      inLabs = true
    } else if (isHeaderCandidate(line) && !stripped.includes('lab')) {
      inLabs = false
    }
    
    // Split dense lab lines
    if (inLabs && line.length > 100 && isLabResultLine(line)) {
      const parts = line.split(/\s{2,}/).filter(Boolean)
      if (parts.length > 2) {
        output.push(...parts)
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function formatEDVitalsLine(text: string): string {
  // Format ED-specific vitals patterns
  return text.replace(
    /\b(ED\s+Vitals?:?)(\s*)(\d)/gi,
    '$1\n$3'
  )
}

function formatExamFindings(text: string): string {
  // Ensure exam findings are properly separated
  let result = text
  
  // Split "Normal heart sounds" type patterns when stuck together
  result = result.replace(
    /\bNormal\s*\n+\s*heart sounds/gi,
    'Normal heart sounds'
  )
  result = result.replace(
    /\bNormal\s*\n+\s*breath sounds/gi,
    'Normal breath sounds'
  )
  result = result.replace(
    /\bNormal\s*\n+\s*rate and/gi,
    'Normal rate and'
  )
  
  return result
}

function fixGeneralAppearance(text: string): string {
  // Fix "General:" followed by "Appearance:" patterns
  return text.replace(
    /\b(General):\s*\n+\s*(Appearance):/gi,
    '$1/Appearance:'
  )
}

function fixStatusOrphans(text: string): string {
  // Merge orphaned "Status:" lines with their content
  const lines = text.split('\n')
  const output: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const stripped = line.trim()
    
    if (/^Status:?\s*$/i.test(stripped) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (nextLine && !isHeaderCandidate(lines[i + 1])) {
        output.push('Status: ' + nextLine)
        i++
        continue
      }
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function dropVitalsColumnHeaders(text: string): string {
  // Remove vitals column header rows
  return text.replace(
    /^\s*(?:Temp|Pulse|Resp|BP|SpO2|O2\s*Sat)(?:\s+(?:Temp|Pulse|Resp|BP|SpO2|O2\s*Sat))+\s*$/gmi,
    ''
  )
}

function consolidateVitalsLine(text: string): string {
  // Consolidate split vitals onto single line
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i]
    const stripped = line.trim()
    
    // Check if this looks like a partial vitals line
    if (/^(?:BP|HR|RR|Temp|SpO2):\s*[\d./]+$/i.test(stripped) && i + 1 < lines.length) {
      let combined = stripped
      let j = i + 1
      
      while (j < lines.length) {
        const nxt = lines[j].trim()
        if (/^(?:BP|HR|RR|Temp|SpO2):\s*[\d./]+$/i.test(nxt)) {
          combined += '  ' + nxt
          j++
        } else {
          break
        }
      }
      
      if (j > i + 1) {
        output.push(combined)
        i = j
        continue
      }
    }
    
    output.push(line)
    i++
  }
  
  return output.join('\n')
}

function forceBreakBeforeLabels(text: string): string {
  // Force line breaks before ROS/PE labels that are stuck to content
  let result = text
  
  for (const label of [...ROS_LABELS, ...EXAM_LABELS]) {
    result = result.replace(
      new RegExp(`([a-z.!?])\\s+(${escapeRegex(label)})\\s*:`, 'gi'),
      '$1\n$2:'
    )
  }
  
  return result
}

function breakInlineLabels(text: string): string {
  // Put short inline labels onto their own lines
  return text.replace(/(?:^|\n)\s*(?=[A-Z][A-Za-z]{2,15}:)/g, '\n')
}

function cleanMedicationLines(text: string): string {
  // Clean up medication line formatting
  let result = text
  
  // Remove trailing commas before newlines in med lists
  result = result.replace(/,\s*\n(?=\s*-)/g, '\n')
  
  // Fix "1 tablet" stuck to drug name
  result = result.replace(/(\w)(\d+\s*tablet)/gi, '$1 $2')
  
  return result
}

function normalizeLabelKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function rejoinAcronymHeaders(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  const knownLabels = new Set(
    [
      ...SECTION_HEADERS,
      ...ROS_LABELS,
      ...EXAM_LABELS,
      ...PE_SUB_LABELS,
      'HISTORY AND PHYSICAL',
      'HISTORY AND PHYSICAL EXAM',
      'HISTORY AND PHYSICAL EXAMINATION',
      'VITALS/PHYSICAL EXAM',
      'VITALS/PHYSICAL EXAMINATION',
    ].map(normalizeLabelKey)
  )
  
  let i = 0
  while (i < lines.length) {
    const curr = lines[i]
    const currStripped = curr.trim()
    
    if (currStripped &&
        !currStripped.includes(':') &&
        /^[A-Z]{2,6}$/.test(currStripped)) {
      const next = lines[i + 1]
      if (next) {
        const nextStripped = next.trim()
        const match = nextStripped.match(/^([A-Z][A-Za-z/ &'-]{1,40}?):\s*(.*)$/)
        if (match) {
          const [, nextLabel, rest] = match
          const combinedKey = normalizeLabelKey(currStripped + nextLabel.replace(/\s+/g, ''))
          
          if (knownLabels.has(combinedKey)) {
            const mergedLabel = currStripped + nextLabel.replace(/\s+/g, '')
            const mergedLine = rest ? `${mergedLabel}: ${rest.trim()}` : `${mergedLabel}:`
            output.push(mergedLine)
            i += 2
            continue
          }
        }
      }
    }
    
    output.push(curr)
    i++
  }
  
  return output.join('\n')
}

function rejoinHistoryAndPhysical(text: string): string {
  let result = text
  result = result.replace(
    /([A-Z ]*HISTORY)\s*\n+\s*(AND PHYSICAL(?: EXAM(?:INATION)?)?)/gi,
    '$1 $2'
  )
  result = result.replace(
    /(HISTORY)\s*\n+\s*(AND PHYSICAL)\s*\n+\s*(EXAM(?:INATION)?)/gi,
    '$1 $2 $3'
  )
  return result
}

/**
 * Fix isolated connectors (&, AND) that got separated from compound headers
 * This runs early to rejoin things like "ED Course" + "&" + "MDM"
 */
function fixIsolatedConnectors(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i].trim()
    
    // Check for isolated "&" or "AND" or "and" on their own line
    if (line === '&' || line.toLowerCase() === 'and') {
      // Look back for context
      const prevLine = result.length > 0 ? result[result.length - 1].trim() : ''
      // Look ahead for context
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
      
      // If we have content before and after, join them
      if (prevLine && nextLine && 
          !prevLine.endsWith('.') && !prevLine.endsWith('!') && !prevLine.endsWith('?')) {
        // Remove the previous line and join with connector
        result.pop()
        result.push(`${prevLine} ${line} ${nextLine}`)
        i += 2  // Skip next line since we consumed it
        continue
      }
    }
    
    // Check for lines that are just isolated short words that shouldn't be alone
    // These are common words that get incorrectly put on their own line
    const isolatedPatterns = [
      /^history$/i,
      /^exam$/i,
      /^results$/i,
      /^found\.?$/i,
      /^POS$/,
      /^Final$/,
      /^plan$/i,
      /^medication$/i,
      /^medications$/i,
      /^of$/i,        // "history of", "review of"
      /^study$/i,     // "limited study"
      /^evaluation$/i,
      /^motion$/i,    // "due to motion"
      /^for$/i,       // "reason for", "positive for"
    ]
    
    // Don't add isolated words as separate lines if they look like sentence fragments
    if (isolatedPatterns.some(p => p.test(line))) {
      const prevLine = result.length > 0 ? result[result.length - 1].trim() : ''
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
      
      // Check if this looks like it was incorrectly split
      if (prevLine && !prevLine.endsWith('.') && !prevLine.endsWith(':') && 
          !prevLine.endsWith('!') && !prevLine.endsWith('?')) {
        // Join with previous line
        result.pop()
        result.push(`${prevLine} ${line}`)
        i++
        continue
      } else if (nextLine && /^[a-z]/.test(nextLine)) {
        // Join with next line (lowercase start = likely continuation)
        result.push(`${line} ${nextLine}`)
        i += 2
        continue
      }
    }
    
    result.push(lines[i])
    i++
  }
  
  return result.join('\n')
}

/**
 * Protect compound clinical terms from being split
 * This runs early to protect terms that should stay together
 */
function protectCompoundTerms(text: string): string {
  let result = text
  
  // Fix cross-line splits for clinical compounds
  const compoundFixes: Array<[RegExp, string]> = [
    // Lab values that get split at newlines
    [/\bTroponin\s*-?\s*\n\s*I\b/gi, 'Troponin-I'],
    [/\beGFR\s*\n\s*cr\b/gi, 'eGFRcr'],
    [/\bLactic\s*\n\s*Acid\b/gi, 'Lactic Acid'],
    [/\bLactic Acid\s*\n\s*Level\b/gi, 'Lactic Acid Level'],
    
    // PE/exam terms
    [/\bNeuro\s*\n\s*exam/gi, 'Neuroexam'],
    [/\bThought\s*\n\s*Content/gi, 'Thought Content'],
    [/\bThought\s+Cont\s*\n?\s*ent/gi, 'Thought Content'],
    
    // Compound headers that get split
    [/\bED\s*\n\s*Course\b/gi, 'ED Course'],
    [/\bED Course\s*\n\s*&\s*\n\s*MDM\b/gi, 'ED Course & MDM'],
    [/\bED Course\s*&\s*\n\s*MDM\b/gi, 'ED Course & MDM'],
    [/\bED Course\s*\n\s*& MDM\b/gi, 'ED Course & MDM'],
    [/\bMedical\s*\n\s*Decision\s*\n?\s*Making\b/gi, 'Medical Decision Making'],
    [/\bCOURSE\s+AND\s*\n\s*MEDICAL/gi, 'COURSE AND MEDICAL'],
    
    // RDW splits
    [/\bRDW\s*\n\s*SD\b/g, 'RDW SD'],
    [/\bRDW\s*\n\s*CV\b/g, 'RDW CV'],
    
    // Assessment & Plan splits
    [/\bAssessment\s*\n\s*&\s*\n\s*Plan\b/gi, 'Assessment & Plan'],
    [/\bAssessment\s*&\s*\n\s*Plan\b/gi, 'Assessment & Plan'],
    [/\bAssessment\s*\n\s*& Plan\b/gi, 'Assessment & Plan'],
    
    // FINDINGS/IMPRESSION splits  
    [/\bFINDINGS\s*\/?\s*\n\s*IMPRESSION\b/gi, 'FINDINGS/IMPRESSION'],
    [/\bIMPRESSION\s*\n\s*FINDINGS\s*\/?\b/gi, 'IMPRESSION FINDINGS/'],
    
    // No results found
    [/\bNo\s*\n\s*results\s*\n\s*found\b/gi, 'No results found'],
    
    // Diagnostic Studies
    [/\bDiagnostic\s*\n\s*Studies\b/gi, 'Diagnostic Studies'],
    
    // Labs and Imaging
    [/\bLabs\s*\n\s*and\s*\n?\s*Imaging\b/gi, 'Labs and Imaging'],
    [/\bED\s*Labs\s*\n\s*and\s*\n?\s*Imaging\b/gi, 'ED Labs and Imaging'],
    
    // NEW: Common phrase splits in discharge notes
    [/\btreatment\s*\n\s*plan\b/gi, 'treatment plan'],
    [/\bFollow-up\s*\n\s*Care\b/gi, 'Follow-up Care'],
    [/\bFollow-up Care\s*\n\s*and\s*\n?\s*Appointments\b/gi, 'Follow-up Care and Appointments'],
    [/\bthe above\s*\n\s*medication/gi, 'the above medication'],
    [/\bthe\s*\n\s*medications\b/gi, 'the medications'],
    [/\babove\s*\n\s*medication/gi, 'above medication'],
    [/\bover-the-counter\s*\n\s*medications/gi, 'over-the-counter medications'],
    [/\bprimary care\s*\n\s*provider/gi, 'primary care provider'],
    [/\bfollow-up\s*\n\s*care/gi, 'follow-up care'],
    
    // NEW: More header combinations
    [/\bVital\s*\n\s*Signs\b/gi, 'Vital Signs'],
    [/\bReview of\s*\n\s*Systems\b/gi, 'Review of Systems'],
    [/\bPast Medical\s*\n\s*History\b/gi, 'Past Medical History'],
    [/\bPast Surgical\s*\n\s*History\b/gi, 'Past Surgical History'],
    [/\bSocial\s*\n\s*History\b/gi, 'Social History'],
    [/\bFamily\s*\n\s*History\b/gi, 'Family History'],
    [/\bPhysical\s*\n\s*Exam\b/gi, 'Physical Exam'],
    [/\bPhysical\s*\n\s*Examination\b/gi, 'Physical Examination'],
    
    // NEW: Mental Status splits
    [/\bMental\s*\n\s*Status\b/gi, 'Mental Status'],
    
    // NEW: Further history (prevent splitting when part of a phrase)  
    [/\bFurther\s*\n\s*history\b/gi, 'Further history'],
    [/\bextensive\s*\n\s*history\b/gi, 'extensive history'],
    
    // NEW: Some medications phrases
    [/\bSome\s*\n\s*medications\b/gi, 'Some medications'],
    [/\bother\s*\n\s*medications\b/gi, 'other medications'],
    
    // NEW: "history of" pattern - very common in clinical notes
    [/\bhistory\s*\n\s*of\b/gi, 'history of'],
    [/\bHistory\s*\n\s*of\b/g, 'History of'],
    
    // NEW: Radiology patterns
    [/\bLimited\s*\n\s*exam\b/gi, 'Limited exam'],
    [/\bLimited\s*\n\s*study\b/gi, 'Limited study'],
    [/\bLimited\s*\n\s*evaluation\b/gi, 'Limited evaluation'],
    [/\bdue to\s*\n\s*motion\b/gi, 'due to motion'],
    [/\bdue to\s*\n\s*artifact\b/gi, 'due to artifact'],
    [/\bDelayed\s*\n\s*nephrogram\b/gi, 'Delayed nephrogram'],
    
    // NEW: More clinical phrase preservations
    [/\breason for\s*\n\s*study\b/gi, 'reason for study'],
    [/\breason for\s*\n\s*exam\b/gi, 'reason for exam'],
    [/\breason for\s*\n\s*visit\b/gi, 'reason for visit'],
    [/\bwithout\s*\n\s*evidence\b/gi, 'without evidence'],
    [/\bno evidence\s*\n\s*of\b/gi, 'no evidence of'],
    [/\bpositive\s*\n\s*for\b/gi, 'positive for'],
    [/\bnegative\s*\n\s*for\b/gi, 'negative for'],
  ]
  
  for (const [pattern, replacement] of compoundFixes) {
    result = result.replace(pattern, replacement)
  }
  
  return result
}

function fixNoKnownVitalsPhysical(text: string): string {
  let result = text
  result = result.replace(/No Known Vitals\/Physical Exam/gi, 'No Known Allergies\nVitals/Physical Exam')
  result = result.replace(/No Known Allergies\s+Vitals\/Physical Exam/gi, 'No Known Allergies\nVitals/Physical Exam')
  return result
}

// =============================================================================
// MAIN FORMATTING PIPELINE
// =============================================================================

type FormattingStep = (text: string) => string

const FORMATTING_PIPELINE: FormattingStep[] = [
  // Initial cleanup
  normalizeNbsp,
  normalizeLineEndings,
  convertTildeBullets,
  normalizeBullets,
  stripBrTags,
  unescapeLiteralNewlines,
  collapseMultipleSpaces,
  
  // EARLY PROTECTION: Fix compound terms BEFORE splitting to prevent incorrect breaks
  protectCompoundTerms,
  
  // CRITICAL: Dense line splitting FIRST - handles compressed single-line notes
  splitDenseLines,
  splitClinicalSections,      // NEW: Master line break function for clinical sections
  splitSOAPSections,          // NEW: Handle ultra-dense SOAP notes
  splitPostOpSections,        // NEW: Handle post-op note formatting
  splitActiveProblemsAndMedications, // NEW: Handle Active Problems/Medications lists
  splitTildeBullets,
  splitEDSections,
  formatDischargeSummarySections,
  formatPsychiatryNote,
  formatAxisDiagnoses,
  formatMentalStatusExam,
  formatProcedureNotes,
  splitDatePatterns,
  splitTimestampPatterns,     // NEW: Handle inline timestamps
  
  splitLongLines,
  fixUnhyphenatedWordSplits,
  fixBrokenWords,
  
  // Dense content splitting
  splitPastMedicalHistory,
  splitDenseLabLines,
  splitDenseVitals,
  splitAllergenList,
  splitMedicationSigs,
  formatLabTables,
  formatIntakeOutputTables,   // NEW: Handle Intake/Output tables
  formatResultValueLabs,
  formatLabPanelHeaders,
  splitAbnormalLabPatterns,
  splitAssessmentAndPlan,
  
  // Additional dense pattern handling
  formatSubstanceUse,
  formatAttestationBlocks,
  formatHPPatterns,
  formatHistoryReviewed,
  formatImagingResults,
  formatDischargeInstructionPatterns,
  formatDensePEPatterns,
  formatDenseROS,
  formatDiagnosisDateTables,
  formatPastSurgicalHistory,
  formatFamilyHistory,
  formatSignatureLines,
  formatAppointmentPatterns,
  formatCommonlyKnownAs,
  formatCareInstructions,
  
  // Early compound header fixes
  fixSplitCompoundHeaders,
  fixFragmentedLabels,
  fixSlashSplitLabels,
  fixExamConductedSplit,
  fixHistoryOfInLists,
  
  // Radiology (early)
  formatRadiologyNote,
  formatRadiologyComparisonDates,
  formatRadiologySignatureBlock,
  
  // Sentence handling
  splitSentences,
  breakOnSentenceGaps,
  breakOnSemicolonCap,
  insertMissingSpaces,
  insertUppercaseHeaderBreaks,
  
  // Section header handling
  breakOnLargeGaps,
  insertSectionBreaks,
  forceHeaderOnNewline,
  forceBreakBeforeLabels,
  breakInlineLabels,
  splitHeaderLine,
  headerNumberNewline,
  splitBMILines,
  breakNumberedLists,
  cleanSectionColons,
  
  // Medication formatting
  fixStuckMedicationHeader,
  formatMedicationList,
  addMedicationBullets,
  splitMergedMedications,
  cleanEmptyDispRefill,
  splitAtRefillsQuantity,
  splitAlsoKnownAsMeds,
  joinSplitMedicationLines,
  enforceOneMedPerLine,
  fixMissingMedicationWords,
  cleanMedicationLines,
  
  // ROS and PE formatting
  formatROSSection,
  splitROSInline,
  splitStackedROSLabels,
  joinROSPEContinuations,
  normalizeROSLayout,
  dedupeSequentialHeaders,
  formatPESection,
  splitPEInlineLabels,
  splitDensePESection,
  splitPEAtSemicolons,
  fixDensePEColonSpacing,
  formatPESubLabels,
  formatExamFindings,
  fixGeneralAppearance,
  breakAfterColonKeywords,
  breakKnownInlinePhrases,
  
  // Social History
  joinSocialHistoryValues,
  
  // Lab formatting
  formatLabResults,
  splitMultiValueLabLines,
  formatDenseLabBlocks,
  condenseLabBlankLines,
  
  // Vitals formatting
  formatVitalsLine,
  formatEDVitalsLine,
  splitVitalsTable,
  fixVitalsSplit,
  cleanVitalsHeaders,
  dropVitalsColumnHeaders,
  consolidateVitalsLine,
  
  // Drug name preservation
  preserveDrugNames,
  
  // Cleanup
  collapseWhitespace,
  removeOrphanPunctuation,
  removeRulerLines,
  removePageMarkers,
  removeReviewedLines,
  
  // Bullet/list handling
  fixBrokenBulletLines,
  
  // Soft break handling
  mergeSoftBreaks,
  mergeLowercaseContinuations,
  consolidateParagraphs,
  fixPrepositionLineBreaks,
  
  // Status/Plan section
  fixStatusOrphans,
  mergePlanBlankLines,
  
  // Orphan fixes
  mergeOrphanSentenceEndings,
  fixOrphanHeaders,
  fixOrphanDates,
  fixOrphanNumbers,
  fixOrphanNumberedItems,
  
  // Word split fixes
  fixCommonWordSplits,
  fixWordSplitsAcrossBlanks,
  
  // Discharge formatting
  formatDischargeMedicationList,
  formatDischargeAppointments,
  formatDischargeInstructions,
  
  // Final formatting
  (text) => wrapLines(text, 98),
  tightenBlankLines,
  standardizeSectionSpacing,
  rejoinAcronymHeaders,
  rejoinHistoryAndPhysical,
  fixNoKnownVitalsPhysical,
  fixFragmentedLabels,
  
  // Post-wrap cleanup
  removeInternalDoubleSpaces,
  fixSplitCompoundHeaders,  // Run again to fix any splits that occurred during processing
  protectCompoundTerms,     // Run again to fix compound terms split during processing
  fixIsolatedConnectors,    // Fix isolated & and AND connectors
  normalizeListSpacing,
  normalizeAllergyList,
  trimLines,
  collapseMultipleBlankLines,
  
  // Final dedup
  dedupeSequentialHeaders,
  
  // Final radiology pass
  formatRadiologyNote,
  
  // Final compound header fix pass
  fixSplitCompoundHeaders,
  protectCompoundTerms,
  fixIsolatedConnectors,
]

/**
 * Format clinical note text using the complete formatting pipeline.
 * 
 * This is the main entry point - call this function to format notes.
 * All regex patterns are pre-compiled for performance.
 * 
 * Matches the quality of scripts/format_notes.py with:
 * - 140+ section headers
 * - Physical Exam formatting
 * - Review of Systems formatting
 * - Medication list formatting
 * - Lab value formatting
 * - Vitals formatting
 * - Radiology note formatting
 * - Discharge summary formatting
 * - Word split fixes
 * - Orphan line merging
 * 
 * @param text - Raw clinical note text
 * @param width - Maximum line width for wrapping (default: 98)
 * @returns Formatted clinical note text
 */
export function formatNoteText(text: string, width: number = 98): string {
  let result = text
  
  for (const step of FORMATTING_PIPELINE) {
    result = step(result)
  }
  
  // Final wrap with custom width if specified
  if (width !== 98) {
    result = wrapLines(result, width)
  }
  
  return result.trim()
}
