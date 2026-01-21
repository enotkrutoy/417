
import { DLFormData, ValidationField, ValidationReport } from '../types';

const CRITICAL_TAGS = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA', 'DCG', 'DAJ'];
const MANDATORY_TAGS = ['DCA', 'DCB', 'DCD', 'DBD', 'DBC', 'DAY', 'DAU', 'DAG', 'DAI', 'DAK', 'DCF'];

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  const complianceNotes: string[] = [];
  let earnedWeight = 0;
  let totalPossibleWeight = 0;

  // 1. Structural Checks
  const hasHeader = raw.startsWith("@\x0A\x1E\x0DANSI ");
  const hasVersion10 = raw.includes("100001") || raw.substring(15, 17) === "10";
  
  if (!hasHeader) complianceNotes.push("Invalid ANSI Header Preamble.");
  if (!hasVersion10) complianceNotes.push("Standard version mismatch (Expected 2020/V10).");

  earnedWeight += (hasHeader ? 5 : 0) + (hasVersion10 ? 5 : 0);
  totalPossibleWeight += 10;

  // 2. Field Extraction & Validation
  // Разделяем по LF для проверки наличия тегов в структуре
  const lines = raw.split(/\x0A/);
  
  const allTags = [...CRITICAL_TAGS, ...MANDATORY_TAGS];
  allTags.forEach(tag => {
    const isCritical = CRITICAL_TAGS.includes(tag);
    const weight = isCritical ? 2 : 1;
    totalPossibleWeight += weight;

    // Ищем тег в начале любой строки (после разделителя LF)
    const exists = lines.some(line => line.startsWith(tag));
    
    if (exists) {
      earnedWeight += weight;
    } else {
      complianceNotes.push(`Missing ${isCritical ? 'CRITICAL' : 'Mandatory'} Tag: ${tag}`);
    }

    fields.push({
      elementId: tag,
      description: isCritical ? `CRITICAL: ${tag}` : `Mandatory: ${tag}`,
      formValue: formData[tag] || 'EMPTY',
      scannedValue: exists ? 'PRESENT' : 'MISSING',
      status: exists ? 'MATCH' : (isCritical ? 'CRITICAL_INVALID' : 'MISSING_IN_SCAN')
    });
  });

  // Score calculation
  const overallScore = Math.min(100, Math.round((earnedWeight / totalPossibleWeight) * 100));

  return {
    isHeaderValid: hasHeader && hasVersion10,
    rawString: raw,
    fields: fields.sort((a, b) => {
      if (a.status === 'CRITICAL_INVALID') return -1;
      if (b.status === 'CRITICAL_INVALID') return 1;
      return 0;
    }),
    overallScore,
    complianceNotes
  };
};
