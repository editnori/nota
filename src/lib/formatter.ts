/**
 * Clinical Note Formatter - Complete TypeScript Port
 * 
 * Comprehensive formatter for clinical notes with:
 * - 140+ section headers
 * - Physical Exam subsection formatting
 * - Review of Systems formatting
 * - Lab value formatting
 * - Medication list formatting
 * - Drug name preservation
 * - Abbreviation handling
 * - Vitals formatting
 * - Discharge summary formatting
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
  // Medications
  'MEDICATIONS', 'MEDICATION', 'CURRENT MEDICATIONS', 'DISCHARGE MEDICATIONS',
  'MEDICATIONS ON ADMISSION', 'MEDICATIONS ON DISCHARGE', 'ACTIVE MEDICATIONS',
  'HOME MEDICATIONS', 'OUTPATIENT MEDICATIONS', 'CURRENT OUTPATIENT MEDICATIONS',
  'CURRENT OUTPATIENT MEDICATIONS ON FILE PRIOR TO ENCOUNTER',
  'MEDICATIONS (PRIOR TO CURRENT ENCOUNTER)', 'ORDERS PLACED THIS ENCOUNTER',
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
  'VITAL SIGNS', 'VITALS', 'VS',
  // Labs/Imaging
  'LABS', 'LAB RESULTS', 'LABORATORY', 'LABORATORY DATA', 'LABORATORY RESULTS',
  'LABORATORY STUDIES', 'MOST RECENT PREOPERATIVE LABS',
  'IMAGING', 'IMAGING STUDIES', 'RADIOLOGY', 'DIAGNOSTIC STUDIES', 'STUDIES', 'RESULTS',
  // Procedures/Surgery
  'PROCEDURE', 'PROCEDURES', 'OPERATIVE PROCEDURE', 'OPERATION', 'OPERATION PERFORMED',
  'SURGERY', 'SURGERY ORDER', 'SURGERY TYPE', 'PREOPERATIVE INFO', 'PREOPERATIVE INFORMATION',
  'PREOPERATIVE DIAGNOSIS', 'POSTOPERATIVE DIAGNOSIS', 'POSTOPERATIVE PLAN', 'POST OP FOLLOW UP',
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
  // Radiology
  'FINDINGS', 'TECHNIQUE', 'INDICATION', 'COMPARISON', 'CLINICAL HISTORY',
  'CLINICAL INDICATION', 'IMPRESSION/RECOMMENDATION',
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
  'eGFR', 'eGFRAA', 'Urine Color', 'Urine Appearance', 'Urine Specific Gravity',
  'Urine pH', 'Urine Glucose', 'Urine Protein', 'Urine Ketones', 'Urine Bilirubin',
  'Urine Urobilinogen', 'Urine Leukocyte', 'Urine Nitrite', 'Urine Blood',
  'Urine RBC', 'Urine Bacteria', 'Urine Squamous Epithelial Cells',
  'Urine Mucous', 'Urine Hyaline Casts', 'Urine Triple Phosphate',
] as const

// Negation prefixes (used in ROS/symptom context)
const NEGATION_PREFIXES: readonly string[] = [
  'no ', 'not ', 'denies ', 'negative for ', 'without ', 'absent ',
] as const

// Export for use in other modules
export { NEGATION_PREFIXES }

// Common abbreviations to avoid splitting sentences incorrectly
const ABBREVIATIONS: readonly string[] = [
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'vs.', 'no.', 'pt.', 'hx.', 'dx.',
  'tx.', 'hx', 'dx', 'tx', 'st.', 'rd.', 'ave.', 'dr', 'mr', 'mrs', 'ms',
  'vs', 'i.e.', 'e.g.', 'etc.', 'approx.', 'ca.', 'cf.', 'et al.', 'vol.',
  'yr.', 'mo.', 'wk.', 'hr.', 'min.', 'sec.', 'oz.', 'lb.', 'kg.', 'mg.',
  'mcg.', 'ml.', 'cm.', 'mm.', 'in.', 'ft.', 'a.m.', 'p.m.', 'b.i.d.',
  't.i.d.', 'q.i.d.', 'p.r.n.', 'q.d.', 'q.h.', 'q.o.d.', 'h.s.', 'a.c.',
  'p.c.', 'stat.', 'prn.', 'bid.', 'tid.', 'qid.', 'qd.', 'qh.', 'qod.',
] as const

// Sections that need explicit breaks before them
const BREAK_BEFORE_LABELS: readonly string[] = [
  'ATTESTATION', 'PROVIDER ATTESTATION', 'SURGERY ORDER', 'DESCRIPTION',
  'STATUS', 'SURGERY TYPE', 'POST OP FOLLOW UP', 'NOTE DETAILS',
  'REVISION HISTORY', 'SIGNIFICANT RELEVANT COMORBIDITIES',
  'PATIENT ACTIVE PROBLEM LIST', 'MEDICATIONS (PRIOR TO CURRENT ENCOUNTER)',
  'CURRENT OUTPATIENT MEDICATIONS ON FILE PRIOR TO ENCOUNTER',
  'ORDERS PLACED THIS ENCOUNTER',
] as const

// =============================================================================
// PRE-COMPILED REGEX PATTERNS
// =============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Sort headers by length (longest first) for proper matching
const SECTION_HEADERS_SORTED = [...SECTION_HEADERS].sort((a, b) => b.length - a.length)
const SECTION_HEADERS_JOINED = SECTION_HEADERS_SORTED.map(escapeRegex).join('|')

// Pre-compiled patterns for section headers
const PATTERNS = {
  // Basic cleanup
  lineEndings: /\r\n|\r/g,
  multipleBlankLines: /\n{3,}/g,
  multipleSpaces: /[ \t]{2,}/g,
  nbsp: /\u00a0/g,
  brTags: /<br\s*\/?>/gi,
  literalNewlines: /\\n/g,
  
  // Section headers - combined pattern for all headers
  sectionHeaders: new RegExp(
    `(?<!\n\n)(?<!\n)(${SECTION_HEADERS_JOINED})`,
    'gi'
  ),
  
  // Insert breaks before headers
  insertSectionBreaks: new RegExp(
    `(?:^|(?<=\n)|(?<=[.;]))\\s*(?=(${SECTION_HEADERS_JOINED})(?:\\b|:))`,
    'gi'
  ),
  
  // Force header on newline
  forceHeaderNewline: new RegExp(
    `(?<=\\S)\\s+(?=(${SECTION_HEADERS_JOINED})(?:\\b|:))`,
    'gi'
  ),
  
  // Ensure header newline
  ensureHeaderNewline: new RegExp(
    `\\b(${SECTION_HEADERS_JOINED})(:?)(\\s+)([^\n]+)`,
    'gi'
  ),
  
  // Split header line
  splitHeaderLine: new RegExp(
    `^(\\s*-?\\s*)(${SECTION_HEADERS_JOINED})(:?)(\\s+)(.+)$`,
    'gim'
  ),
  
  // Run-together patterns
  runTogether: /([a-z])([A-Z]{2,}:)/g,
  colonHeaderSpacing: /([A-Z]{2,}:)\s*\n\s*\n/g,
  
  // Large gaps (3+ spaces)
  largeGaps: /[ \t]{3,}/g,
  
  // Numbered list at start of line with large gap
  numberedListGap: /^(\s*\d+\.)\s{2,}(\S)/gm,
  inlineNumberedGap: /(\d+\.)\s{2,}(\S)/g,
  
  // BMI pattern
  bmi: /(?:BMI\s+[0-9]+(?:\.[0-9]+)?\s*kg\/m²)/gi,
  
  // Vitals patterns
  vitalsLine: /(?:BP|HR|RR|Temp|SpO2|O2\s*Sat|Pulse|Weight|Height|BMI)[\s:]+[\d./]+/gi,
  
  // Lab panel headers
  labPanel: /^(CBC|BMP|CMP|AUTO DIFF|HEPATIC|URINALYSIS|BLOOD GAS|COAGULATION)/i,
  
  // Medication patterns
  medicationDose: /(\d+)\s*(mg|mcg|mL|g)([- ])/g,
  dispenseRefill: /,?\s*Disp:\s*,?\s*Rfl:\s*/g,
  
  // Drug name patterns (preserve camelCase drug names)
  drugNames: [
    { pattern: /\bam\s*LODIPine\b/gi, replacement: 'amLODIPine' },
    { pattern: /\bsil\s*denafi\s*L\b/gi, replacement: 'sildenafiL' },
    { pattern: /\btada\s*lafi\s*L\b/gi, replacement: 'tadalafiL' },
    { pattern: /\bPri\s*LOSEC\b/gi, replacement: 'PriLOSEC' },
    { pattern: /\bm\s*L\b/g, replacement: 'mL' },
  ],
  
  // Sentence boundaries
  sentenceEnd: /([.!?])\s+([A-Z])/g,
  semicolonCap: /;\s*([A-Z])/g,
  
  // Page markers
  pageMarkers: /(?:^|\n)\s*(?:Page\s+\d+(?:\s+of\s+\d+)?|---+|\*\*\*+)\s*(?:\n|$)/gi,
  
  // Ruler lines
  rulerLines: /^[-=_*]{3,}$/gm,
  
  // Orphan punctuation
  orphanPunctuation: /^\s*[.,;:!?]\s*$/gm,
  
  // Whitespace
  leadingWhitespace: /^[ \t]+/gm,
  trailingWhitespace: /[ \t]+$/gm,
  internalDoubleSpaces: /([^\s])  +([^\s])/g,
} as const

// ROS/PE labels lower-cased set for fast lookup
const ROS_PE_LABELS_LOWER = new Set([
  ...ROS_LABELS.map(l => l.toLowerCase()),
  ...EXAM_LABELS.map(l => l.toLowerCase()),
])

// PE section headers
const PE_SECTION_HEADERS = new Set([
  'physical exam', 'physical examination', 'pe', 'physical findings', 'objective exam', 'exam', 'examination'
])

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isHeaderCandidate(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  
  // Check if line matches any section header
  const lower = stripped.toLowerCase().replace(/:$/, '')
  for (const header of SECTION_HEADERS) {
    if (lower === header.toLowerCase()) return true
  }
  
  // Check for all-caps words that might be headers
  if (/^[A-Z][A-Z\s/&]+:?$/.test(stripped) && stripped.length <= 50) {
    return true
  }
  
  return false
}

function isPELine(line: string): boolean {
  const stripped = line.trim().toLowerCase()
  return ROS_PE_LABELS_LOWER.has(stripped.replace(/:$/, ''))
}

function isROSOrPELine(line: string): boolean {
  return isPELine(line)
}

function isAsciiTableLine(line: string): boolean {
  const stripped = line.trim()
  if (!stripped) return false
  
  const firstChar = stripped[0]
  
  // Table border lines
  if (firstChar === '+' && (stripped.includes('---') || stripped.includes('==='))) {
    return true
  }
  
  // Table row lines
  if (firstChar === '|' && (stripped.match(/\|/g) || []).length >= 2) {
    return true
  }
  
  return false
}

function isNumberedListItem(line: string): boolean {
  return /^\s*\d+[.)]\s/.test(line)
}

function isMedicationLine(line: string): boolean {
  const lower = line.toLowerCase()
  // Check for common medication patterns
  return /\d+\s*(mg|mcg|ml|g|tablet|capsule|inhaler)\b/i.test(line) ||
         /\b(take|inhale|apply|inject)\s+\d/i.test(line) ||
         /\b(daily|twice|three times|once|bid|tid|qid|prn)\b/i.test(lower)
}

// =============================================================================
// CORE FORMATTING FUNCTIONS
// =============================================================================

function normalizeNbsp(text: string): string {
  return text.replace(PATTERNS.nbsp, ' ')
}

function stripBrTags(text: string): string {
  let result = text.replace(PATTERNS.brTags, '\n')
  result = result.replace(/(?:^|\n)\s*br>\s*(?:\n|$)/gm, '\n')
  return result
}

function unescapeLiteralNewlines(text: string): string {
  return text.replace(PATTERNS.literalNewlines, '\n')
}

function normalizeLineEndings(text: string): string {
  return text.replace(PATTERNS.lineEndings, '\n')
}

function collapseMultipleBlankLines(text: string): string {
  return text.replace(PATTERNS.multipleBlankLines, '\n\n')
}

function collapseMultipleSpaces(text: string): string {
  return text.replace(PATTERNS.multipleSpaces, ' ')
}

function preserveDrugNames(text: string): string {
  let result = text
  for (const { pattern, replacement } of PATTERNS.drugNames) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function breakOnLargeGaps(text: string): string {
  // First, collapse big gaps after numbered list markers
  let result = text.replace(PATTERNS.numberedListGap, '$1 $2')
  result = result.replace(PATTERNS.inlineNumberedGap, '$1 $2')
  
  // Split at 3+ spaces (except in ASCII tables)
  const lines = result.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Skip ASCII table lines
    if (isAsciiTableLine(line)) {
      output.push(line)
      continue
    }
    // Split on runs of 3+ spaces
    const parts = line.split(PATTERNS.largeGaps)
    output.push(...parts)
  }
  
  return output.join('\n')
}

function insertSectionBreaks(text: string): string {
  // Insert newline before known section headers
  let result = text
  
  for (const header of SECTION_HEADERS_SORTED) {
    const pattern = new RegExp(
      `(?<![\\n])(?=[\\s]*(${escapeRegex(header)})(?:\\b|:))`,
      'gi'
    )
    result = result.replace(pattern, '\n\n')
  }
  
  return result
}

function forceHeaderOnNewline(text: string): string {
  // Force headers that appear mid-line to start on their own line
  let result = text
  
  for (const header of SECTION_HEADERS_SORTED) {
    const pattern = new RegExp(
      `(?<=\\S)[ \\t]+(${escapeRegex(header)})(:?)`,
      'gi'
    )
    result = result.replace(pattern, '\n\n$1$2')
  }
  
  return result
}

function splitHeaderLine(text: string): string {
  // Split lines where header and content are on same line
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    let matched = false
    
    for (const header of SECTION_HEADERS_SORTED) {
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

function splitBMILines(text: string): string {
  return text.replace(PATTERNS.bmi, '\n$&\n')
}

function forceBreakBeforeLabels(text: string): string {
  let result = text
  
  for (const label of BREAK_BEFORE_LABELS) {
    const pattern = new RegExp(
      `(?:^|(?<=\\n))\\s*(?=(${escapeRegex(label)})(?::|\\b))`,
      'gi'
    )
    result = result.replace(pattern, '\n')
  }
  
  return result
}

function removePageMarkers(text: string): string {
  return text.replace(PATTERNS.pageMarkers, '\n')
}

function removeRulerLines(text: string): string {
  return text.replace(PATTERNS.rulerLines, '')
}

function removeOrphanPunctuation(text: string): string {
  return text.replace(PATTERNS.orphanPunctuation, '')
}

function collapseWhitespace(text: string): string {
  let result = text.replace(PATTERNS.leadingWhitespace, '')
  result = result.replace(PATTERNS.trailingWhitespace, '')
  return result
}

function removeInternalDoubleSpaces(text: string): string {
  return text.replace(PATTERNS.internalDoubleSpaces, '$1 $2')
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
    
    // Detect ROS section start
    if (stripped.startsWith('review of systems') || stripped === 'ros' || stripped === 'ros:') {
      inROS = true
      output.push(line)
      continue
    }
    
    // Exit ROS on other major headers
    if (inROS && isHeaderCandidate(line) && !isROSOrPELine(line)) {
      inROS = false
    }
    
    if (inROS) {
      // Check for ROS labels
      for (const label of ROS_LABELS) {
        const labelLower = label.toLowerCase()
        if (stripped.startsWith(labelLower)) {
          // Ensure label is on its own line or properly formatted
          const colonIdx = line.indexOf(':')
          if (colonIdx > 0 && colonIdx < line.length - 1) {
            // Label with content - keep on same line but ensure formatting
            output.push(line)
          } else {
            output.push(line)
          }
          break
        }
      }
      if (!ROS_LABELS.some(l => stripped.startsWith(l.toLowerCase()))) {
        output.push(line)
      }
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function splitROSInline(text: string): string {
  // Split ROS content that runs into the next label
  let result = text
  
  for (const label of ROS_LABELS) {
    // Pattern: content followed by ROS label
    const pattern = new RegExp(
      `([.;,])\\s*(${escapeRegex(label)})\\s*:`,
      'gi'
    )
    result = result.replace(pattern, '$1\n$2:')
  }
  
  return result
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
    
    // Detect PE section start
    if (PE_SECTION_HEADERS.has(stripped)) {
      inPE = true
      output.push(line)
      continue
    }
    
    // Exit PE on other major headers (not PE subsections)
    if (inPE && isHeaderCandidate(line) && !isPELine(line)) {
      inPE = false
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function splitPEInlineLabels(text: string): string {
  // Split PE content that runs into the next exam label
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
  // Split dense PE sections where everything is on one line
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check if line contains multiple PE labels
    let labelCount = 0
    for (const label of EXAM_LABELS) {
      const pattern = new RegExp(`\\b${escapeRegex(label)}\\s*:`, 'gi')
      const matches = line.match(pattern)
      if (matches) labelCount += matches.length
    }
    
    if (labelCount > 1) {
      // Split at each label
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
    
    // Detect medication section
    if (medHeaders.includes(stripped)) {
      inMeds = true
      output.push(line)
      continue
    }
    
    // Exit on other major headers
    if (inMeds && isHeaderCandidate(line) && !medHeaders.includes(stripped)) {
      if (!stripped.includes('medication') && !stripped.includes('allerg')) {
        inMeds = false
      }
    }
    
    if (inMeds && line.trim()) {
      // Add bullet if line looks like a medication and doesn't have one
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
  // Remove empty Disp: , Rfl: patterns
  let result = text.replace(/,?\s*Disp:\s*,?\s*Rfl:\s*$/gm, '')
  result = result.replace(/,\s*Disp:\s*\n/g, '\n')
  result = result.replace(/,\s*Rfl:\s*$/gm, '')
  
  // Join lines split in middle of drug names
  result = result.replace(/(\d)\s*\n\s*(mg|mcg|mL|g)([- ])/g, '$1 $2$3')
  
  return result
}

function splitMergedMedications(text: string): string {
  // Split medications that got merged onto same line
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
    
    // Detect lab section
    if (labHeaders.includes(stripped)) {
      inLabs = true
      output.push(line)
      continue
    }
    
    // Exit on other major headers
    if (inLabs && isHeaderCandidate(line) && !labHeaders.includes(stripped)) {
      inLabs = false
    }
    
    output.push(line)
  }
  
  return output.join('\n')
}

function condenseLabBlankLines(text: string): string {
  // Reduce multiple blank lines in lab sections to single blank
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
  // Split lines with multiple lab values
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
  // Format vitals readings cleanly
  return text.replace(
    /\b(BP|HR|RR|Temp|SpO2|O2\s*Sat|Pulse|Weight|Height|BMI)\s*[:=]?\s*(\d)/gi,
    '$1: $2'
  )
}

function splitVitalsTable(text: string): string {
  // Split vitals that appear in table format
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    // Check for multiple vitals on one line
    const vitalsPattern = /\b(BP|HR|RR|Temp|SpO2|O2\s*Sat|Pulse)\s*[:=]?\s*[\d./]+/gi
    const matches = line.match(vitalsPattern)
    
    if (matches && matches.length > 2) {
      // Split each vital onto its own line
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

// =============================================================================
// SENTENCE AND PARAGRAPH HANDLING
// =============================================================================

function splitSentences(text: string): string {
  // Don't split after abbreviations
  let result = text
  
  // Standard sentence splitting
  result = result.replace(/([.!?])\s+([A-Z][a-z])/g, '$1\n$2')
  
  // But rejoin if it was an abbreviation
  for (const abbr of ABBREVIATIONS) {
    const pattern = new RegExp(
      `(${escapeRegex(abbr)})\\n([A-Z])`,
      'gi'
    )
    result = result.replace(pattern, '$1 $2')
  }
  
  return result
}

function breakOnSentenceGaps(text: string): string {
  // Break on gaps between sentences
  return text.replace(/([.!?])\s{2,}([A-Z])/g, '$1\n\n$2')
}

function breakOnSemicolonCap(text: string): string {
  // Break after semicolon followed by capital letter
  return text.replace(/;\s*([A-Z])/g, ';\n$1')
}

function mergeSoftBreaks(text: string): string {
  // Merge lines that were soft-wrapped (lowercase continuation)
  const lines = text.split('\n')
  const output: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]
    
    if (nextLine && 
        line.trim() && 
        !line.trim().endsWith('.') && 
        !line.trim().endsWith(':') &&
        !line.trim().endsWith(';') &&
        nextLine.trim() &&
        /^[a-z]/.test(nextLine.trim()) &&
        !isHeaderCandidate(nextLine) &&
        !isNumberedListItem(nextLine)) {
      output.push(line.trimEnd() + ' ' + nextLine.trimStart())
      i++ // Skip next line
    } else {
      output.push(line)
    }
  }
  
  return output.join('\n')
}

function consolidateParagraphs(text: string): string {
  // Join short lines into paragraphs where appropriate
  const lines = text.split('\n')
  const output: string[] = []
  let paragraph: string[] = []
  
  for (const line of lines) {
    const stripped = line.trim()
    
    if (!stripped) {
      // Blank line - flush paragraph
      if (paragraph.length > 0) {
        output.push(paragraph.join(' '))
        paragraph = []
      }
      output.push('')
    } else if (isHeaderCandidate(line) || isNumberedListItem(line) || stripped.startsWith('-')) {
      // Header or list - flush and add separately
      if (paragraph.length > 0) {
        output.push(paragraph.join(' '))
        paragraph = []
      }
      output.push(line)
    } else {
      paragraph.push(stripped)
    }
  }
  
  // Flush remaining
  if (paragraph.length > 0) {
    output.push(paragraph.join(' '))
  }
  
  return output.join('\n')
}

// =============================================================================
// WRAP AND FINAL CLEANUP
// =============================================================================

function wrapLines(text: string, width: number = 98): string {
  const lines = text.split('\n')
  const output: string[] = []
  
  for (const line of lines) {
    if (line.length <= width || isAsciiTableLine(line)) {
      output.push(line)
      continue
    }
    
    // Wrap long lines
    let remaining = line
    while (remaining.length > width) {
      // Find last space before width
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
  // Reduce 3+ blank lines to 2
  return text.replace(/\n{4,}/g, '\n\n\n')
}

function standardizeSectionSpacing(text: string): string {
  // Ensure consistent spacing before section headers
  let result = text
  
  for (const header of SECTION_HEADERS_SORTED) {
    const pattern = new RegExp(
      `\\n{1,2}(${escapeRegex(header)})(:|\\b)`,
      'gi'
    )
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

// =============================================================================
// COMPOUND HEADER FIXES
// =============================================================================

const COMPOUND_HEADER_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(Past Medical)\s*\n+\s*(HISTORY:?)/gi, replacement: '$1 $2' },
  { pattern: /(Past Surgical)\s*\n+\s*(HISTORY:?)/gi, replacement: '$1 $2' },
  { pattern: /(Family Medical)\s*\n+\s*(HISTORY:?)/gi, replacement: '$1 $2' },
  { pattern: /(Family)\s*\n+\s*(HISTORY:?)/gi, replacement: '$1 $2' },
  { pattern: /(Social)\s*\n+\s*(HISTORY:?)/gi, replacement: '$1 $2' },
  { pattern: /(PHYSICAL)\s*\n+\s*(EXAMINATION:?)/gi, replacement: '$1 $2' },
  { pattern: /(PHYSICAL)\s*\n+\s*(EXAM:?)/gi, replacement: '$1 $2' },
  { pattern: /(Physical)\s*\n+\s*(Exam:?)/gi, replacement: '$1 $2' },
  { pattern: /(Assessment)\s*\n+\s*(and Plan:?)/gi, replacement: '$1 $2' },
  { pattern: /(ASSESSMENT)\s*\n+\s*(AND PLAN:?)/gi, replacement: '$1 $2' },
  { pattern: /(Review of)\s*\n+\s*(Systems:?)/gi, replacement: '$1 $2' },
  { pattern: /(History of Present)\s*\n+\s*(Illness:?)/gi, replacement: '$1 $2' },
  { pattern: /(Chief)\s*\n+\s*(Complaint:?)/gi, replacement: '$1 $2' },
  { pattern: /(Vital)\s*\n+\s*(Signs)/gi, replacement: '$1 $2' },
  { pattern: /(VITAL)\s*\n+\s*(SIGNS)/gi, replacement: '$1 $2' },
  { pattern: /(Mental)\s*\n+\s*(Status)/gi, replacement: '$1 $2' },
  { pattern: /(CURRENT)\s*\n+\s*(MEDICATIONS:?)/gi, replacement: '$1 $2' },
  { pattern: /(Laboratory)\s*\n+\s*(values)/gi, replacement: '$1 $2' },
  { pattern: /(LABORATORY)\s*\n+\s*(VALUES)/gi, replacement: '$1 $2' },
]

function fixSplitCompoundHeaders(text: string): string {
  let result = text
  for (const { pattern, replacement } of COMPOUND_HEADER_FIXES) {
    result = result.replace(pattern, replacement)
  }
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
  stripBrTags,
  unescapeLiteralNewlines,
  collapseMultipleSpaces,
  breakOnLargeGaps,
  
  // Early compound header fixes
  fixSplitCompoundHeaders,
  
  // Sentence handling
  splitSentences,
  breakOnSentenceGaps,
  breakOnSemicolonCap,
  
  // Section header handling
  insertSectionBreaks,
  forceHeaderOnNewline,
  splitHeaderLine,
  splitBMILines,
  forceBreakBeforeLabels,
  
  // ROS and PE formatting
  formatROSSection,
  splitROSInline,
  formatPESection,
  splitPEInlineLabels,
  splitDensePESection,
  
  // Medication formatting
  formatMedicationList,
  splitMergedMedications,
  cleanEmptyDispRefill,
  
  // Lab formatting
  formatLabResults,
  splitMultiValueLabLines,
  condenseLabBlankLines,
  
  // Vitals formatting
  formatVitalsLine,
  splitVitalsTable,
  
  // Drug name preservation
  preserveDrugNames,
  
  // Cleanup
  collapseWhitespace,
  removeOrphanPunctuation,
  removeRulerLines,
  removePageMarkers,
  mergeSoftBreaks,
  consolidateParagraphs,
  
  // Final formatting
  (text) => wrapLines(text, 98),
  tightenBlankLines,
  standardizeSectionSpacing,
  
  // Post-wrap fixes
  removeInternalDoubleSpaces,
  fixSplitCompoundHeaders,
  trimLines,
  collapseMultipleBlankLines,
]

/**
 * Format clinical note text using the full formatting pipeline.
 * 
 * This is the main entry point - call this function to format notes.
 * All regex patterns are pre-compiled for performance.
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

// Export individual functions for testing/customization
export {
  normalizeNbsp,
  normalizeLineEndings,
  stripBrTags,
  unescapeLiteralNewlines,
  breakOnLargeGaps,
  fixSplitCompoundHeaders,
  splitSentences,
  insertSectionBreaks,
  forceHeaderOnNewline,
  splitHeaderLine,
  formatROSSection,
  formatPESection,
  formatMedicationList,
  formatLabResults,
  formatVitalsLine,
  preserveDrugNames,
  wrapLines,
  tightenBlankLines,
  isHeaderCandidate,
  isPELine,
  isROSOrPELine,
  isMedicationLine,
  SECTION_HEADERS,
  EXAM_LABELS,
  ROS_LABELS,
  LAB_VALUE_PATTERNS,
}
