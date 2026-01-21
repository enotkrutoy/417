
import { Jurisdiction, DLDataPreset } from './types';

export const JURISDICTIONS: Jurisdiction[] = [
  { name: "New York", code: "NY", iin: "636005", version: "10" },
  { name: "California", code: "CA", iin: "636014", version: "10" },
  { name: "Texas", code: "TX", iin: "636016", version: "10" },
  { name: "Florida", code: "FL", iin: "636010", version: "10" },
  { name: "Virginia", code: "VA", iin: "636001", version: "10" },
  { name: "Washington", code: "WA", iin: "636036", version: "10" },
  { name: "Ontario (CAN)", code: "ON", iin: "636012", version: "10", country: "CAN" },
  { name: "Quebec (CAN)", code: "QC", iin: "636013", version: "10", country: "CAN" },
  { name: "Georgia", code: "GA", iin: "636055", version: "10" },
  { name: "Illinois", code: "IL", iin: "636035", version: "10" }
];

export const PRESETS: DLDataPreset[] = [
  {
    id: 'STANDARD',
    label: 'Standard Driver',
    description: 'Typical Class C license holder',
    data: {
      DCS: 'SMITH', DAC: 'JOHN', DAD: 'QUINCY',
      DAQ: 'A1234567', DBB: '19850615', DBA: '20300615',
      DBD: '20200615', DBC: '1', DAY: 'BRO', DAU: '5-10',
      DAG: '123 MAIN ST', DAI: 'ANYTOWN', DAK: '12345678901'
    }
  },
  {
    id: 'CDL_HAZMAT',
    label: 'Commercial (CDL)',
    description: 'Class A with HAZMAT & Air Brakes',
    data: {
      DCA: 'A', DCB: 'NONE', DCD: 'HT',
      DCS: 'TRUCKER', DAC: 'BOB', DAQ: 'CDL999888',
      DBB: '19700101', DBA: '20281231', DDC: '20281231',
      DDA: 'F', DBC: '1'
    }
  },
  {
    id: 'UNDER_21',
    label: 'Under 21 Node',
    description: 'Minor driver with status markers',
    data: {
      DCS: 'JUNIOR', DAC: 'TIMMY', DBB: '20100520',
      DBA: '20310520', DDJ: '20310520', DDH: '20280520',
      DDK: '1', DBC: '1'
    }
  }
];
