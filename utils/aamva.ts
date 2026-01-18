
import { DLFormData } from '../types';

/**
 * AAMVA 2020 DL/ID Card Design Standard
 * Implementing Annex D: Mandatory PDF417 Bar Code
 */

const LF = "\x0A"; // Data Element Separator
const RS = "\x1E"; // Record Separator
const CR = "\x0D"; // Segment Terminator / Subfile Terminator

const formatHeight = (h: string) => {
  const parts = h.split(/['-]/);
  if (parts.length >= 2) {
    const feet = parseInt(parts[0], 10) || 0;
    const inches = parseInt(parts[1], 10) || 0;
    const totalInches = (feet * 12) + inches;
    return `${totalInches.toString().padStart(3, '0')} IN`;
  }
  const digits = h.replace(/\D/g, '');
  if (digits.length > 0) return `${digits.padStart(3, '0')} IN`;
  return "000 IN";
};

const formatWeight = (w: string) => {
  const digits = w.replace(/\D/g, '');
  if (!digits) return "000 LB";
  return `${digits.padStart(3, '0')} LB`;
};

const sanitize = (val: string, placeholder = "NONE") => {
  const cleaned = (val || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned || placeholder;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string, isMandatory = true) => {
    let cleanVal = "";
    if (tag === "DAU") cleanVal = formatHeight(val);
    else if (tag === "DAW") cleanVal = formatWeight(val);
    else cleanVal = sanitize(val, isMandatory ? "NONE" : "");

    if (cleanVal || isMandatory) {
      subfields.push(`${tag}${cleanVal}`);
    }
  };

  // Порядок тегов AAMVA 2020 (Таблица D.3)
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB);
  add("DCD", data.DCD);
  add("DBA", data.DBA); // Expiry
  add("DCS", data.DCS); // Last Name
  add("DAC", data.DAC); // First Name
  add("DAD", data.DAD); // Middle
  add("DBD", data.DBD); // Issue Date
  add("DBB", data.DBB); // DOB
  add("DBC", data.DBC); // Sex
  add("DAY", data.DAY); // Eye Color
  add("DAU", data.DAU); // Height
  add("DAG", data.DAG); // Address
  add("DAI", data.DAI); // City
  add("DAJ", data.DAJ); // State
  add("DAK", data.DAK); // Zip
  add("DAQ", data.DAQ); // ID Number
  add("DCF", data.DCF); // Document Disc.
  add("DCG", data.DCG || "USA");
  
  // Optional but recommended
  add("DAW", data.DAW, false);
  add("DAZ", data.DAZ, false);
  
  // Truncation indicators (AAMVA 2020 Requirement)
  add("DDE", data.DDE || "N");
  add("DDF", data.DDF || "N");
  add("DDG", data.DDG || "N");

  const subfileType = data.subfileType || "DL";
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  // Header (21 байт)
  const complianceIndicator = "@";
  const headerSeparators = LF + RS + CR;
  const fileType = "ANSI "; 
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const aamvaVersion = "10"; 
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const numEntries = "01";

  const header = complianceIndicator + headerSeparators + fileType + iin + aamvaVersion + jurVersion + numEntries;

  // Subfile Designator (10 байт)
  const offsetValue = header.length + 10; 
  const lengthValue = fullSubfile.length;

  const designator = subfileType + 
                     offsetValue.toString().padStart(4, '0') + 
                     lengthValue.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};
