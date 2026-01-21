import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

/**
 * AAMVA 2020 Standard A.7.7 Truncation Algorithm
 */
export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  let current = name.toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  current = current.replace(/\s+-/g, '-').replace(/-\s+/g, '-');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  current = current.replace(/'/g, '');
  if (current.length <= limit) return { text: current, truncated: 'T' };

  let chars = current.split('');
  for (let i = chars.length - 1; i >= 0 && chars.length > limit; i--) {
    const char = chars[i];
    const prevChar = i > 0 ? chars[i - 1] : null;
    const isProtected = char === '-' || char === ' ' || prevChar === '-' || prevChar === ' ';
    if (!isProtected) {
      chars.splice(i, 1);
    }
  }

  return { text: chars.join('').substring(0, limit), truncated: 'T' };
};

const formatHeight = (h: string) => {
  const val = h.replace(/\D/g, '');
  if (h.toLowerCase().includes('cm')) return val.padStart(3, '0') + " CM";
  return val.padStart(3, '0') + " IN";
};

/**
 * Normalizes dates based on AAMVA 2020 D.12.5.1
 * USA: MMDDCCYY, CAN: CCYYMMDD
 */
const formatAAMVADate = (dateStr: string, country: string): string => {
  const d = dateStr.replace(/\D/g, '');
  if (d.length !== 8) return d;

  const firstTwo = parseInt(d.substring(0, 2), 10);
  const isUS = country !== 'CAN';

  if (isUS) {
    // If input is CCYYMMDD (starts with 19/20), convert to MMDDCCYY
    if (firstTwo >= 19) return d.substring(4, 6) + d.substring(6, 8) + d.substring(0, 4);
  } else {
    // If input is MMDDCCYY (starts with 0/1), convert to CCYYMMDD
    if (firstTwo <= 12) return d.substring(4, 8) + d.substring(0, 4);
  }
  return d;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const isCanada = data.DCG === 'CAN';
  const dlSubfields: string[] = [];
  
  const lastTrunc = truncateAAMVA(data.DCS || "", 40);
  const firstTrunc = truncateAAMVA(data.DAC || "", 40);
  const midTrunc = truncateAAMVA(data.DAD || "", 40);

  const add = (tag: string, val: string) => {
    if (val !== undefined && val !== null) {
      dlSubfields.push(`${tag}${val.toUpperCase().trim()}`);
    }
  };

  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", formatAAMVADate(data.DBA || "", data.DCG));
  add("DCS", lastTrunc.text);
  add("DAC", firstTrunc.text);
  add("DAD", midTrunc.text);
  add("DBD", formatAAMVADate(data.DBD || "", data.DCG));
  add("DBB", formatAAMVADate(data.DBB || "", data.DCG));
  add("DBC", data.DBC || "1");
  add("DAY", data.DAY || "BRO");
  add("DAU", formatHeight(data.DAU || "070"));
  add("DAG", data.DAG || "");
  add("DAI", data.DAI || "");
  add("DAJ", data.DAJ || "");
  
  // DAK Normalization (Annex D, Table D.3, Ref p)
  const cleanZip = (data.DAK || "").replace(/[^A-Z0-9]/g, '');
  add("DAK", isCanada ? cleanZip.substring(0, 11) : cleanZip.padEnd(11, '0').substring(0, 11));

  add("DAQ", data.DAQ || "NONE");
  add("DCF", data.DCF || "NONE");
  add("DCG", data.DCG || "USA");
  add("DDE", lastTrunc.truncated);
  add("DDF", firstTrunc.truncated);
  add("DDG", midTrunc.truncated);
  
  if (data.DAW) add("DAW", data.DAW.replace(/\D/g, '').padStart(3, '0'));
  if (data.DAZ) add("DAZ", data.DAZ);
  if (data.DDA) add("DDA", data.DDA);
  if (data.DDK) add("DDK", data.DDK);
  if (data.DDD) add("DDD", data.DDD);

  const subfileContent = "DL" + dlSubfields.join(LF) + CR;
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const entries = "01";
  const header = "@" + LF + RS + CR + "ANSI " + iin + "10" + jurVersion + entries;
  const designatorOffset = 21 + (parseInt(entries) * 10);
  const designator = "DL" + designatorOffset.toString().padStart(4, '0') + subfileContent.length.toString().padStart(4, '0');

  return header + designator + subfileContent;
};