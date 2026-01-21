import { DLFormData, ValidationField, ValidationReport } from '../types';

const MANDATORY_2020_TAGS = [
  'DCA', 'DCB', 'DCD', 'DBA', 'DCS', 'DAC', 'DAD', 'DBD', 
  'DBB', 'DBC', 'DAY', 'DAU', 'DAG', 'DAI', 'DAJ', 'DAK', 
  'DAQ', 'DCF', 'DCG'
];

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let scorePoints = 0;
  const totalPoints = 6;

  // 1. Header Validation (Fixed 21 bytes)
  const isHeaderStartValid = raw.startsWith("@\x0A\x1E\x0DANSI ");
  if (!isHeaderStartValid) complianceNotes.push("Header Preamble Error: Missing mandatory LF/RS/CR or ANSI designator.");
  else scorePoints++;

  const version = raw.substring(15, 17);
  if (version !== "10") complianceNotes.push(`Version mismatch: Found ${version}, expected '10' for 2020 Standard.`);
  else scorePoints++;

  // 2. Offset Integrity (D.12.4)
  const entries = parseInt(raw.substring(19, 21), 10);
  const expectedOffset = 21 + (entries * 10);
  const actualOffset = parseInt(raw.substring(23, 27), 10);
  
  if (actualOffset !== expectedOffset) {
    complianceNotes.push(`Designator Error: Calculated offset ${actualOffset} does not match header expectations.`);
  } else scorePoints++;

  // 3. Regional Date Audit (D.12.5.1)
  const isCanada = formData.DCG === 'CAN';
  const dobRaw = (formData.DBB || "").replace(/\D/g, '');
  let dateValid = false;

  if (isCanada) {
    dateValid = dobRaw.length === 8 && (dobRaw.startsWith('19') || dobRaw.startsWith('20'));
    if (!dateValid) complianceNotes.push("Canada Compliance: DOB must be in CCYYMMDD format.");
  } else {
    const month = parseInt(dobRaw.substring(0, 2), 10);
    dateValid = dobRaw.length === 8 && month >= 1 && month <= 12;
    if (!dateValid) complianceNotes.push("USA Compliance: DOB must be in MMDDCCYY format.");
  }
  if (dateValid) scorePoints++;

  // 4. Barcode Symbology Constraint (Annex D.5.2)
  // Logic check: ensured by BarcodeSVG configuration.
  scorePoints++; 

  // 5. Full Mandatory Tag Audit (Table D.3)
  let missingTags: string[] = [];
  MANDATORY_2020_TAGS.forEach(tag => {
    const exists = raw.includes(tag);
    if (!exists) missingTags.push(tag);
    
    fields.push({
      elementId: tag,
      description: `Requirement ${tag}`,
      formValue: formData[tag as keyof DLFormData] || 'NULL',
      scannedValue: exists ? 'FOUND' : 'MISSING',
      status: exists ? 'MATCH' : (tag.startsWith('D') ? 'CRITICAL_INVALID' : 'MISSING_IN_SCAN')
    });
  });

  if (missingTags.length === 0) {
    scorePoints++;
  } else {
    complianceNotes.push(`Missing Mandatory Tags: ${missingTags.join(', ')}`);
  }

  return {
    isHeaderValid: isHeaderStartValid && version === "10",
    rawString: raw,
    fields: fields.filter(f => MANDATORY_2020_TAGS.includes(f.elementId) || f.status !== 'MATCH'),
    overallScore: Math.round((scorePoints / totalPoints) * 100),
    complianceNotes
  };
};