
import { DLFormData, ValidationField, ValidationReport, ValidationStatus } from '../types';

const MANDATORY_TAGS: Record<string, string> = {
  'DAQ': 'ID Number',
  'DCS': 'Family Name',
  'DAC': 'Given Name',
  'DBB': 'Date of Birth',
  'DBA': 'Expiry Date',
  'DBD': 'Issue Date',
  'DAJ': 'State/Province',
  'DCG': 'Country',
  'DCF': 'Document Discriminator'
};

export const parseAAMVARaw = (raw: string): { data: Record<string, string>; error?: string } => {
  const result: Record<string, string> = {};
  
  if (!raw.startsWith('@')) return { data: {}, error: "Invalid Compliance Indicator (expected @)" };

  try {
    // 1. Read Header Metadata
    // Bytes 5-9: ANSI (Check)
    const fileType = raw.substring(4, 9);
    if (fileType !== "ANSI ") return { data: {}, error: "Unsupported File Type (expected ANSI )" };

    // 2. Read Subfile Designator for DL
    // Each subfile designator is 10 bytes starting from byte 21
    const numEntries = parseInt(raw.substring(19, 21), 10);
    
    for (let i = 0; i < numEntries; i++) {
      const designatorStart = 21 + (i * 10);
      const type = raw.substring(designatorStart, designatorStart + 2);
      const offset = parseInt(raw.substring(designatorStart + 2, designatorStart + 6), 10);
      const length = parseInt(raw.substring(designatorStart + 6, designatorStart + 10), 10);

      // Extract the subfile block
      const subfileBlock = raw.substring(offset, offset + length);
      // Skip the 2-char type header (e.g. "DL")
      const content = subfileBlock.substring(2);
      
      // Split by LF (0x0A) or CR (0x0D)
      const elements = content.split(/[\n\r]/);
      
      elements.forEach(el => {
        if (el.length < 3) return;
        const tag = el.substring(0, 3);
        const val = el.substring(3).trim();
        result[tag] = val;
      });
    }

    return { data: result };
  } catch (e) {
    return { data: {}, error: "Structure parsing failed (corrupted format)" };
  }
};

export const validateBarcode = (scannedRaw: string, formData: DLFormData): ValidationReport => {
  const { data: scannedMap, error } = parseAAMVARaw(scannedRaw);
  const fields: ValidationField[] = [];
  let scorePoints = 0;

  Object.entries(MANDATORY_TAGS).forEach(([tag, desc]) => {
    const formVal = (formData[tag] || "").toUpperCase().replace(/\s/g, '');
    const scanVal = (scannedMap[tag] || "").toUpperCase().replace(/\s/g, '');

    let status: ValidationStatus = 'MATCH';
    
    if (!scannedMap[tag]) {
      status = 'MISSING_IN_SCAN';
    } else if (formVal !== scanVal) {
      status = 'MISMATCH';
    } else {
      scorePoints++;
    }

    fields.push({
      elementId: tag,
      description: desc,
      formValue: formData[tag] || "N/A",
      scannedValue: scannedMap[tag] || "N/A",
      status
    });
  });

  const overallScore = Math.round((scorePoints / Object.keys(MANDATORY_TAGS).length) * 100);

  return {
    isHeaderValid: !error,
    rawString: scannedRaw,
    fields,
    overallScore
  };
};
