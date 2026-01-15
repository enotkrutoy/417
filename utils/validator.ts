import { DLFormData, ValidationField, ValidationReport } from '../types';

const ELEMENT_MAP: Record<string, { desc: string, formKey: keyof DLFormData, regex?: RegExp }> = {
  'DAQ': { desc: 'License Number', formKey: 'DAQ', regex: /^[A-Z0-9]+$/i },
  'DBA': { desc: 'Expiration Date', formKey: 'DBA', regex: /^\d{8}$/ }, 
  'DCS': { desc: 'Last Name', formKey: 'DCS', regex: /^[A-Z\s-]+$/i },
  'DAC': { desc: 'First Name', formKey: 'DAC', regex: /^[A-Z\s-]+$/i },
  'DAD': { desc: 'Middle Name', formKey: 'DAD' },
  'DBB': { desc: 'Date of Birth', formKey: 'DBB', regex: /^\d{8}$/ },
  'DBD': { desc: 'Issue Date', formKey: 'DBD', regex: /^\d{8}$/ },
  'DEB': { desc: 'File Creation Date', formKey: 'DEB', regex: /^\d{8}$/ },
  'DDA': { desc: 'Compliance Type', formKey: 'DDA', regex: /^[F|N]$/ }, 
  'DAG': { desc: 'Address Street', formKey: 'DAG' },
  'DAI': { desc: 'City', formKey: 'DAI' },
  'DAJ': { desc: 'State Code', formKey: 'DAJ', regex: /^[A-Z]{2}$/ },
  'DAK': { desc: 'Zip Code', formKey: 'DAK', regex: /^[0-9-]{5,11}$/ },
  'DCA': { desc: 'Class', formKey: 'DCA' },
  'DBC': { desc: 'Sex', formKey: 'DBC', regex: /^[12X]$/ },
  'DAU': { desc: 'Height', formKey: 'DAU' },
  'DAW': { desc: 'Weight', formKey: 'DAW' },
  'DAY': { desc: 'Eye Color', formKey: 'DAY', regex: /^[A-Z]{3}$/ }, 
  'DAZ': { desc: 'Hair Color', formKey: 'DAZ', regex: /^[A-Z]{3}$/ },
  'DCB': { desc: 'Restrictions', formKey: 'DCB' },
  'DCD': { desc: 'Endorsements', formKey: 'DCD' },
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DCG': { desc: 'Country', formKey: 'DCG', regex: /^[A-Z]{3}$/ }
};

const parseAAMVARaw = (raw: string): { data: Record<string, string>, error?: string, warnings?: string[] } => {
  const result: Record<string, string> = {};
  const warnings: string[] = [];
  
  if (!raw.startsWith('@')) return { data: {}, error: "Missing Compliance Indicator (@)" };
  if (!raw.includes('ANSI')) return { data: {}, error: "Missing 'ANSI' File Type" };

  // Offset extraction (Bytes 23-27 for 1st subfile)
  const offsetStr = raw.substring(23, 27);
  const offset = parseInt(offsetStr, 10);

  // Length extraction (Bytes 27-31 for 1st subfile)
  const lengthStr = raw.substring(27, 31);
  const declaredLength = parseInt(lengthStr, 10);
  
  if (isNaN(offset)) return { data: {}, error: "Invalid Header Offset" };
  if (offset >= raw.length) return { data: {}, error: "Offset points outside file bounds" };

  // The Data Block starts at offset.
  let dataBlock = raw.substring(offset);
  
  // VALIDATION: Check Actual Length vs Declared Length
  // Actual available data from offset to end of string (or next subfile if we supported multiple)
  // For single subfile, it's the rest of the string.
  const actualLength = dataBlock.length;
  if (actualLength !== declaredLength) {
      warnings.push(`Length Mismatch: Declared ${declaredLength}, Found ${actualLength}. Hardware scanners may fail.`);
  }

  // VERIFY SUBFILE TYPE
  const subfileType = dataBlock.substring(0, 2);
  
  if (subfileType !== "DL" && subfileType !== "ID") {
      warnings.push(`Subfile Type Missing: Data block at offset ${offset} starts with '${subfileType}', expected 'DL' or 'ID'.`);
  } else {
      // Remove the "DL" prefix to parse the rest of the fields
      dataBlock = dataBlock.substring(2);
  }
  
  const lines = dataBlock.split('\n');

  lines.forEach(line => {
    line = line.trim();
    // Some lines might be just CR or empty
    if (line.length < 3) return;
    
    const match = line.match(/^([A-Z]{3})(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();
      result[key] = val;
    }
  });

  return { data: result, warnings };
};

export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const { data: scannedData, error, warnings } = parseAAMVARaw(rawString);
  const fields: ValidationField[] = [];
  
  const hasCompliance = rawString.startsWith('@');
  const isValidSignature = hasCompliance && !error;

  if (error) {
      fields.push({
          elementId: "HEADER",
          description: "AAMVA Binary Header",
          formValue: "Valid Header",
          scannedValue: error,
          status: "INVALID_FORMAT",
          message: "Critical: Scanners will fail to read this."
      });
  }

  if (warnings && warnings.length > 0) {
      warnings.forEach(w => {
          fields.push({
              elementId: "WARN",
              description: "Structure Warning",
              formValue: "Compliant",
              scannedValue: "Non-Compliant",
              status: "INVALID_FORMAT",
              message: w
          });
      });
  }

  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    const keyExists = Object.prototype.hasOwnProperty.call(scannedData, elId);
    const scannedVal = scannedData[elId];
    const formKey = config.formKey as keyof DLFormData;
    const formVal = currentFormData[formKey];

    if (!keyExists) {
      // Don't show missing if form value is also empty (e.g. optional middle name)
      if (!formVal) return;

      fields.push({
        elementId: elId,
        description: config.desc,
        formValue: formVal || '(empty)',
        scannedValue: 'Tag Missing',
        status: 'MISSING_IN_SCAN'
      });
      return;
    }

    // Normalization for comparison
    const normScanned = scannedVal.toUpperCase().replace(/\s+/g, ' ').trim();
    const normForm = (formVal || '').toUpperCase().replace(/\s+/g, ' ').trim();

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    if (normScanned !== normForm) {
        // Special Handling for Height (070 in vs 70 in)
        if (elId === 'DAU') {
             const hScanned = normScanned.replace(/^0+/, '').replace(/\s/g,'');
             const hForm = normForm.replace(/^0+/, '').replace(/\s/g,'');
             if (hScanned !== hForm) {
                 status = 'MISMATCH';
                 msg = `Value mismatch`;
             }
        } else {
             status = 'MISMATCH';
             msg = `Value mismatch`;
        }
    }

    if (config.regex && !config.regex.test(scannedVal)) {
      status = 'INVALID_FORMAT';
      msg = `Format violation (AAMVA)`;
    }

    fields.push({
      elementId: elId,
      description: config.desc,
      formValue: formVal,
      scannedValue: scannedVal,
      status: status,
      message: msg
    });
  });

  return {
    isValidSignature,
    rawString,
    fields
  };
};