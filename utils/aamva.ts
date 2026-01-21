import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

/**
 * Implements AAMVA 2020 Standard A.7.7 Truncation Algorithm
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

  // Phase 3: Eliminate remaining characters excluding protected ones (R to L)
  let chars = current.split('');
  for (let i = chars.length - 1; i >= 0 && chars.length > limit; i--) {
    const char = chars[i];
    const prevChar = i > 0 ? chars[i - 1] : null;
    const isProtected = char === '-' || char === ' ' || prevChar === '-' || prevChar === ' ';
    if (!isProtected) {
      chars.splice(i, 1);
    }
  }

  const finalStr = chars.join('').substring(0, limit);
  return { text: finalStr, truncated: 'T' };
};

const formatHeight = (h: string) => {
  if (h.toLowerCase().includes('cm')) {
    return h.replace(/\D/g, '').padStart(3, '0') + " CM";
  }
  const parts = h.split(/['-]/);
  if (parts.length >= 2) {
    const totalInches = (parseInt(parts[0], 10) * 12) + (parseInt(parts[1], 10) || 0);
    return `${totalInches.toString().padStart(3, '0')} IN`;
  }
  return h.replace(/\D/g, '').padStart(3, '0') + " IN";
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];
  
  const lastTrunc = truncateAAMVA(data.DCS || "", 40);
  const firstTrunc = truncateAAMVA(data.DAC || "", 40);
  const midTrunc = truncateAAMVA(data.DAD || "", 40);

  const add = (tag: string, val: string) => {
    if (val) subfields.push(`${tag}${val.toUpperCase().trim()}`);
  };

  // Mandatory Elements
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", data.DBA.replace(/\D/g, ''));
  add("DCS", lastTrunc.text);
  add("DAC", firstTrunc.text);
  add("DAD", midTrunc.text);
  add("DBD", data.DBD.replace(/\D/g, ''));
  add("DBB", data.DBB.replace(/\D/g, ''));
  add("DBC", data.DBC || "1");
  add("DAY", data.DAY || "BRO");
  add("DAU", formatHeight(data.DAU || "509"));
  add("DAG", data.DAG || "");
  add("DAI", data.DAI || "");
  add("DAJ", data.DAJ || "");
  add("DAK", data.DAK.replace(/\D/g, ''));
  add("DAQ", data.DAQ || "NONE");
  add("DCF", data.DCF || "NONE");
  add("DCG", data.DCG || "USA");
  add("DDE", lastTrunc.truncated);
  add("DDF", firstTrunc.truncated);
  add("DDG", midTrunc.truncated);

  // Optional Elements
  if (data.DAW) add("DAW", data.DAW.replace(/\D/g, '').padStart(3, '0'));
  if (data.DAZ) add("DAZ", data.DAZ);
  if (data.DDA) add("DDA", data.DDA);
  if (data.DDK) add("DDK", data.DDK);

  const subfileType = "DL";
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const version = "10"; 
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  
  // Header: 21 bytes total
  const header = "@" + LF + RS + CR + "ANSI " + iin + version + jurVersion + "01";
  
  // Designator: Type(2) + Offset(4) + Length(4) = 10 bytes
  const offset = header.length + 10; 
  const designator = subfileType + offset.toString().padStart(4, '0') + fullSubfile.length.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};