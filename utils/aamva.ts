
import { DLFormData } from '../types';

/**
 * AAMVA 2020 DL/ID Card Design Standard
 * Implementing Annex D: Mandatory PDF417 Bar Code
 */

const LF = "\x0A"; // Data Element Separator
const RS = "\x1E"; // Record Separator
const CR = "\x0D"; // Segment Terminator / Subfile Terminator

const formatHeight = (h: string) => {
  const digits = h.replace(/\D/g, '');
  if (!digits) return "000 in";
  return `${digits.padStart(3, '0')} in`;
};

const sanitize = (val: string, placeholder = "NONE") => {
  const cleaned = (val || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned || placeholder;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string, isMandatory = true) => {
    const placeholder = isMandatory ? "NONE" : "";
    const cleanVal = tag === "DAU" ? formatHeight(val) : sanitize(val, placeholder);
    if (cleanVal || isMandatory) {
      subfields.push(`${tag}${cleanVal}`);
    }
  };

  // Порядок тегов согласно Table D.3 (Рекомендованный для интероперабельности)
  add("DCA", data.DCA || "D");
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
  add("DDE", data.DDE || "N"); // Truncation indicators
  add("DDF", data.DDF || "N");
  add("DDG", data.DDG || "N");

  // Подфайл DL
  const subfileType = "DL";
  // Содержимое подфайла: элементы через LF, в конце CR
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  // Header (21 байт)
  const complianceIndicator = "@";
  const headerSeparators = LF + RS + CR;
  const fileType = "ANSI "; // 5 байт
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const aamvaVersion = "10"; // Версия 2020 стандарта
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const numEntries = "01";

  const header = complianceIndicator + headerSeparators + fileType + iin + aamvaVersion + jurVersion + numEntries;

  // Subfile Designator (10 байт)
  const offsetValue = header.length + 10; // 21 + (1 * 10) = 31
  const lengthValue = fullSubfile.length;

  const designator = subfileType + 
                     offsetValue.toString().padStart(4, '0') + 
                     lengthValue.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};
