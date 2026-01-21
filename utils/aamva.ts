import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

/**
 * AAMVA 2020 Standard A.7.7 Truncation Algorithm
 * 1. Eliminate spaces adjacent to hyphens (Right-to-Left)
 * 2. Eliminate apostrophes (Right-to-Left)
 * 3. Eliminate any remaining characters, excluding hyphens, remaining spaces, 
 *    and characters immediately following a hyphen or a space.
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  let current = (name || "").toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  // Phase 1: Spaces adjacent to hyphens
  while (current.length > limit && (current.includes(" -") || current.includes("- "))) {
    const idx1 = current.lastIndexOf(" -");
    const idx2 = current.lastIndexOf("- ");
    const target = Math.max(idx1, idx2);
    if (current[target] === ' ') {
      current = current.substring(0, target) + current.substring(target + 1);
    } else {
      current = current.substring(0, target + 1) + current.substring(target + 2);
    }
  }
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 2: Apostrophes
  while (current.length > limit && current.includes("'")) {
    const idx = current.lastIndexOf("'");
    current = current.substring(0, idx) + current.substring(idx + 1);
  }
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 3: General characters (protecting hyphens, spaces, and char-after-them)
  let chars = current.split('');
  for (let i = chars.length - 1; i >= 0 && chars.length > limit; i--) {
    const char = chars[i];
    const prevChar = i > 0 ? chars[i - 1] : null;
    
    // Protect if char is hyphen, space, or if it follows a hyphen/space
    const isProtected = char === '-' || char === ' ' || prevChar === '-' || prevChar === ' ';
    
    if (!isProtected) {
      chars.splice(i, 1);
    }
  }

  const final = chars.join('').substring(0, limit);
  return { text: final, truncated: 'T' };
};

const formatHeight = (h: string) => {
  const val = h.replace(/\D/g, '');
  if (h.toLowerCase().includes('cm')) return val.padStart(3, '0') + " CM";
  return val.padStart(3, '0') + " IN";
};

const formatAAMVADate = (dateStr: string, country: string): string => {
  const d = dateStr.replace(/\D/g, '');
  if (d.length !== 8) return d;
  const isUS = country !== 'CAN';
  // Standard 2020: MMDDCCYY for US, CCYYMMDD for Canada
  if (isUS) {
    // If input is YYYYMMDD, convert to MMDDCCYY
    if (d.startsWith('19') || d.startsWith('20')) {
      return d.substring(4, 6) + d.substring(6, 8) + d.substring(0, 4);
    }
    return d;
  } else {
    // If input is MMDDYYYY, convert to CCYYMMDD
    if (!d.startsWith('19') && !d.startsWith('20')) {
      return d.substring(4, 8) + d.substring(0, 4);
    }
    return d;
  }
};

export const generateAAMVAString = (data: DLFormData): string => {
  const isCanada = data.DCG === 'CAN';
  const dlSubfields: string[] = [];
  
  const lastTrunc = truncateAAMVA(data.DCS, 40);
  const firstTrunc = truncateAAMVA(data.DAC, 40);
  const midTrunc = truncateAAMVA(data.DAD, 40);

  const add = (tag: string, val: string, isMandatory: boolean = true) => {
    let finalVal = (val || "").toUpperCase().trim();
    if (!finalVal) {
      finalVal = isMandatory ? "NONE" : ""; // Use NONE if strictly missing but mandatory
    }
    if (finalVal || isMandatory) {
      dlSubfields.push(`${tag}${finalVal || "unavl"}`);
    }
  };

  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", formatAAMVADate(data.DBA, data.DCG));
  add("DCS", lastTrunc.text);
  add("DAC", firstTrunc.text);
  add("DAD", midTrunc.text);
  add("DBD", formatAAMVADate(data.DBD, data.DCG));
  add("DBB", formatAAMVADate(data.DBB, data.DCG));
  add("DBC", data.DBC);
  add("DAY", data.DAY || "BRO");
  add("DAU", formatHeight(data.DAU));
  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  
  const cleanZip = (data.DAK || "").replace(/[^A-Z0-9]/g, '');
  add("DAK", isCanada ? cleanZip.substring(0, 11) : cleanZip.padEnd(11, '0').substring(0, 11));

  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", data.DCG || "USA");
  add("DDE", lastTrunc.truncated);
  add("DDF", firstTrunc.truncated);
  add("DDG", midTrunc.truncated);
  
  // Optional Tags with standard enforcement
  if (data.DCU) add("DCU", data.DCU, false);
  if (data.DAW) add("DAW", data.DAW.replace(/\D/g, '').padStart(3, '0').substring(0, 3), false);
  if (data.DAZ) add("DAZ", data.DAZ, false);
  if (data.DDA) add("DDA", data.DDA, false);
  if (data.DDB) add("DDB", formatAAMVADate(data.DDB, data.DCG), false);
  if (data.DDK === '1') add("DDK", "1", false);
  if (data.DDL === '1') add("DDL", "1", false);
  if (data.DDD === '1') add("DDD", "1", false);

  const subfileContent = "DL" + dlSubfields.join(LF) + CR;
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const entries = "01";
  
  // Header: 21 bytes total
  const header = "@" + LF + RS + CR + "ANSI " + iin + "10" + jurVersion + entries;
  
  // Designator: 10 bytes total (Type[2] + Offset[4] + Length[4])
  const designatorOffset = header.length + (parseInt(entries) * 10);
  const designator = "DL" + designatorOffset.toString().padStart(4, '0') + subfileContent.length.toString().padStart(4, '0');

  return header + designator + subfileContent;
};