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

  // Phase 1: Eliminate spaces adjacent to hyphens (Right to Left)
  current = current.replace(/\s+-/g, '-').replace(/-\s+/g, '-');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 2: Eliminate apostrophes (Right to Left)
  current = current.replace(/'/g, '');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  // Phase 3: Eliminate remaining characters excluding hyphens, spaces, and char after hyphen/space
  // Logic: Work from right to left, skipping protected indices
  let chars = current.split('');
  for (let i = chars.length - 1; i >= 0 && chars.length > limit; i--) {
    const char = chars[i];
    const prevChar = i > 0 ? chars[i - 1] : null;
    
    // Protect: Hyphen, Space, and characters immediately following a hyphen or space
    const isProtected = char === '-' || char === ' ' || prevChar === '-' || prevChar === ' ';
    
    if (!isProtected) {
      chars.splice(i, 1);
    }
  }

  return { text: chars.join('').substring(0, limit), truncated: 'T' };
};

const formatHeight = (h: string) => {
  const parts = h.split(/['-]/);
  if (parts.length >= 2) {
    const feet = parseInt(parts[0], 10) || 0;
    const inches = parseInt(parts[1], 10) || 0;
    const totalInches = (feet * 12) + inches;
    return `${totalInches.toString().padStart(3, '0')} IN`;
  }
  return h.replace(/\D/g, '').padStart(3, '0') + " IN";
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];
  
  // Apply Truncation and determine DDE/DDF/DDG
  const lastTrunc = truncateAAMVA(data.DCS || "", 40);
  const firstTrunc = truncateAAMVA(data.DAC || "", 40);
  const midTrunc = truncateAAMVA(data.DAD || "", 40);

  const add = (tag: string, val: string) => {
    subfields.push(`${tag}${val.toUpperCase().trim()}`);
  };

  // Mandatory Table D.3
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
  add("DAU", formatHeight(data.DAU || "504"));
  add("DAG", data.DAG || "NONE");
  add("DAI", data.DAI || "NONE");
  add("DAJ", data.DAJ || "NY");
  add("DAK", data.DAK.replace(/\D/g, ''));
  add("DAQ", data.DAQ || "NONE");
  add("DCF", data.DCF || "NONE");
  add("DCG", data.DCG || "USA");

  // Optional Table D.4
  if (data.DAW) add("DAW", data.DAW.replace(/\D/g, '').padStart(3, '0') + " LB");
  if (data.DAZ) add("DAZ", data.DAZ);
  if (data.DDK) add("DDK", data.DDK);

  // AAMVA 2020 Truncation Indicators
  add("DDE", lastTrunc.truncated);
  add("DDF", firstTrunc.truncated);
  add("DDG", midTrunc.truncated);

  const subfileType = "DL";
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  // Header Construction (21 bytes)
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const version = (data.Version || "10").padStart(2, '0');
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  
  const header = "@" + LF + RS + CR + "ANSI " + iin + version + jurVersion + "01";
  
  // Designator (10 bytes per subfile)
  const offset = header.length + 10; // offset of DL subfile
  const designator = subfileType + offset.toString().padStart(4, '0') + fullSubfile.length.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};