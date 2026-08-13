// Saudi Regulatory Engine — shared client-safe types.
// This module is fully independent from the Yemeni legacy calculator module.

export type Nationality = "saudi" | "non_saudi";
export type ContractType = "fixed" | "indefinite";
export type TerminationReason =
  | "employer_termination"
  | "unlawful_termination"
  | "resignation"
  | "mutual"
  | "contract_expiry"
  | "during_probation";

export interface SaWageInput {
  basic: number;
  housing: number;
  transport: number;
  otherFixed: number;
}

export interface SaHolidayWorkEntry {
  date: string;
  name?: string;
  hours: number;
}

export interface SaUnpaidWageEntry {
  label: string;
  amount: number;
  dueDate: string;
  paid: boolean;
}

export interface SaCaseInput {
  // Step 1 — case information
  nationality: Nationality;
  jobTitle: string;
  sector: string;
  startDate: string;
  endDate: string;
  employeeName?: string;
  employerName?: string;
  includeNamesInReport?: boolean;

  // Step 2 — contract
  contractType: ContractType;
  contractTermEnd?: string | null;
  renewals: number;
  paidMonthly: boolean;

  // Step 3 — probation
  hasProbation: boolean;
  probationDays: number;
  probationWritten: boolean;
  endedDuringProbation: boolean;

  // Step 4 — compensation
  wage: SaWageInput;

  // Step 5 — working hours
  dailyHours: number | null;
  workDaysPerWeek: number | null;
  ramadanApplies: boolean;
  ramadanDailyHours: number | null;

  // Step 6 — overtime
  overtimeHours: number;

  // Step 7 — official holidays
  holidayWork: SaHolidayWorkEntry[];

  // Step 8 — outstanding wages
  unpaidWages: SaUnpaidWageEntry[];

  // Step 9 — annual leave
  annualLeaveEntitledDays: number | null;
  annualLeaveUsedDays: number;

  // Step 10 — sick leave
  sickLeaveDays: number;

  // Step 12 — female employee rights
  gender: Gender;
  female: SaFemaleInput;

  // Step 13 — social insurance (GOSI)
  gosiSubscribed: boolean;
  gosiMonths: number;
  gosiSubjectWageOverride: number | null;

  // Step 14 — termination context and resignation analysis
  terminationReason: TerminationReason;
  terminationNoticeDate: string | null;
  noticeGiven: boolean;
  noticeDaysGiven: number;
  resignation: SaResignationInput;

  // Step 18 — settlements / releases
  settlements: SaSettlementEntry[];

  // Step 19 — amicable dispute settlement
  dispute: SaDisputeInput;
}

export type Gender = "male" | "female";

export interface SaFemaleInput {
  birthDate: string | null;
  maternityStart: string | null;
  maternityEnd: string | null;
  maternityPaid: boolean;
  nursingClaimed: boolean;
  nursingMonths: number;
  terminatedDuringMaternity: boolean;
}

export type ResignationAcceptance = "none" | "accepted" | "rejected";

export interface SaResignationInput {
  submittedDate: string | null;
  effectiveDate: string | null;
  written: boolean;
  acceptance: ResignationAcceptance;
  qiwaSubmitted: boolean;
}

export type SettlementDocKind = "bank_transfer" | "signed_release" | "e_document" | "receipt" | "cash" | "other";

export interface SaSettlementEntry {
  date: string;
  amount: number;
  kind: string;
  method: SettlementDocKind;
  hasDocuments: boolean;
  note?: string;
}

export interface SaDisputeInput {
  exists: boolean;
  amount: number;
  coveredKeys: string[];
  note?: string;
}

export type SaIssueSeverity = "error" | "warning";

export interface SaValidationIssue {
  field: string;
  label: string;
  severity: SaIssueSeverity;
  message: string;
}

export interface SaValidationReport {
  ok: boolean;
  issues: SaValidationIssue[];
  checkedAt: string;
}

export interface SaGosiResult {
  subscribed: boolean;
  subjectWage: number;
  employeeRate: number;
  employerRate: number;
  employeeAmount: number;
  employerAmount: number;
  months: number;
  effectiveFrom: string;
  legalVersion: string;
  basis: string;
}

export interface SaSettlementResult {
  date: string;
  amount: number;
  kind: string;
  method: SettlementDocKind;
  reliability: "high" | "medium" | "low";
  reliabilityLabel: string;
  accepted: boolean;
  note: string;
}

export interface SaAdjustmentResult {
  lineKey: string;
  label: string;
  rate: number;
  before: number;
  after: number;
  reason: string;
}

export interface SaResultLine {
  key: string;
  label: string;
  amount: number;
  formula: string;
  legalRef: string;
  explanation: string;
}

export interface SaAuditEntry {
  step: string;
  decision: string;
  reason: string;
}

export interface SaFullResult {
  currency: "SAR";
  actualWage: number;
  dailyRate: number;
  hourlyRate: number;
  serviceYears: number;
  serviceDays: number;
  contractClassification: string;
  terminationClassification: string;
  lines: SaResultLine[];
  grossTotal: number;
  total: number;
  validation: SaValidationReport;
  gosi: SaGosiResult;
  settlements: SaSettlementResult[];
  settledAmount: number;
  adjustments: SaAdjustmentResult[];
  limitationDate: string;
  limitationExpired: boolean;
  audit: SaAuditEntry[];
}


/** Redacted payload returned to free-trial users: total only. */
export interface SaTotalOnlyResult {
  currency: "SAR";
  total: number;
  restricted: true;
}

export type SaComputeResponse =
  | { invalid: true; issues: SaValidationIssue[] }
  | { invalid?: false; restricted: false; result: SaFullResult; caseId: string | null; planCode: string }
  | { invalid?: false; restricted: true; result: SaTotalOnlyResult; caseId: null; planCode: string };


export const SECTORS = [
  "القطاع الخاص",
  "المقاولات والإنشاءات",
  "التجزئة والمبيعات",
  "الصحة",
  "التعليم",
  "الضيافة والمطاعم",
  "النقل واللوجستيات",
  "الصناعة",
  "التقنية والاتصالات",
  "أخرى",
] as const;
