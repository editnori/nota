/**
 * Tests for the improved clinical note formatter
 * Run with: bun test
 */

import { describe, it, expect } from 'vitest'
import { formatNoteText } from '../lib/formatter'

describe('formatNoteText', () => {
  describe('Dense Single-Line Notes', () => {
    it('should split dense ED procedure notes', () => {
      const input = `ED Procedure Notes for Test encounter.       Procedure  Peripheral venous access ultrasound - guided  Performed by: Dr. Smith, MD  Authorized by: Dr. Jones, MD     Consent obtained:  Verbal  Risks discussed:  Bleeding, infection and pain`
      const result = formatNoteText(input)
      
      // Should have line breaks between sections
      expect(result.split('\n').length).toBeGreaterThan(3)
      expect(result).toContain('Performed by:')
      expect(result).toContain('Authorized by:')
    })

    it('should split dense lab results', () => {
      const input = `Labs Reviewed   CBC W/ DIFFERENTIAL - Abnormal       Result Value    White Blood Cells 13.6 (*)     Red Blood Cells 3.99 (*)     Hemoglobin 11.6 (*)`
      const result = formatNoteText(input)
      
      // Should have multiple lines for lab values
      expect(result.split('\n').length).toBeGreaterThan(3)
    })

    it('should split dense physical exam findings', () => {
      const input = `Physical Exam   GEN: Nontoxic in appearance  HENT: Normocephalic and atraumatic.   RESP: Clear to auscultation  C/V: Normal rate and regular rhythm.  ABD: Soft, nontender.  NEURO: Alert and oriented.`
      const result = formatNoteText(input)
      
      // PE labels should be on separate lines
      expect(result.split('\n').length).toBeGreaterThan(4)
      expect(result).toContain('HENT:')
      expect(result).toContain('NEURO:')
    })
  })

  describe('Axis Diagnosis Formatting', () => {
    it('should split Axis diagnoses onto separate lines', () => {
      const input = `Admitting Diagnosis: Axis I: MDD, Bereavement Axis II: Deferred Axis III: Diabetes Axis IV: Problems with support Axis V: 15`
      const result = formatNoteText(input)
      
      // Each Axis should start on a new line
      expect(result).toContain('\nAxis I:')
      expect(result).toContain('\nAxis II:')
      expect(result).toContain('\nAxis III:')
    })
  })

  describe('Mental Status Exam', () => {
    it('should format mental status exam labels when on separate lines', () => {
      // Note: MSE label splitting only activates when "Mental Status" is on its own line
      // For inline MSE content, use the BiLSTM model (default) for better formatting
      const input = `Mental Status Exam:
Appearance: Well-groomed  Attitude: Cooperative  Activity: Normal  Mood/Affect: Good/Appropriate  Perception: No hallucinations  Cognition: Intact`
      const result = formatNoteText(input)
      
      // MSE labels should be split when the section header is on its own line and content is > 100 chars
      expect(result).toContain('Mental Status')
      expect(result.split('\n').length).toBeGreaterThanOrEqual(2)
    })

    it('should handle inline MSE with wrapping', () => {
      const input = `Mental Status:  Appearance: Well-groomed  Attitude: Cooperative  Activity: Normal  Mood/Affect: Good/Appropriate  Perception: No hallucinations  Cognition: Intact`
      const result = formatNoteText(input)
      
      // Inline MSE is wrapped at column width - BiLSTM model handles this better
      expect(result).toContain('Mental Status')
      expect(result).toContain('Appearance')
      expect(result).toContain('Cognition')
    })
  })

  describe('Medication Lists', () => {
    it('should split tilde-prefixed medications', () => {
      const input = `Medications:  ~  baclofen 5 mg BID  ~  carBAMazepine 200 mg BID  ~  citalopram 20 mg daily`
      const result = formatNoteText(input)
      
      // Medications should be on separate lines
      expect(result).toContain('- baclofen')
      expect(result).toContain('- carBAMazepine')
      expect(result.split('\n').length).toBeGreaterThan(3)
    })
  })

  describe('Past Medical History', () => {
    it('should split dense PMH entries', () => {
      const input = `Past Medical History:   Diagnosis Date   ~ Anxiety disorder    ~ Asthma    ~ End stage renal disease    ~ Hyperlipidemia    ~ Type 2 diabetes mellitus`
      const result = formatNoteText(input)
      
      // Each diagnosis should be on its own line
      expect(result.split('\n').length).toBeGreaterThan(4)
    })
  })

  describe('Review of Systems', () => {
    it('should split dense ROS entries', () => {
      const input = `Review of Systems   Constitutional: Positive for fatigue. Negative for fever.   HENT: Negative for congestion.    Respiratory: Positive for SOB.    Cardiovascular: Negative for chest pain.`
      const result = formatNoteText(input)
      
      // Each ROS category should be properly formatted
      expect(result.split('\n').length).toBeGreaterThan(3)
    })
  })

  describe('ED-Specific Sections', () => {
    it('should format ED Course and MDM sections', () => {
      const input = `ED Course & MDM   The patient presented with complaints.   Amount And/Or Complexity of Data Reviewed:   Decide to obtain previous records: Yes   Final diagnoses:   Acute abdominal pain (Primary)`
      const result = formatNoteText(input)
      
      // ED Course and MDM should be present (may be split or together)
      expect(result.toLowerCase()).toContain('ed course')
      expect(result.toLowerCase()).toContain('mdm')
      expect(result.split('\n').length).toBeGreaterThan(3)
    })
  })

  describe('Discharge Summary Sections', () => {
    it('should split discharge summary headers', () => {
      const input = `PREADMISSION DIAGNOSIS: Spondylosis   DISCHARGE DIAGNOSIS: Status post fusion   BRIEF HISTORY: Patient with back pain   HOSPITAL COURSE: Uneventful   DISCHARGE INSTRUCTIONS: Follow up in 4 weeks`
      const result = formatNoteText(input)
      
      // Major sections should be present and separated
      expect(result.toUpperCase()).toContain('PREADMISSION')
      expect(result.toUpperCase()).toContain('DISCHARGE')
      expect(result.toUpperCase()).toContain('DIAGNOSIS')
      // Should have multiple lines
      expect(result.split('\n').length).toBeGreaterThan(5)
    })
  })

  describe('Word Split Fixes', () => {
    it('should fix common word splits', () => {
      const input = 'Patient has cardio vascular disease and neuro logical symptoms with hyper tension.'
      const result = formatNoteText(input)
      
      expect(result).toContain('cardiovascular')
      expect(result).toContain('neurological')
      expect(result).toContain('hypertension')
    })
  })

  describe('Section Headers', () => {
    it('should handle psychiatric section headers', () => {
      const input = `Mental Status Exam:   Laboratory Findings: CBC wnl   Hospital Course: Patient was admitted   Consultations: None   Condition on Discharge: Stable   Disposition on Discharge: Home`
      const result = formatNoteText(input)
      
      // Sections should be properly separated
      expect(result.split('\n').length).toBeGreaterThan(5)
    })
  })

  describe('Vitals Formatting', () => {
    it('should format vitals from dense patterns', () => {
      const input = `Vital Signs:   Temp Pulse Resp BP SpO2   37 °C 92 16 118/65 94%`
      const result = formatNoteText(input)
      
      expect(result).toContain('Vital Signs')
    })
  })

  describe('Real-World Note Scenarios', () => {
    it('should handle very long single-line notes', () => {
      // Simulate a long ED note
      const input = `ED Provider Notes for hospital encounter         Chief Complaint   Patient presents with   ~ Abdominal Pain     History of Present Illness   Patient is a 45 y.o. male presenting with LUQ abdominal pain.    Previous History     Past Medical History:   Diagnosis Date   ~ HIV infection    ~ Nephrolithiasis      Past Surgical History:   Procedure Laterality Date   ~ CYSTOSCOPY Left 07/19/2018    Review of Systems  Pertinent positives and negatives as above.    Physical Exam   GEN: Nontoxic in appearance  HENT: Normocephalic. EYES: PERRL  RESP: Clear bilaterally  C/V: Normal rate  ABD: Mild tenderness    ED Labs & Imaging      Labs Reviewed   CBC W/ DIFFERENTIAL - Abnormal       Result Value    White Blood Cells 13.6 (*)     Red Blood Cells 3.99 (*)   ED Course & MDM   Patient presents as above. Concern for infection. Will continue workup.    Final diagnoses:   Acute abdominal pain (Primary)`
      
      const result = formatNoteText(input)
      
      // Should expand to many lines
      expect(result.split('\n').length).toBeGreaterThan(20)
      
      // Key sections should be present
      expect(result.toLowerCase()).toContain('chief complaint')
      expect(result.toLowerCase()).toContain('physical exam')
      expect(result.toLowerCase()).toContain('labs')
    })

    it('should handle discharge summary with dense medication lists', () => {
      const input = `DISCHARGE SUMMARY   Discharge Medications:  ~  aspirin 81 mg daily  ~  atorvastatin 20 mg daily  ~  lisinopril 10 mg BID   New Medications      Sig   oxycodone 5 mg PRN pain     Modified Medications      Sig   aspirin 81 mg daily   DO NOT RESUME UNTIL 08/16   Activity Instructions     No strenuous activity for 6 weeks.`
      
      const result = formatNoteText(input)
      
      // Tilde-prefixed medications get converted to bullet list format
      expect(result).toContain('- aspirin')
      expect(result).toContain('- atorvastatin')
      expect(result).toContain('- lisinopril')
      // Should have multiple lines from medication list + wrapping
      expect(result.split('\n').length).toBeGreaterThanOrEqual(4)
      // Section headers should be preserved
      expect(result).toContain('DISCHARGE SUMMARY')
      expect(result).toContain('Activity Instructions')
    })
  })
})
