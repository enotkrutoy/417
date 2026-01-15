import { DLFormData, ValidationField, ValidationReport } from '../types';

const ELEMENT_MAP: Record<string, { desc: string, formKey: keyof DLFormData, regex?: RegExp }> = {
  'DAQ': { desc: 'License Number', formKey: 'DAQ', regex: /^[A-Z0-9]+$/i },
  'DBA': { desc: 'Expiration Date', formKey: 'DBA', regex: /^\d{8}$/ }, 
  'DCS': { desc: 'Last Name', formKey: 'DCS', regex: /^[A-Z\s-]+$/i },
  'DAC': { desc: 'First Name', formKey: 'DAC', regex: /^[A-Z\s-]+$/i },
  'DBB': { desc: 'Date of Birth', formKey: 'DBB', regex: /^\d{8}$/ },
  'DDA': { desc: 'Compliance Type', formKey: 'DDA', regex: /^[F|N]$/ }, 
  'DAJ': { desc: 'State Code', formKey: 'DAJ', regex: /^[A-Z]{2}$/ },
  'DAU': { desc: 'Height', formKey: 'DAU', regex: /^\d{3}\s(in|cm)$/ }, 
  'DAW': { desc: 'Weight', formKey: 'DAW', regex: /^\d{3}$/ },
  'DAY': { desc: 'Eye Color', formKey: 'DAY', regex: /^[A-Z]{3}$/ }, 
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DDE': { desc: 'Family Name Truncation', formKey: 'DCS', regex: /^[NTU]$/ },
  'DDF': { desc: 'First Name Truncation', formKey: 'DAC', regex: /^[NTU]$/ },
  'DDG': { desc: 'Middle Name Truncation', formKey: 'DAD', regex: /^[NTU]$/ },
};

const parseAAMVARaw = (raw: string): { data: Record<string, string>, error?: string } => {
  const result: Record<string, string> = {};
  if (!raw.startsWith('@')) return { data: {}, error: "Invalid Compliance Indicator" };

  try {
    const offsetStr = raw.substring(23, 27);
    const offset = parseInt(offsetStr, 10);
    const dataPart = raw.substring(offset);

    if (!dataPart.startsWith('DL')) return { data: {}, error: "DL Subfile not found" };

    const fields = dataPart.substring(2).split('\n');
    fields.forEach(f => {
      const tag = f.substring(0, 3);
      const val = f.substring(3).trim();
      if (tag && val) result[tag] = val;
    });
    return { data: result };
  } catch (e) {
    return { data: {}, error: "Parsing error" };
  }
};

export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const { data: scannedData, error } = parseAAMVARaw(rawString);
  const fields: ValidationField[] = [];
  
  const isValidSignature = !error;

  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    const scannedVal = scannedData[elId];
    const formVal = currentFormData[config.formKey] || "";

    if (!scannedVal && !formVal) return;

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    if (!scannedVal) {
      status = 'MISSING_IN_SCAN';
    } else {
      // Normalize for comparison
      const normScanned = scannedVal.replace(/\s/g, '').toUpperCase();
      const normForm = formVal.replace(/\s/g, '').replace(/IN|CM/g, '').toUpperCase();
      
      // Special logic for truncation flags (don't compare directly to form text)
      if (['DDE', 'DDF', 'DDG'].includes(elId)) {
        if (!/^[NTU]$/.test(scannedVal)) {
          status = 'INVALID_FORMAT';
        }
      } else if (!normScanned.includes(normForm) && !normForm.includes(normScanned)) {
        status = 'MISMATCH';
      }
    }

    fields.push({
      elementId: elId,
      description: config.desc,
      formValue: formVal,
      scannedValue: scannedVal || "MISSING",
      status,
      message: msg
    });
  });

  return { isValidSignature, rawString, fields };
};