
import { DLFormData } from '../types';

/**
 * AAMVA 2020 DL/ID Card Design Standard
 * Section D.12.3: Header Format (21 bytes fixed)
 * Section D.12.4: Subfile Designator (10 bytes fixed)
 */

const LF = "\n"; // 0x0A
const RS = "\x1e"; // 0x1E
const CR = "\r"; // 0x0D

const sanitize = (s: string) => (s || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string) => {
    const cleanVal = sanitize(val);
    if (cleanVal) subfields.push(`${tag}${cleanVal}`);
  };

  // 1. Mandatory Elements (Order as per AAMVA Standard Recommended Sequence)
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", data.DBA); // Expiry
  add("DCS", data.DCS); // Family Name
  add("DAC", data.DAC); // Given Name
  add("DAD", data.DAD); // Middle Name
  add("DBD", data.DBD); // Issue Date
  add("DBB", data.DBB); // DOB
  add("DBC", data.DBC); // Sex
  add("DAY", data.DAY); // Eyes
  add("DAU", data.DAU); // Height
  add("DAG", data.DAG); // Address
  add("DAI", data.DAI); // City
  add("DAJ", data.DAJ); // State
  add("DAK", data.DAK); // Zip
  add("DAQ", data.DAQ); // ID Number
  add("DCF", data.DCF); // Document Discriminator
  add("DCG", data.DCG); // Country
  add("DDA", data.DDA); // Compliance

  // 2. Truncation Indicators (DDE, DDF, DDG)
  add("DDE", data.DCS.length > 40 ? "T" : "N");
  add("DDF", data.DAC.length > 40 ? "T" : "N");
  add("DDG", (data.DAD || "").length > 40 ? "T" : "N");

  // Subfile Content construction
  // Start with "DL" then all fields joined by LF, ending with LF and Segment Terminator CR
  const subfileBody = subfields.join(LF) + LF + CR;
  const subfileType = "DL";
  const fullSubfile = subfileType + subfileBody;

  // 3. Header Construction (21 bytes)
  const compliance = "@";
  const separators = LF + RS + CR;
  const fileType = "ANSI "; // 5 bytes
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const aamvaVersion = (data.Version || "10").padStart(2, '0');
  const jurisdictionVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const numberOfEntries = "01";

  // Subfile Designator (10 bytes)
  // Offset = Header (21) + All Designators (10 * numEntries)
  const offsetValue = 21 + (10 * parseInt(numberOfEntries));
  const lengthValue = fullSubfile.length;

  const designator = subfileType + 
                     offsetValue.toString().padStart(4, '0') + 
                     lengthValue.toString().padStart(4, '0');

  // Combine everything
  return compliance + separators + fileType + iin + aamvaVersion + jurisdictionVersion + numberOfEntries + designator + fullSubfile;
};
