
import { DLFormData } from '../types';

/**
 * AAMVA 2020 DL/ID Card Design Standard Implementation
 * Section D.12: Data encoding structures
 */

const LF = "\x0A"; // Data Element Separator
const RS = "\x1E"; // Record Separator
const CR = "\x0D"; // Segment Terminator

const sanitize = (s: string) => (s || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();

export const generateAAMVAString = (data: DLFormData): string => {
  // Список обязательных тегов в рекомендованном порядке для лучшей совместимости
  const subfields: string[] = [];

  const add = (tag: string, val: string) => {
    const cleanVal = sanitize(val);
    if (cleanVal) {
      subfields.push(`${tag}${cleanVal}`);
    }
  };

  // Порядок элементов согласно Table D.3 (AAMVA 2020)
  add("DCA", data.DCA || "D");      // Class
  add("DCB", data.DCB || "NONE");   // Restrictions
  add("DCD", data.DCD || "NONE");   // Endorsements
  add("DBA", data.DBA);             // Expiry Date
  add("DCS", data.DCS);             // Family Name
  add("DAC", data.DAC);             // First Name
  add("DAD", data.DAD);             // Middle Name
  add("DBD", data.DBD);             // Issue Date
  add("DBB", data.DBB);             // DOB
  add("DBC", data.DBC);             // Sex
  add("DAY", data.DAY);             // Eye Color
  add("DAU", data.DAU);             // Height
  add("DAG", data.DAG);             // Address
  add("DAI", data.DAI);             // City
  add("DAJ", data.DAJ);             // State
  add("DAK", data.DAK);             // Zip
  add("DAQ", data.DAQ);             // ID Number
  add("DCF", data.DCF);             // Document Discriminator
  add("DCG", data.DCG || "USA");    // Country
  add("DDE", data.DDE || "N");      // Truncation indicators
  add("DDF", data.DDF || "N");
  add("DDG", data.DDG || "N");

  // Собираем контент подфайла
  // Каждый элемент разделен LF. Весь подфайл заканчивается CR.
  const subfileType = "DL";
  const subfileContent = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileContent;

  // Формируем Header (21 байт)
  const complianceIndicator = "@";
  const headerSeparators = LF + RS + CR;
  const fileType = "ANSI ";
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const aamvaVersion = (data.Version || "10").padStart(2, '0'); // Для 2020 года это "10"
  const jurVersion = (data.JurisdictionVersion || "00").padStart(2, '0');
  const numEntries = "01";

  const header = complianceIndicator + headerSeparators + fileType + iin + aamvaVersion + jurVersion + numEntries;

  // Формируем Subfile Designator (10 байт)
  // Offset = заголовок(21) + кол-во десигнаторов * 10
  const offsetValue = 21 + (parseInt(numEntries, 10) * 10);
  const lengthValue = fullSubfile.length;

  const designator = subfileType + 
                     offsetValue.toString().padStart(4, '0') + 
                     lengthValue.toString().padStart(4, '0');

  // Итоговая строка: Header + Designator + Subfile
  return header + designator + fullSubfile;
};
