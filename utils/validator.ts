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
  'DAU': { desc: 'Height', formKey: 'DAU', regex: /^\d{3} (in|cm)$/ }, // Strict AAMVA: "070 in"
  'DAW': { desc: 'Weight', formKey: 'DAW', regex: /^\d{3}$/ },
  'DAY': { desc: 'Eye Color', formKey: 'DAY', regex: /^[A-Z]{3}$/ }, 
  'DAZ': { desc: 'Hair Color', formKey: 'DAZ', regex: /^[A-Z]{3}$/ },
  'DCB': { desc: 'Restrictions', formKey: 'DCB' },
  'DCD': { desc: 'Endorsements', formKey: 'DCD' },
  'DCF': { desc: 'Doc Discriminator', formKey: 'DCF' },
  'DCG': { desc: 'Country', formKey: 'DCG', regex: /^[A-Z]{3}$/ },
  'DDEN': { desc: 'Truncation (Last)', formKey: 'DCS', regex: /^[NTU]$/ }, // DCS is proxy key, not direct
  'DDFN': { desc: 'Truncation (First)', formKey: 'DAC', regex: /^[NTU]$/ },
  'DDGN': { desc: 'Truncation (Middle)', formKey: 'DAD', regex: /^[NTU]$/ },
};

const parseAAMVARaw = (raw: string): { data: Record<string, string>, error?: string, warnings?: string[] } => {
  const result: Record<string, string> = {};
  const warnings: string[] = [];
  
  if (!raw.startsWith('@')) return { data: {}, error: "Missing Compliance Indicator (@)" };
  if (!raw.includes('ANSI')) return { data: {}, error: "Missing 'ANSI' File Type" };

  // 1. Header Analysis
  const offsetStr = raw.substring(23, 27);
  const offset = parseInt(offsetStr, 10);
  const lengthStr = raw.substring(27, 31);
  const declaredLength = parseInt(lengthStr, 10);
  
  if (isNaN(offset)) return { data: {}, error: "Invalid Header Offset" };
  
  // 2. Data Block Extraction
  // Note: The raw string might continue after this subfile if strictly compliant, 
  // but for single DL generation, we treat the rest as the block.
  let dataBlock = raw.substring(offset);
  
  // 3. Subfile Type Check
  const subfileType = dataBlock.substring(0, 2);
  if (subfileType !== "DL" && subfileType !== "ID") {
      warnings.push(`Subfile Type Error: Found '${subfileType}', expected 'DL'.`);
  }
  
  // Remove "DL" to parse fields
  const fieldsBlock = dataBlock.substring(2);
  
  // 4. Parse Fields (Split by LF)
  const lines = fieldsBlock.split('\n');

  lines.forEach(line => {
    line = line.trim();
    if (line.length < 2) return; // Skip empty/CR lines
    
    // Attempt to match 3-char tag + value
    const match = line.match(/^([A-Z0-9]{3})(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2]; // Don't trim value aggressively here, space might be significant in some formats
      result[key] = val.trim();
    }
  });

  return { data: result, warnings };
};

export const validateBarcode = (rawString: string, currentFormData: DLFormData): ValidationReport => {
  const { data: scannedData, error, warnings } = parseAAMVARaw(rawString);
  const fields: ValidationField[] = [];
  
  const isValidSignature = !error;

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

  // Iterate over defined elements to validate
  Object.entries(ELEMENT_MAP).forEach(([elId, config]) => {
    const scannedVal = scannedData[elId];
    
    // Special handling for Truncation flags which map to Name fields in form data
    let formVal = "";
    if (elId === 'DDEN' || elId === 'DDFN' || elId === 'DDGN') {
        // Logic: If name > 40 chars, expect T, else N. 
        // We just check if it matches regex [NTU] mostly.
        formVal = "N"; // Default expectation
    } else {
        formVal = currentFormData[config.formKey] || "";
    }

    // Skip missing optional fields if they are missing in both
    if (!scannedVal && !formVal && elId !== 'DDEN') return;

    if (scannedVal === undefined) {
      // If form has value but scan doesn't
      if (formVal && formVal !== 'NONE') {
         fields.push({
            elementId: elId,
            description: config.desc,
            formValue: formVal,
            scannedValue: 'MISSING',
            status: 'MISSING_IN_SCAN'
         });
      }
      return;
    }

    let status: ValidationField['status'] = 'MATCH';
    let msg = '';

    // Regex Validation
    if (config.regex && !config.regex.test(scannedVal)) {
      status = 'INVALID_FORMAT';
      msg = `Format violation. Expected: ${config.regex.source}`;
    }

    // Value Comparison (Normalization)
    // For truncation flags, we don't compare strictly against form data because we don't store "N" in form data
    if (!['DDEN', 'DDFN', 'DDGN'].includes(elId)) {
        const normScanned = scannedVal.toUpperCase().replace(/\s+/g, ' ').trim();
        const normForm = formVal.toUpperCase().replace(/\s+/g, ' ').trim();
        
        if (normScanned !== normForm) {
            // Special Height Check: 070 in vs 70 in
            const hS = normScanned.replace(/^0+/, '').replace(/\s/g,'');
            const hF = normForm.replace(/^0+/, '').replace(/\s/g,'');
            if (hS !== hF) {
                status = 'MISMATCH';
                msg = 'Data mismatch';
            } else {
                 // matched loosely
                 status = 'MATCH';
            }
        }
    }

    fields.push({
      elementId: elId,
      description: config.desc,
      formValue: ['DDEN','DDFN','DDGN'].includes(elId) ? "(Auto)" : formVal,
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