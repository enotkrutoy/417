import { DLFormData } from '../types';

/**
 * AAMVA 2020 Standard Constants & Helpers
 */
const COMPLIANCE_INDICATOR = "@"; // 0x40
const DATA_ELEMENT_SEPARATOR = "\n"; // 0x0A (LF)
const RECORD_SEPARATOR = "\x1e"; // 0x1E (RS)
const SEGMENT_TERMINATOR = "\r"; // 0x0D (CR)
const FILE_TYPE = "ANSI ";
const IIN_DEFAULT = "636000"; 

// Helper to ensure strict ASCII (remove special quotes, accents, etc which break PDF417)
const toAscii = (str: string) => str.replace(/[^\x00-\x7F]/g, "").trim();

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
 * Generates the raw AAMVA compliant string.
 * MATH EXPLANATION:
 * - Header = 21 bytes
 * - Subfile Designator = 10 bytes (Type 2 + Offset 4 + Length 4)
 * - Offset to Data = Header + (NumEntries * 10)
 * - Subfile Length = 10 (Designator) + Data.length + 1 (Terminator)
 */
export const generateAAMVAString = (data: DLFormData): string => {
  
  // --- 1. Build the DL Subfile Data Block ---
  const fields: string[] = [];

  // Mandatory Header Elements inside Subfile
  fields.push(`DDA${formatField(data.DDA, 1, true)}`); // Compliance
  
  // Ensure DEB/DBB/DBA/DBD are purely numeric 8 digits
  const cleanDate = (d: string) => d ? d.replace(/\D/g, '').slice(0, 8) : "";
  
  fields.push(`DEB${cleanDate(data.DEB)}`); // File Create Date
  fields.push(`DAQ${formatField(data.DAQ, 25, true)}`); // License #
  fields.push(`DCS${formatField(data.DCS, 40, true)}`); // Last Name
  fields.push(`DAC${formatField(data.DAC, 40, true)}`); // First Name
  fields.push(`DAD${formatField(data.DAD, 40)}`);       // Middle Name
  fields.push(`DCA${formatField(data.DCA, 6, true)}`);   // Class
  fields.push(`DCB${formatField(data.DCB || "NONE", 12, true)}`); // Restrictions
  fields.push(`DCD${formatField(data.DCD || "NONE", 5, true)}`);  // Endorsements
  fields.push(`DBA${cleanDate(data.DBA)}`); // Exp Date
  fields.push(`DBB${cleanDate(data.DBB)}`); // DOB
  fields.push(`DBD${cleanDate(data.DBD)}`); // Issue Date
  fields.push(`DBC${formatField(data.DBC, 1, true)}`);   // Sex
  fields.push(`DAY${formatField(data.DAY, 3, true)}`);   // Eyes
  
  // Height: Ensure format "069 in" or "175 cm"
  let height = data.DAU;
  if (height && !height.includes(' ')) {
      // Assuming user typed "069", append " in" default
      height = height + " in"; 
  }
  fields.push(`DAU${formatField(height, 6, true)}`);
  fields.push(`DAW${formatField(data.DAW, 3, true)}`);   // Weight
  fields.push(`DAG${formatField(data.DAG, 35, true)}`);  // Street
  fields.push(`DAI${formatField(data.DAI, 20, true)}`);  // City
  fields.push(`DAJ${formatField(data.DAJ, 2, true)}`);   // State
  fields.push(`DAK${formatField(data.DAK, 11, true)}`);  // Zip
  fields.push(`DCF${formatField(data.DCF, 25, true)}`);  // Discriminator
  fields.push(`DCG${formatField(data.DCG, 3, true)}`);   // Country
  
  if (data.DAZ) fields.push(`DAZ${formatField(data.DAZ, 12)}`); // Hair

  // Truncation flags (Mandatory)
  fields.push(`DDEN`); 
  fields.push(`DDFN`); 
  fields.push(`DDGN`); 

  // Join fields with LF. 
  // CRITICAL: The Data Block MUST begin with the Subfile Type ("DL").
  // This is implicit in the standard examples (e.g. ...00410278DLDAQT...).
  // Without this "DL" prefix in the data, hardware scanners will fail to identify the start of the block.
  let subfileData = "DL" + fields.join(DATA_ELEMENT_SEPARATOR);
  
  // Append Subfile Terminator (LF) before the Segment Terminator
  subfileData += DATA_ELEMENT_SEPARATOR;

  // --- 2. Calculate Offsets & Lengths ---
  
  // We are generating 1 Subfile ("DL").
  const numEntries = 1; 
  
  const headerSize = 21;
  const designatorSize = 10;
  
  // Offset is where the actual DATA begins.
  // It skips the Header (21) and ALL Subfile Designators (10 * numEntries).
  const offsetToDLData = headerSize + (designatorSize * numEntries);
  
  // Total Length of the subfile = Designator (10) + Data + Segment Terminator (1)
  const lengthOfDLSubfile = designatorSize + subfileData.length + 1; // +1 for the final CR

  // Format to 4-digit zero-padded strings
  const offsetStr = offsetToDLData.toString().padStart(4, '0');
  const lengthStr = lengthOfDLSubfile.toString().padStart(4, '0');

  // --- 3. Construct the Raw String ---
  
  let raw = "";
  
  // 3a. File Header
  raw += COMPLIANCE_INDICATOR; // @ (byte 0)
  raw += DATA_ELEMENT_SEPARATOR; // \n (byte 1)
  raw += RECORD_SEPARATOR;       // \x1e (byte 2)
  raw += SEGMENT_TERMINATOR;     // \r (byte 3)
  raw += FILE_TYPE;              // "ANSI " (bytes 4-8)
  raw += (data.IIN || IIN_DEFAULT).padEnd(6, '0'); // IIN (bytes 9-14)
  raw += (data.Version || "08").padStart(2, '0');  // Version (bytes 15-16)
  raw += "00";                   // Jur Version (bytes 17-18)
  raw += numEntries.toString().padStart(2, '0'); // Entries (bytes 19-20) -> "01"

  // 3b. Subfile Designator (DL)
  raw += "DL";                   // Type
  raw += offsetStr;              // Offset to data
  raw += lengthStr;              // Length of this subfile

  // 3c. Subfile Data (Includes "DL" prefix + fields + LF)
  raw += subfileData;
  
  // 3d. Final Segment Terminator
  raw += SEGMENT_TERMINATOR;     // \r

  return raw;
};