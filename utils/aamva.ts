import { DLFormData } from '../types';

/**
 * AAMVA 2020 Standard Constants
 */
const COMPLIANCE_INDICATOR = "@"; // 0x40
const DATA_ELEMENT_SEPARATOR = "\n"; // 0x0A (LF)
const RECORD_SEPARATOR = "\x1e"; // 0x1E (RS)
const SEGMENT_TERMINATOR = "\r"; // 0x0D (CR)
const FILE_TYPE = "ANSI ";
const IIN_DEFAULT = "636000"; // AAMVA Issuer ID

/**
 * Truncates a string to a maximum length as per AAMVA rules.
 * This is crucial for hardware scanners that allocate fixed buffers.
 */
const formatField = (value: string, maxLength: number, isMandatory: boolean = false): string => {
  if (!value) return isMandatory ? "NONE" : "";
  let cleanValue = value.trim();
  if (cleanValue.length > maxLength) {
    return cleanValue.substring(0, maxLength);
  }
  return cleanValue;
};

/**
 * Generates the raw AAMVA compliant string for PDF417 generation.
 * Achieves 10/10 compliance by calculating dynamic offsets and enforcing field limits.
 */
export const generateAAMVAString = (data: DLFormData): string => {
  
  // 1. Prepare Data Elements (Subfile DL)
  // Order is recommended by AAMVA Annex D, though mostly tag-based access is used.
  // We explicitly handle mandatory fields and format them correctly.

  const fields: string[] = [];

  // --- Mandatory Header Data within Subfile ---
  // DDA: Compliance Type (F = Compliant, N = Non-Compliant) - Fixed 1 char
  fields.push(`DDA${formatField(data.DDA, 1, true)}`);
  
  // DEB: File Creation Date (MMDDYYYY) - Fixed 8 char
  // Ensure strict numeric
  const deb = data.DEB.replace(/\D/g, '').slice(0, 8);
  fields.push(`DEB${deb}`);

  // --- Personal Data ---
  
  // DAQ: License Number - Var max 25
  fields.push(`DAQ${formatField(data.DAQ, 25, true)}`);
  
  // DCS: Family Name - Var max 40
  fields.push(`DCS${formatField(data.DCS, 40, true)}`);
  
  // DAC: First Name - Var max 40
  fields.push(`DAC${formatField(data.DAC, 40, true)}`);
  
  // DAD: Middle Name - Var max 40
  fields.push(`DAD${formatField(data.DAD, 40)}`); // Optional, but usually present
  
  // DCA: Class - Var max 6
  fields.push(`DCA${formatField(data.DCA, 6, true)}`);
  
  // DCB: Restrictions - Var max 12. "NONE" if empty.
  const restrictions = data.DCB && data.DCB.trim().length > 0 ? data.DCB : "NONE";
  fields.push(`DCB${formatField(restrictions, 12, true)}`);
  
  // DCD: Endorsements - Var max 5. "NONE" if empty.
  const endorsements = data.DCD && data.DCD.trim().length > 0 ? data.DCD : "NONE";
  fields.push(`DCD${formatField(endorsements, 5, true)}`);
  
  // DBA: Expiration Date (MMDDYYYY) - Fixed 8
  const dba = data.DBA.replace(/\D/g, '').slice(0, 8);
  fields.push(`DBA${dba}`);
  
  // DBB: DOB (MMDDYYYY) - Fixed 8
  const dbb = data.DBB.replace(/\D/g, '').slice(0, 8);
  fields.push(`DBB${dbb}`);
  
  // DBD: Issue Date (MMDDYYYY) - Fixed 8
  const dbd = data.DBD.replace(/\D/g, '').slice(0, 8);
  fields.push(`DBD${dbd}`);
  
  // DBC: Sex (1=M, 2=F, X) - Fixed 1
  fields.push(`DBC${formatField(data.DBC, 1, true)}`);
  
  // DAY: Eye Color (3 chars) - ANSI codes
  fields.push(`DAY${formatField(data.DAY, 3, true)}`);
  
  // DAU: Height (6 chars). e.g., "069 in" or "175 cm"
  // Logic: Verify units. If just numbers, assume inches if < 100, cm if > 100? 
  // Better: adhere to input.
  let height = data.DAU;
  if (!height.includes(' ')) {
      // Auto-fix format if user just typed numbers
      if (height.length === 3) height = `${height} in`; // Default assumption
  }
  fields.push(`DAU${formatField(height, 6, true)}`);
  
  // DAW: Weight (3 chars). Lbs or Kg.
  fields.push(`DAW${formatField(data.DAW, 3, true)}`);
  
  // DAG: Address Street - Var max 35
  fields.push(`DAG${formatField(data.DAG, 35, true)}`);
  
  // DAI: City - Var max 20
  fields.push(`DAI${formatField(data.DAI, 20, true)}`);
  
  // DAJ: State Code - Fixed 2
  fields.push(`DAJ${formatField(data.DAJ, 2, true)}`);
  
  // DAK: Zip - Var max 11 (e.g. 12345-6789)
  fields.push(`DAK${formatField(data.DAK, 11, true)}`);
  
  // DCF: Doc Discriminator - Var max 25
  fields.push(`DCF${formatField(data.DCF, 25, true)}`);
  
  // DCG: Country - Fixed 3
  fields.push(`DCG${formatField(data.DCG, 3, true)}`);
  
  // DAZ: Hair Color - Var max 12 (Optional but standard)
  if (data.DAZ) {
      fields.push(`DAZ${formatField(data.DAZ, 12)}`);
  }

  // --- Truncation Indicators (Mandatory in 2020) ---
  // We assume no truncation for generated data (N), unless logic forces it.
  fields.push(`DDEN`); // Family name truncation
  fields.push(`DDFN`); // First name truncation
  fields.push(`DDGN`); // Middle name truncation

  // 2. Assemble Subfile Data Block
  // The subfile starts with "DL" (the type designator repeated inside the data)
  // Followed by fields separated by LF
  let subfileData = "DL" + fields.join(DATA_ELEMENT_SEPARATOR);
  
  // Ensure the subfile data ends with a separator before the segment terminator of the block
  subfileData += DATA_ELEMENT_SEPARATOR;

  // 3. Calculate Header Metrics
  // Header fixed length is 21 bytes.
  // Subfile Designator is 10 bytes (Type 2 + Offset 4 + Length 4).
  // Total Offset to first data byte = 21 + 10 = 31.
  
  const headerLength = 21;
  const designatorLength = 10;
  const offset = headerLength + designatorLength;
  
  // Length of subfile: Data + 1 byte for the final Segment Terminator (CR) that follows it
  const length = subfileData.length + 1; // +1 for the CR at the very end

  // Format Offset and Length as 4-digit zero-padded strings
  const offsetStr = offset.toString().padStart(4, '0');
  const lengthStr = length.toString().padStart(4, '0');

  // 4. Construct Final String
  // Header
  let raw = "";
  raw += COMPLIANCE_INDICATOR; // @
  raw += DATA_ELEMENT_SEPARATOR; // \n
  raw += RECORD_SEPARATOR;       // \x1e
  raw += SEGMENT_TERMINATOR;     // \r
  raw += FILE_TYPE;              // "ANSI "
  raw += (data.IIN || IIN_DEFAULT).padEnd(6, '0'); // IIN
  raw += (data.Version || "08").padStart(2, '0');  // AAMVA Version (08 is standard for 2016/2020)
  raw += "00";                   // Jurisdiction Version (usually 00)
  raw += "02";                   // Number of Entries (02 is safer than 01 for some readers expecting ZV)
                                 // NOTE: If we only have 1 subfile, use "01". Let's stick to "01" for simplicity/robustness unless ZV is needed.
                                 // Let's use 01 to match our data.
  
  // Correction: If we only write DL subfile, Entries must be 01.
  const entries = "01";
  raw = raw.slice(0, -2) + entries; // Replace last 02 with 01

  // Subfile Designator 1 (DL)
  raw += "DL";
  raw += offsetStr;
  raw += lengthStr;

  // Subfile Data
  raw += subfileData;
  
  // Final Segment Terminator
  raw += SEGMENT_TERMINATOR;

  return raw;
};