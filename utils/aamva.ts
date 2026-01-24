import { DLFormData } from '../types';

const LF = "\x0A"; 
const RS = "\x1E"; 
const CR = "\x0D"; 

/**
 * AAMVA 2020 Annex A.7.7: Name Truncation Sequence
 * Strict implementation of Phase 1, 2, and 3.
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  let current = (name || "").toUpperCase().replace(/[^\x00-\x7F]/g, "").trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  // Phase 1: Remove spaces adjacent to hyphens (" -", "- " -> "-")
  while (current.length > limit && (current.includes(" -") || current.includes("- "))) {
    current = current.replace(/ -/g, "-").replace(/- /g, "-");
  }
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 2: Remove apostrophes (Right to Left)
  while (current.length > limit && current.includes("'")) {
    const lastIdx = current.lastIndexOf("'");
    if (lastIdx !== -1) {
      current = current.slice(0, lastIdx) + current.slice(lastIdx + 1);
    } else {
      break; 
    }
  }
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 3: Remove other characters (Right to Left / Truncate)
  // Ensure we preserve the first character by simply slicing to limit if we are still over.
  if (current.length > limit) {
    current = current.substring(0, limit);
  }

  return { text: current, truncated: 'T' };
};

const formatToAAMVADate = (dateStr: string, country: string = 'USA'): string => {
  const clean = dateStr.replace(/\D/g, '');
  if (clean.length !== 8) return clean.padEnd(8, '0');
  const isInputISO = parseInt(clean.substring(0, 4)) > 1300;
  if (country === 'USA' && isInputISO) {
    return `${clean.substring(4, 6)}${clean.substring(6, 8)}${clean.substring(0, 4)}`;
  }
  if (country === 'CAN' && !isInputISO) {
    return `${clean.substring(4, 8)}${clean.substring(0, 2)}${clean.substring(2, 4)}`;
  }
  return clean;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const segments: string[] = [];
  const subType = data.subfileType || 'DL';
  const country = data.DCG || 'USA';

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    let final = (val || "").replace(/[^\x00-\x7F]/g, "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    
    if (final) {
      if (tag === 'DAK') {
          const digits = final.replace(/\D/g, '');
          // AAMVA D.12.5.1 [14] Compliance Fix: 
          // ZIP+4 unknown -> 0000 padding up to 9 digits, then pad to 11 chars.
          if (country === 'USA') {
              final = digits.padEnd(9, '0').slice(0, 9).padEnd(11, ' ');
          } else {
              final = digits.padEnd(11, ' ');
          }
      }
      if (tag === 'DAJ') final = final.substring(0, 2); 
      if (tag === 'DBC') {
        if (final.startsWith('M') || final === '1') final = '1';
        else if (final.startsWith('F') || final === '2') final = '2';
        else final = '9';
      }
      if (tag === 'DAU') {
        const digits = final.replace(/\D/g, '').padStart(3, '0').slice(-3);
        const unit = final.toLowerCase().includes('cm') ? 'cm' : 'in';
        final = `${digits} ${unit.toUpperCase()}`;
      }
      segments.push(`${tag}${final}`);
    }
  };

  if (subType === 'DL') {
    add("DCA", data.DCA || "C", true);
    add("DCB", data.DCB, true);
    add("DCD", data.DCD, true);
  }

  const truncatedDCS = truncateAAMVA(data.DCS, 40);
  const truncatedDAC = truncateAAMVA(data.DAC, 40);
  const truncatedDAD = truncateAAMVA(data.DAD, 40);

  add("DBA", formatToAAMVADate(data.DBA, country), true);
  add("DCS", truncatedDCS.text, true);
  add("DAC", truncatedDAC.text, true);
  add("DAD", truncatedDAD.text, true);
  add("DBD", formatToAAMVADate(data.DBD, country), true);
  add("DBB", formatToAAMVADate(data.DBB, country), true);
  add("DBC", data.DBC, true);
  add("DAY", data.DAY, true);
  add("DAU", data.DAU, true);
  add("DAG", data.DAG, true);
  add("DAI", data.DAI, true);
  add("DAJ", data.DAJ, true);
  add("DAK", data.DAK, true);
  add("DAQ", data.DAQ, true);
  add("DCF", data.DCF, true);
  add("DCG", country, true);
  
  add("DDE", truncatedDCS.truncated, false);
  add("DDF", truncatedDAC.truncated, false);
  add("DDG", truncatedDAD.truncated, false);

  const optionalTags = ['DAH','DAZ','DCI','DCJ','DCK','DBN','DBG','DBS','DCU','DCE','DCL','DDA','DDB','DDC','DDD','DAW','DAX','DDH','DDI','DDJ','DDK','DDL'];
  optionalTags.forEach(tag => {
    let val = data[tag];
    if (val && val !== '0' && val !== 'NONE' && val !== 'N') {
      if (['DDB', 'DDC', 'DDH', 'DDI', 'DDJ'].includes(tag)) val = formatToAAMVADate(val, country);
      add(tag, val, false);
    }
  });

  let subfileData = subType;
  for (let i = 0; i < segments.length; i++) {
    subfileData += segments[i] + (i === segments.length - 1 ? CR : LF);
  }

  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const version = (data.Version || "10").padStart(2, '0');
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  
  const header = `@${LF}${RS}${CR}ANSI ${iin}${version}${jurVersion}01`; 
  const offset = 21 + 10; 
  const designator = subType + offset.toString().padStart(4, '0') + subfileData.length.toString().padStart(4, '0');

  return header + designator + subfileData;
};