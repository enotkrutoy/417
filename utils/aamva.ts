
import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

/**
 * AAMVA 2020 Standards:
 * Dates: YYYYMMDD
 * Elements separated by LF
 * Subfile ends with CR
 * Header: @ + LF + RS + CR + 'ANSI ' + IIN + Version + JurisdictionVersion + NumberOfSubfiles
 */

export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  const current = (name || "").toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };
  return { text: current.substring(0, limit), truncated: 'T' };
};

const formatToAAMVADate = (dateStr: string): string => {
  // Ensure YYYYMMDD
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length === 8) {
    // If user provided MMDDYYYY, we try to detect it, but standard says YYYYMMDD
    // For this tool, we assume input is already sanitized or we force YYYYMMDD.
    return clean;
  }
  return clean.padEnd(8, '0');
};

export const generateAAMVAString = (data: DLFormData): string => {
  const segments: string[] = [];

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    let final = (val || "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    if (final && final !== 'NONE') segments.push(`${tag}${final}`);
  };

  // Annex D.3 - Mandatory Elements
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB);
  add("DCD", data.DCD);
  add("DBA", formatToAAMVADate(data.DBA));
  add("DCS", truncateAAMVA(data.DCS, 40).text);
  add("DAC", truncateAAMVA(data.DAC, 40).text);
  add("DAD", truncateAAMVA(data.DAD, 40).text);
  add("DBD", formatToAAMVADate(data.DBD));
  add("DBB", formatToAAMVADate(data.DBB));
  add("DBC", data.DBC);
  add("DAY", data.DAY);
  
  // Height processing (e.g. 069 IN or 170 CM)
  let height = data.DAU.replace(/\D/g, '');
  if (height) {
    height = height.padStart(3, '0') + (data.DAU.includes('CM') ? ' CM' : ' IN');
    add("DAU", height);
  } else {
    add("DAU", "000 IN");
  }

  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", data.DAK.replace(/\D/g, '').substring(0, 11));
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", data.DCG);
  
  // Truncation indicators
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
      if (['DDB', 'DDC', 'DDH', 'DDI', 'DDJ'].includes(tag)) val = formatToAAMVADate(val);
      add(tag, val, false);
    }
  });

  const subfileContent = "DL" + segments.join(LF) + CR;
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  
  // Header ANSI 15434
  const header = `@${LF}${RS}${CR}ANSI ${iin}${data.Version.padStart(2, '0')}${data.JurisdictionVersion.padStart(2, '0')}01`; 
  
  // Designator: Type(2) + Offset(4) + Length(4)
  // Header(21 bytes) + Designator(10 bytes) = 31 offset
  const offset = 31;
  const designator = "DL" + offset.toString().padStart(4, '0') + subfileContent.length.toString().padStart(4, '0');

  return header + designator + subfileContent;
};
