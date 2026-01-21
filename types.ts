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
  
  // Mandatory Elements (AAMVA 2020 Table 1)
  DCA: string; // Class
  DCB: string; // Restrictions
  DCD: string; // Endorsements
  DBA: string; // Expiry Date
  DCS: string; // Last Name
  DAC: string; // First Name
  DAD: string; // Middle Name
  DBD: string; // Issue Date
  DBB: string; // DOB
  DBC: string; // Sex (1=M, 2=F, 9=Not specified)
  DAY: string; // Eye Color
  DAU: string; // Height
  DAG: string; // Address
  DAI: string; // City
  DAJ: string; // State
  DAK: string; // Zip
  DAQ: string; // ID Number
  DCF: string; // Document Discriminator
  DCG: string; // Country (USA/CAN)
  
  // Truncation Indicators (D.12.5.1)
  DDE: string; // Family name truncation (T/N/U)
  DDF: string; // First name truncation (T/N/U)
  DDG: string; // Middle name truncation (T/N/U)

  // Optional/Standardized Elements (AAMVA 2020 Table 2/4)
  DAZ: string; // Hair Color
  DAW: string; // Weight (LBS/KG)
  DCU: string; // Name Suffix
  DDA: string; // Compliance Type (F/N)
  DDB: string; // Card Revision Date
  DDK: string; // Organ Donor (1/0)
  DDL: string; // Veteran Indicator (1/0)
  DDD: string; // Limited Duration Document Indicator (1/0)
  
  [key: string]: string;
}

export type ValidationStatus = 'MATCH' | 'MISMATCH' | 'MISSING_IN_SCAN' | 'FORMAT_ERROR' | 'CRITICAL_INVALID';

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
  complianceNotes: string[];
}