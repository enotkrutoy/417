
export interface Jurisdiction {
  name: string;
  code: string;
  iin: string;
  version: string;
  country?: string;
}

export interface DLFormData {
  // Metadata
  IIN: string;
  Version: string;
  JurisdictionVersion: string;
  subfileType: 'DL' | 'ID';
  
  // Mandatory Elements (AAMVA 2020)
  DCA: string; // Class
  DCB: string; // Restrictions
  DCD: string; // Endorsements
  DBA: string; // Expiry Date (MMDDCCYY)
  DCS: string; // Last Name
  DAC: string; // First Name
  DAD: string; // Middle Name
  DBD: string; // Issue Date (MMDDCCYY)
  DBB: string; // DOB (MMDDCCYY)
  DBC: string; // Sex (1=M, 2=F)
  DAY: string; // Eye Color
  DAU: string; // Height
  DAG: string; // Address
  DAI: string; // City
  DAJ: string; // State
  DAK: string; // Zip
  DAQ: string; // ID Number
  DCF: string; // Document Discriminator
  DCG: string; // Country
  
  // Optional/Texas Specific
  DCU: string; // Name Suffix (e.g. III, JR)
  DDA: string; // Compliance Indicator (F=REAL ID)
  DDK: string; // Organ Donor (1=Yes)
  DAW: string; // Weight
  DAZ: string; // Hair Color
  [key: string]: string;
}

export type ValidationStatus = 'MATCH' | 'MISMATCH' | 'MISSING_IN_SCAN' | 'FORMAT_ERROR';

export interface ValidationField {
  elementId: string;
  description: string;
  formValue: string;
  scannedValue: string;
  status: ValidationStatus;
}

export interface ValidationReport {
  isHeaderValid: boolean;
  rawString: string;
  fields: ValidationField[];
  overallScore: number;
}
