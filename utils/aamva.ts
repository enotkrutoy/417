
import { DLFormData } from '../types';

const LF = "\x0A"; 
const RS = "\x1E"; 
const CR = "\x0D"; 

/**
 * AAMVA 2020 Annex A.7.7: Name Truncation Sequence
 * 1. Delete blanks adjacent to hyphens (R to L)
 * 2. Delete apostrophes (R to L)
 * 3. Delete other characters (R to L) while preserving:
 *    - Hyphens
 *    - Blanks
 *    - The character immediately following a hyphen or blank
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  let current = (name || "").toUpperCase().replace(/[^\x00-\x7F]/g, "").trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  // Phase 1: Delete blanks adjacent to hyphens (Right to Left)
  while (current.length > limit && (current.includes(" -") || current.includes("- "))) {
    const lastSpaceHyphen = current.lastIndexOf(" -");
    const lastHyphenSpace = current.lastIndexOf("- ");
    const targetIdx = Math.max(lastSpaceHyphen, lastHyphenSpace);
    
    if (targetIdx === -1) break;
    const spaceIdx = current[targetIdx] === ' ' ? targetIdx : targetIdx + 1;
    current = current.substring(0, spaceIdx) + current.substring(spaceIdx + 1);
  }

  // Phase 2: Delete apostrophes (Right to Left)
  while (current.length > limit && current.includes("'")) {
    const idx = current.lastIndexOf("'");
    current = current.substring(0, idx) + current.substring(idx + 1);
  }

  // Phase 3: Delete other characters (Right to Left)
  // Rule: Do not delete hyphen, blank, or char after hyphen/blank
  if (current.length > limit) {
    let chars = current.split('');
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars.length <= limit) break;
      
      const char = chars[i];
      const prevChar = i > 0 ? chars[i - 1] : null;
      
      // Protection logic
      const isHyphenOrBlank = char === '-' || char === ' ';
      const isProtectedByPrefix = prevChar === '-' || prevChar === ' ';
      
      if (!isHyphenOrBlank && !isProtectedByPrefix) {
        chars.splice(i, 1);
      }
    }
    current = chars.join('');
  }

  return { 
    text: current.substring(0, limit), // Final safety clip
    truncated: 'T' 
  };
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
    if (final && final !== 'NONE') {
      if (tag === 'DAK') final = final.padEnd(11, ' '); 
      if (tag === 'DAJ') final = final.substring(0, 2); 
      if (tag === 'DBC') {
        if (final.startsWith('M') || final === '1') final = '1';
        else if (final.startsWith('F') || final === '2') final = '2';
        else final = '9';
      }
      if (tag === 'DAU') {
        const digits = final.replace(/\D/g, '');
        const unit = final.toLowerCase().includes('cm') ? 'cm' : 'in';
        final = `${digits.padStart(3, '0')} ${unit}`;
      }
      segments.push(`${tag}${final}`);
    }
  };

  if (subType === 'DL') {
    add("DCA", data.DCA || "C");
    add("DCB", data.DCB);
    add("DCD", data.DCD);
  }

  const truncatedDCS = truncateAAMVA(data.DCS, 40);
  const truncatedDAC = truncateAAMVA(data.DAC, 40);
  const truncatedDAD = truncateAAMVA(data.DAD, 40);

  add("DBA", formatToAAMVADate(data.DBA, country));
  add("DCS", truncatedDCS.text);
  add("DAC", truncatedDAC.text);
  add("DAD", truncatedDAD.text);
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
  
  add("DDE", truncatedDCS.truncated);
  add("DDF", truncatedDAC.truncated);
  add("DDG", truncatedDAD.truncated);

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
