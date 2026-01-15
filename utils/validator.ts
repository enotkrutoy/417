
import { DLFormData, ValidationField, ValidationReport } from '../types';

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  let score = 0;
  let errors = [];

  // 1. Проверка Header (21 байт)
  const compliance = raw[0];
  const separators = raw.substring(1, 4);
  const fileType = raw.substring(4, 9);
  const version = raw.substring(15, 17);

  if (compliance !== '@') errors.push("Compliance indicator '@' missing");
  if (separators !== "\x0A\x1E\x0D") errors.push("Header separators (LF, RS, CR) incorrect");
  if (fileType !== "ANSI ") errors.push("File type must be 'ANSI '");
  if (version !== "10") errors.push("AAMVA Version must be '10' for 2020 standard");

  // 2. Проверка Designator (оффсет 31 для 1 записи)
  const offsetStr = raw.substring(23, 27);
  const offset = parseInt(offsetStr, 10);
  if (offset !== 31) errors.push(`Designator offset mismatch (expected 0031, got ${offsetStr})`);

  // 3. Сверка данных
  const mandatory = ['DAQ', 'DCS', 'DAC', 'DBB', 'DBA'];
  mandatory.forEach(tag => {
    const exists = raw.includes(tag);
    if (exists) score += 20;
    fields.push({
      elementId: tag,
      description: `Tag ${tag} presence`,
      formValue: formData[tag as keyof DLFormData] || "NONE",
      scannedValue: exists ? "PRESENT" : "MISSING",
      status: exists ? 'MATCH' : 'MISSING_IN_SCAN'
    });
  });

  return {
    isHeaderValid: errors.length === 0,
    rawString: raw,
    fields,
    overallScore: errors.length === 0 ? Math.min(score, 100) : 0
  };
};
