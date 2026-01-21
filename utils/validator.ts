
import { DLFormData, ValidationField, ValidationReport } from '../types';

const CRITICAL_TAGS = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA', 'DCG', 'DAJ'];
const MANDATORY_TAGS = ['DCA', 'DCB', 'DCD', 'DBD', 'DBC', 'DAY', 'DAU', 'DAG', 'DAI', 'DAK', 'DCF'];

const FIELD_RULES: Record<string, { regex: RegExp; msg: string }> = {
  DAJ: { regex: /^[A-Z]{2}$/, msg: "State code must be 2 uppercase chars." },
  DAK: { regex: /^[A-Z0-9\s]{5,11}$/, msg: "Zip must be 5-11 alphanumeric characters." },
  DBB: { regex: /^\d{8}$/, msg: "DOB must be YYYYMMDD." },
  DBA: { regex: /^\d{8}$/, msg: "Expiry Date must be YYYYMMDD." },
  DBD: { regex: /^\d{8}$/, msg: "Issue Date must be YYYYMMDD." },
  DBC: { regex: /^[129]$/, msg: "Sex must be 1 (M), 2 (F), or 9 (X)." },
  DCG: { regex: /^(USA|CAN)$/, msg: "Country must be USA or CAN." }
};

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let earnedWeight = 0;
  let totalPossibleWeight = 0;

  // 1. Structural Checks (Header ANSI 15434)
  const hasHeader = raw.startsWith("@\x0A\x1E\x0DANSI ");
  const hasProperVersion = raw.includes("100001") || /ANSI [0-9]{6}(10|08|09)/.test(raw);
  
  earnedWeight += (hasHeader ? 15 : 0) + (hasProperVersion ? 15 : 0);
  totalPossibleWeight += 30;

  // 2. Payload Validation
  const subType = formData.subfileType || 'DL';
  const dataPayload = raw.substring(31); // Skip 21 (header) + 10 (designator)
  const lines = dataPayload.split(/\x0A|\x0D/).filter(l => l.length > 0);
  
  const allTags = [...CRITICAL_TAGS, ...MANDATORY_TAGS];

  allTags.forEach(tag => {
    // DL-only fields check
    if (subType === 'ID' && ['DCA', 'DCB', 'DCD'].includes(tag)) return;

    const isCritical = CRITICAL_TAGS.includes(tag);
    const weight = isCritical ? 10 : 5;
    totalPossibleWeight += weight;

    // Fix: First tag logic handler
    // The first line starts with subType (DL/ID) followed immediately by the tag
    const lineWithTag = lines.find((line, idx) => {
      if (idx === 0) {
        return line.startsWith(subType + tag) || line.startsWith(tag);
      }
      return line.startsWith(tag);
    });

    if (!lineWithTag) {
      fields.push({
        elementId: tag,
        description: isCritical ? `CRITICAL: ${tag}` : `Mandatory: ${tag}`,
        formValue: formData[tag] || 'EMPTY',
        scannedValue: 'MISSING',
        status: isCritical ? 'CRITICAL_INVALID' : 'MISSING_IN_SCAN'
      });
      complianceNotes.push(`Field ${tag} not found in generated bitstream.`);
    } else {
      const formVal = (formData[tag] || "").toUpperCase().trim();
      const rule = FIELD_RULES[tag];
      
      let status: any = 'MATCH';
      if (rule && !rule.regex.test(formVal)) {
        status = 'FORMAT_ERROR';
        complianceNotes.push(`${tag} format mismatch: ${rule.msg}`);
      } else {
        earnedWeight += weight;
      }

      fields.push({
        elementId: tag,
        description: isCritical ? `CRITICAL: ${tag}` : `Mandatory: ${tag}`,
        formValue: formVal || 'NONE',
        scannedValue: 'FOUND',
        status
      });
    }
  });

  const overallScore = Math.min(100, Math.round((earnedWeight / totalPossibleWeight) * 100));

  return {
    isHeaderValid: hasHeader,
    rawString: raw,
    fields: fields.sort((a, b) => {
      const order = { 'CRITICAL_INVALID': 0, 'FORMAT_ERROR': 1, 'MISSING_IN_SCAN': 2, 'MATCH': 3 };
      return (order[a.status] || 0) - (order[b.status] || 0);
    }),
    overallScore,
    complianceNotes
  };
};
