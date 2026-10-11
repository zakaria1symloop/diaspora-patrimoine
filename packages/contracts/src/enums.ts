// Enumerations of Specs/01-domaine/01 § 3, in the order of apps/api/prisma/schema.prisma.
// Shared with the browser: no import (never import Prisma here). Labels: packages/i18n/messages/fr/enum.json.
// Generated together with the Prisma schema (work package 1.2): keep both in sync.

// § 3.1
export const UserKind = {
  CLIENT: 'CLIENT',
  STAFF: 'STAFF',
  PARTNER: 'PARTNER',
} as const;
export type UserKind = (typeof UserKind)[keyof typeof UserKind];
export const UserStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
export const OrganizationType = {
  OPERATOR: 'OPERATOR',
  PROMOTER: 'PROMOTER',
  BANK: 'BANK',
} as const;
export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType];
export const MembershipRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  VIEWER: 'VIEWER',
  SUPPORT: 'SUPPORT',
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];
export const Locale = {
  fr: 'fr',
  ar: 'ar',
  en: 'en',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const SessionAudience = {
  WEB: 'WEB',
  ADMIN: 'ADMIN',
  MOBILE: 'MOBILE',
  PARTNER: 'PARTNER',
} as const;
export type SessionAudience = (typeof SessionAudience)[keyof typeof SessionAudience];
export const AuthTokenPurpose = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  MAGIC_LOGIN: 'MAGIC_LOGIN',
  ACCOUNT_ACTIVATION: 'ACCOUNT_ACTIVATION',
  STAFF_INVITATION: 'STAFF_INVITATION',
  EMAIL_CHANGE: 'EMAIL_CHANGE',
  ACTION_CODE: 'ACTION_CODE',
  CLIENT_PREVIEW: 'CLIENT_PREVIEW',
  LOGIN_CHALLENGE: 'LOGIN_CHALLENGE',
} as const;
export type AuthTokenPurpose = (typeof AuthTokenPurpose)[keyof typeof AuthTokenPurpose];
export const ConsentType = {
  TERMS_OF_USE: 'TERMS_OF_USE',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  CONTACT_REQUEST: 'CONTACT_REQUEST',
  MARKETING_EMAIL: 'MARKETING_EMAIL',
  DATA_SHARING_PARTNERS: 'DATA_SHARING_PARTNERS',
  PARTY_AUTHORIZATION: 'PARTY_AUTHORIZATION',
  PARTNER_CHARTER: 'PARTNER_CHARTER',
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

// § 3.2
export const ResidencyStatus = {
  NON_RESIDENT: 'NON_RESIDENT',
  EXPATRIATE: 'EXPATRIATE',
  RESIDENT: 'RESIDENT',
  OTHER: 'OTHER',
} as const;
export type ResidencyStatus = (typeof ResidencyStatus)[keyof typeof ResidencyStatus];
export const EmploymentType = {
  PERMANENT: 'PERMANENT',
  FIXED_TERM: 'FIXED_TERM',
  CIVIL_SERVANT: 'CIVIL_SERVANT',
  SELF_EMPLOYED: 'SELF_EMPLOYED',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  RETIRED: 'RETIRED',
  OTHER: 'OTHER',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];
export const PurchasePurpose = {
  HOLIDAY_HOME: 'HOLIDAY_HOME',
  RETURN_HOME: 'RETURN_HOME',
  FAMILY: 'FAMILY',
  RENTAL_INVESTMENT: 'RENTAL_INVESTMENT',
  OTHER: 'OTHER',
} as const;
export type PurchasePurpose = (typeof PurchasePurpose)[keyof typeof PurchasePurpose];
export const PurchaseTimeframe = {
  LT_6M: 'LT_6M',
  M6_12: 'M6_12',
  GT_12M: 'GT_12M',
  UNDEFINED: 'UNDEFINED',
} as const;
export type PurchaseTimeframe = (typeof PurchaseTimeframe)[keyof typeof PurchaseTimeframe];
export const FinancingPreference = {
  CONVENTIONAL: 'CONVENTIONAL',
  ISLAMIC: 'ISLAMIC',
  NO_PREFERENCE: 'NO_PREFERENCE',
  CASH: 'CASH',
} as const;
export type FinancingPreference = (typeof FinancingPreference)[keyof typeof FinancingPreference];
export const ContactChannel = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  WHATSAPP: 'WHATSAPP',
} as const;
export type ContactChannel = (typeof ContactChannel)[keyof typeof ContactChannel];
export const ContactTimeSlot = {
  MORNING: 'MORNING',
  NOON: 'NOON',
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
  ANYTIME: 'ANYTIME',
} as const;
export type ContactTimeSlot = (typeof ContactTimeSlot)[keyof typeof ContactTimeSlot];
export const ClientStatus = {
  PROSPECT: 'PROSPECT',
  QUALIFIED: 'QUALIFIED',
  ACTIVE: 'ACTIVE',
  CUSTOMER: 'CUSTOMER',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ClientStatus = (typeof ClientStatus)[keyof typeof ClientStatus];

// § 3.3
export const LeadKind = {
  PROPERTY_INTEREST: 'PROPERTY_INTEREST',
  PROJECTION_REQUEST: 'PROJECTION_REQUEST',
  CALLBACK_REQUEST: 'CALLBACK_REQUEST',
  GUIDED_SEARCH: 'GUIDED_SEARCH',
  SIMULATION_FOLLOWUP: 'SIMULATION_FOLLOWUP',
  CONTACT_MESSAGE: 'CONTACT_MESSAGE',
  PARTNER_REQUEST: 'PARTNER_REQUEST',
} as const;
export type LeadKind = (typeof LeadKind)[keyof typeof LeadKind];
export const LeadStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSED: 'CLOSED',
  SPAM: 'SPAM',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];
export const PartnerApplicationStatus = {
  EMAIL_UNVERIFIED: 'EMAIL_UNVERIFIED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  INFO_REQUESTED: 'INFO_REQUESTED',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
} as const;
export type PartnerApplicationStatus = (typeof PartnerApplicationStatus)[keyof typeof PartnerApplicationStatus];
export const LeadOutcome = {
  DOSSIER_OPENED: 'DOSSIER_OPENED',
  ATTACHED_TO_DOSSIER: 'ATTACHED_TO_DOSSIER',
  ANSWERED: 'ANSWERED',
  UNREACHABLE: 'UNREACHABLE',
  NOT_INTERESTED: 'NOT_INTERESTED',
  DUPLICATE: 'DUPLICATE',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;
export type LeadOutcome = (typeof LeadOutcome)[keyof typeof LeadOutcome];
export const LeadSource = {
  WEB_FORM: 'WEB_FORM',
  MOBILE_APP: 'MOBILE_APP',
  ADMIN: 'ADMIN',
  PHONE: 'PHONE',
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  CAFE: 'CAFE',
  IMPORT: 'IMPORT',
  PARTNER: 'PARTNER',
  SIGNUP: 'SIGNUP',
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];
export const SpamSignal = {
  HONEYPOT: 'HONEYPOT',
  FAST_SUBMIT: 'FAST_SUBMIT',
  MANY_LINKS: 'MANY_LINKS',
  DISPOSABLE_DOMAIN: 'DISPOSABLE_DOMAIN',
  IP_BURST: 'IP_BURST',
  DUPLICATE_MESSAGE: 'DUPLICATE_MESSAGE',
  NO_MX: 'NO_MX',
  PHONE_COUNTRY_MISMATCH: 'PHONE_COUNTRY_MISMATCH',
  ALL_CAPS: 'ALL_CAPS',
} as const;
export type SpamSignal = (typeof SpamSignal)[keyof typeof SpamSignal];

// § 3.4
export const PropertyType = {
  APARTMENT: 'APARTMENT',
  STUDIO: 'STUDIO',
  DUPLEX: 'DUPLEX',
  VILLA: 'VILLA',
  LAND: 'LAND',
  COMMERCIAL: 'COMMERCIAL',
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];
export const Standing = {
  COMFORT: 'COMFORT',
  STANDING: 'STANDING',
  PREMIUM: 'PREMIUM',
} as const;
export type Standing = (typeof Standing)[keyof typeof Standing];
export const LotStatus = {
  AVAILABLE: 'AVAILABLE',
  OPTIONED: 'OPTIONED',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type LotStatus = (typeof LotStatus)[keyof typeof LotStatus];
export const Availability = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD: 'SOLD',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type Availability = (typeof Availability)[keyof typeof Availability];
export const DeliveryStatus = {
  ON_PLAN: 'ON_PLAN',
  UNDER_CONSTRUCTION: 'UNDER_CONSTRUCTION',
  DELIVERED: 'DELIVERED',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];
export const DatePrecision = {
  MONTH: 'MONTH',
  QUARTER: 'QUARTER',
  YEAR: 'YEAR',
} as const;
export type DatePrecision = (typeof DatePrecision)[keyof typeof DatePrecision];
export const PublicationStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PublicationStatus = (typeof PublicationStatus)[keyof typeof PublicationStatus];
export const MediaKind = {
  PHOTO: 'PHOTO',
  RENDER_3D: 'RENDER_3D',
  PLAN: 'PLAN',
  BROCHURE: 'BROCHURE',
  VIDEO: 'VIDEO',
  PANO_360: 'PANO_360',
  LOGO: 'LOGO',
  DOCUMENT: 'DOCUMENT',
} as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];
export const MediaOwnerType = {
  PROGRAM: 'PROGRAM',
  PROPERTY: 'PROPERTY',
  LOT: 'LOT',
  PROGRAM_UPDATE: 'PROGRAM_UPDATE',
  PROMOTER: 'PROMOTER',
  BANK: 'BANK',
  PARTNER: 'PARTNER',
  EVENT: 'EVENT',
  CONTENT: 'CONTENT',
  USER: 'USER',
} as const;
export type MediaOwnerType = (typeof MediaOwnerType)[keyof typeof MediaOwnerType];
export const ProcessingStatus = {
  PENDING: 'PENDING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type ProcessingStatus = (typeof ProcessingStatus)[keyof typeof ProcessingStatus];
export const ConstructionStage = {
  FOUNDATIONS: 'FOUNDATIONS',
  STRUCTURE: 'STRUCTURE',
  SECONDARY_WORKS: 'SECONDARY_WORKS',
  FINISHES: 'FINISHES',
  DELIVERY: 'DELIVERY',
} as const;
export type ConstructionStage = (typeof ConstructionStage)[keyof typeof ConstructionStage];
export const PoiCategory = {
  TRANSPORT: 'TRANSPORT',
  EDUCATION: 'EDUCATION',
  SHOPPING: 'SHOPPING',
  HEALTH: 'HEALTH',
  LEISURE: 'LEISURE',
  OTHER: 'OTHER',
} as const;
export type PoiCategory = (typeof PoiCategory)[keyof typeof PoiCategory];
export const TravelMode = {
  WALK: 'WALK',
  CAR: 'CAR',
  TRANSIT: 'TRANSIT',
} as const;
export type TravelMode = (typeof TravelMode)[keyof typeof TravelMode];
export const Orientation = {
  N: 'N',
  NE: 'NE',
  E: 'E',
  SE: 'SE',
  S: 'S',
  SW: 'SW',
  W: 'W',
  NW: 'NW',
} as const;
export type Orientation = (typeof Orientation)[keyof typeof Orientation];

// § 3.5
export const PartnerStatus = {
  PROSPECT: 'PROSPECT',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  ENDED: 'ENDED',
} as const;
export type PartnerStatus = (typeof PartnerStatus)[keyof typeof PartnerStatus];
export const PartnerAccessLevel = {
  MANAGED: 'MANAGED',
  LINK: 'LINK',
  PORTAL: 'PORTAL',
} as const;
export type PartnerAccessLevel = (typeof PartnerAccessLevel)[keyof typeof PartnerAccessLevel];
export const PartnerCategory = {
  NOTARY: 'NOTARY',
  INSURER: 'INSURER',
  INSTITUTION: 'INSTITUTION',
  MEDIA: 'MEDIA',
  OTHER: 'OTHER',
} as const;
export type PartnerCategory = (typeof PartnerCategory)[keyof typeof PartnerCategory];
export const FinancingType = {
  CONVENTIONAL: 'CONVENTIONAL',
  ISLAMIC: 'ISLAMIC',
} as const;
export type FinancingType = (typeof FinancingType)[keyof typeof FinancingType];
export const PricingMethod = {
  AMORTIZED_RATE: 'AMORTIZED_RATE',
  FLAT_MARGIN: 'FLAT_MARGIN',
} as const;
export type PricingMethod = (typeof PricingMethod)[keyof typeof PricingMethod];
export const TargetSegment = {
  DIASPORA: 'DIASPORA',
  RESIDENT: 'RESIDENT',
  ALL: 'ALL',
} as const;
export type TargetSegment = (typeof TargetSegment)[keyof typeof TargetSegment];
export const ExchangeRateKind = {
  OFFICIAL: 'OFFICIAL',
  INDICATIVE: 'INDICATIVE',
} as const;
export type ExchangeRateKind = (typeof ExchangeRateKind)[keyof typeof ExchangeRateKind];
export const SubmissionStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INFO_REQUESTED: 'INFO_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  EXPIRED: 'EXPIRED',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];
export const TransmissionMode = {
  SECURE_LINK: 'SECURE_LINK',
  MANUAL: 'MANUAL',
  PORTAL: 'PORTAL',
} as const;
export type TransmissionMode = (typeof TransmissionMode)[keyof typeof TransmissionMode];
export const SubmissionEventType = {
  STATUS_CHANGED: 'STATUS_CHANGED',
  NOTE: 'NOTE',
  INFO_REQUESTED: 'INFO_REQUESTED',
  INFO_PROVIDED: 'INFO_PROVIDED',
  PACKAGE_GENERATED: 'PACKAGE_GENERATED',
  PACKAGE_SENT: 'PACKAGE_SENT',
  PACKAGE_DOWNLOADED: 'PACKAGE_DOWNLOADED',
  REMINDER_SENT: 'REMINDER_SENT',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_DECLINED: 'OFFER_DECLINED',
  DECISION_CORRECTED: 'DECISION_CORRECTED',
  DECISION_REVERTED: 'DECISION_REVERTED',
  OFFER_EXTENDED: 'OFFER_EXTENDED',
  OFFER_ACCEPT_REQUESTED: 'OFFER_ACCEPT_REQUESTED',
  OFFER_ACCEPT_WITHDRAWN: 'OFFER_ACCEPT_WITHDRAWN',
  OFFER_UNACCEPTED: 'OFFER_UNACCEPTED',
  PACKAGE_FAILED: 'PACKAGE_FAILED',
  SHARE_OPENED: 'SHARE_OPENED',
  SHARE_LOCKED: 'SHARE_LOCKED',
} as const;
export type SubmissionEventType = (typeof SubmissionEventType)[keyof typeof SubmissionEventType];
export const SimulationType = {
  ELIGIBILITY: 'ELIGIBILITY',
  CREDIT: 'CREDIT',
  PROJECTION: 'PROJECTION',
} as const;
export type SimulationType = (typeof SimulationType)[keyof typeof SimulationType];

// § 3.6
export const DossierStage = {
  INTEREST: 'INTEREST',
  QUALIFICATION: 'QUALIFICATION',
  MATCHING: 'MATCHING',
  DOCUMENTS: 'DOCUMENTS',
  BANK_REVIEW: 'BANK_REVIEW',
  APPROVED: 'APPROVED',
  ACQUISITION: 'ACQUISITION',
} as const;
export type DossierStage = (typeof DossierStage)[keyof typeof DossierStage];
export const DossierStatus = {
  OPEN: 'OPEN',
  ON_HOLD: 'ON_HOLD',
  WON: 'WON',
  LOST: 'LOST',
} as const;
export type DossierStatus = (typeof DossierStatus)[keyof typeof DossierStatus];
export const LostReason = {
  UNREACHABLE: 'UNREACHABLE',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  NO_SUITABLE_PROPERTY: 'NO_SUITABLE_PROPERTY',
  BOUGHT_ELSEWHERE: 'BOUGHT_ELSEWHERE',
  BUDGET: 'BUDGET',
  CLIENT_WITHDREW: 'CLIENT_WITHDREW',
  BANK_REFUSAL: 'BANK_REFUSAL',
  PROPERTY_UNAVAILABLE: 'PROPERTY_UNAVAILABLE',
  DUPLICATE: 'DUPLICATE',
  OTHER: 'OTHER',
} as const;
export type LostReason = (typeof LostReason)[keyof typeof LostReason];
export const HoldReason = {
  CLIENT_REQUEST: 'CLIENT_REQUEST',
  WAITING_CLIENT: 'WAITING_CLIENT',
  WAITING_PROMOTER: 'WAITING_PROMOTER',
  WAITING_BANK: 'WAITING_BANK',
  OTHER: 'OTHER',
} as const;
export type HoldReason = (typeof HoldReason)[keyof typeof HoldReason];
export const PartyRole = {
  PRIMARY: 'PRIMARY',
  CO_BORROWER: 'CO_BORROWER',
  GUARANTOR: 'GUARANTOR',
} as const;
export type PartyRole = (typeof PartyRole)[keyof typeof PartyRole];
export const CandidateOrigin = {
  CLIENT_INTEREST: 'CLIENT_INTEREST',
  ADVISOR_PROPOSAL: 'ADVISOR_PROPOSAL',
} as const;
export type CandidateOrigin = (typeof CandidateOrigin)[keyof typeof CandidateOrigin];
export const CandidateStatus = {
  PROPOSED: 'PROPOSED',
  VIEWED: 'VIEWED',
  INTERESTED: 'INTERESTED',
  DECLINED: 'DECLINED',
  VISIT_REQUESTED: 'VISIT_REQUESTED',
  VISIT_PLANNED: 'VISIT_PLANNED',
  VISITED: 'VISITED',
  SELECTED: 'SELECTED',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;
export type CandidateStatus = (typeof CandidateStatus)[keyof typeof CandidateStatus];
export const DeclineReason = {
  PRICE: 'PRICE',
  LOCATION: 'LOCATION',
  SIZE: 'SIZE',
  DELIVERY: 'DELIVERY',
  OTHER: 'OTHER',
} as const;
export type DeclineReason = (typeof DeclineReason)[keyof typeof DeclineReason];
export const ReservationStatus = {
  OPTION: 'OPTION',
  RESERVED: 'RESERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];
export const AcquisitionMilestone = {
  CONDITIONS_ACCEPTED: 'CONDITIONS_ACCEPTED',
  SIGNING_SCHEDULED: 'SIGNING_SCHEDULED',
  DEED_SIGNED: 'DEED_SIGNED',
  KEYS_HANDED: 'KEYS_HANDED',
} as const;
export type AcquisitionMilestone = (typeof AcquisitionMilestone)[keyof typeof AcquisitionMilestone];
export const AppointmentType = {
  CALL: 'CALL',
  VISIO: 'VISIO',
  PROPERTY_VISIT: 'PROPERTY_VISIT',
  OFFICE_MEETING: 'OFFICE_MEETING',
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];
export const AppointmentStatus = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  DONE: 'DONE',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

// § 3.7
export const ChecklistScope = {
  CLIENT_FILE: 'CLIENT_FILE',
  BANK_FILE: 'BANK_FILE',
} as const;
export type ChecklistScope = (typeof ChecklistScope)[keyof typeof ChecklistScope];
export const DocumentCategory = {
  IDENTITY: 'IDENTITY',
  RESIDENCE: 'RESIDENCE',
  EMPLOYMENT: 'EMPLOYMENT',
  INCOME: 'INCOME',
  BANKING: 'BANKING',
  PROPERTY: 'PROPERTY',
  FINANCING: 'FINANCING',
  OTHER: 'OTHER',
} as const;
export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];
export const DocumentStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WAIVED: 'WAIVED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
export const RejectionReason = {
  ILLEGIBLE: 'ILLEGIBLE',
  INCOMPLETE: 'INCOMPLETE',
  TOO_OLD: 'TOO_OLD',
  WRONG_DOCUMENT: 'WRONG_DOCUMENT',
  NAME_MISMATCH: 'NAME_MISMATCH',
  CERTIFICATION_REQUIRED: 'CERTIFICATION_REQUIRED',
  OTHER: 'OTHER',
} as const;
export type RejectionReason = (typeof RejectionReason)[keyof typeof RejectionReason];
export const DocumentProvider = {
  CLIENT: 'CLIENT',
  OPERATOR: 'OPERATOR',
  PROMOTER: 'PROMOTER',
  BANK: 'BANK',
} as const;
export type DocumentProvider = (typeof DocumentProvider)[keyof typeof DocumentProvider];
export const DocumentSource = {
  CHECKLIST: 'CHECKLIST',
  AD_HOC: 'AD_HOC',
  BANK_REQUEST: 'BANK_REQUEST',
} as const;
export type DocumentSource = (typeof DocumentSource)[keyof typeof DocumentSource];
export const WaiveKind = {
  MANUAL: 'MANUAL',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PARTY_REMOVED: 'PARTY_REMOVED',
  SUBMISSION_ENDED: 'SUBMISSION_ENDED',
} as const;
export type WaiveKind = (typeof WaiveKind)[keyof typeof WaiveKind];
export const ScanStatus = {
  PENDING: 'PENDING',
  CLEAN: 'CLEAN',
  INFECTED: 'INFECTED',
  ERROR: 'ERROR',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

// § 3.8
export const Channel = {
  EMAIL: 'EMAIL',
  CALL: 'CALL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  MEETING: 'MEETING',
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];
export const Direction = {
  OUTBOUND: 'OUTBOUND',
  INBOUND: 'INBOUND',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];
export const DeliveryState = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  OPENED: 'OPENED',
  CLICKED: 'CLICKED',
  BOUNCED: 'BOUNCED',
  COMPLAINED: 'COMPLAINED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  SUPPRESSED: 'SUPPRESSED',
} as const;
export type DeliveryState = (typeof DeliveryState)[keyof typeof DeliveryState];
export const TriggerKind = {
  MANUAL: 'MANUAL',
  EVENT: 'EVENT',
  WORKFLOW: 'WORKFLOW',
  SYSTEM: 'SYSTEM',
} as const;
export type TriggerKind = (typeof TriggerKind)[keyof typeof TriggerKind];
export const EmailAudience = {
  CLIENT: 'CLIENT',
  STAFF: 'STAFF',
  PARTNER: 'PARTNER',
} as const;
export type EmailAudience = (typeof EmailAudience)[keyof typeof EmailAudience];
export const TaskType = {
  CALL: 'CALL',
  FOLLOW_UP: 'FOLLOW_UP',
  DOC_REVIEW: 'DOC_REVIEW',
  BANK_FOLLOW_UP: 'BANK_FOLLOW_UP',
  VISIT: 'VISIT',
  MEETING: 'MEETING',
  CONTENT: 'CONTENT',
  OTHER: 'OTHER',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];
export const TaskStatus = {
  OPEN: 'OPEN',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const SurveyTrigger = {
  PROPOSAL_SENT: 'PROPOSAL_SENT',
  DOSSIER_COMPLETE: 'DOSSIER_COMPLETE',
  BANK_DECISION: 'BANK_DECISION',
  ACQUISITION: 'ACQUISITION',
  CAFE_ATTENDED: 'CAFE_ATTENDED',
  MANUAL: 'MANUAL',
} as const;
export type SurveyTrigger = (typeof SurveyTrigger)[keyof typeof SurveyTrigger];
export const SurveyCancelReason = {
  CLIENT_ARCHIVED: 'CLIENT_ARCHIVED',
  CLIENT_ERASED: 'CLIENT_ERASED',
  DO_NOT_CONTACT: 'DO_NOT_CONTACT',
  NO_EMAIL: 'NO_EMAIL',
  EMAIL_BOUNCED: 'EMAIL_BOUNCED',
  RESTRICTED: 'RESTRICTED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  DOSSIER_DELETED: 'DOSSIER_DELETED',
  DECISION_REVERTED: 'DECISION_REVERTED',
  PREFERENCE_OFF: 'PREFERENCE_OFF',
  TOO_LATE: 'TOO_LATE',
  MANUAL: 'MANUAL',
} as const;
export type SurveyCancelReason = (typeof SurveyCancelReason)[keyof typeof SurveyCancelReason];
export const FeedbackKind = {
  SURVEY_RESPONSE: 'SURVEY_RESPONSE',
  SPONTANEOUS: 'SPONTANEOUS',
  LISTING_ERROR: 'LISTING_ERROR',
} as const;
export type FeedbackKind = (typeof FeedbackKind)[keyof typeof FeedbackKind];
export const FeedbackStatus = {
  NEW: 'NEW',
  REVIEWED: 'REVIEWED',
  ACTIONED: 'ACTIONED',
  DISMISSED: 'DISMISSED',
} as const;
export type FeedbackStatus = (typeof FeedbackStatus)[keyof typeof FeedbackStatus];
export const FeedbackCategory = {
  JOURNEY: 'JOURNEY',
  COMMUNICATION: 'COMMUNICATION',
  PROPERTY: 'PROPERTY',
  FINANCING: 'FINANCING',
  PLATFORM: 'PLATFORM',
  EVENT: 'EVENT',
  OTHER: 'OTHER',
} as const;
export type FeedbackCategory = (typeof FeedbackCategory)[keyof typeof FeedbackCategory];
export const AlertFrequency = {
  INSTANT: 'INSTANT',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  NONE: 'NONE',
} as const;
export type AlertFrequency = (typeof AlertFrequency)[keyof typeof AlertFrequency];

// § 3.9
export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];
export const RegistrationStatus = {
  REGISTERED: 'REGISTERED',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

// § 3.10
export const ContentBlockType = {
  TEXT: 'TEXT',
  RICH_TEXT: 'RICH_TEXT',
  NUMBER: 'NUMBER',
  MONEY: 'MONEY',
  BOOLEAN: 'BOOLEAN',
  IMAGE: 'IMAGE',
  JSON: 'JSON',
} as const;
export type ContentBlockType = (typeof ContentBlockType)[keyof typeof ContentBlockType];
export const PageKind = {
  EDITORIAL: 'EDITORIAL',
  LEGAL: 'LEGAL',
} as const;
export type PageKind = (typeof PageKind)[keyof typeof PageKind];
export const LegalDocumentType = {
  TERMS_OF_USE: 'TERMS_OF_USE',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  COOKIE_POLICY: 'COOKIE_POLICY',
  LEGAL_NOTICE: 'LEGAL_NOTICE',
  PARTNER_CHARTER: 'PARTNER_CHARTER',
} as const;
export type LegalDocumentType = (typeof LegalDocumentType)[keyof typeof LegalDocumentType];
export const DataRequestType = {
  ACCESS: 'ACCESS',
  RECTIFICATION: 'RECTIFICATION',
  ERASURE: 'ERASURE',
  RESTRICTION: 'RESTRICTION',
  PORTABILITY: 'PORTABILITY',
  OBJECTION: 'OBJECTION',
  OTHER: 'OTHER',
} as const;
export type DataRequestType = (typeof DataRequestType)[keyof typeof DataRequestType];
export const DataRequestStatus = {
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  REJECTED: 'REJECTED',
} as const;
export type DataRequestStatus = (typeof DataRequestStatus)[keyof typeof DataRequestStatus];
export const JobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
export const ImportType = {
  LOTS: 'LOTS',
} as const;
export type ImportType = (typeof ImportType)[keyof typeof ImportType];
export const ExportType = {
  LEADS: 'LEADS',
  CLIENTS: 'CLIENTS',
  DOSSIERS: 'DOSSIERS',
  REGISTRATIONS: 'REGISTRATIONS',
  CATALOGUE: 'CATALOGUE',
  REPORT: 'REPORT',
  AUDIT: 'AUDIT',
  PERSONAL_DATA: 'PERSONAL_DATA',
} as const;
export type ExportType = (typeof ExportType)[keyof typeof ExportType];
export const ActorType = {
  USER: 'USER',
  SYSTEM: 'SYSTEM',
  WEBHOOK: 'WEBHOOK',
  ANONYMOUS: 'ANONYMOUS',
  LINK: 'LINK',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

// § 3.11
export const SessionRevokedReason = {
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  REUSE_DETECTED: 'REUSE_DETECTED',
  ADMIN: 'ADMIN',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  PREVIEW_ENDED: 'PREVIEW_ENDED',
} as const;
export type SessionRevokedReason = (typeof SessionRevokedReason)[keyof typeof SessionRevokedReason];
export const SuspensionReason = {
  STAFF_DECISION: 'STAFF_DECISION',
  DELETION_PENDING: 'DELETION_PENDING',
} as const;
export type SuspensionReason = (typeof SuspensionReason)[keyof typeof SuspensionReason];
export const RestrictionReason = {
  REQUEST: 'REQUEST',
  DELETION_PENDING: 'DELETION_PENDING',
} as const;
export type RestrictionReason = (typeof RestrictionReason)[keyof typeof RestrictionReason];
export const PushPlatform = {
  IOS: 'IOS',
  ANDROID: 'ANDROID',
} as const;
export type PushPlatform = (typeof PushPlatform)[keyof typeof PushPlatform];
export const PartnerDocumentOwner = {
  PROMOTER: 'PROMOTER',
  BANK: 'BANK',
} as const;
export type PartnerDocumentOwner = (typeof PartnerDocumentOwner)[keyof typeof PartnerDocumentOwner];
export const SlugEntityType = {
  PROGRAM: 'PROGRAM',
  PROPERTY: 'PROPERTY',
  PROMOTER: 'PROMOTER',
  EVENT: 'EVENT',
  PAGE: 'PAGE',
} as const;
export type SlugEntityType = (typeof SlugEntityType)[keyof typeof SlugEntityType];
export const NoteEntityType = {
  CLIENT: 'CLIENT',
  LEAD: 'LEAD',
  DOSSIER: 'DOSSIER',
  SUBMISSION: 'SUBMISSION',
  PROMOTER: 'PROMOTER',
  BANK: 'BANK',
  PROGRAM: 'PROGRAM',
  PROPERTY: 'PROPERTY',
  EVENT: 'EVENT',
} as const;
export type NoteEntityType = (typeof NoteEntityType)[keyof typeof NoteEntityType];
export const ContactSubject = {
  PROPERTY: 'PROPERTY',
  FINANCING: 'FINANCING',
  DOSSIER: 'DOSSIER',
  CAFE: 'CAFE',
  CALLBACK: 'CALLBACK',
  OTHER: 'OTHER',
} as const;
export type ContactSubject = (typeof ContactSubject)[keyof typeof ContactSubject];
export const BudgetKind = {
  TOTAL: 'TOTAL',
  MONTHLY: 'MONTHLY',
} as const;
export type BudgetKind = (typeof BudgetKind)[keyof typeof BudgetKind];
export const AlertDeactivationReason = {
  USER: 'USER',
  BOUNCE: 'BOUNCE',
  EXPIRED: 'EXPIRED',
  ADMIN: 'ADMIN',
} as const;
export type AlertDeactivationReason = (typeof AlertDeactivationReason)[keyof typeof AlertDeactivationReason];
export const DepositRefundStatus = {
  NONE: 'NONE',
  DUE: 'DUE',
  REFUNDED: 'REFUNDED',
  RETAINED: 'RETAINED',
} as const;
export type DepositRefundStatus = (typeof DepositRefundStatus)[keyof typeof DepositRefundStatus];
export const CancelledBy = {
  CLIENT: 'CLIENT',
  STAFF: 'STAFF',
  SYSTEM: 'SYSTEM',
} as const;
export type CancelledBy = (typeof CancelledBy)[keyof typeof CancelledBy];
export const UploadChannel = {
  WEB: 'WEB',
  MOBILE: 'MOBILE',
  ADMIN: 'ADMIN',
  CONVERSATION: 'CONVERSATION',
  PARTNER: 'PARTNER',
} as const;
export type UploadChannel = (typeof UploadChannel)[keyof typeof UploadChannel];
export const UploadTarget = {
  DOCUMENT: 'DOCUMENT',
  MESSAGE: 'MESSAGE',
  MEDIA: 'MEDIA',
  PARTNER_DOCUMENT: 'PARTNER_DOCUMENT',
  IMPORT: 'IMPORT',
  EMAIL_ATTACHMENT: 'EMAIL_ATTACHMENT',
} as const;
export type UploadTarget = (typeof UploadTarget)[keyof typeof UploadTarget];
export const UploadStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];
export const ClientTimelineKind = {
  LEAD_SENT: 'LEAD_SENT',
  LEAD_SENT_AGAIN: 'LEAD_SENT_AGAIN',
  AGENT_ASSIGNED: 'AGENT_ASSIGNED',
  QUALIFIED: 'QUALIFIED',
  PROPERTIES_PROPOSED: 'PROPERTIES_PROPOSED',
  APPOINTMENT_DONE: 'APPOINTMENT_DONE',
  PROPERTY_SELECTED: 'PROPERTY_SELECTED',
  SELECTION_DECLINED: 'SELECTION_DECLINED',
  SELECTION_WITHDRAWN: 'SELECTION_WITHDRAWN',
  DOCUMENTS_REQUESTED: 'DOCUMENTS_REQUESTED',
  DOSSIER_COMPLETE: 'DOSSIER_COMPLETE',
  SUBMISSION_SENT: 'SUBMISSION_SENT',
  INFO_REQUESTED: 'INFO_REQUESTED',
  BANK_APPROVED: 'BANK_APPROVED',
  BANK_REJECTED: 'BANK_REJECTED',
  BANK_DECISION_REVERTED: 'BANK_DECISION_REVERTED',
  FINANCING_DROPPED: 'FINANCING_DROPPED',
  FINANCING_RESUMED: 'FINANCING_RESUMED',
  OPTION_PLACED: 'OPTION_PLACED',
  RESERVATION_CONFIRMED: 'RESERVATION_CONFIRMED',
  OPTION_ENDED: 'OPTION_ENDED',
  RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',
  MILESTONE_REACHED: 'MILESTONE_REACHED',
  PUT_ON_HOLD: 'PUT_ON_HOLD',
  RESUMED: 'RESUMED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  OFFER_UPDATED: 'OFFER_UPDATED',
  OFFER_EXTENDED: 'OFFER_EXTENDED',
  OFFER_EXPIRED: 'OFFER_EXPIRED',
  SUBMISSION_WITHDRAWN: 'SUBMISSION_WITHDRAWN',
  CONSENT_GIVEN: 'CONSENT_GIVEN',
  CONSENT_WITHDRAWN: 'CONSENT_WITHDRAWN',
  DEPOSIT_DUE: 'DEPOSIT_DUE',
  DEPOSIT_REFUNDED: 'DEPOSIT_REFUNDED',
  DEPOSIT_RETAINED: 'DEPOSIT_RETAINED',
} as const;
export type ClientTimelineKind = (typeof ClientTimelineKind)[keyof typeof ClientTimelineKind];
export const VersionOutcome = {
  SCANNING: 'SCANNING',
  IN_REVIEW: 'IN_REVIEW',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
  REPLACED: 'REPLACED',
  DISCARDED: 'DISCARDED',
  DELETED: 'DELETED',
} as const;
export type VersionOutcome = (typeof VersionOutcome)[keyof typeof VersionOutcome];
export const CallOutcome = {
  REACHED: 'REACHED',
  NO_ANSWER: 'NO_ANSWER',
  VOICEMAIL: 'VOICEMAIL',
  WRONG_NUMBER: 'WRONG_NUMBER',
} as const;
export type CallOutcome = (typeof CallOutcome)[keyof typeof CallOutcome];
export const MessageSenderType = {
  CLIENT: 'CLIENT',
  STAFF: 'STAFF',
  SYSTEM: 'SYSTEM',
} as const;
export type MessageSenderType = (typeof MessageSenderType)[keyof typeof MessageSenderType];
export const ExecutionStatus = {
  PENDING: 'PENDING',
  DONE: 'DONE',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
} as const;
export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];
export const DelayUnit = {
  MINUTES: 'MINUTES',
  HOURS: 'HOURS',
  DAYS: 'DAYS',
  BUSINESS_HOURS: 'BUSINESS_HOURS',
  BUSINESS_DAYS: 'BUSINESS_DAYS',
} as const;
export type DelayUnit = (typeof DelayUnit)[keyof typeof DelayUnit];
export const AssigneeRef = {
  DOSSIER_AGENT: 'DOSSIER_AGENT',
  LEAD_AGENT: 'LEAD_AGENT',
  CLIENT_AGENT: 'CLIENT_AGENT',
  APPOINTMENT_AGENT: 'APPOINTMENT_AGENT',
  EVENT_HOST: 'EVENT_HOST',
  TEAM: 'TEAM',
  ADMINS: 'ADMINS',
  OWNERS: 'OWNERS',
  ALL_AGENTS: 'ALL_AGENTS',
  SUPPORT: 'SUPPORT',
} as const;
export type AssigneeRef = (typeof AssigneeRef)[keyof typeof AssigneeRef];
export const EmailRecipientRef = {
  CLIENT: 'CLIENT',
  REGISTRANT: 'REGISTRANT',
  REGISTRANTS: 'REGISTRANTS',
  ATTENDEES: 'ATTENDEES',
  NOTIFY_REQUESTS: 'NOTIFY_REQUESTS',
  DOSSIER_AGENT: 'DOSSIER_AGENT',
  LEAD_AGENT: 'LEAD_AGENT',
  CLIENT_AGENT: 'CLIENT_AGENT',
  APPOINTMENT_AGENT: 'APPOINTMENT_AGENT',
  EVENT_HOST: 'EVENT_HOST',
  ADMINS: 'ADMINS',
  OWNERS: 'OWNERS',
} as const;
export type EmailRecipientRef = (typeof EmailRecipientRef)[keyof typeof EmailRecipientRef];
export const TaskOrigin = {
  MANUAL: 'MANUAL',
  WORKFLOW: 'WORKFLOW',
  SYSTEM: 'SYSTEM',
} as const;
export type TaskOrigin = (typeof TaskOrigin)[keyof typeof TaskOrigin];
export const ReminderKind = {
  NONE: 'NONE',
  AT_DUE: 'AT_DUE',
  BEFORE_15M: 'BEFORE_15M',
  BEFORE_1H: 'BEFORE_1H',
  BEFORE_1D: 'BEFORE_1D',
  CUSTOM: 'CUSTOM',
} as const;
export type ReminderKind = (typeof ReminderKind)[keyof typeof ReminderKind];
export const GestureRoute = {
  BACK_OFFICE: 'BACK_OFFICE',
  LINK: 'LINK',
  PORTAL: 'PORTAL',
} as const;
export type GestureRoute = (typeof GestureRoute)[keyof typeof GestureRoute];
export const PartnerGesture = {
  OPTION_ANSWER: 'OPTION_ANSWER',
  RESERVATION_CONFIRM: 'RESERVATION_CONFIRM',
  DOCUMENT_PROVIDE: 'DOCUMENT_PROVIDE',
  DEPOSIT_OUTCOME: 'DEPOSIT_OUTCOME',
  VISIT_HOST: 'VISIT_HOST',
  STOCK_UPDATE: 'STOCK_UPDATE',
  DELIVERY_UPDATE: 'DELIVERY_UPDATE',
  PARTNER_DOCUMENT: 'PARTNER_DOCUMENT',
  SUBMISSION_ACK: 'SUBMISSION_ACK',
  INFO_REQUEST: 'INFO_REQUEST',
  DECISION: 'DECISION',
  OFFER_EXTEND: 'OFFER_EXTEND',
  PRODUCT_CONFIRM: 'PRODUCT_CONFIRM',
  PRODUCT_UPDATE: 'PRODUCT_UPDATE',
} as const;
export type PartnerGesture = (typeof PartnerGesture)[keyof typeof PartnerGesture];
export const PartnerAnswerStatus = {
  INTERNAL: 'INTERNAL',
  PENDING: 'PENDING',
  APPLIED: 'APPLIED',
  DISMISSED: 'DISMISSED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type PartnerAnswerStatus = (typeof PartnerAnswerStatus)[keyof typeof PartnerAnswerStatus];
export const SharePurpose = {
  SUBMISSION_PACKAGE: 'SUBMISSION_PACKAGE',
  PERSONAL_DATA_EXPORT: 'PERSONAL_DATA_EXPORT',
  PARTNER_REQUEST: 'PARTNER_REQUEST',
} as const;
export type SharePurpose = (typeof SharePurpose)[keyof typeof SharePurpose];
export const SurveyQuestionType = {
  NPS: 'NPS',
  CSAT: 'CSAT',
  CHOICE: 'CHOICE',
  TEXT: 'TEXT',
} as const;
export type SurveyQuestionType = (typeof SurveyQuestionType)[keyof typeof SurveyQuestionType];
export const FaqCategory = {
  BUYING: 'BUYING',
  FINANCING: 'FINANCING',
  DOSSIER: 'DOSSIER',
  CAFE: 'CAFE',
  PLATFORM: 'PLATFORM',
} as const;
export type FaqCategory = (typeof FaqCategory)[keyof typeof FaqCategory];
export const FaqPlacement = {
  FAQ: 'FAQ',
  FINANCEMENTS: 'FINANCEMENTS',
  LE_CAFE: 'LE_CAFE',
  NOTRE_CONCEPT: 'NOTRE_CONCEPT',
} as const;
export type FaqPlacement = (typeof FaqPlacement)[keyof typeof FaqPlacement];
export const EmailTemplateCategory = {
  ACCOUNT: 'ACCOUNT',
  LEADS: 'LEADS',
  DOSSIER: 'DOSSIER',
  DOCUMENTS: 'DOCUMENTS',
  FINANCING: 'FINANCING',
  CAFE: 'CAFE',
  SURVEYS: 'SURVEYS',
  ALERTS: 'ALERTS',
  INTERNAL: 'INTERNAL',
  PARTNERS: 'PARTNERS',
  NEWS: 'NEWS',
  PRIVACY: 'PRIVACY',
  MANUAL: 'MANUAL',
} as const;
export type EmailTemplateCategory = (typeof EmailTemplateCategory)[keyof typeof EmailTemplateCategory];
export const ListingErrorKind = {
  PRICE: 'PRICE',
  SURFACE: 'SURFACE',
  PHOTOS: 'PHOTOS',
  LOCATION: 'LOCATION',
  AVAILABILITY: 'AVAILABILITY',
  OTHER: 'OTHER',
} as const;
export type ListingErrorKind = (typeof ListingErrorKind)[keyof typeof ListingErrorKind];
export const EventTopic = {
  PROGRAMMES: 'PROGRAMMES',
  FINANCING: 'FINANCING',
  ISLAMIC_FINANCE: 'ISLAMIC_FINANCE',
  PROCEDURE: 'PROCEDURE',
} as const;
export type EventTopic = (typeof EventTopic)[keyof typeof EventTopic];
export const ExportFormat = {
  CSV: 'CSV',
  XLSX: 'XLSX',
  ZIP: 'ZIP',
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
export const EligibilityStatus = {
  ELIGIBLE: 'ELIGIBLE',
  CONDITIONAL: 'CONDITIONAL',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
} as const;
export type EligibilityStatus = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];
export const EligibilityReason = {
  RESIDENCY: 'RESIDENCY',
  RESIDENCE_COUNTRY: 'RESIDENCE_COUNTRY',
  INCOME_CURRENCY: 'INCOME_CURRENCY',
  RATE_MISSING: 'RATE_MISSING',
  AGE_OR_DURATION: 'AGE_OR_DURATION',
  INCOME_TOO_LOW: 'INCOME_TOO_LOW',
  DEBT_RATIO: 'DEBT_RATIO',
  AMOUNT_BELOW_MIN: 'AMOUNT_BELOW_MIN',
} as const;
export type EligibilityReason = (typeof EligibilityReason)[keyof typeof EligibilityReason];
export const LimitingFactor = {
  INCOME: 'INCOME',
  DOWN_PAYMENT: 'DOWN_PAYMENT',
} as const;
export type LimitingFactor = (typeof LimitingFactor)[keyof typeof LimitingFactor];
export const TargetCase = {
  NO_FINANCING_NEEDED: 'NO_FINANCING_NEEDED',
  FINANCEABLE: 'FINANCEABLE',
  DOWN_PAYMENT_SHORT: 'DOWN_PAYMENT_SHORT',
  PAYMENT_TOO_HIGH: 'PAYMENT_TOO_HIGH',
  AMOUNT_BELOW_MIN: 'AMOUNT_BELOW_MIN',
} as const;
export type TargetCase = (typeof TargetCase)[keyof typeof TargetCase];
export const CreditMode = {
  FROM_PRICE: 'FROM_PRICE',
  FROM_AMOUNT: 'FROM_AMOUNT',
} as const;
export type CreditMode = (typeof CreditMode)[keyof typeof CreditMode];
export const CreditWarning = {
  AMOUNT_OUT_OF_PRODUCT_BOUNDS: 'AMOUNT_OUT_OF_PRODUCT_BOUNDS',
  DURATION_OUT_OF_PRODUCT_BOUNDS: 'DURATION_OUT_OF_PRODUCT_BOUNDS',
  DOWN_PAYMENT_BELOW_MIN: 'DOWN_PAYMENT_BELOW_MIN',
} as const;
export type CreditWarning = (typeof CreditWarning)[keyof typeof CreditWarning];
export const AssistantMode = {
  OFF: 'OFF',
  GUIDED: 'GUIDED',
  AI: 'AI',
} as const;
export type AssistantMode = (typeof AssistantMode)[keyof typeof AssistantMode];
export const AgentScope = {
  ALL: 'ALL',
  ASSIGNED_ONLY: 'ASSIGNED_ONLY',
} as const;
export type AgentScope = (typeof AgentScope)[keyof typeof AgentScope];
export const AssignmentMode = {
  MANUAL: 'MANUAL',
  ROUND_ROBIN: 'ROUND_ROBIN',
} as const;
export type AssignmentMode = (typeof AssignmentMode)[keyof typeof AssignmentMode];
export const LaunchCheckPoint = {
  REFERENCE_FINANCING: 'REFERENCE_FINANCING',
  EXCHANGE_RATE: 'EXCHANGE_RATE',
  INDICATIVE_SCALE: 'INDICATIVE_SCALE',
  BANK_PRODUCTS: 'BANK_PRODUCTS',
  ACQUISITION_FEES: 'ACQUISITION_FEES',
  CHECKLIST: 'CHECKLIST',
  CONTACT: 'CONTACT',
  LEGAL_TEXTS: 'LEGAL_TEXTS',
  FINANCIAL_NOTICES: 'FINANCIAL_NOTICES',
  HOME_COMPARISON: 'HOME_COMPARISON',
  IMAGES: 'IMAGES',
  TWO_FACTOR: 'TWO_FACTOR',
} as const;
export type LaunchCheckPoint = (typeof LaunchCheckPoint)[keyof typeof LaunchCheckPoint];
