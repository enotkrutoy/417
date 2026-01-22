
import { DLFormData } from '../types';

const LF = "\x0A"; // Data Element Separator
const RS = "\x1E"; // Record Separator
const CR = "\x0D"; // Segment Terminator

/**
 * Standard AAMVA 2020 Annex D.12.5.1: Name truncation indicators
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  const current = (name || "").toUpperCase().replace(/[^\x00-\x7F]/g, "").trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };
  return { text: current.substring(0, limit), truncated: 'T' };
};

/**
 * AAMVA 2020 Date Formats (Annex D):
 * USA (MMDDCCYY): MMDDYYYY
 * Canada (CCYYMMDD): YYYYMMDD
 */
const formatToAAMVADate = (dateStr: string, country: string = 'USA'): string => {
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length !== 8) return clean.padEnd(8, '0');
  
  const isInputISO = parseInt(clean.substring(0, 4)) > 1300;

  if (country === 'USA' && isInputISO) {
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return `${m}${d}${y}`;
  }
  
  if (country === 'CAN' && !isInputISO) {
    const m = clean.substring(0, 2);
    const d = clean.substring(2, 4);
    const y = clean.substring(4, 8);
    return `${y}${m}${d}`;
  }

  return clean;
};

/**
 * Generates AAMVA Compliant String (Annex D)
 * @warning Incorrect header size will cause rejection by parser nodes.
 */
export const generateAAMVAString = (data: DLFormData): string => {
  const segments: string[] = [];
  const subType = data.subfileType || 'DL';
  const isID = subType === 'ID';
  const country = data.DCG || 'USA';

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    // Force ASCII/ISO 8859-1 (D.3.1)
    let final = (val || "").replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    
    if (final && final !== 'NONE') {
      if (tag === 'DAK') final = final.padEnd(11, ' '); 
      if (tag === 'DAJ') final = final.substring(0, 2); 
      
      // Sex Mapping (Page 70: 1=M, 2=F, 9=X)
      if (tag === 'DBC') {
        if (final.startsWith('M') || final === '1') final = '1';
        else if (final.startsWith('F') || final === '2') final = '2';
        else final = '9';
      }
      
      // Height Formatting (Page 70: "070 in")
      if (tag === 'DAU') {
        const digits = final.replace(/\D/g, '');
        const unit = final.toLowerCase().includes('cm') ? 'cm' : 'in';
        final = `${digits.padStart(3, '0')} ${unit}`;
      }

      segments.push(`${tag}${final}`);
    }
  };

  if (!isID) {
    add("DCA", data.DCA || "C");
    add("DCB", data.DCB);
    add("DCD", data.DCD);
  }

  add("DBA", formatToAAMVADate(data.DBA, country));
  add("DCS", truncateAAMVA(data.DCS, 40).text);
  add("DAC", truncateAAMVA(data.DAC, 40).text);
  add("DAD", truncateAAMVA(data.DAD, 40).text);
  add("DBD", formatToAAMVADate(data.DBD, country));
  add("DBB", formatToAAMVADate(data.DBB, country));
  add("DBC", data.DBC);
  add("DAY", data.DAY);
  add("DAU", data.DAU);
  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", data.DAK);
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", country);
  
  add("DDE", truncateAAMVA(data.DCS, 40).truncated);
  add("DDF", truncateAAMVA(data.DAC, 40).truncated);
  add("DDG", truncateAAMVA(data.DAD, 40).truncated);

  const optionalTags = [
    'DAH','DAZ','DCI','DCJ','DCK','DBN','DBG','DBS','DCU','DCE','DCL',
    'DDA','DDB','DDC','DDD','DAW','DAX','DDH','DDI','DDJ','DDK','DDL'
  ];

  optionalTags.forEach(tag => {
    let val = data[tag];
    if (val && val !== '0' && val !== 'NONE' && val !== 'N') {
      if (['DDB', 'DDC', 'DDH', 'DDI', 'DDJ'].includes(tag)) val = formatToAAMVADate(val, country);
      add(tag, val, false);
    }
  });

  let subfileData = subType;
  for (let i = 0; i < segments.length; i++) {
    const terminator = (i === segments.length - 1) ? CR : LF;
    subfileData += segments[i] + terminator;
  }

  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const version = (data.Version || "10").padStart(2, '0');
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  
  // Header ANSI 15434 (Compliance Check: Exactly 21 bytes as per Annex D.12.3)
  const header = `@${LF}${RS}${CR}ANSI ${iin}${version}${jurVersion}01`; 
  
  // Designator (Exactly 10 bytes)
  const offset = 21 + 10; 
  const designator = subType + offset.toString().padStart(4, '0') + subfileData.length.toString().padStart(4, '0');

  return header + designator + subfileData;
};
