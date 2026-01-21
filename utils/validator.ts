
import { DLFormData, ValidationField, ValidationReport } from '../types';

const CRITICAL_TAGS = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA', 'DCG', 'DAJ'];
const MANDATORY_TAGS = ['DCA', 'DCB', 'DCD', 'DBD', 'DBC', 'DAY', 'DAU', 'DAG', 'DAI', 'DAK', 'DCF'];

const FIELD_RULES: Record<string, { regex: RegExp; msg: string }> = {
  DAJ: { regex: /^[A-Z]{2}$/, msg: "State must be 2 uppercase characters." },
  DAK: { regex: /^[A-Z0-9\s]{5,11}$/, msg: "Zip Code must be 5-11 alphanumeric characters." },
  DBB: { regex: /^\d{8}$/, msg: "Date of Birth must be exactly 8 digits (YYYYMMDD)." },
  DBA: { regex: /^\d{8}$/, msg: "Expiry Date must be exactly 8 digits (YYYYMMDD)." },
  DBD: { regex: /^\d{8}$/, msg: "Issue Date must be exactly 8 digits (YYYYMMDD)." },
  DBC: { regex: /^[129]$/, msg: "Sex must be 1, 2, or 9." },
  DCG: { regex: /^(USA|CAN)$/, msg: "Country must be USA or CAN." }
};

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let earnedWeight = 0;
  let totalPossibleWeight = 0;

  // 1. Structural Checks
  const hasHeader = raw.startsWith("@\x0A\x1E\x0DANSI ");
  const hasProperVersion = raw.includes("100001") || /ANSI [0-9]{6}(10|08)/.test(raw);
  
  if (!hasHeader) complianceNotes.push("Header violation: Missing @LF RS CR sequence.");
  if (!hasProperVersion) complianceNotes.push("Version alert: Matrix not using V10 or V08 standard.");

  earnedWeight += (hasHeader ? 10 : 0) + (hasProperVersion ? 10 : 0);
  totalPossibleWeight += 20;

  // 2. Data Check
  const lines = raw.split(/\x0A|\x0D/);
  const allTags = [...CRITICAL_TAGS, ...MANDATORY_TAGS];

  allTags.forEach(tag => {
    const isCritical = CRITICAL_TAGS.includes(tag);
    const weight = isCritical ? 5 : 2;
    totalPossibleWeight += weight;

    // Search for tag in stream
    const lineWithTag = lines.find(line => line.startsWith(tag));
    const valueInStream = lineWithTag ? lineWithTag.substring(3) : null;
    
    let status: any = 'MATCH';
    if (!lineWithTag) {
      status = isCritical ? 'CRITICAL_INVALID' : 'MISSING_IN_SCAN';
      complianceNotes.push(`Data loss: Tag ${tag} missing from bitstream.`);
    } else {
      // 3. Pattern Validation
      const rule = FIELD_RULES[tag];
      const formVal = formData[tag] || "";
      if (rule && !rule.regex.test(formVal)) {
        status = 'FORMAT_ERROR';
        complianceNotes.push(`${tag} format error: ${rule.msg}`);
      } else {
        earnedWeight += weight;
      }
    }

    fields.push({
      elementId: tag,
      description: isCritical ? `CRITICAL: ${tag}` : `Mandatory: ${tag}`,
      formValue: formData[tag] || 'EMPTY',
      scannedValue: valueInStream || 'MISSING',
      status
    });
  });

  // Score calculation
  const overallScore = Math.min(100, Math.round((earnedWeight / totalPossibleWeight) * 100));

  return {
    isHeaderValid: hasHeader,
    rawString: raw,
    fields: fields.sort((a, b) => {
      const priority = { 'CRITICAL_INVALID': 0, 'FORMAT_ERROR': 1, 'MISSING_IN_SCAN': 2, 'MATCH': 3 };
      return (priority[a.status] || 99) - (priority[b.status] || 99);
    }),
    overallScore,
    complianceNotes
  };
};
