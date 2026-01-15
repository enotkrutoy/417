import { DLFormData, ValidationField, ValidationReport } from '../types';

// Map AAMVA Element IDs to readable descriptions and Form Keys
const ELEMENT_MAP: Record<string, { desc: string, formKey: keyof DLFormData, regex?: RegExp }> = {
  'DAQ': { desc: 'License Number', formKey: 'DAQ', regex: /^[A-Z0-9]+$/i },
  'DBA': { desc: 'Expiration Date', formKey: 'DBA', regex: /^\d{8}$/ }, // MMDDYYYY
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
  'DAY': { desc: 'Eye Color', formKey: 'DAZ', regex: /^[A-Z]{3}$/ }, // Maps to DAY on form, fix typings later if needed
  'DCB': { desc: 'Restrictions', formKey: 'DCB' },
  'DCD': { desc: 'Endorsements', formKey: 'DCD' },
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DCG': { desc: 'Country', formKey: 'DCG', regex: /^[A-Z]{3}$/ }
};

/**
 * Parses a raw AAMVA string (PDF417 content) into a key-value map.
 * Now includes Header Integrity Check.
 */
const parseAAMVARaw = (raw: string): { data: Record<string, string>, error?: string } => {
  const result: Record<string, string> = {};
  
  // 1. Basic Signature Check
  if (!raw.startsWith('@')) return { data: {}, error: "Missing Compliance Indicator (@)" };
  if (!raw.includes('ANSI')) return { data: {}, error: "Missing 'ANSI' File Type" };

  // 2. Extract Offset from Header
  // Header structure: @(1) + Sep(1) + Rec(1) + Seg(1) + ANSI (5) + IIN(6) + V(2) + JV(2) + Entries(2)
  // Total Header Fixed = 21 bytes.
  // Subfile Designator 1 starts at index 21.
  // Designator: Type(2) + Offset(4) + Length(4)
  
  const offsetStr = raw.substring(23, 27); // Bytes 23-27 is the Offset for the first subfile
  const offset = parseInt(offsetStr, 10);
  
  if (isNaN(offset)) return { data: {}, error: "Invalid Header Offset" };
  
  // 3. Jump to Data Block
  // The data block starts exactly at 'offset'.
  // We slice the string from that point to parse elements.
  // If the offset is out of bounds, the barcode is garbage.
  if (offset >= raw.length) return { data: {}, error: "Offset points outside file bounds" };

  const dataBlock = raw.substring(offset);
  
  // 4. Split and Map
  const lines = dataBlock.split('\n');

  lines.forEach(line => {
    line = line.trim();
    // AAMVA Elements are 3 uppercase letters followed by data
    const match = line.match(/^([A-Z]{3})(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();
      result[key] = val;
    }
  });

  return { data: result };
};

export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const { data: scannedData, error } = parseAAMVARaw(rawString);
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

  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    // If we have a critical header error, we might not have data, but we process what we found
    const keyExists = Object.prototype.hasOwnProperty.call(scannedData, elId);
    const scannedVal = scannedData[elId];
    // Cast strict type
    const formKey = config.formKey as keyof DLFormData;
    const formVal = currentFormData[formKey];

    if (!keyExists) {
      fields.push({
        elementId: elId,
        description: config.desc,
        formValue: formVal || '(empty)',
        scannedValue: 'Tag Missing',
        status: 'MISSING_IN_SCAN'
      });
      return;
    }

    if (scannedVal === "") {
        const isFormEmpty = !formVal || formVal.trim() === "";
        fields.push({
            elementId: elId,
            description: config.desc,
            formValue: formVal || '(empty)',
            scannedValue: '(empty)',
            status: isFormEmpty ? 'MATCH' : 'MISMATCH',
            message: isFormEmpty ? undefined : 'Scanned value is empty'
        });
        return;
    }

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    if (config.regex && !config.regex.test(scannedVal)) {
      status = 'INVALID_FORMAT';
      msg = `Format error.`;
    }

    const normScanned = scannedVal.toUpperCase().replace(/\s+/g, ' ').trim();
    const normForm = (formVal || '').toUpperCase().replace(/\s+/g, ' ').trim();

    if (elId === 'DAU') {
        const hScanned = normScanned.replace(/\D/g, ''); 
        const hForm = normForm.replace(/\D/g, '');
        if (hScanned !== hForm) {
            status = 'MISMATCH';
            msg = `Form(${hForm}) vs Scan(${hScanned})`;
        }
    } 
    else if (normScanned !== normForm) {
       status = 'MISMATCH';
       msg = `Data mismatch.`;
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