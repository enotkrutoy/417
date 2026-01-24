import { Jurisdiction, DLDataPreset } from './types';

export const JURISDICTIONS: Jurisdiction[] = [
  { name: "Alabama", code: "AL", iin: "636033", version: "10" },
  { name: "Alaska", code: "AK", iin: "636059", version: "10" },
  { name: "Arizona", code: "AZ", iin: "636026", version: "10" },
  { name: "Arkansas", code: "AR", iin: "636048", version: "10" },
  { name: "California", code: "CA", iin: "636014", version: "10" },
  { name: "Colorado", code: "CO", iin: "636020", version: "10" },
  { name: "Connecticut", code: "CT", iin: "636006", version: "10" },
  { name: "Delaware", code: "DE", iin: "636011", version: "10" },
  { name: "Florida", code: "FL", iin: "636010", version: "10" },
  { name: "Georgia", code: "GA", iin: "636055", version: "10" },
  { name: "Hawaii", code: "HI", iin: "636060", version: "10" },
  { name: "Idaho", code: "ID", iin: "636050", version: "10" },
  { name: "Illinois", code: "IL", iin: "636035", version: "10" },
  { name: "Indiana", code: "IN", iin: "636037", version: "10" },
  { name: "Iowa", code: "IA", iin: "636018", version: "10" },
  { name: "Kansas", code: "KS", iin: "636017", version: "10" },
  { name: "Kentucky", code: "KY", iin: "636047", version: "10" },
  { name: "Louisiana", code: "LA", iin: "636007", version: "10" },
  { name: "Maine", code: "ME", iin: "636041", version: "10" },
  { name: "Maryland", code: "MD", iin: "636003", version: "10" },
  { name: "Massachusetts", code: "MA", iin: "636002", version: "10" },
  { name: "Michigan", code: "MI", iin: "636032", version: "10" },
  { name: "Minnesota", code: "MN", iin: "636038", version: "10" },
  { name: "Mississippi", code: "MS", iin: "636051", version: "10" },
  { name: "Missouri", code: "MO", iin: "636030", version: "10" },
  { name: "Montana", code: "MT", iin: "636052", version: "10" },
  { name: "Nebraska", code: "NE", iin: "636024", version: "10" },
  { name: "Nevada", code: "NV", iin: "636049", version: "10" },
  { name: "New Hampshire", code: "NH", iin: "636039", version: "10" },
  { name: "New Jersey", code: "NJ", iin: "636004", version: "10" },
  { name: "New Mexico", code: "NM", iin: "636053", version: "10" },
  { name: "New York", code: "NY", iin: "636005", version: "10" },
  { name: "North Carolina", code: "NC", iin: "636009", version: "10" },
  { name: "North Dakota", code: "ND", iin: "636034", version: "10" },
  { name: "Ohio", code: "OH", iin: "636025", version: "10" },
  { name: "Oklahoma", code: "OK", iin: "636054", version: "10" },
  { name: "Oregon", code: "OR", iin: "636021", version: "10" },
  { name: "Pennsylvania", code: "PA", iin: "636008", version: "10" },
  { name: "Rhode Island", code: "RI", iin: "636042", version: "10" },
  { name: "South Carolina", code: "SC", iin: "636043", version: "10" },
  { name: "South Dakota", code: "SD", iin: "636056", version: "10" },
  { name: "Tennessee", code: "TN", iin: "636057", version: "10" },
  { name: "Texas", code: "TX", iin: "636016", version: "10" },
  { name: "Utah", code: "UT", iin: "636044", version: "10" },
  { name: "Vermont", code: "VT", iin: "636045", version: "10" },
  { name: "Virginia", code: "VA", iin: "636001", version: "10" },
  { name: "Washington", code: "WA", iin: "636036", version: "10" },
  { name: "West Virginia", code: "WV", iin: "636058", version: "10" },
  { name: "Wisconsin", code: "WI", iin: "636046", version: "10" },
  { name: "Wyoming", code: "WY", iin: "636040", version: "10" },
  { name: "District of Columbia", code: "DC", iin: "636015", version: "10" },
  { name: "Ontario (CAN)", code: "ON", iin: "636012", version: "10", country: "CAN" },
  { name: "Quebec (CAN)", code: "QC", iin: "636013", version: "10", country: "CAN" },
  { name: "Alberta (CAN)", code: "AB", iin: "636019", version: "10", country: "CAN" }
];

export const PRESETS: DLDataPreset[] = [
  {
    id: 'STANDARD',
    label: 'Standard Operator',
    description: 'Generic Class C License holder',
    data: {
      DCS: 'WALKER', DAC: 'REBECCA', DAD: 'LYNN',
      DAQ: 'DL-8827319', DBB: '19920412', DBA: '20300412',
      DBD: '20220412', DBC: '2', DAY: 'BLU', DAU: '066 IN',
      DAG: '742 EVERGREEN TERRACE', DAI: 'SPRINGFIELD', DAJ: 'IL', DAK: '627040000'
    }
  },
  {
    id: 'CDL_EXPERT',
    label: 'CDL Master',
    description: 'Commercial Class A with multiple endorsements',
    data: {
      DCA: 'A', DCB: 'NONE', DCD: 'TX',
      DCS: 'OVERDRIVE', DAC: 'JACK', DAQ: 'CDL-445566',
      DBB: '19751130', DBA: '20281130', DDC: '20281130',
      DDA: 'F', DBC: '1', DAU: '072 IN'
    }
  },
  {
    id: 'YOUNG_DRIVER',
    label: 'Graduated Driver',
    description: 'Under-21 driver with restrictive markers',
    data: {
      DCS: 'MILLER', DAC: 'ZACHARY', DBB: '20080824',
      DBA: '20290824', DDJ: '20290824', DDH: '20260824',
      DDK: '1', DBC: '1', DAU: '070 IN'
    }
  }
];