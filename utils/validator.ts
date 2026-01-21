import { DLFormData, ValidationField, ValidationReport } from '../types';

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let scorePoints = 0;
  const totalPoints = 5;

  // 1. Header Validation (Fixed 21 bytes)
  const isHeaderStartValid = raw.startsWith("@\x0A\x1E\x0DANSI ");
  if (!isHeaderStartValid) complianceNotes.push("Invalid Header Preamble. Check LF/RS/CR sequence.");
  else scorePoints++;

  const version = raw.substring(15, 17);
  if (version !== "10") complianceNotes.push(`Version mismatch: Found ${version}, expected 10 for 2020 Standard.`);
  else scorePoints++;

  // 2. Offset Integrity
  const entries = parseInt(raw.substring(19, 21), 10);
  const expectedOffset = 21 + (entries * 10);
  const actualOffset = parseInt(raw.substring(23, 27), 10);
  
  if (actualOffset !== expectedOffset) {
    complianceNotes.push(`Offset calculation error: Found ${actualOffset}, expected ${expectedOffset}.`);
  } else scorePoints++;

  // 3. Regional Date Audit
  const isCanada = formData.DCG === 'CAN';
  const dobRaw = formData.DBB.replace(/\D/g, '');
  let dateValid = false;

  if (isCanada) {
    // CCYYMMDD
    dateValid = dobRaw.length === 8 && (dobRaw.startsWith('19') || dobRaw.startsWith('20'));
    if (!dateValid) complianceNotes.push("Canada requires CCYYMMDD format.");
  } else {
    // MMDDCCYY
    const month = parseInt(dobRaw.substring(0, 2), 10);
    dateValid = dobRaw.length === 8 && month >= 1 && month <= 12;
    if (!dateValid) complianceNotes.push("USA requires MMDDCCYY format.");
  }
  if (dateValid) scorePoints++;

  // 4. Critical Tags Audit
  const criticalTags = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA'];
  let tagsFound = 0;
  criticalTags.forEach(tag => {
    const exists = raw.includes(tag);
    if (exists) tagsFound++;
    fields.push({
      elementId: tag,
      description: `Tag ${tag} presence`,
      formValue: formData[tag as keyof DLFormData] || 'EMPTY',
      scannedValue: exists ? 'PRESENT' : 'MISSING',
      status: exists ? 'MATCH' : 'CRITICAL_INVALID'
    });
  });
  if (tagsFound === criticalTags.length) scorePoints++;

  return {
    isHeaderValid: isHeaderStartValid && version === "10",
    rawString: raw,
    fields,
    overallScore: Math.round((scorePoints / totalPoints) * 100),
    complianceNotes
  };
};