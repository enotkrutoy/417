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
  'DDA': { desc: 'Compliance Type', formKey: 'DDA', regex: /^[F|N]$/ }, // F = Fully Compliant (Real ID), N = Non-Compliant
  'DAG': { desc: 'Address Street', formKey: 'DAG' },
  'DAI': { desc: 'City', formKey: 'DAI' },
  'DAJ': { desc: 'State Code', formKey: 'DAJ', regex: /^[A-Z]{2}$/ },
  'DAK': { desc: 'Zip Code', formKey: 'DAK', regex: /^[0-9-]{5,11}$/ },
  'DCA': { desc: 'Class', formKey: 'DCA' },
  'DBC': { desc: 'Sex', formKey: 'DBC', regex: /^[12X]$/ }, // Added X for AAMVA 2020
  'DAU': { desc: 'Height', formKey: 'DAU' },
  'DAW': { desc: 'Weight', formKey: 'DAW' },
  'DAY': { desc: 'Eye Color', formKey: 'DAY', regex: /^[A-Z]{3}$/ },
  'DAZ': { desc: 'Hair Color', formKey: 'DAZ', regex: /^[A-Z]{3}$/ },
  'DCB': { desc: 'Restrictions', formKey: 'DCB' },
  'DCD': { desc: 'Endorsements', formKey: 'DCD' },
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DCG': { desc: 'Country', formKey: 'DCG', regex: /^[A-Z]{3}$/ }
};

/**
 * Parses a raw AAMVA string (PDF417 content) into a key-value map.
 * Assumes format: @...DL...DAQ12345...
 */
const parseAAMVARaw = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  
  // 1. Basic Header Check
  if (!raw.startsWith('@')) return result;

  // 2. Find the Subfile Block
  const cleanRaw = raw.replace(/\r/g, '\n'); 
  const lines = cleanRaw.split('\n');

  lines.forEach(line => {
    line = line.trim();
    
    // Fix: Handle Subfile Type merged with first element (e.g. "DLDDAF")
    if (/^(DL|ID|EN)[A-Z]{3}/.test(line)) {
      line = line.substring(2);
    }

    if (line.length < 3) return;

    // AAMVA Elements are 3 uppercase letters followed by data
    const match = line.match(/^([A-Z]{3})(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();
      result[key] = val;
    }
  });

  return result;
};

/**
 * Validates the scanned data against the current Form Data and AAMVA Standards.
 */
export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const scannedData = parseAAMVARaw(rawString);
  const fields: ValidationField[] = [];
  
  // Check signature
  const isValidSignature = rawString.startsWith('@') && rawString.includes('ANSI');

  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    // Check if the key exists in the scanned data object at all
    const keyExists = Object.prototype.hasOwnProperty.call(scannedData, elId);
    
    // Get the value (might be empty string)
    const scannedVal = scannedData[elId];
    const formVal = currentFormData[config.formKey as string];

    if (!keyExists) {
      // Key is completely missing from the barcode
      fields.push({
        elementId: elId,
        description: config.desc,
        formValue: formVal || '(empty)',
        scannedValue: 'Tag Missing',
        status: 'MISSING_IN_SCAN'
      });
      return;
    }

    // Key exists, but value might be empty (which is valid for some fields like Weight in NC)
    if (scannedVal === "") {
        const isFormEmpty = !formVal || formVal.trim() === "";
        fields.push({
            elementId: elId,
            description: config.desc,
            formValue: formVal || '(empty)',
            scannedValue: '(empty)',
            status: isFormEmpty ? 'MATCH' : 'MISMATCH', // If form is also empty, it's a match.
            message: isFormEmpty ? undefined : 'Scanned value is empty'
        });
        return;
    }

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    // 1. Format Validation (AAMVA 2020 Standard)
    if (config.regex && !config.regex.test(scannedVal)) {
      status = 'INVALID_FORMAT';
      msg = `Format mismatch.`;
    }

    // 2. Comparison Validation
    const normScanned = scannedVal.toUpperCase().replace(/\s+/g, ' ').trim();
    const normForm = (formVal || '').toUpperCase().replace(/\s+/g, ' ').trim();

    // Specific handling for Height (DAU)
    if (elId === 'DAU') {
        const hScanned = normScanned.replace(/\D/g, ''); 
        const hForm = normForm.replace(/\D/g, '');
        if (hScanned !== hForm) {
            status = 'MISMATCH';
            msg = `Values differ: Form(${hForm}) vs Scan(${hScanned})`;
        }
    } 
    // General handling
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