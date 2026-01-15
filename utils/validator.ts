
import { DLFormData, ValidationField, ValidationReport, ValidationStatus } from '../types';

const ELEMENT_DESCS: Record<string, string> = {
  'DAQ': 'ID Number', 'DBA': 'Expiry', 'DCS': 'Last Name', 'DAC': 'First Name',
  'DBB': 'DOB', 'DBD': 'Issue Date', 'DAJ': 'State', 'DAU': 'Height',
  'DCF': 'Audit/DD', 'DCA': 'Class', 'DCB': 'Restrictions', 'DCD': 'Endorsements'
};

export const parseAAMVARaw = (raw: string): { data: Record<string, string>; error?: string } => {
  const result: Record<string, string> = {};
  if (!raw.startsWith('@')) return { data: {}, error: "Invalid Compliance Indicator" };

  try {
    // Согласно стандарту 2020, дескриптор подфайла DL начинается с 21-го байта
    const offset = parseInt(raw.substring(23, 27), 10);
    const subfile = raw.substring(offset);

    if (!subfile.startsWith('DL')) return { data: {}, error: "DL Segment not found at offset" };

    const elements = subfile.substring(2).split(/[\n\r]/);
    elements.forEach(el => {
      const tag = el.substring(0, 3);
      const val = el.substring(3).trim();
      if (tag.length === 3) result[tag] = val;
    });
    return { data: result };
  } catch (e) {
    return { data: {}, error: "Byte structure corrupted" };
  }
};

export const validateBarcode = (scannedRaw: string, formData: DLFormData): ValidationReport => {
  const { data: scannedMap, error } = parseAAMVARaw(scannedRaw);
  const fields: ValidationField[] = [];
  let scoreCount = 0;

  Object.entries(ELEMENT_DESCS).forEach(([tag, desc]) => {
    const formVal = (formData[tag] || "").toUpperCase().replace(/\s/g, '');
    const scanVal = (scannedMap[tag] || "").toUpperCase().replace(/\s/g, '');

    let status: ValidationStatus = 'MATCH';
    if (!scannedMap[tag]) {
      status = 'MISSING_IN_SCAN';
    } else if (formVal !== scanVal) {
      status = 'MISMATCH';
    } else {
      scoreCount++;
    }

    fields.push({ elementId: tag, description: desc, formValue: formData[tag], scannedValue: scannedMap[tag] || "N/A", status });
  });

  const overallScore = Math.round((scoreCount / Object.keys(ELEMENT_DESCS).length) * 100);

  return {
    isHeaderValid: !error,
    rawString: scannedRaw,
    fields,
    overallScore
  };
};
