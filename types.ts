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
  
  // Mandatory Elements (AAMVA 2020 Table 1/D.3)
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
  DDE: string; // Family name truncation
  DDF: string; // First name truncation
  DDG: string; // Middle name truncation

  // Optional/Standardized Elements (Table D.4)
  DAH: string; // Address Street 2
  DAZ: string; // Hair Color
  DCI: string; // Place of Birth
  DCJ: string; // Audit information
  DCK: string; // Inventory control number
  DBN: string; // Alias Family Name
  DBG: string; // Alias Given Name
  DBS: string; // Alias Suffix
  DCU: string; // Name Suffix
  DCE: string; // Weight Range (0-9)
  DCL: string; // Race / Ethnicity
  DCM: string; // Standard vehicle classification
  DCN: string; // Standard endorsement code
  DCO: string; // Standard restriction code
  DCP: string; // Vehicle classification description
  DCQ: string; // Endorsement description
  DCR: string; // Restriction description
  DDA: string; // Compliance Type (F/N)
  DDB: string; // Card Revision Date
  DDC: string; // HAZMAT Expiry
  DDD: string; // Limited Duration Indicator (1/0)
  DAW: string; // Weight (LBS)
  DAX: string; // Weight (KG)
  DDH: string; // Under 18 Until
  DDI: string; // Under 19 Until
  DDJ: string; // Under 21 Until
  DDK: string; // Organ Donor (1/0)
  DDL: string; // Veteran Indicator (1/0)
  
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