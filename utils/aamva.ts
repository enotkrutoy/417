
import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

/**
 * Implements AAMVA 2020 Standard A.7.7 Truncation Algorithm
 * 1. Eliminate spaces adjacent to hyphens (R to L)
 * 2. Eliminate apostrophes (R to L)
 * 3. Eliminate remaining chars (R to L) EXCLUDING: hyphens, spaces, and char after hyphen/space.
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  let current = name.toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  // Phase 1: Eliminate spaces adjacent to hyphens
  current = current.replace(/\s+-/g, '-').replace(/-\s+/g, '-');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 2: Eliminate apostrophes
  current = current.replace(/'/g, '');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 3: Eliminate remaining characters excluding protected ones
  let chars = current.split('');
  // We work right to left.
  for (let i = chars.length - 1; i >= 0 && chars.length > limit; i--) {
    const char = chars[i];
    const prevChar = i > 0 ? chars[i - 1] : null;
    
    // Protection Rule: Hyphens, Spaces, and characters immediately following a hyphen or space
    const isProtected = char === '-' || char === ' ' || prevChar === '-' || prevChar === ' ';
    
    if (!isProtected) {
      chars.splice(i, 1);
      // After splicing, the next iteration will check the 'new' character at this position
      // but since we are moving R to L, we just continue decreasing i.
    }
  }

  const finalStr = chars.join('');
  return { text: finalStr.substring(0, limit), truncated: 'T' };
};

const formatHeight = (h: string) => {
  // Expected input: 5-09 or 68 or 172cm
  if (h.toLowerCase().includes('cm')) {
    const val = h.replace(/\D/g, '').padStart(3, '0');
    return `${val} CM`;
  }
  const parts = h.split(/['-]/);
  if (parts.length >= 2) {
    const feet = parseInt(parts[0], 10) || 0;
    const inches = parseInt(parts[1], 10) || 0;
    const totalInches = (feet * 12) + inches;
    return `${totalInches.toString().padStart(3, '0')} IN`;
  }
  const val = h.replace(/\D/g, '').padStart(3, '0');
  return `${val} IN`;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];
  
  // Truncation according to A.7.7
  const lastTrunc = truncateAAMVA(data.DCS || "", 40);
  const firstTrunc = truncateAAMVA(data.DAC || "", 40);
  const midTrunc = truncateAAMVA(data.DAD || "", 40);

  const add = (tag: string, val: string) => {
    if (val) subfields.push(`${tag}${val.toUpperCase().trim()}`);
  };

  // Table D.3 - Minimum Mandatory
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", (data.DBA || "").replace(/\D/g, ''));
  add("DCS", lastTrunc.text);
  add("DAC", firstTrunc.text);
  add("DAD", midTrunc.text);
  add("DBD", (data.DBD || "").replace(/\D/g, ''));
  add("DBB", (data.DBB || "").replace(/\D/g, ''));
  add("DBC", data.DBC || "1");
  add("DAY", data.DAY || "BRO");
  add("DAU", formatHeight(data.DAU || "509"));
  add("DAG", data.DAG || "");
  add("DAI", data.DAI || "");
  add("DAJ", data.DAJ || "");
  add("DAK", (data.DAK || "").replace(/\D/g, ''));
  add("DAQ", data.DAQ || "NONE");
  add("DCF", data.DCF || "NONE");
  add("DCG", data.DCG || "USA");
  add("DDE", lastTrunc.truncated);
  add("DDF", firstTrunc.truncated);
  add("DDG", midTrunc.truncated);

  // Table D.4 - Optional (Priority)
  if (data.DAW) add("DAW", data.DAW.replace(/\D/g, '').padStart(3, '0'));
  if (data.DAZ) add("DAZ", data.DAZ);
  if (data.DDA) add("DDA", data.DDA);
  if (data.DDK) add("DDK", data.DDK);
  if (data.DCU) add("DCU", data.DCU);

  const subfileType = "DL";
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  // Header Construction
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const version = "10"; // AAMVA 2020
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const entries = "01";
  
  const header = "@" + LF + RS + CR + "ANSI " + iin + version + jurVersion + entries;
  
  // Designator (Type + Offset + Length)
  const designatorOffset = header.length + (10 * 1); // 10 bytes per subfile designator
  const designator = subfileType + designatorOffset.toString().padStart(4, '0') + fullSubfile.length.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};
