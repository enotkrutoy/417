import { DLFormData } from '../types';

/**
 * AAMVA 2020 (Version 08+) Standard Constants
 */
const COMPLIANCE_INDICATOR = "@"; 
const DATA_ELEMENT_SEPARATOR = "\n"; // LF (0x0A)
const RECORD_SEPARATOR = "\x1e";       // RS (0x1E)
const SEGMENT_TERMINATOR = "\r";      // CR (0x0D)
const FILE_TYPE = "ANSI ";

const toAscii = (str: string) => (str || "").replace(/[^\x20-\x7E]/g, "").trim().toUpperCase();

/**
 * Strict formatting for AAMVA fields
 */
const formatHeight = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return "000 in";
  const num = parseInt(digits);
  if (val.toLowerCase().includes("cm") || num > 100) {
    return num.toString().padStart(3, '0') + " cm";
  }
  return num.toString().padStart(3, '0') + " in";
};

const formatWeight = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  return digits.substring(0, 3).padStart(3, '0');
};

const formatDate = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  return digits.substring(0, 8);
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string) => {
    if (val) subfields.push(`${tag}${val}`);
  };

  // 1. Calculate Truncation Flags
  const truncLast = (data.DCS || "").length > 40 ? "T" : "N";
  const truncFirst = (data.DAC || "").length > 40 ? "T" : "N";
  const truncMiddle = (data.DAD || "").length > 40 ? "T" : "N";

  // 2. Build Subfile (DL Block)
  // Mandatory Elements
  add("DCA", toAscii(data.DCA || "C"));
  add("DCB", toAscii(data.DCB || "NONE"));
  add("DCD", toAscii(data.DCD || "NONE"));
  add("DBA", formatDate(data.DBA));
  add("DCS", toAscii(data.DCS).substring(0, 40));
  add("DAC", toAscii(data.DAC).substring(0, 40));
  add("DAD", toAscii(data.DAD).substring(0, 40));
  add("DBD", formatDate(data.DBD));
  add("DBB", formatDate(data.DBB));
  add("DBC", toAscii(data.DBC).substring(0, 1));
  add("DAY", toAscii(data.DAY).substring(0, 3));
  add("DAU", formatHeight(data.DAU));
  add("DAG", toAscii(data.DAG).substring(0, 35));
  add("DAI", toAscii(data.DAI).substring(0, 20));
  add("DAJ", toAscii(data.DAJ).substring(0, 2));
  add("DAK", toAscii(data.DAK).replace(/\D/g, '').substring(0, 11));
  add("DAQ", toAscii(data.DAQ));
  add("DCF", toAscii(data.DCF || "NONE"));
  add("DCG", toAscii(data.DCG || "USA"));
  add("DDE", truncLast);
  add("DDF", truncFirst);
  add("DDG", truncMiddle);
  add("DAW", formatWeight(data.DAW));
  add("DEB", formatDate(data.DEB));

  // Construct Subfile Data: "DL" + tags joined by LF + LF + CR
  let subfileBody = "DL" + subfields.join(DATA_ELEMENT_SEPARATOR) + DATA_ELEMENT_SEPARATOR + SEGMENT_TERMINATOR;

  // 3. Header Calculation
  const numEntries = 1;
  const headerSize = 21;
  const designatorSize = 10;
  const offset = headerSize + (designatorSize * numEntries);
  const length = subfileBody.length;

  const offsetStr = offset.toString().padStart(4, '0');
  const lengthStr = length.toString().padStart(4, '0');

  // 4. Final Construction
  let header = COMPLIANCE_INDICATOR + DATA_ELEMENT_SEPARATOR + RECORD_SEPARATOR + SEGMENT_TERMINATOR;
  header += FILE_TYPE;
  header += (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  header += (data.Version || "08").padStart(2, '0');
  header += "00"; // Jurisdiction version
  header += "01"; // Number of entries

  const designator = "DL" + offsetStr + lengthStr;

  return header + designator + subfileBody;
};