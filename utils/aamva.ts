
import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  const current = (name || "").toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };
  return { text: current.substring(0, limit), truncated: 'T' };
};

/**
 * AAMVA 2020:
 * Dates for USA: MMDDYYYY
 * Dates for Canada: YYYYMMDD (CCYYMMDD)
 */
const formatToAAMVADate = (dateStr: string, country: string = 'USA'): string => {
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length !== 8) return clean.padEnd(8, '0');
  
  // If input is YYYYMMDD (typical ISO/Gemini output), convert to MMDDYYYY for US
  if (country === 'USA') {
    if (parseInt(clean.substring(0, 4)) > 1300) {
      const y = clean.substring(0, 4);
      const m = clean.substring(4, 6);
      const d = clean.substring(6, 8);
      return `${m}${d}${y}`;
    }
  }
  return clean; // Default for Canada or already correct
};

export const generateAAMVAString = (data: DLFormData): string => {
  const segments: string[] = [];
  const isID = data.subfileType === 'ID';
  const country = data.DCG || 'USA';

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    let final = (val || "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    if (final && final !== 'NONE') {
      // Specific padding for Zip Code (DAK) to satisfy F11ANS (11 chars)
      if (tag === 'DAK') final = final.padEnd(11, ' ');
      segments.push(`${tag}${final}`);
    }
  };

  // Annex D.3 - Mandatory Elements
  // Elements DCA, DCB, DCD are specific to Driver Licenses
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
  
  // Sex (DBC): Ensure numeric per standard (1=M, 2=F, 9=Unknown)
  let sex = data.DBC;
  if (sex === 'M' || sex === 'MALE') sex = '1';
  else if (sex === 'F' || sex === 'FEMALE') sex = '2';
  else if (!['1', '2', '9'].includes(sex)) sex = '9';
  add("DBC", sex);

  add("DAY", data.DAY);
  
  // Height (DAU): Format per Annex D example "073 in"
  let hVal = data.DAU.replace(/\D/g, '');
  if (hVal) {
    const unit = data.DAU.toUpperCase().includes('CM') ? 'cm' : 'in';
    add("DAU", `${hVal.padStart(3, '0')} ${unit}`);
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
  
  // Truncation indicators (DDE, DDF, DDG) - Mandatory in 2020
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

  const subfileContent = "DL" + segments.join(LF) + CR;
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  
  // Header ANSI 15434 (21 bytes)
  const header = `@${LF}${RS}${CR}ANSI ${iin}${data.Version.padStart(2, '0')}${data.JurisdictionVersion.padStart(2, '0')}01`; 
  
  // Designator: Type(2) + Offset(4) + Length(4) = 10 bytes
  // Header(21) + Designator(10) = 31 offset
  const offset = 31;
  const designator = "DL" + offset.toString().padStart(4, '0') + subfileContent.length.toString().padStart(4, '0');

  return header + designator + subfileContent;
};
