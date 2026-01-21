
import { DLFormData } from '../types';

const LF = "\x0A"; // Data Element Separator
const RS = "\x1E"; // Record Separator
const CR = "\x0D"; // Segment Terminator

export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  const current = (name || "").toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };
  return { text: current.substring(0, limit), truncated: 'T' };
};

/**
 * AAMVA 2020:
 * Dates for USA: MMDDYYYY (MMDDCCYY)
 * Dates for Canada: YYYYMMDD (CCYYMMDD)
 */
const formatToAAMVADate = (dateStr: string, country: string = 'USA'): string => {
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length !== 8) return clean.padEnd(8, '0');
  
  // If input is YYYYMMDD (typical ISO/Gemini output), convert to MMDDYYYY for US
  if (country === 'USA') {
    // Check if the first 4 digits look like a year (e.g., 19xx or 20xx)
    if (parseInt(clean.substring(0, 4)) > 1300) {
      const y = clean.substring(0, 4);
      const m = clean.substring(4, 6);
      const d = clean.substring(6, 8);
      return `${m}${d}${y}`;
    }
  }
  return clean; // Default for Canada or already correct format
};

export const generateAAMVAString = (data: DLFormData): string => {
  const segments: string[] = [];
  const isID = data.subfileType === 'ID';
  const country = data.DCG || 'USA';

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    let final = (val || "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    if (final && final !== 'NONE') {
      // Padding for fixed length fields (Annex D.12.5.1/D.12.5.2)
      if (tag === 'DAK') final = final.padEnd(11, ' '); // F11
      if (tag === 'DAJ') final = final.substring(0, 2); // F2A
      if (tag === 'DBC') {
        // Map common inputs to AAMVA numeric codes (1=M, 2=F, 9=X)
        if (final.startsWith('M')) final = '1';
        else if (final.startsWith('F')) final = '2';
        else if (final === 'X' || final.startsWith('U')) final = '9';
        else if (!['1', '2', '9'].includes(final)) final = '9';
      }
      segments.push(`${tag}${final}`);
    }
  };

  // Annex D.3 - Mandatory Elements
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
  add("DAY", data.DAY);
  
  // Height (DAU): Format per Annex D example "070 in" or "175 cm"
  let hRaw = data.DAU.replace(/\D/g, '');
  if (hRaw) {
    const unit = data.DAU.toLowerCase().includes('cm') ? 'cm' : 'in';
    add("DAU", `${hRaw.padStart(3, '0')} ${unit}`);
  } else {
    add("DAU", `000 ${country === 'CAN' ? 'cm' : 'in'}`);
  }

  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", data.DAK);
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", country);
  
  // Truncation indicators (DDE, DDF, DDG)
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

  // Construction of Subfile Data: DL + segments terminated by LF/CR
  let subfileData = "DL";
  for (let i = 0; i < segments.length; i++) {
    // Every element is terminated by LF (Data Element Separator), 
    // but the very last element in the subfile must be terminated by CR (Segment Terminator).
    const term = (i === segments.length - 1) ? CR : LF;
    subfileData += segments[i] + term;
  }

  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  
  // Header ANSI 15434 (21 bytes)
  const header = `@${LF}${RS}${CR}ANSI ${iin}${data.Version.padStart(2, '0')}${data.JurisdictionVersion.padStart(2, '0')}01`; 
  
  // Designator: SubfileType(2) + Offset(4) + Length(4) = 10 bytes
  const offset = 21 + 10; // Header + 1 Designator
  const designator = "DL" + offset.toString().padStart(4, '0') + subfileData.length.toString().padStart(4, '0');

  return header + designator + subfileData;
};
