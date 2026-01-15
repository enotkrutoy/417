
import { DLFormData } from '../types';

const LF = "\n"; // 0x0A
const RS = "\x1e"; // 0x1E
const CR = "\r"; // 0x0D
const HEADER_LEAD = "@" + LF + RS + CR + "ANSI "; // 9 bytes

const sanitize = (s: string) => (s || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];

  const add = (tag: string, val: string) => {
    const cleanVal = sanitize(val);
    if (cleanVal) subfields.push(`${tag}${cleanVal}`);
  };

  // Строгое следование порядку элементов AAMVA 2020 для максимальной совместимости
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB || "NONE");
  add("DCD", data.DCD || "NONE");
  add("DBA", data.DBA);
  add("DCS", data.DCS);
  add("DAC", data.DAC);
  add("DAD", data.DAD);
  add("DBD", data.DBD);
  add("DBB", data.DBB);
  add("DBC", data.DBC);
  add("DAY", data.DAY);
  add("DAU", data.DAU);
  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", data.DAK);
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", data.DCG);
  add("DDA", data.DDA);
  
  // Рассчитываем truncation флаги динамически
  add("DDE", data.DCS.length > 40 ? "T" : "N");
  add("DDF", data.DAC.length > 40 ? "T" : "N");
  add("DDG", data.DAD.length > 40 ? "T" : "N");

  // Тело подфайла: "DL" + поля + разделитель записей + терминатор
  const subfileContent = "DL" + subfields.join(LF) + LF + CR;
  
  // Расчет заголовка
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const ver = (data.Version || "10").padStart(2, '0');
  const jurVer = (data.JurisdictionVersion || "00").padStart(2, '0');
  const entries = "01";

  // Заголовок фиксированной длины (21 байт)
  const headerMeta = `${iin}${ver}${jurVer}${entries}`;
  
  // Смещение = 21 (заголовок) + 10 (один дескриптор подфайла)
  const offset = 21 + 10;
  const length = subfileContent.length;

  const designator = "DL" + offset.toString().padStart(4, '0') + length.toString().padStart(4, '0');

  return HEADER_LEAD + headerMeta + designator + subfileContent;
};
