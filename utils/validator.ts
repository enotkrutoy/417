import { DLFormData, ValidationField, ValidationReport } from '../types';

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const errors: string[] = [];

  // 1. Structural Header Audit
  if (!raw.startsWith('@')) errors.push("Compliance Indicator '@' missing");
  const headerSep = raw.substring(1, 4);
  if (headerSep !== "\x0A\x1E\x0D") errors.push(`Separator Mismatch: ${JSON.stringify(headerSep)}`);
  
  const version = raw.substring(15, 17);
  if (version !== "10") errors.push(`Legacy Version detected: ${version}. Expected: 10 (2020)`);

  // 2. Regional Date Format Validation (AAMVA 2020 D.12.5.1)
  const isCanada = formData.DCG === 'CAN';
  const dob = formData.DBB.replace(/\D/g, '');
  
  // Simple check: Canada expects CCYYMMDD (8 digits, starts with 19 or 20)
  // USA expects MMDDCCYY
  if (isCanada) {
    if (!dob.startsWith('19') && !dob.startsWith('20')) {
      errors.push("Canadian DOB must use CCYYMMDD format");
    }
  } else {
    const month = parseInt(dob.substring(0, 2), 10);
    if (month > 12 || month === 0) {
      errors.push("USA DOB must use MMDDCCYY format");
    }
  }

  // 3. Subfile Integrity Check
  const designatorOffset = parseInt(raw.substring(23, 27), 10);
  if (designatorOffset !== 31) errors.push(`Subfile Offset Error: ${designatorOffset}. Expected: 31`);

  // 4. Critical Field Mapping
  const tags = [
    { id: 'DAQ', desc: 'ID/DL Number' },
    { id: 'DCS', desc: 'Surname' },
    { id: 'DBB', desc: 'DOB' },
    { id: 'DDE', desc: 'Surname Truncation Ind.' },
    { id: 'DDF', desc: 'First Name Truncation Ind.' }
  ];

  let matches = 0;
  tags.forEach(tag => {
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

  const overallScore = errors.length > 0 ? 0 : Math.round((matches / tags.length) * 100);

  return {
    isHeaderValid: errors.length === 0,
    rawString: raw,
    fields,
    overallScore
  };
};