
import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

export const truncateAAMVA = (name: string, limit: number): { text: string; truncated: 'T' | 'N' } => {
  const current = (name || "").toUpperCase().trim();
  if (current.length <= limit) return { text: current, truncated: 'N' };

  // Оптимизированный поиск и удаление спецсимволов с конца
  let result = current.substring(0, limit);
  return { text: result, truncated: 'T' };
};

const formatAAMVADate = (dateStr: string, country: string): string => {
  const d = dateStr.replace(/\D/g, '');
  if (d.length !== 8) return d;
  // AAMVA 2020: MMDDYYYY для USA, YYYYMMDD для Canada (обычно)
  // Но стандарт требует MMDDYYYY для большинства полей в Annex D
  return country === 'CAN' ? d : d.substring(0, 8); 
};

export const generateAAMVAString = (data: DLFormData): string => {
  const isCanada = data.DCG === 'CAN';
  const segments: string[] = [];

  const add = (tag: string, val: string | undefined, mandatory = true) => {
    let final = (val || "").toUpperCase().trim();
    if (!final && mandatory) final = "NONE";
    if (final) segments.push(`${tag}${final}`);
  };

  // Mandatory Elements - Strict Sequence
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB);
  add("DCD", data.DCD);
  add("DBA", formatAAMVADate(data.DBA, data.DCG));
  add("DCS", truncateAAMVA(data.DCS, 40).text);
  add("DAC", truncateAAMVA(data.DAC, 40).text);
  add("DAD", truncateAAMVA(data.DAD, 40).text);
  add("DBD", formatAAMVADate(data.DBD, data.DCG));
  add("DBB", formatAAMVADate(data.DBB, data.DCG));
  add("DBC", data.DBC);
  add("DAY", data.DAY);
  add("DAU", data.DAU.includes("IN") ? data.DAU : `${data.DAU.replace(/\D/g, '').padStart(3, '0')} IN`);
  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", isCanada ? data.DAK : data.DAK.replace(/\D/g, '').padEnd(11, '0').substring(0, 11));
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", data.DCG);
  add("DDE", truncateAAMVA(data.DCS, 40).truncated);
  add("DDF", truncateAAMVA(data.DAC, 40).truncated);
  add("DDG", truncateAAMVA(data.DAD, 40).truncated);

  const optionalTags = [
    'DAH','DAZ','DCI','DCJ','DCK','DBN','DBG','DBS','DCU','DCE','DCL',
    'DDA','DDB','DDC','DDD','DAW','DAX','DDH','DDI','DDJ','DDK','DDL'
  ];

  optionalTags.forEach(tag => {
    let val = data[tag];
    if (val && val !== '0' && val !== 'NONE') {
      if (['DDB', 'DDC', 'DDH', 'DDI', 'DDJ'].includes(tag)) val = formatAAMVADate(val, data.DCG);
      add(tag, val, false);
    }
  });

  const subfileContent = "DL" + segments.join(LF) + CR;
  const iin = (data.IIN || "636000").substring(0, 6).padEnd(6, '0');
  const header = `@${LF}${RS}${CR}ANSI ${iin}100001`; // Version 10, 1 subfile
  
  // Offset calculation: Header (21 bytes) + Designator (10 bytes per subfile)
  const offset = 21 + 10; 
  const designator = "DL" + offset.toString().padStart(4, '0') + subfileContent.length.toString().padStart(4, '0');

  return header + designator + subfileContent;
};
