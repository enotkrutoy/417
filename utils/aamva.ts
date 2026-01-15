
import { DLFormData } from '../types';

/**
 * AAMVA 2020 DL/ID Card Design Standard
 * Section D.12.3: Header Format (21 bytes fixed)
 * Section D.12.4: Subfile Designator (10 bytes fixed)
 */

const LF = "\n"; // 0x0A - Data Element Separator
const RS = "\x1e"; // 0x1E - Record Separator
const CR = "\r"; // 0x0D - Segment Terminator

const sanitize = (s: string) => (s || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string) => {
    const cleanVal = sanitize(val);
    if (cleanVal) {
      subfields.push(`${tag}${cleanVal}`);
    }
  };

  // Build Subfile elements using Field Identifiers
  // Note: The order matters for some legacy scanners, though standards say any order.
  // We use the recommended AAMVA sequence.
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", data.DBA); // Expiry MMDDCCYY
  add("DCS", data.DCS); // Last Name
  add("DAC", data.DAC); // First Name
  add("DAD", data.DAD); // Middle Name
  add("DBD", data.DBD); // Issue Date MMDDCCYY
  add("DBB", data.DBB); // DOB MMDDCCYY
  add("DBC", data.DBC); // Sex (1=M, 2=F)
  add("DAY", data.DAY); // Eyes
  add("DAU", data.DAU); // Height
  add("DAG", data.DAG); // Address
  add("DAI", data.DAI); // City
  add("DAJ", data.DAJ); // State
  add("DAK", data.DAK); // Zip
  add("DAQ", data.DAQ); // ID Number
  add("DCF", data.DCF); // Document Discriminator (DD)
  add("DCG", data.DCG || "USA"); // Country
  add("DDA", data.DDA || "F"); // Compliance
  
  // Truncation Indicators (DDE, DDF, DDG)
  // Logic: 'T' if truncated, 'N' if not.
  add("DDE", (data.DCS || "").length > 40 ? "T" : "N");
  add("DDF", (data.DAC || "").length > 40 ? "T" : "N");
  add("DDG", (data.DAD || "").length > 40 ? "T" : "N");

  // Subfile construction: Starts with Subfile Type (e.g. "DL")
  // Fields are joined by LF. Ends with LF + Segment Terminator (CR).
  const subfileType = "DL";
  const subfileContent = subfields.join(LF) + LF + CR;
  const fullSubfile = subfileType + subfileContent;

  // Header Construction (21 bytes)
  const compliance = "@"; // 1 byte
  const separators = LF + RS + CR; // 3 bytes
  const fileType = "ANSI "; // 5 bytes
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0'); // 6 bytes
  const aamvaVersion = (data.Version || "08").padStart(2, '0'); // 2 bytes
  const jurisdictionVersion = (data.JurisdictionVersion || "00").padStart(2, '0'); // 2 bytes
  const numberOfEntries = "01"; // 2 bytes (Fixed for single subfile)

  // Subfile Designator (10 bytes)
  // Offset = Header (21) + All Designators (10 * numEntries)
  const offsetValue = 21 + (10 * 1); 
  const lengthValue = fullSubfile.length;

  const designator = subfileType + 
                     offsetValue.toString().padStart(4, '0') + 
                     lengthValue.toString().padStart(4, '0');

  // Result: Header + Designator + Subfile
  return compliance + separators + fileType + iin + aamvaVersion + jurisdictionVersion + numberOfEntries + designator + fullSubfile;
};
