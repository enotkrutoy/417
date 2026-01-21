import { DLFormData, ValidationField, ValidationReport } from '../types';

const CRITICAL_TAGS = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA', 'DCG', 'DAJ'];
const MANDATORY_TAGS = ['DCA', 'DCB', 'DCD', 'DBD', 'DBC', 'DAY', 'DAU', 'DAG', 'DAI', 'DAK', 'DCF'];

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let earnedWeight = 0;
  let totalPossibleWeight = 0;

  // 1. Structural Checks (Weight: 2.0 each)
  const structuralChecks = [
    { id: 'HDR', desc: 'Header Preamble', valid: raw.startsWith("@\x0A\x1E\x0DANSI "), weight: 2 },
    { id: 'VER', desc: 'AAMVA Version 10', valid: raw.substring(15, 17) === "10", weight: 2 },
    { id: 'OFF', desc: 'Designator Offset Integrity', valid: false, weight: 2 }
  ];

  const entries = parseInt(raw.substring(19, 21), 10);
  const expectedOffset = 21 + (entries * 10);
  const actualOffset = parseInt(raw.substring(23, 27), 10);
  structuralChecks[2].valid = actualOffset === expectedOffset;

  structuralChecks.forEach(c => {
    totalPossibleWeight += c.weight;
    if (c.valid) earnedWeight += c.weight;
    else complianceNotes.push(`${c.desc} violation.`);
  });

  // 2. Field Validation with Weights
  const allTags = [...CRITICAL_TAGS, ...MANDATORY_TAGS];
  allTags.forEach(tag => {
    const isCritical = CRITICAL_TAGS.includes(tag);
    const weight = isCritical ? 1.5 : 0.8;
    totalPossibleWeight += weight;

    const exists = raw.includes(tag);
    if (exists) {
      earnedWeight += weight;
    } else {
      complianceNotes.push(`Missing ${isCritical ? 'CRITICAL' : 'Mandatory'} Tag: ${tag}`);
    }

    fields.push({
      elementId: tag,
      description: isCritical ? `CRITICAL: ${tag}` : `Mandatory: ${tag}`,
      formValue: formData[tag as keyof DLFormData] || 'NULL',
      scannedValue: exists ? 'FOUND' : 'MISSING',
      status: exists ? 'MATCH' : (isCritical ? 'CRITICAL_INVALID' : 'MISSING_IN_SCAN')
    });
  });

  // 3. Size Constraints (ISO 15438)
  if (raw.length > 2000) complianceNotes.push("Payload Alert: Bitstream exceeds 2000 octets. Some legacy scanners may fail.");

  return {
    isHeaderValid: structuralChecks[0].valid && structuralChecks[1].valid,
    rawString: raw,
    fields: fields.sort((a, b) => (a.status === 'CRITICAL_INVALID' ? -1 : 1)),
    overallScore: Math.round((earnedWeight / totalPossibleWeight) * 100),
    complianceNotes
  };
};