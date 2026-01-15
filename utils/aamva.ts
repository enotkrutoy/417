import { DLFormData } from '../types';

/**
 * AAMVA 2020 (Version 08) Standard Constants & Helpers
 * Based on DL/ID Card Design Standard
 */
const COMPLIANCE_INDICATOR = "@"; // 0x40
const DATA_ELEMENT_SEPARATOR = "\n"; // 0x0A (LF)
const RECORD_SEPARATOR = "\x1e"; // 0x1E (RS)
const SEGMENT_TERMINATOR = "\r"; // 0x0D (CR)
const FILE_TYPE = "ANSI ";

// Helper to ensure strict ASCII and remove control characters
const toAscii = (str: string) => str.replace(/[^\x20-\x7E]/g, "").trim();

/**
 * Formats a field: trims, truncates, checks mandatory status.
 */
const formatField = (value: string, maxLength: number, isMandatory: boolean = false): string => {
  if (!value) return isMandatory ? "NONE" : "";
  const cleanValue = toAscii(value);
  if (cleanValue.length > maxLength) {
    return cleanValue.substring(0, maxLength);
  }
  return cleanValue;
};

/**
 * Formats date to MMDDYYYY (USA Standard)
 * Input can be various formats, output must be strict 8 digits.
 */
const formatDate = (val: string): string => {
  if (!val) return "";
  const digits = val.replace(/\D/g, '');
  // Assuming input is relatively sane; strict validation happens in validator
  return digits.substring(0, 8);
};

/**
 * Generates the raw AAMVA compliant string.
 */
export const generateAAMVAString = (data: DLFormData): string => {
  
  const fields: string[] = [];

  // --- Helper to add field safely ---
  const add = (tag: string, val: string) => {
     if (val !== "") {
         fields.push(`${tag}${val}`);
     }
  };

  // --- 1. Pre-calculate Truncation Flags ---
  // AAMVA requires we explicitly state if names were truncated.
  // Values: N = Not truncated, T = Truncated, U = Unknown
  
  const rawLast = toAscii(data.DCS || "");
  const rawFirst = toAscii(data.DAC || "");
  const rawMiddle = toAscii(data.DAD || "");

  const truncLast = rawLast.length > 40 ? 'T' : 'N';
  const truncFirst = rawFirst.length > 40 ? 'T' : 'N';
  const truncMiddle = rawMiddle.length > 40 ? 'T' : 'N';

  // --- 2. Build the DL Subfile Data Block ---
  // Order roughly follows AAMVA best practices (Mandatory first, then Optional)
  // Note: Parsers use tags, so order is technically flexible, but standard order reduces friction.

  // Mandatory Header Elements inside Subfile (Ver 08)
  add("DDA", formatField(data.DDA, 1, true)); // Compliance Type (F/N)
  add("DCS", formatField(data.DCS, 40, true)); // Last Name
  add("DAC", formatField(data.DAC, 40, true)); // First Name
  add("DAD", formatField(data.DAD, 40));       // Middle Name
  add("DBD", formatDate(data.DBD));            // Issue Date
  add("DBB", formatDate(data.DBB));            // DOB
  add("DBA", formatDate(data.DBA));            // Exp Date
  add("DBC", formatField(data.DBC, 1, true));  // Sex
  add("DAU", formatField(data.DAU, 6, true));  // Height
  add("DAY", formatField(data.DAY, 3, true));  // Eye Color
  add("DAZ", formatField(data.DAZ, 3));        // Hair Color
  
  add("DAG", formatField(data.DAG, 35, true)); // Street
  add("DAI", formatField(data.DAI, 20, true)); // City
  add("DAJ", formatField(data.DAJ, 2, true));  // State
  add("DAK", formatField(data.DAK, 11, true)); // Zip
  
  add("DAQ", formatField(data.DAQ, 25, true)); // License #
  add("DCF", formatField(data.DCF, 25, true)); // Doc Discriminator (Mandatory in 08)
  add("DCG", formatField(data.DCG, 3, true));  // Country

  // Class / Restrictions / Endorsements
  add("DCA", formatField(data.DCA, 6, true));
  add("DCB", formatField(data.DCB || "NONE", 12, true));
  add("DCD", formatField(data.DCD || "NONE", 5, true));

  // Weight (Optional in some, Mandatory in others, we treat as standard)
  add("DAW", formatField(data.DAW, 3)); 

  // Truncation Flags (Mandatory)
  add("DDEN", truncLast); 
  add("DDFN", truncFirst); 
  add("DDGN", truncMiddle); 

  // File Creation Date (Mandatory)
  add("DEB", formatDate(data.DEB));

  // --- 3. Construct Data Block String ---
  // Rules:
  // 1. Starts with "DL" (Subfile Type)
  // 2. Fields separated by LF
  // 3. Last field followed by LF then CR (Segment Terminator)
  
  let subfileData = "DL";
  if (fields.length > 0) {
      subfileData += fields.join(DATA_ELEMENT_SEPARATOR) + DATA_ELEMENT_SEPARATOR;
  }
  subfileData += SEGMENT_TERMINATOR;

  // --- 4. Calculate Offsets & Lengths ---
  
  const numEntries = 1; 
  const headerSize = 21;
  const designatorSize = 10;
  
  // Offset points to the 'DL' tag.
  const offsetToDLData = headerSize + (designatorSize * numEntries);
  
  // Length is the length of the subfileData string (including the trailing CR)
  const lengthOfDLSubfile = subfileData.length;

  const offsetStr = offsetToDLData.toString().padStart(4, '0');
  const lengthStr = lengthOfDLSubfile.toString().padStart(4, '0');

  // --- 5. Construct Final Raw String ---
  
  let raw = "";
  
  // 5a. File Header (21 bytes)
  raw += COMPLIANCE_INDICATOR; // @
  raw += DATA_ELEMENT_SEPARATOR; // \n
  raw += RECORD_SEPARATOR;       // \x1e
  raw += SEGMENT_TERMINATOR;     // \r
  raw += FILE_TYPE;              // "ANSI "
  raw += (data.IIN || "636000").padEnd(6, '0'); // Issuer ID
  raw += (data.Version || "08").padStart(2, '0'); // AAMVA Version
  raw += "00";                   // Jurisdiction Version (00 usually)
  raw += "01";                   // Number of Entries (01)

  // 5b. Subfile Designator (10 bytes)
  raw += "DL";                   // Type
  raw += offsetStr;              // Offset
  raw += lengthStr;              // Length

  // 5c. Subfile Data
  raw += subfileData;
  
  return raw;
};