import { DLFormData, ValidationField, ValidationReport } from '../types';

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const errors: string[] = [];

  // 1. Structural Header Check
  if (!raw.startsWith('@')) errors.push("Missing Compliance Indicator '@'");
  if (raw.substring(1, 4) !== "\x0A\x1E\x0D") errors.push("Invalid Header Separators");
  if (!raw.includes("ANSI ")) errors.push("Missing 'ANSI ' file type marker");

  // 2. Version Check
  const version = raw.substring(15, 17);
  if (version !== "10") {
    // We allow other versions but flag 2020 compliance
    console.warn(`Standard version is ${version}, expected 10 for AAMVA 2020`);
  }

  // 3. Subfile Check
  if (!raw.includes("DL")) errors.push("DL Subfile segment not found");

  // 4. Critical Tags Verification
  const criticalTags = [
    { id: 'DAQ', desc: 'ID Number' },
    { id: 'DCS', desc: 'Surname' },
    { id: 'DAC', desc: 'First Name' },
    { id: 'DBB', desc: 'Date of Birth' },
    { id: 'DBA', desc: 'Expiry Date' },
    { id: 'DDE', desc: 'Surname Truncation' },
    { id: 'DDF', desc: 'First Name Truncation' }
  ];

  let matches = 0;
  criticalTags.forEach(tag => {
    const exists = raw.includes(tag.id);
    if (exists) matches++;
    
    fields.push({
      elementId: tag.id,
      description: tag.desc,
      formValue: String(formData[tag.id as keyof DLFormData] || "N/A"),
      scannedValue: exists ? "VALIDATED" : "MISSING",
      status: exists ? 'MATCH' : 'MISSING_IN_SCAN'
    });
  });

  const overallScore = errors.length > 0 ? 0 : Math.round((matches / criticalTags.length) * 100);

  return {
    isHeaderValid: errors.length === 0,
    rawString: raw,
    fields,
    overallScore
  };
};