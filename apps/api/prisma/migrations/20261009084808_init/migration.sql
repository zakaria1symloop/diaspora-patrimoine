-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('CLIENT', 'STAFF', 'PARTNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('OPERATOR', 'PROMOTER', 'BANK');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'ar', 'en');

-- CreateEnum
CREATE TYPE "SessionAudience" AS ENUM ('WEB', 'ADMIN', 'MOBILE', 'PARTNER');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MAGIC_LOGIN', 'ACCOUNT_ACTIVATION', 'STAFF_INVITATION', 'EMAIL_CHANGE', 'ACTION_CODE', 'CLIENT_PREVIEW', 'LOGIN_CHALLENGE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY', 'CONTACT_REQUEST', 'MARKETING_EMAIL', 'DATA_SHARING_PARTNERS', 'PARTY_AUTHORIZATION', 'PARTNER_CHARTER');

-- CreateEnum
CREATE TYPE "ResidencyStatus" AS ENUM ('NON_RESIDENT', 'EXPATRIATE', 'RESIDENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'FIXED_TERM', 'CIVIL_SERVANT', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'RETIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchasePurpose" AS ENUM ('HOLIDAY_HOME', 'RETURN_HOME', 'FAMILY', 'RENTAL_INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseTimeframe" AS ENUM ('LT_6M', 'M6_12', 'GT_12M', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "FinancingPreference" AS ENUM ('CONVENTIONAL', 'ISLAMIC', 'NO_PREFERENCE', 'CASH');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ContactTimeSlot" AS ENUM ('MORNING', 'NOON', 'AFTERNOON', 'EVENING', 'ANYTIME');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'QUALIFIED', 'ACTIVE', 'CUSTOMER', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('PROPERTY_INTEREST', 'PROJECTION_REQUEST', 'CALLBACK_REQUEST', 'GUIDED_SEARCH', 'SIMULATION_FOLLOWUP', 'CONTACT_MESSAGE', 'PARTNER_REQUEST');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('EMAIL_UNVERIFIED', 'DRAFT', 'SUBMITTED', 'INFO_REQUESTED', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LeadOutcome" AS ENUM ('DOSSIER_OPENED', 'ATTACHED_TO_DOSSIER', 'ANSWERED', 'UNREACHABLE', 'NOT_INTERESTED', 'DUPLICATE', 'OUT_OF_SCOPE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEB_FORM', 'MOBILE_APP', 'ADMIN', 'PHONE', 'WHATSAPP', 'EMAIL', 'CAFE', 'IMPORT', 'PARTNER', 'SIGNUP');

-- CreateEnum
CREATE TYPE "SpamSignal" AS ENUM ('HONEYPOT', 'FAST_SUBMIT', 'MANY_LINKS', 'DISPOSABLE_DOMAIN', 'IP_BURST', 'DUPLICATE_MESSAGE', 'NO_MX', 'PHONE_COUNTRY_MISMATCH', 'ALL_CAPS');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'STUDIO', 'DUPLEX', 'VILLA', 'LAND', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "Standing" AS ENUM ('COMFORT', 'STANDING', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('AVAILABLE', 'OPTIONED', 'RESERVED', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('ON_PLAN', 'UNDER_CONSTRUCTION', 'DELIVERED');

-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'RENDER_3D', 'PLAN', 'BROCHURE', 'VIDEO', 'PANO_360', 'LOGO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaOwnerType" AS ENUM ('PROGRAM', 'PROPERTY', 'LOT', 'PROGRAM_UPDATE', 'PROMOTER', 'BANK', 'PARTNER', 'EVENT', 'CONTENT', 'USER');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ConstructionStage" AS ENUM ('FOUNDATIONS', 'STRUCTURE', 'SECONDARY_WORKS', 'FINISHES', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PoiCategory" AS ENUM ('TRANSPORT', 'EDUCATION', 'SHOPPING', 'HEALTH', 'LEISURE', 'OTHER');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('WALK', 'CAR', 'TRANSIT');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'ENDED');

-- CreateEnum
CREATE TYPE "PartnerAccessLevel" AS ENUM ('MANAGED', 'LINK', 'PORTAL');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('NOTARY', 'INSURER', 'INSTITUTION', 'MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('CONVENTIONAL', 'ISLAMIC');

-- CreateEnum
CREATE TYPE "PricingMethod" AS ENUM ('AMORTIZED_RATE', 'FLAT_MARGIN');

-- CreateEnum
CREATE TYPE "TargetSegment" AS ENUM ('DIASPORA', 'RESIDENT', 'ALL');

-- CreateEnum
CREATE TYPE "ExchangeRateKind" AS ENUM ('OFFICIAL', 'INDICATIVE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransmissionMode" AS ENUM ('SECURE_LINK', 'MANUAL', 'PORTAL');

-- CreateEnum
CREATE TYPE "SubmissionEventType" AS ENUM ('STATUS_CHANGED', 'NOTE', 'INFO_REQUESTED', 'INFO_PROVIDED', 'PACKAGE_GENERATED', 'PACKAGE_SENT', 'PACKAGE_DOWNLOADED', 'REMINDER_SENT', 'OFFER_ACCEPTED', 'OFFER_DECLINED', 'DECISION_CORRECTED', 'DECISION_REVERTED', 'OFFER_EXTENDED', 'OFFER_ACCEPT_REQUESTED', 'OFFER_ACCEPT_WITHDRAWN', 'OFFER_UNACCEPTED', 'PACKAGE_FAILED', 'SHARE_OPENED', 'SHARE_LOCKED');

-- CreateEnum
CREATE TYPE "SimulationType" AS ENUM ('ELIGIBILITY', 'CREDIT', 'PROJECTION');

-- CreateEnum
CREATE TYPE "DossierStage" AS ENUM ('INTEREST', 'QUALIFICATION', 'MATCHING', 'DOCUMENTS', 'BANK_REVIEW', 'APPROVED', 'ACQUISITION');

-- CreateEnum
CREATE TYPE "DossierStatus" AS ENUM ('OPEN', 'ON_HOLD', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('UNREACHABLE', 'NOT_ELIGIBLE', 'NO_SUITABLE_PROPERTY', 'BOUGHT_ELSEWHERE', 'BUDGET', 'CLIENT_WITHDREW', 'BANK_REFUSAL', 'PROPERTY_UNAVAILABLE', 'DUPLICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "HoldReason" AS ENUM ('CLIENT_REQUEST', 'WAITING_CLIENT', 'WAITING_PROMOTER', 'WAITING_BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('PRIMARY', 'CO_BORROWER', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "CandidateOrigin" AS ENUM ('CLIENT_INTEREST', 'ADVISOR_PROPOSAL');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PROPOSED', 'VIEWED', 'INTERESTED', 'DECLINED', 'VISIT_REQUESTED', 'VISIT_PLANNED', 'VISITED', 'SELECTED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DeclineReason" AS ENUM ('PRICE', 'LOCATION', 'SIZE', 'DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('OPTION', 'RESERVED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AcquisitionMilestone" AS ENUM ('CONDITIONS_ACCEPTED', 'SIGNING_SCHEDULED', 'DEED_SIGNED', 'KEYS_HANDED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('CALL', 'VISIO', 'PROPERTY_VISIT', 'OFFICE_MEETING');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChecklistScope" AS ENUM ('CLIENT_FILE', 'BANK_FILE');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'RESIDENCE', 'EMPLOYMENT', 'INCOME', 'BANKING', 'PROPERTY', 'FINANCING', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'RECEIVED', 'VALIDATED', 'REJECTED', 'EXPIRED', 'WAIVED');

-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('ILLEGIBLE', 'INCOMPLETE', 'TOO_OLD', 'WRONG_DOCUMENT', 'NAME_MISMATCH', 'CERTIFICATION_REQUIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentProvider" AS ENUM ('CLIENT', 'OPERATOR', 'PROMOTER', 'BANK');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('CHECKLIST', 'AD_HOC', 'BANK_REQUEST');

-- CreateEnum
CREATE TYPE "WaiveKind" AS ENUM ('MANUAL', 'NOT_APPLICABLE', 'PARTY_REMOVED', 'SUBMISSION_ENDED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'CALL', 'WHATSAPP', 'SMS', 'MEETING');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "TriggerKind" AS ENUM ('MANUAL', 'EVENT', 'WORKFLOW', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailAudience" AS ENUM ('CLIENT', 'STAFF', 'PARTNER');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'FOLLOW_UP', 'DOC_REVIEW', 'BANK_FOLLOW_UP', 'VISIT', 'MEETING', 'CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SurveyTrigger" AS ENUM ('PROPOSAL_SENT', 'DOSSIER_COMPLETE', 'BANK_DECISION', 'ACQUISITION', 'CAFE_ATTENDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SurveyCancelReason" AS ENUM ('CLIENT_ARCHIVED', 'CLIENT_ERASED', 'DO_NOT_CONTACT', 'NO_EMAIL', 'EMAIL_BOUNCED', 'RESTRICTED', 'ACCOUNT_SUSPENDED', 'DOSSIER_DELETED', 'DECISION_REVERTED', 'PREFERENCE_OFF', 'TOO_LATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "FeedbackKind" AS ENUM ('SURVEY_RESPONSE', 'SPONTANEOUS', 'LISTING_ERROR');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('JOURNEY', 'COMMUNICATION', 'PROPERTY', 'FINANCING', 'PLATFORM', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AlertFrequency" AS ENUM ('INSTANT', 'DAILY', 'WEEKLY', 'NONE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ContentBlockType" AS ENUM ('TEXT', 'RICH_TEXT', 'NUMBER', 'MONEY', 'BOOLEAN', 'IMAGE', 'JSON');

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('EDITORIAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('TERMS_OF_USE', 'PRIVACY_POLICY', 'COOKIE_POLICY', 'LEGAL_NOTICE', 'PARTNER_CHARTER');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('ACCESS', 'RECTIFICATION', 'ERASURE', 'RESTRICTION', 'PORTABILITY', 'OBJECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'DONE', 'REJECTED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('LOTS');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('LEADS', 'CLIENTS', 'DOSSIERS', 'REGISTRATIONS', 'CATALOGUE', 'REPORT', 'AUDIT', 'PERSONAL_DATA');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK', 'ANONYMOUS', 'LINK');

-- CreateEnum
CREATE TYPE "SessionRevokedReason" AS ENUM ('LOGOUT', 'PASSWORD_CHANGED', 'ROLE_CHANGED', 'REUSE_DETECTED', 'ADMIN', 'SUSPENDED', 'EXPIRED', 'PREVIEW_ENDED');

-- CreateEnum
CREATE TYPE "SuspensionReason" AS ENUM ('STAFF_DECISION', 'DELETION_PENDING');

-- CreateEnum
CREATE TYPE "RestrictionReason" AS ENUM ('REQUEST', 'DELETION_PENDING');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PartnerDocumentOwner" AS ENUM ('PROMOTER', 'BANK');

-- CreateEnum
CREATE TYPE "SlugEntityType" AS ENUM ('PROGRAM', 'PROPERTY', 'PROMOTER', 'EVENT', 'PAGE');

-- CreateEnum
CREATE TYPE "NoteEntityType" AS ENUM ('CLIENT', 'LEAD', 'DOSSIER', 'SUBMISSION', 'PROMOTER', 'BANK', 'PROGRAM', 'PROPERTY', 'EVENT');

-- CreateEnum
CREATE TYPE "ContactSubject" AS ENUM ('PROPERTY', 'FINANCING', 'DOSSIER', 'CAFE', 'CALLBACK', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetKind" AS ENUM ('TOTAL', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AlertDeactivationReason" AS ENUM ('USER', 'BOUNCE', 'EXPIRED', 'ADMIN');

-- CreateEnum
CREATE TYPE "DepositRefundStatus" AS ENUM ('NONE', 'DUE', 'REFUNDED', 'RETAINED');

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CLIENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UploadChannel" AS ENUM ('WEB', 'MOBILE', 'ADMIN', 'CONVERSATION', 'PARTNER');

-- CreateEnum
CREATE TYPE "UploadTarget" AS ENUM ('DOCUMENT', 'MESSAGE', 'MEDIA', 'PARTNER_DOCUMENT', 'IMPORT', 'EMAIL_ATTACHMENT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClientTimelineKind" AS ENUM ('LEAD_SENT', 'LEAD_SENT_AGAIN', 'AGENT_ASSIGNED', 'QUALIFIED', 'PROPERTIES_PROPOSED', 'APPOINTMENT_DONE', 'PROPERTY_SELECTED', 'SELECTION_DECLINED', 'SELECTION_WITHDRAWN', 'DOCUMENTS_REQUESTED', 'DOSSIER_COMPLETE', 'SUBMISSION_SENT', 'INFO_REQUESTED', 'BANK_APPROVED', 'BANK_REJECTED', 'BANK_DECISION_REVERTED', 'FINANCING_DROPPED', 'FINANCING_RESUMED', 'OPTION_PLACED', 'RESERVATION_CONFIRMED', 'OPTION_ENDED', 'RESERVATION_CANCELLED', 'MILESTONE_REACHED', 'PUT_ON_HOLD', 'RESUMED', 'CLOSED', 'REOPENED', 'OFFER_UPDATED', 'OFFER_EXTENDED', 'OFFER_EXPIRED', 'SUBMISSION_WITHDRAWN', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN', 'DEPOSIT_DUE', 'DEPOSIT_REFUNDED', 'DEPOSIT_RETAINED');

-- CreateEnum
CREATE TYPE "VersionOutcome" AS ENUM ('SCANNING', 'IN_REVIEW', 'VALIDATED', 'REJECTED', 'REPLACED', 'DISCARDED', 'DELETED');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('REACHED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('CLIENT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "DelayUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS', 'BUSINESS_HOURS', 'BUSINESS_DAYS');

-- CreateEnum
CREATE TYPE "AssigneeRef" AS ENUM ('DOSSIER_AGENT', 'LEAD_AGENT', 'CLIENT_AGENT', 'APPOINTMENT_AGENT', 'EVENT_HOST', 'TEAM', 'ADMINS', 'OWNERS', 'ALL_AGENTS', 'SUPPORT');

-- CreateEnum
CREATE TYPE "EmailRecipientRef" AS ENUM ('CLIENT', 'REGISTRANT', 'REGISTRANTS', 'ATTENDEES', 'NOTIFY_REQUESTS', 'DOSSIER_AGENT', 'LEAD_AGENT', 'CLIENT_AGENT', 'APPOINTMENT_AGENT', 'EVENT_HOST', 'ADMINS', 'OWNERS');

-- CreateEnum
CREATE TYPE "TaskOrigin" AS ENUM ('MANUAL', 'WORKFLOW', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('NONE', 'AT_DUE', 'BEFORE_15M', 'BEFORE_1H', 'BEFORE_1D', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GestureRoute" AS ENUM ('BACK_OFFICE', 'LINK', 'PORTAL');

-- CreateEnum
CREATE TYPE "PartnerGesture" AS ENUM ('OPTION_ANSWER', 'RESERVATION_CONFIRM', 'DOCUMENT_PROVIDE', 'DEPOSIT_OUTCOME', 'VISIT_HOST', 'STOCK_UPDATE', 'DELIVERY_UPDATE', 'PARTNER_DOCUMENT', 'SUBMISSION_ACK', 'INFO_REQUEST', 'DECISION', 'OFFER_EXTEND', 'PRODUCT_CONFIRM', 'PRODUCT_UPDATE');

-- CreateEnum
CREATE TYPE "PartnerAnswerStatus" AS ENUM ('INTERNAL', 'PENDING', 'APPLIED', 'DISMISSED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SharePurpose" AS ENUM ('SUBMISSION_PACKAGE', 'PERSONAL_DATA_EXPORT', 'PARTNER_REQUEST');

-- CreateEnum
CREATE TYPE "SurveyQuestionType" AS ENUM ('NPS', 'CSAT', 'CHOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "FaqCategory" AS ENUM ('BUYING', 'FINANCING', 'DOSSIER', 'CAFE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "FaqPlacement" AS ENUM ('FAQ', 'FINANCEMENTS', 'LE_CAFE', 'NOTRE_CONCEPT');

-- CreateEnum
CREATE TYPE "EmailTemplateCategory" AS ENUM ('ACCOUNT', 'LEADS', 'DOSSIER', 'DOCUMENTS', 'FINANCING', 'CAFE', 'SURVEYS', 'ALERTS', 'INTERNAL', 'PARTNERS', 'NEWS', 'PRIVACY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ListingErrorKind" AS ENUM ('PRICE', 'SURFACE', 'PHOTOS', 'LOCATION', 'AVAILABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "EventTopic" AS ENUM ('PROGRAMMES', 'FINANCING', 'ISLAMIC_FINANCE', 'PROCEDURE');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'ZIP');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'CONDITIONAL', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "EligibilityReason" AS ENUM ('RESIDENCY', 'RESIDENCE_COUNTRY', 'INCOME_CURRENCY', 'RATE_MISSING', 'AGE_OR_DURATION', 'INCOME_TOO_LOW', 'DEBT_RATIO', 'AMOUNT_BELOW_MIN');

-- CreateEnum
CREATE TYPE "LimitingFactor" AS ENUM ('INCOME', 'DOWN_PAYMENT');

-- CreateEnum
CREATE TYPE "TargetCase" AS ENUM ('NO_FINANCING_NEEDED', 'FINANCEABLE', 'DOWN_PAYMENT_SHORT', 'PAYMENT_TOO_HIGH', 'AMOUNT_BELOW_MIN');

-- CreateEnum
CREATE TYPE "CreditMode" AS ENUM ('FROM_PRICE', 'FROM_AMOUNT');

-- CreateEnum
CREATE TYPE "CreditWarning" AS ENUM ('AMOUNT_OUT_OF_PRODUCT_BOUNDS', 'DURATION_OUT_OF_PRODUCT_BOUNDS', 'DOWN_PAYMENT_BELOW_MIN');

-- CreateEnum
CREATE TYPE "AssistantMode" AS ENUM ('OFF', 'GUIDED', 'AI');

-- CreateEnum
CREATE TYPE "AgentScope" AS ENUM ('ALL', 'ASSIGNED_ONLY');

-- CreateEnum
CREATE TYPE "AssignmentMode" AS ENUM ('MANUAL', 'ROUND_ROBIN');

-- CreateEnum
CREATE TYPE "LaunchCheckPoint" AS ENUM ('REFERENCE_FINANCING', 'EXCHANGE_RATE', 'INDICATIVE_SCALE', 'BANK_PRODUCTS', 'ACQUISITION_FEES', 'CHECKLIST', 'CONTACT', 'LEGAL_TEXTS', 'FINANCIAL_NOTICES', 'HOME_COMPARISON', 'IMAGES', 'TWO_FACTOR');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "kind" "UserKind" NOT NULL,
    "email" CITEXT NOT NULL,
    "email_verified_at" TIMESTAMPTZ(3),
    "pending_email" CITEXT,
    "password_hash" TEXT,
    "password_changed_at" TIMESTAMPTZ(3),
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "phone" VARCHAR(20),
    "locale" "Locale" NOT NULL DEFAULT 'fr',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspended_at" TIMESTAMPTZ(3),
    "suspended_reason" "SuspensionReason",
    "suspended_note" VARCHAR(300),
    "job_title" VARCHAR(80),
    "signature" VARCHAR(500),
    "avatar_media_id" UUID,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "two_factor_pending_secret" TEXT,
    "two_factor_recovery_hashes" JSONB,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "last_seen_at" TIMESTAMPTZ(3),
    "charter_accepted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "invited_by_id" UUID,
    "invited_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "suspended_at" TIMESTAMPTZ(3),
    "elevated_role" "MembershipRole",
    "elevated_until" TIMESTAMPTZ(3),
    "elevation_reason" VARCHAR(500),
    "receives_leads" BOOLEAN NOT NULL,
    "absent_until" DATE,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "audience" "SessionAudience" NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" CHAR(64) NOT NULL,
    "previous_refresh_token_hash" CHAR(64),
    "rotated_at" TIMESTAMPTZ(3),
    "impersonated_by_id" UUID,
    "remember_me" BOOLEAN NOT NULL,
    "user_agent" VARCHAR(400),
    "device_label" VARCHAR(120),
    "ip_hash" CHAR(64),
    "last_used_at" TIMESTAMPTZ(3) NOT NULL,
    "password_confirmed_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" "SessionRevokedReason",
    "device_key" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "user_id" UUID,
    "email" CITEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "payload" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMPTZ(3),
    "ip_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "user_id" UUID,
    "client_id" UUID,
    "lead_id" UUID,
    "registration_id" UUID,
    "party_id" UUID,
    "document_version" VARCHAR(40),
    "wording" TEXT,
    "source" VARCHAR(60) NOT NULL,
    "source_communication_id" UUID,
    "given_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_by_id" UUID,
    "proof_document_id" UUID,
    "proof_note" VARCHAR(1000),
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "token" VARCHAR(400) NOT NULL,
    "app_version" VARCHAR(20),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name_fr" VARCHAR(80) NOT NULL,
    "name_ar" VARCHAR(80),
    "name_en" VARCHAR(80),
    "currency" CHAR(3) NOT NULL,
    "phone_prefix" VARCHAR(6) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "region_label_fr" VARCHAR(40) NOT NULL DEFAULT 'Région',
    "city_label_fr" VARCHAR(40) NOT NULL DEFAULT 'Ville',
    "is_catalogue_active" BOOLEAN NOT NULL DEFAULT false,
    "is_residence_option" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_ar" VARCHAR(120),
    "slug" VARCHAR(80) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "name_fr" VARCHAR(120) NOT NULL,
    "name_ar" VARCHAR(120),
    "slug" VARCHAR(80) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_times" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "origin_city" VARCHAR(80) NOT NULL,
    "origin_country_code" CHAR(2) NOT NULL,
    "airport_code" VARCHAR(4) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "is_direct" BOOLEAN NOT NULL,
    "note" VARCHAR(120),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "travel_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "from_currency" CHAR(3) NOT NULL,
    "to_currency" CHAR(3) NOT NULL,
    "kind" "ExchangeRateKind" NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "as_of" DATE NOT NULL,
    "source" VARCHAR(120),
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" VARCHAR(200),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "recurring" BOOLEAN NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legal_name" VARCHAR(160) NOT NULL,
    "brand_name" VARCHAR(160),
    "slug" VARCHAR(80) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "registration_number" VARCHAR(60),
    "tax_id" VARCHAR(60),
    "license_number" VARCHAR(60),
    "address_line" VARCHAR(200),
    "region_id" UUID,
    "city_id" UUID,
    "website" VARCHAR(200),
    "email" CITEXT,
    "phone" VARCHAR(20),
    "description_public" VARCHAR(2000),
    "references_public" VARCHAR(600),
    "founded_year" INTEGER,
    "delivered_units" INTEGER,
    "logo_media_id" UUID,
    "cover_media_id" UUID,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PROSPECT',
    "status_changed_at" TIMESTAMPTZ(3),
    "account_manager_id" UUID,
    "status_reason" VARCHAR(500),
    "access_level" "PartnerAccessLevel" NOT NULL DEFAULT 'MANAGED',
    "vetted_at" DATE,
    "vetted_by_id" UUID,
    "vetting_checklist" JSONB,
    "convention_signed_at" DATE,
    "convention_expires_at" DATE,
    "commission_terms" VARCHAR(1000),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "promoters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promoter_contacts" (
    "id" UUID NOT NULL,
    "promoter_id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "role" VARCHAR(80),
    "email" CITEXT,
    "phone" VARCHAR(20),
    "is_primary" BOOLEAN NOT NULL,
    "notes" VARCHAR(500),
    "answers_requests" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "promoter_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "short_name" VARCHAR(40),
    "slug" VARCHAR(80) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "logo_media_id" UUID,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PROSPECT',
    "status_changed_at" TIMESTAMPTZ(3),
    "status_reason" VARCHAR(500),
    "account_manager_id" UUID,
    "access_level" "PartnerAccessLevel" NOT NULL DEFAULT 'MANAGED',
    "convention_signed_at" DATE,
    "convention_expires_at" DATE,
    "description_public" VARCHAR(1500),
    "offers_islamic_finance" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "default_transmission_mode" "TransmissionMode" NOT NULL DEFAULT 'SECURE_LINK',
    "submission_email" CITEXT,
    "review_sla_days" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_contacts" (
    "id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "role" VARCHAR(80),
    "email" CITEXT,
    "phone" VARCHAR(20),
    "is_primary" BOOLEAN NOT NULL,
    "notes" VARCHAR(500),
    "agency" VARCHAR(120),
    "receives_submissions" BOOLEAN NOT NULL DEFAULT false,
    "answers_requests" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_products" (
    "id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "financing_type" "FinancingType" NOT NULL,
    "islamic_contract_label" VARCHAR(60),
    "pricing_method" "PricingMethod" NOT NULL DEFAULT 'AMORTIZED_RATE',
    "segment" "TargetSegment" NOT NULL DEFAULT 'DIASPORA',
    "property_country_code" CHAR(2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "nominal_rate_bps" INTEGER NOT NULL,
    "rate_bands" JSONB,
    "min_amount" DECIMAL(14,2) NOT NULL,
    "max_amount" DECIMAL(14,2) NOT NULL,
    "min_duration_months" INTEGER NOT NULL,
    "max_duration_months" INTEGER NOT NULL,
    "max_debt_ratio_pct" DECIMAL(5,2) NOT NULL,
    "min_down_payment_pct" DECIMAL(5,2) NOT NULL,
    "max_age_at_end" INTEGER,
    "min_monthly_income" DECIMAL(12,2),
    "eligible_residency" "ResidencyStatus"[] DEFAULT ARRAY[]::"ResidencyStatus"[],
    "accepted_income_currencies" CHAR(3)[] DEFAULT ARRAY[]::CHAR(3)[],
    "accepted_residence_countries" CHAR(2)[] DEFAULT ARRAY[]::CHAR(2)[],
    "insurance_rate_bps" INTEGER,
    "file_fee_fixed" DECIMAL(14,2),
    "file_fee_pct" DECIMAL(5,2),
    "other_fees_note" VARCHAR(500),
    "required_checklist_id" UUID,
    "is_example" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public_in_simulators" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_to" DATE,
    "rates_confirmed_at" TIMESTAMPTZ(3),
    "rates_confirmed_by" VARCHAR(160),
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" "PartnerCategory" NOT NULL,
    "logo_media_id" UUID,
    "url" VARCHAR(200),
    "description_public" VARCHAR(600),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_documents" (
    "id" UUID NOT NULL,
    "owner_type" "PartnerDocumentOwner" NOT NULL,
    "owner_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "scan_status" "ScanStatus" NOT NULL,
    "issued_at" DATE,
    "expires_at" DATE,
    "uploaded_by_id" UUID NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_answers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "gesture" "PartnerGesture" NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "dossier_id" UUID,
    "route" "GestureRoute" NOT NULL,
    "secure_share_id" UUID,
    "user_id" UUID,
    "contact_name" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "note" VARCHAR(1000),
    "status" "PartnerAnswerStatus" NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "applied_payload" JSONB,
    "review_note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "promoter_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "tagline" VARCHAR(160),
    "description" VARCHAR(5000),
    "standing" "Standing" NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "region_id" UUID NOT NULL,
    "city_id" UUID,
    "address_line" VARCHAR(200),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "delivery_status" "DeliveryStatus" NOT NULL,
    "delivery_date" DATE,
    "delivery_date_precision" "DatePrecision" NOT NULL DEFAULT 'QUARTER',
    "total_units" INTEGER,
    "amenities" VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR(40)[],
    "guarantees" VARCHAR(600),
    "highlight_label" VARCHAR(40),
    "highlight_until" DATE,
    "publication" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "first_published_at" TIMESTAMPTZ(3),
    "unpublished_by_suspension_at" TIMESTAMPTZ(3),
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(160),
    "lots_total" INTEGER NOT NULL DEFAULT 0,
    "lots_available" INTEGER NOT NULL DEFAULT 0,
    "lots_held" INTEGER NOT NULL DEFAULT 0,
    "lots_sold" INTEGER NOT NULL DEFAULT 0,
    "listed_property_count" INTEGER NOT NULL DEFAULT 0,
    "last_sold_at" TIMESTAMPTZ(3),
    "price_from" DECIMAL(14,2),
    "price_from_ref" DECIMAL(14,2),
    "stock_confirmed_at" TIMESTAMPTZ(3),
    "stock_confirmed_by" VARCHAR(160),
    "submitted_for_review_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "review_note" VARCHAR(1000),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "promoter_id" UUID NOT NULL,
    "program_id" UUID,
    "title" VARCHAR(120) NOT NULL,
    "title_auto" BOOLEAN NOT NULL,
    "description" VARCHAR(5000),
    "description_auto" BOOLEAN NOT NULL,
    "type" "PropertyType" NOT NULL,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "surface_m2" DECIMAL(8,2) NOT NULL,
    "terrace_m2" DECIMAL(8,2),
    "land_m2" DECIMAL(10,2),
    "features" VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR(40)[],
    "standing" "Standing" NOT NULL,
    "delivery_status" "DeliveryStatus" NOT NULL,
    "delivery_date" DATE,
    "delivery_date_precision" "DatePrecision" NOT NULL,
    "delivery_overridden" BOOLEAN NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "region_id" UUID NOT NULL,
    "city_id" UUID,
    "address_line" VARCHAR(200),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "price_currency" CHAR(3) NOT NULL,
    "highlight_label" VARCHAR(40),
    "highlight_until" DATE,
    "featured_rank" INTEGER,
    "publication" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "first_published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "unpublished_by_suspension_at" TIMESTAMPTZ(3),
    "unpublished_at" TIMESTAMPTZ(3),
    "program_cascade_at" TIMESTAMPTZ(3),
    "stock_confirmed_at" TIMESTAMPTZ(3),
    "stock_confirmed_by" VARCHAR(160),
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(160),
    "submitted_for_review_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,
    "review_note" VARCHAR(500),
    "relevance_score" INTEGER NOT NULL DEFAULT 0,
    "lots_total" INTEGER NOT NULL DEFAULT 0,
    "lots_available" INTEGER NOT NULL DEFAULT 0,
    "lots_taken" INTEGER NOT NULL DEFAULT 0,
    "availability" "Availability" NOT NULL,
    "availability_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "price_from" DECIMAL(14,2),
    "price_to" DECIMAL(14,2),
    "surface_min" DECIMAL(8,2),
    "surface_max" DECIMAL(8,2),
    "price_from_ref" DECIMAL(14,2),
    "down_payment_ref" DECIMAL(14,2),
    "monthly_from_ref" DECIMAL(12,2),
    "financing_eligible" BOOLEAN NOT NULL DEFAULT false,
    "islamic_financing_eligible" BOOLEAN NOT NULL DEFAULT false,
    "has360_tour" BOOLEAN NOT NULL DEFAULT false,
    "has_plan" BOOLEAN NOT NULL DEFAULT false,
    "has_video" BOOLEAN NOT NULL DEFAULT false,
    "photo_count" INTEGER NOT NULL DEFAULT 0,
    "completeness_score" INTEGER NOT NULL DEFAULT 0,
    "interest_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "search_text" TEXT NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "reference_pending" BOOLEAN NOT NULL DEFAULT false,
    "building" VARCHAR(40),
    "floor" INTEGER,
    "door" VARCHAR(20),
    "orientation" "Orientation",
    "surface_m2" DECIMAL(8,2) NOT NULL,
    "terrace_m2" DECIMAL(8,2),
    "land_m2" DECIMAL(10,2),
    "price" DECIMAL(14,2) NOT NULL,
    "price_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "status_note" VARCHAR(300),
    "external_sale" BOOLEAN NOT NULL DEFAULT false,
    "parking_included" BOOLEAN,
    "extras" VARCHAR(300),
    "plan_media_id" UUID,
    "delivered_at" DATE,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "owner_type" "MediaOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "is_public" BOOLEAN NOT NULL,
    "storage_key" VARCHAR(400),
    "external_url" VARCHAR(400),
    "file_name" VARCHAR(200),
    "mime_type" VARCHAR(100),
    "size_bytes" BIGINT,
    "checksum_sha256" CHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "renditions" JSONB,
    "alt" VARCHAR(200),
    "caption" VARCHAR(200),
    "room_label" VARCHAR(60),
    "is_cover" BOOLEAN NOT NULL,
    "is_illustration" BOOLEAN NOT NULL DEFAULT false,
    "taken_at" DATE,
    "sort_order" INTEGER NOT NULL,
    "processing_status" "ProcessingStatus" NOT NULL,
    "processing_error" VARCHAR(300),
    "uploaded_by_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_pois" (
    "id" UUID NOT NULL,
    "program_id" UUID,
    "property_id" UUID,
    "label" VARCHAR(120) NOT NULL,
    "category" "PoiCategory" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "mode" "TravelMode" NOT NULL DEFAULT 'CAR',
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "property_pois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_updates" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "stage" "ConstructionStage" NOT NULL,
    "percent" INTEGER NOT NULL,
    "note" VARCHAR(600),
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "program_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_eligibilities" (
    "id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "program_id" UUID,
    "property_id" UUID,
    "accepted" BOOLEAN NOT NULL,
    "note" VARCHAR(300),
    "checked_at" DATE NOT NULL,
    "checked_by_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financing_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slug_histories" (
    "id" UUID NOT NULL,
    "entity_type" "SlugEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "slug_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_daily_stats" (
    "property_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "interests" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "property_daily_stats_pkey" PRIMARY KEY ("property_id","day")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email" CITEXT,
    "alternate_emails" CITEXT[] DEFAULT ARRAY[]::CITEXT[],
    "email_doubtful" BOOLEAN NOT NULL DEFAULT false,
    "email_bounced_at" TIMESTAMPTZ(3),
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "phone" VARCHAR(20),
    "phone_check_needed" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "preferred_contact_channel" "ContactChannel",
    "preferred_contact_slot" "ContactTimeSlot",
    "timezone" VARCHAR(64),
    "country_of_residence" CHAR(2),
    "city_of_residence" VARCHAR(80),
    "nationalities" CHAR(2)[] DEFAULT ARRAY[]::CHAR(2)[],
    "residency_status" "ResidencyStatus",
    "birth_date" DATE,
    "preferred_language" "Locale" NOT NULL DEFAULT 'fr',
    "profession" VARCHAR(80),
    "employment_type" "EmploymentType",
    "employer_name" VARCHAR(120),
    "employed_since" DATE,
    "monthly_income" DECIMAL(12,2),
    "other_monthly_income" DECIMAL(12,2),
    "monthly_debts" DECIMAL(12,2),
    "income_currency" CHAR(3),
    "down_payment" DECIMAL(14,2),
    "down_payment_currency" CHAR(3),
    "budget_max" DECIMAL(14,2),
    "budget_currency" CHAR(3),
    "budget_monthly" DECIMAL(12,2),
    "budget_monthly_currency" CHAR(3),
    "preferred_countries" CHAR(2)[] DEFAULT ARRAY[]::CHAR(2)[],
    "preferred_region_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "preferred_types" "PropertyType"[] DEFAULT ARRAY[]::"PropertyType"[],
    "min_rooms" INTEGER,
    "purchase_purpose" "PurchasePurpose",
    "purchase_timeframe" "PurchaseTimeframe",
    "financing_preference" "FinancingPreference",
    "source" "LeadSource",
    "utm" JSONB,
    "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "qualified_at" TIMESTAMPTZ(3),
    "qualified_by_id" UUID,
    "score" INTEGER,
    "assigned_agent_id" UUID,
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact" BOOLEAN NOT NULL DEFAULT false,
    "do_not_contact_reason" VARCHAR(300),
    "do_not_contact_at" TIMESTAMPTZ(3),
    "merged_into_id" UUID,
    "not_duplicate_of_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL,
    "archived_at" TIMESTAMPTZ(3),
    "archived_reason" VARCHAR(300),
    "restricted_at" TIMESTAMPTZ(3),
    "restriction_reason" "RestrictionReason",
    "gdpr_erased_at" TIMESTAMPTZ(3),
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "relation" VARCHAR(60),
    "phone" VARCHAR(20),
    "email" CITEXT,
    "can_visit_on_behalf" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(300),
    "informed_confirmed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "kind" "LeadKind" NOT NULL,
    "source" "LeadSource" NOT NULL DEFAULT 'WEB_FORM',
    "client_id" UUID,
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "email" CITEXT,
    "phone" VARCHAR(20),
    "property_id" UUID,
    "program_id" UUID,
    "lot_id" UUID,
    "simulation_id" UUID,
    "applicant_user_id" UUID,
    "partner_kind" "PartnerDocumentOwner",
    "application_status" "PartnerApplicationStatus",
    "application" JSONB,
    "application_submitted_at" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL,
    "message" VARCHAR(2000),
    "subject" "ContactSubject",
    "preferred_callback_date" DATE,
    "preferred_slot" "ContactTimeSlot",
    "caller_timezone" VARCHAR(64),
    "supplements" JSONB,
    "locale" "Locale" NOT NULL,
    "utm" JSONB,
    "referrer" VARCHAR(400),
    "landing_path" VARCHAR(400),
    "submitted_from_path" VARCHAR(400),
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(400),
    "spam_score" INTEGER NOT NULL,
    "spam_signals" JSONB NOT NULL,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "completion_token_hash" CHAR(64),
    "completion_expires_at" TIMESTAMPTZ(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "dossier_id" UUID,
    "context_dossier_id" UUID,
    "assigned_agent_id" UUID,
    "taken_at" TIMESTAMPTZ(3),
    "first_contact_at" TIMESTAMPTZ(3),
    "sla_due_at" TIMESTAMPTZ(3),
    "sla_breached_at" TIMESTAMPTZ(3),
    "outcome" "LeadOutcome",
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,
    "close_note" VARCHAR(500),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_files" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "section" VARCHAR(30) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "scan_status" "ScanStatus" NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "client_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("client_id","property_id")
);

-- CreateTable
CREATE TABLE "search_alerts" (
    "id" UUID NOT NULL,
    "client_id" UUID,
    "email" CITEXT NOT NULL,
    "label" VARCHAR(120),
    "criteria" JSONB NOT NULL,
    "frequency" "AlertFrequency" NOT NULL DEFAULT 'DAILY',
    "is_active" BOOLEAN NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "unsubscribe_token_hash" CHAR(64) NOT NULL,
    "last_sent_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "expiry_notice_sent_at" TIMESTAMPTZ(3),
    "deactivated_at" TIMESTAMPTZ(3),
    "deactivated_reason" "AlertDeactivationReason",
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "search_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_deliveries" (
    "alert_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "sent_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("alert_id","property_id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "entity_type" "NoteEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "author_id" UUID NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "client_id" UUID NOT NULL,
    "origin_lead_id" UUID,
    "stage" "DossierStage" NOT NULL DEFAULT 'INTEREST',
    "status" "DossierStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_agent_id" UUID,
    "property_id" UUID,
    "lot_id" UUID,
    "program_id" UUID,
    "promoter_id" UUID,
    "property_country_code" CHAR(2),
    "financing_requested" BOOLEAN NOT NULL,
    "financing_type" "FinancingPreference",
    "purchase_price" DECIMAL(14,2),
    "purchase_currency" CHAR(3),
    "down_payment" DECIMAL(14,2),
    "down_payment_currency" CHAR(3),
    "loan_amount_requested" DECIMAL(14,2),
    "loan_currency" CHAR(3),
    "reminders_paused" BOOLEAN NOT NULL DEFAULT false,
    "duration_months" INTEGER,
    "checklist_template_id" UUID,
    "checklist_template_version" INTEGER,
    "checklist_instantiated_at" TIMESTAMPTZ(3),
    "required_docs_count" INTEGER NOT NULL DEFAULT 0,
    "satisfied_docs_count" INTEGER NOT NULL DEFAULT 0,
    "completeness_pct" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3),
    "first_contact_at" TIMESTAMPTZ(3),
    "qualified_at" TIMESTAMPTZ(3),
    "stage_entered_at" TIMESTAMPTZ(3) NOT NULL,
    "sla_due_at" TIMESTAMPTZ(3),
    "sla_paused_remaining_minutes" INTEGER,
    "last_activity_at" TIMESTAMPTZ(3) NOT NULL,
    "hold_reason" "HoldReason",
    "hold_note" VARCHAR(500),
    "hold_until" DATE,
    "hold_client_note" VARCHAR(300),
    "held_at" TIMESTAMPTZ(3),
    "accepted_submission_id" UUID,
    "conditions_accepted_at" TIMESTAMPTZ(3),
    "signing_scheduled_for" TIMESTAMPTZ(3),
    "deed_signed_at" DATE,
    "keys_handed_at" DATE,
    "won_at" TIMESTAMPTZ(3),
    "lost_at" TIMESTAMPTZ(3),
    "lost_reason" "LostReason",
    "lost_note" VARCHAR(500),
    "sale_amount" DECIMAL(14,2),
    "sale_currency" CHAR(3),
    "commission_amount" DECIMAL(14,2),
    "commission_currency" CHAR(3),
    "client_fee_amount" DECIMAL(14,2),
    "client_fee_currency" CHAR(3),
    "client_next_step" VARCHAR(300),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_parties" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "role" "PartyRole" NOT NULL,
    "client_id" UUID,
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "relationship" VARCHAR(60),
    "birth_date" DATE,
    "email" CITEXT,
    "phone" VARCHAR(20),
    "country_of_residence" CHAR(2),
    "residency_status" "ResidencyStatus",
    "employment_type" "EmploymentType",
    "profession" VARCHAR(80),
    "monthly_income" DECIMAL(12,2),
    "monthly_debts" DECIMAL(12,2),
    "income_currency" CHAR(3),
    "sort_order" INTEGER NOT NULL,
    "removed_at" TIMESTAMPTZ(3),
    "restricted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dossier_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_stage_histories" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "from_stage" "DossierStage",
    "to_stage" "DossierStage" NOT NULL,
    "from_status" "DossierStatus",
    "to_status" "DossierStatus" NOT NULL,
    "is_backward" BOOLEAN NOT NULL,
    "reason" VARCHAR(500),
    "actor_type" "ActorType" NOT NULL,
    "changed_by_id" UUID,
    "changed_at" TIMESTAMPTZ(3) NOT NULL,
    "seconds_in_previous_stage" BIGINT,
    "business_minutes_in_previous_stage" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dossier_stage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_candidates" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "lot_id" UUID,
    "origin" "CandidateOrigin" NOT NULL,
    "lead_id" UUID,
    "proposed_by_id" UUID,
    "message" VARCHAR(1000),
    "sent_at" TIMESTAMPTZ(3),
    "status" "CandidateStatus" NOT NULL,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "viewed_at" TIMESTAMPTZ(3),
    "selection_requested_at" TIMESTAMPTZ(3),
    "selection_decline_note" VARCHAR(500),
    "client_comment" VARCHAR(1000),
    "decline_reason" "DeclineReason",
    "decline_note" VARCHAR(500),
    "advisor_note" VARCHAR(1000),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dossier_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "lot_id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'OPTION',
    "option_expires_at" TIMESTAMPTZ(3),
    "option_extended_count" INTEGER NOT NULL DEFAULT 0,
    "option_acknowledged_at" TIMESTAMPTZ(3),
    "option_acknowledged_by" VARCHAR(160),
    "agreed_price" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL,
    "reserved_at" TIMESTAMPTZ(3),
    "deposit_amount" DECIMAL(14,2),
    "deposit_currency" CHAR(3),
    "deposit_paid_at" DATE,
    "deposit_proof_document_id" UUID,
    "deposit_refund_status" "DepositRefundStatus" NOT NULL DEFAULT 'NONE',
    "deposit_refunded_amount" DECIMAL(14,2),
    "deposit_refunded_at" DATE,
    "deposit_refund_proof_document_id" UUID,
    "deposit_refund_note" VARCHAR(500),
    "contract_document_id" UUID,
    "promoter_confirmed_at" TIMESTAMPTZ(3),
    "promoter_confirmed_by" VARCHAR(160),
    "contractual_delivery_date" DATE,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "type" "AppointmentType" NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "client_id" UUID NOT NULL,
    "dossier_id" UUID,
    "candidate_id" UUID,
    "property_id" UUID,
    "staff_user_id" UUID,
    "requested_slots" JSONB,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "timezone" VARCHAR(64) NOT NULL,
    "place_timezone" VARCHAR(64),
    "client_notified_at" TIMESTAMPTZ(3),
    "location_text" VARCHAR(200),
    "host_name" VARCHAR(160),
    "host_phone" VARCHAR(20),
    "meeting_url" VARCHAR(400),
    "on_behalf_contact_id" UUID,
    "client_note" VARCHAR(1000),
    "internal_note" VARCHAR(1000),
    "outcome_note" VARCHAR(1000),
    "cancelled_by" "CancelledBy",
    "cancel_reason" VARCHAR(300),
    "reminder_sent_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_timeline_entries" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "kind" "ClientTimelineKind" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "params" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "scope" "ChecklistScope" NOT NULL,
    "bank_id" UUID,
    "country_code" CHAR(2),
    "residency_filter" "ResidencyStatus"[] DEFAULT ARRAY[]::"ResidencyStatus"[],
    "financing_type_filter" "FinancingType",
    "is_default" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" VARCHAR(500),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "added_in_version" INTEGER NOT NULL,
    "retired_in_version" INTEGER,
    "code" VARCHAR(60) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "label_when_cash" VARCHAR(160),
    "description" VARCHAR(600),
    "category" "DocumentCategory" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "per_party" BOOLEAN NOT NULL DEFAULT false,
    "applies_to_roles" "PartyRole"[] DEFAULT ARRAY['PRIMARY', 'CO_BORROWER']::"PartyRole"[],
    "applies_when" JSONB,
    "provided_by" "DocumentProvider" NOT NULL DEFAULT 'CLIENT',
    "max_files" INTEGER NOT NULL DEFAULT 5,
    "accepted_formats" VARCHAR(10)[] DEFAULT ARRAY['pdf', 'jpg', 'jpeg', 'png', 'heic']::VARCHAR(10)[],
    "validity_days" INTEGER,
    "example_media_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_documents" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "party_id" UUID,
    "checklist_item_id" UUID,
    "code" VARCHAR(60),
    "label" VARCHAR(160) NOT NULL,
    "label_edited" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(600),
    "category" "DocumentCategory" NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "provided_by" "DocumentProvider" NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "submission_id" UUID,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "max_files" INTEGER NOT NULL,
    "accepted_formats" VARCHAR(10)[] DEFAULT ARRAY[]::VARCHAR(10)[],
    "validity_days" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "due_at" DATE,
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "reminder_base_at" TIMESTAMPTZ(3),
    "last_reminded_at" TIMESTAMPTZ(3),
    "reminders_paused" BOOLEAN NOT NULL DEFAULT false,
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "renewal_version" INTEGER,
    "transmitted_version" INTEGER,
    "rejection_reason" "RejectionReason",
    "rejection_note" VARCHAR(500),
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(3),
    "issued_at" DATE,
    "expires_at" DATE,
    "waived_by_id" UUID,
    "waive_reason" VARCHAR(300),
    "waive_kind" "WaiveKind",
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "dossier_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "uploaded_by_id" UUID,
    "uploaded_via" "UploadChannel" NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "VersionOutcome" NOT NULL DEFAULT 'SCANNING',
    "is_renewal" BOOLEAN NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "rejection_reason" "RejectionReason",
    "rejection_note" VARCHAR(500),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "delete_reason" VARCHAR(300),
    "files_purged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "page_count" INTEGER,
    "assembled_from_images" INTEGER,
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_checked_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_reminders" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "reminded_at" TIMESTAMPTZ(3) NOT NULL,
    "is_manual" BOOLEAN NOT NULL,
    "triggered_by_id" UUID,
    "document_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "counted_document_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "communication_id" UUID,
    "skip_reason" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_submissions" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "dossier_id" UUID NOT NULL,
    "bank_id" UUID NOT NULL,
    "bank_product_id" UUID,
    "financing_type" "FinancingType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "transmission_mode" "TransmissionMode" NOT NULL,
    "recipient_contact_id" UUID,
    "recipient_email" CITEXT,
    "requested_amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "requested_duration_months" INTEGER NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "manual_transmission_means" VARCHAR(120),
    "bank_reference" VARCHAR(60),
    "expected_decision_at" DATE,
    "follow_up_count" INTEGER NOT NULL DEFAULT 0,
    "last_follow_up_at" TIMESTAMPTZ(3),
    "info_requested_at" TIMESTAMPTZ(3),
    "info_request_note" VARCHAR(4000),
    "decision_at" TIMESTAMPTZ(3),
    "decision_published_at" TIMESTAMPTZ(3),
    "approved_amount" DECIMAL(14,2),
    "approved_rate_bps" INTEGER,
    "approved_duration_months" INTEGER,
    "approved_pricing_method" "PricingMethod",
    "approved_insurance_rate_bps" INTEGER,
    "approved_file_fees" DECIMAL(14,2),
    "monthly_payment" DECIMAL(14,2),
    "offer_valid_until" DATE,
    "accept_requested_at" TIMESTAMPTZ(3),
    "conditions" VARCHAR(2000),
    "offer_document_id" UUID,
    "rejection_reason" VARCHAR(500),
    "share_rejection_reason" BOOLEAN NOT NULL DEFAULT false,
    "decision_notes" VARCHAR(2000),
    "accepted_by_client_at" TIMESTAMPTZ(3),
    "declined_by_client_at" TIMESTAMPTZ(3),
    "withdrawn_at" TIMESTAMPTZ(3),
    "withdraw_reason" VARCHAR(300),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_documents" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "dossier_document_id" UUID NOT NULL,
    "checklist_item_code" VARCHAR(60),
    "is_included" BOOLEAN NOT NULL,
    "included_version" INTEGER,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submission_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_packages" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "summary_storage_key" VARCHAR(400) NOT NULL,
    "is_complement" BOOLEAN NOT NULL DEFAULT false,
    "manifest" JSONB NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "generated_by_id" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL,
    "purge_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submission_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secure_shares" (
    "id" UUID NOT NULL,
    "purpose" "SharePurpose" NOT NULL,
    "package_id" UUID,
    "export_job_id" UUID,
    "organization_id" UUID,
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "gestures" "PartnerGesture"[] DEFAULT ARRAY[]::"PartnerGesture"[],
    "answer_until" TIMESTAMPTZ(3),
    "reminded_at" TIMESTAMPTZ(3),
    "token_hash" CHAR(64) NOT NULL,
    "recipient_email" CITEXT NOT NULL,
    "recipient_name" VARCHAR(160),
    "access_code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "max_downloads" INTEGER NOT NULL DEFAULT 5,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "failed_code_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "last_access_at" TIMESTAMPTZ(3),
    "revoked_by_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "secure_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_submission_events" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "type" "SubmissionEventType" NOT NULL,
    "from_status" "SubmissionStatus",
    "to_status" "SubmissionStatus",
    "note" VARCHAR(2000),
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "reported_by" VARCHAR(160),
    "route" "GestureRoute",
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" UUID NOT NULL,
    "type" "SimulationType" NOT NULL,
    "client_id" UUID,
    "dossier_id" UUID,
    "lead_id" UUID,
    "property_id" UUID,
    "lot_id" UUID,
    "bank_product_id" UUID,
    "anonymous_id" VARCHAR(64),
    "label" VARCHAR(120),
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "parameters_snapshot" JSONB NOT NULL,
    "is_saved" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "sent_at" TIMESTAMPTZ(3),
    "pdf_storage_key" VARCHAR(400),
    "locale" "Locale" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "locale" "Locale" NOT NULL,
    "audience" "EmailAudience" NOT NULL,
    "category" "EmailTemplateCategory" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(300),
    "subject" VARCHAR(200) NOT NULL,
    "preheader" VARCHAR(160),
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "variables" VARCHAR(60)[] DEFAULT ARRAY[]::VARCHAR(60)[],
    "required_variables" VARCHAR(60)[] DEFAULT ARRAY[]::VARCHAR(60)[],
    "secret_variables" VARCHAR(60)[] DEFAULT ARRAY[]::VARCHAR(60)[],
    "preference_group" VARCHAR(40),
    "origin_subject" TEXT,
    "origin_preheader" TEXT,
    "origin_body_html" TEXT,
    "is_system" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "sent_by" "TriggerKind"[] DEFAULT ARRAY[]::"TriggerKind"[],
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "preheader" VARCHAR(160),
    "body_html" TEXT NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "direction" "Direction" NOT NULL DEFAULT 'OUTBOUND',
    "client_id" UUID,
    "dossier_id" UUID,
    "lead_id" UUID,
    "submission_id" UUID,
    "event_id" UUID,
    "registration_id" UUID,
    "simulation_id" UUID,
    "promoter_id" UUID,
    "bank_id" UUID,
    "feedback_id" UUID,
    "data_request_id" UUID,
    "export_job_id" UUID,
    "staff_user_id" UUID,
    "template_code" VARCHAR(60),
    "template_version" INTEGER,
    "subject" VARCHAR(200),
    "body" TEXT,
    "to_address" CITEXT,
    "cc_addresses" CITEXT[],
    "from_address" CITEXT,
    "reply_to" CITEXT,
    "attachments" JSONB,
    "provider_message_id" VARCHAR(200),
    "delivery_state" "DeliveryState" DEFAULT 'QUEUED',
    "triggered_by" "TriggerKind" NOT NULL,
    "rule_id" UUID,
    "sent_by_id" UUID,
    "scheduled_for" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "opened_at" TIMESTAMPTZ(3),
    "clicked_at" TIMESTAMPTZ(3),
    "failed_at" TIMESTAMPTZ(3),
    "failure_reason" VARCHAR(300),
    "cancelled_at" TIMESTAMPTZ(3),
    "bounced_at" TIMESTAMPTZ(3),
    "complained_at" TIMESTAMPTZ(3),
    "state_history" JSONB NOT NULL DEFAULT '[]',
    "resent_from_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_minutes" INTEGER,
    "call_outcome" "CallOutcome",
    "dedupe_key" VARCHAR(200),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_webhook_events" (
    "id" UUID NOT NULL,
    "provider_event_id" VARCHAR(200) NOT NULL,
    "provider_message_id" VARCHAR(200) NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "dossier_id" UUID,
    "partner_organization_id" UUID,
    "last_message_at" TIMESTAMPTZ(3),
    "last_message_preview" VARCHAR(160),
    "unread_by_client" INTEGER NOT NULL DEFAULT 0,
    "unread_by_staff" INTEGER NOT NULL DEFAULT 0,
    "client_emailed_at" TIMESTAMPTZ(3),
    "staff_emailed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" "MessageSenderType" NOT NULL,
    "sender_user_id" UUID,
    "body" VARCHAR(4000) NOT NULL,
    "read_by_client_at" TIMESTAMPTZ(3),
    "read_by_staff_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "scan_status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "filed_as_document_id" UUID,
    "files_purged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "title_plural" VARCHAR(160),
    "body" VARCHAR(400),
    "link" VARCHAR(400),
    "entity_type" VARCHAR(40),
    "entity_id" UUID,
    "count" INTEGER NOT NULL DEFAULT 1,
    "dedupe_key" VARCHAR(200),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "client_id" UUID,
    "group" VARCHAR(40) NOT NULL,
    "email_enabled" BOOLEAN NOT NULL,
    "push_enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60),
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "trigger" VARCHAR(60) NOT NULL,
    "conditions" JSONB,
    "delay_value" INTEGER NOT NULL DEFAULT 0,
    "delay_unit" "DelayUnit" NOT NULL DEFAULT 'MINUTES',
    "actions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "is_system" BOOLEAN NOT NULL,
    "origin_definition" JSONB,
    "sort_order" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "trigger_event_id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "executed_at" TIMESTAMPTZ(3),
    "status" "ExecutionStatus" NOT NULL,
    "skip_reason" VARCHAR(200),
    "error" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "actions_done" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "type" "TaskType" NOT NULL DEFAULT 'FOLLOW_UP',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "dossier_id" UUID,
    "client_id" UUID,
    "lead_id" UUID,
    "submission_id" UUID,
    "event_id" UUID,
    "property_id" UUID,
    "promoter_id" UUID,
    "bank_id" UUID,
    "bank_product_id" UUID,
    "appointment_id" UUID,
    "reservation_id" UUID,
    "feedback_id" UUID,
    "suggested_template_code" VARCHAR(60),
    "assignee_id" UUID,
    "created_by_id" UUID,
    "origin" "TaskOrigin" NOT NULL,
    "rule_id" UUID,
    "dedupe_key" VARCHAR(120),
    "due_at" TIMESTAMPTZ(3),
    "due_has_time" BOOLEAN NOT NULL DEFAULT true,
    "reminder_kind" "ReminderKind" NOT NULL DEFAULT 'AT_DUE',
    "remind_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_id" UUID,
    "completion_note" VARCHAR(1000),
    "cancel_reason" VARCHAR(300),
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "trigger" "SurveyTrigger" NOT NULL,
    "delay_hours" INTEGER NOT NULL,
    "intro" VARCHAR(400),
    "origin_definition" JSONB,
    "questions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_invitations" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "dossier_id" UUID,
    "event_id" UUID,
    "token_hash" CHAR(64) NOT NULL,
    "reminder_token_hash" CHAR(64),
    "scheduled_for" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "reminder_sent_at" TIMESTAMPTZ(3),
    "answered_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" "SurveyCancelReason",
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "survey_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" UUID NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "survey_id" UUID,
    "invitation_id" UUID,
    "client_id" UUID,
    "dossier_id" UUID,
    "property_id" UUID,
    "event_id" UUID,
    "promoter_id" UUID,
    "bank_id" UUID,
    "author_organization_id" UUID,
    "stage" "DossierStage",
    "nps_score" INTEGER,
    "csat_score" INTEGER,
    "answers" JSONB,
    "comment" VARCHAR(3000),
    "category" "FeedbackCategory",
    "contact_email" CITEXT,
    "listing_error_kind" "ListingErrorKind",
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "handled_by_id" UUID,
    "handled_at" TIMESTAMPTZ(3),
    "action_note" VARCHAR(1000),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(24) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "location_label" VARCHAR(80) NOT NULL,
    "city_name" VARCHAR(80) NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'FR',
    "venue_name" VARCHAR(160),
    "venue_address" VARCHAR(300),
    "venue_notes" VARCHAR(500),
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Paris',
    "capacity" INTEGER NOT NULL,
    "max_seats_per_registration" INTEGER NOT NULL,
    "registration_opens_at" TIMESTAMPTZ(3),
    "registration_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "description" VARCHAR(3000),
    "cover_media_id" UUID,
    "host_user_id" UUID,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(500),
    "seats_taken" INTEGER NOT NULL DEFAULT 0,
    "waitlist_seats" INTEGER NOT NULL DEFAULT 0,
    "attended_seats" INTEGER NOT NULL DEFAULT 0,
    "walk_in_seats" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_partners" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "promoter_id" UUID,
    "bank_id" UUID,
    "partner_id" UUID,
    "role_label" VARCHAR(80),
    "contact_name" VARCHAR(160),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(20),
    "seats" INTEGER NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "questions" VARCHAR(1000),
    "topics" "EventTopic"[] DEFAULT ARRAY[]::"EventTopic"[],
    "source" "LeadSource" NOT NULL,
    "manage_token_hash" CHAR(64) NOT NULL,
    "check_in_code" VARCHAR(8) NOT NULL,
    "registered_at" TIMESTAMPTZ(3) NOT NULL,
    "promoted_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by" "CancelledBy",
    "cancel_reason" VARCHAR(300),
    "attended_at" TIMESTAMPTZ(3),
    "checked_in_by_id" UUID,
    "reminder7_sent_at" TIMESTAMPTZ(3),
    "reminder1_sent_at" TIMESTAMPTZ(3),
    "follow_up_sent_at" TIMESTAMPTZ(3),
    "utm" JSONB,
    "locale" "Locale" NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_notify_requests" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "event_id" UUID,
    "location_label" VARCHAR(80),
    "client_id" UUID,
    "notified_at" TIMESTAMPTZ(3),
    "unsubscribe_token_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_notify_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "locale" "Locale" NOT NULL,
    "type" "ContentBlockType" NOT NULL,
    "value" JSONB NOT NULL,
    "origin_value" JSONB,
    "label" VARCHAR(160) NOT NULL,
    "group" VARCHAR(60) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_block_versions" (
    "id" UUID NOT NULL,
    "block_id" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_block_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "locale" "Locale" NOT NULL,
    "kind" "PageKind" NOT NULL DEFAULT 'EDITORIAL',
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "seo_title" VARCHAR(70),
    "seo_description" VARCHAR(160),
    "status" "PublicationStatus" NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" UUID NOT NULL,
    "locale" "Locale" NOT NULL,
    "category" "FaqCategory" NOT NULL,
    "question" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "answer" VARCHAR(3000) NOT NULL,
    "placements" "FaqPlacement"[] DEFAULT ARRAY[]::"FaqPlacement"[],
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL,
    "required_feature" VARCHAR(60),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "residence_city" VARCHAR(80),
    "purchase_summary" VARCHAR(120),
    "quote" VARCHAR(600) NOT NULL,
    "photo_media_id" UUID,
    "client_id" UUID,
    "consent_at" DATE,
    "keep_after_erasure_consent_at" DATE,
    "is_published" BOOLEAN NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "requires_reacceptance" BOOLEAN NOT NULL DEFAULT true,
    "change_summary" VARCHAR(500),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" UUID NOT NULL,
    "from_path" VARCHAR(400) NOT NULL,
    "to_path" VARCHAR(400) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID NOT NULL,
    "field" VARCHAR(60) NOT NULL,
    "locale" "Locale" NOT NULL,
    "value" TEXT NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(20),
    "elevation_audit_id" UUID,
    "route" "GestureRoute",
    "partner_organization_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" UUID,
    "entity_label" VARCHAR(200),
    "client_id" UUID,
    "dossier_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(500),
    "request_id" VARCHAR(40),
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "aggregate_type" VARCHAR(40) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" VARCHAR(200),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "available_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "claimed_at" TIMESTAMPTZ(3),
    "parked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "scope" VARCHAR(250) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER,
    "response_body" JSONB,
    "user_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "name" VARCHAR(40) NOT NULL,
    "scope" VARCHAR(10) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("name","scope")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(20) NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "client_id" UUID,
    "requester_email" CITEXT NOT NULL,
    "details" VARCHAR(2000),
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "due_at" DATE NOT NULL,
    "identity_verified_at" TIMESTAMPTZ(3),
    "verification_method" VARCHAR(300),
    "handled_by_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(500),
    "outcome_note" VARCHAR(2000),
    "requester_message" VARCHAR(1000),
    "erasure_result" JSONB,
    "export_job_id" UUID,
    "notes" VARCHAR(2000),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "list_key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "owner_id" UUID NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_view_defaults" (
    "user_id" UUID NOT NULL,
    "list_key" VARCHAR(60) NOT NULL,
    "view_key" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saved_view_defaults_pkey" PRIMARY KEY ("user_id","list_key")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_name" VARCHAR(60) NOT NULL,
    "status" "JobStatus" NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "counters" JSONB,
    "error" VARCHAR(500),
    "triggered_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "file_storage_key" VARCHAR(300) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "target" JSONB NOT NULL,
    "mapping" JSONB NOT NULL,
    "dry_run" BOOLEAN NOT NULL,
    "total_rows" INTEGER,
    "valid_rows" INTEGER,
    "flagged_rows" INTEGER,
    "error_rows" INTEGER,
    "created_count" INTEGER,
    "updated_count" INTEGER,
    "report" JSONB,
    "created_by_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" UUID NOT NULL,
    "type" "ExportType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "filters" JSONB NOT NULL,
    "storage_key" VARCHAR(400),
    "row_count" INTEGER,
    "requested_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "downloaded_at" TIMESTAMPTZ(3),
    "error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "owner_type" "UploadTarget" NOT NULL,
    "owner_id" UUID NOT NULL,
    "requested_by_id" UUID,
    "file_name" VARCHAR(200) NOT NULL,
    "declared_mime_type" VARCHAR(100) NOT NULL,
    "declared_size_bytes" BIGINT NOT NULL,
    "declared_sha256" CHAR(64) NOT NULL,
    "storage_key" VARCHAR(400) NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "result_file_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_kind_idx" ON "users"("kind");

-- CreateIndex
CREATE INDEX "users_avatar_media_id_idx" ON "users"("avatar_media_id");

-- CreateIndex
CREATE INDEX "users_created_by_id_idx" ON "users"("created_by_id");

-- CreateIndex
CREATE INDEX "users_updated_by_id_idx" ON "users"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_created_by_id_idx" ON "organizations"("created_by_id");

-- CreateIndex
CREATE INDEX "organizations_updated_by_id_idx" ON "organizations"("updated_by_id");

-- CreateIndex
CREATE INDEX "memberships_organization_id_role_idx" ON "memberships"("organization_id", "role");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE INDEX "memberships_invited_by_id_idx" ON "memberships"("invited_by_id");

-- CreateIndex
CREATE INDEX "memberships_created_by_id_idx" ON "memberships"("created_by_id");

-- CreateIndex
CREATE INDEX "memberships_updated_by_id_idx" ON "memberships"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_impersonated_by_id_idx" ON "sessions"("impersonated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_email_purpose_idx" ON "auth_tokens"("email", "purpose");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "consents_user_id_idx" ON "consents"("user_id");

-- CreateIndex
CREATE INDEX "consents_client_id_idx" ON "consents"("client_id");

-- CreateIndex
CREATE INDEX "consents_lead_id_idx" ON "consents"("lead_id");

-- CreateIndex
CREATE INDEX "consents_registration_id_idx" ON "consents"("registration_id");

-- CreateIndex
CREATE INDEX "consents_party_id_idx" ON "consents"("party_id");

-- CreateIndex
CREATE INDEX "consents_source_communication_id_idx" ON "consents"("source_communication_id");

-- CreateIndex
CREATE INDEX "consents_recorded_by_id_idx" ON "consents"("recorded_by_id");

-- CreateIndex
CREATE INDEX "consents_proof_document_id_idx" ON "consents"("proof_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_token_key" ON "push_devices"("token");

-- CreateIndex
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");

-- CreateIndex
CREATE INDEX "countries_created_by_id_idx" ON "countries"("created_by_id");

-- CreateIndex
CREATE INDEX "countries_updated_by_id_idx" ON "countries"("updated_by_id");

-- CreateIndex
CREATE INDEX "regions_created_by_id_idx" ON "regions"("created_by_id");

-- CreateIndex
CREATE INDEX "regions_updated_by_id_idx" ON "regions"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "regions_country_code_code_key" ON "regions"("country_code", "code");

-- CreateIndex
CREATE UNIQUE INDEX "regions_country_code_slug_key" ON "regions"("country_code", "slug");

-- CreateIndex
CREATE INDEX "cities_created_by_id_idx" ON "cities"("created_by_id");

-- CreateIndex
CREATE INDEX "cities_updated_by_id_idx" ON "cities"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "cities_region_id_slug_key" ON "cities"("region_id", "slug");

-- CreateIndex
CREATE INDEX "travel_times_created_by_id_idx" ON "travel_times"("created_by_id");

-- CreateIndex
CREATE INDEX "travel_times_updated_by_id_idx" ON "travel_times"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "travel_times_region_id_origin_city_key" ON "travel_times"("region_id", "origin_city");

-- CreateIndex
CREATE INDEX "exchange_rates_from_currency_to_currency_kind_as_of_created_idx" ON "exchange_rates"("from_currency", "to_currency", "kind", "as_of" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "exchange_rates_voided_by_id_idx" ON "exchange_rates"("voided_by_id");

-- CreateIndex
CREATE INDEX "exchange_rates_created_by_id_idx" ON "exchange_rates"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "holidays_created_by_id_idx" ON "holidays"("created_by_id");

-- CreateIndex
CREATE INDEX "holidays_updated_by_id_idx" ON "holidays"("updated_by_id");

-- CreateIndex
CREATE INDEX "promoters_organization_id_idx" ON "promoters"("organization_id");

-- CreateIndex
CREATE INDEX "promoters_country_code_idx" ON "promoters"("country_code");

-- CreateIndex
CREATE INDEX "promoters_region_id_idx" ON "promoters"("region_id");

-- CreateIndex
CREATE INDEX "promoters_city_id_idx" ON "promoters"("city_id");

-- CreateIndex
CREATE INDEX "promoters_logo_media_id_idx" ON "promoters"("logo_media_id");

-- CreateIndex
CREATE INDEX "promoters_cover_media_id_idx" ON "promoters"("cover_media_id");

-- CreateIndex
CREATE INDEX "promoters_account_manager_id_idx" ON "promoters"("account_manager_id");

-- CreateIndex
CREATE INDEX "promoters_vetted_by_id_idx" ON "promoters"("vetted_by_id");

-- CreateIndex
CREATE INDEX "promoters_created_by_id_idx" ON "promoters"("created_by_id");

-- CreateIndex
CREATE INDEX "promoters_updated_by_id_idx" ON "promoters"("updated_by_id");

-- CreateIndex
CREATE INDEX "promoter_contacts_promoter_id_idx" ON "promoter_contacts"("promoter_id");

-- CreateIndex
CREATE INDEX "promoter_contacts_user_id_idx" ON "promoter_contacts"("user_id");

-- CreateIndex
CREATE INDEX "promoter_contacts_created_by_id_idx" ON "promoter_contacts"("created_by_id");

-- CreateIndex
CREATE INDEX "promoter_contacts_updated_by_id_idx" ON "promoter_contacts"("updated_by_id");

-- CreateIndex
CREATE INDEX "banks_organization_id_idx" ON "banks"("organization_id");

-- CreateIndex
CREATE INDEX "banks_country_code_idx" ON "banks"("country_code");

-- CreateIndex
CREATE INDEX "banks_logo_media_id_idx" ON "banks"("logo_media_id");

-- CreateIndex
CREATE INDEX "banks_account_manager_id_idx" ON "banks"("account_manager_id");

-- CreateIndex
CREATE INDEX "banks_created_by_id_idx" ON "banks"("created_by_id");

-- CreateIndex
CREATE INDEX "banks_updated_by_id_idx" ON "banks"("updated_by_id");

-- CreateIndex
CREATE INDEX "bank_contacts_bank_id_idx" ON "bank_contacts"("bank_id");

-- CreateIndex
CREATE INDEX "bank_contacts_user_id_idx" ON "bank_contacts"("user_id");

-- CreateIndex
CREATE INDEX "bank_contacts_created_by_id_idx" ON "bank_contacts"("created_by_id");

-- CreateIndex
CREATE INDEX "bank_contacts_updated_by_id_idx" ON "bank_contacts"("updated_by_id");

-- CreateIndex
CREATE INDEX "bank_products_bank_id_idx" ON "bank_products"("bank_id");

-- CreateIndex
CREATE INDEX "bank_products_property_country_code_idx" ON "bank_products"("property_country_code");

-- CreateIndex
CREATE INDEX "bank_products_required_checklist_id_idx" ON "bank_products"("required_checklist_id");

-- CreateIndex
CREATE INDEX "bank_products_created_by_id_idx" ON "bank_products"("created_by_id");

-- CreateIndex
CREATE INDEX "bank_products_updated_by_id_idx" ON "bank_products"("updated_by_id");

-- CreateIndex
CREATE INDEX "partners_logo_media_id_idx" ON "partners"("logo_media_id");

-- CreateIndex
CREATE INDEX "partners_created_by_id_idx" ON "partners"("created_by_id");

-- CreateIndex
CREATE INDEX "partners_updated_by_id_idx" ON "partners"("updated_by_id");

-- CreateIndex
CREATE INDEX "partner_documents_owner_type_owner_id_idx" ON "partner_documents"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "partner_documents_uploaded_by_id_idx" ON "partner_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "partner_documents_created_by_id_idx" ON "partner_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "partner_documents_updated_by_id_idx" ON "partner_documents"("updated_by_id");

-- CreateIndex
CREATE INDEX "partner_answers_organization_id_status_idx" ON "partner_answers"("organization_id", "status");

-- CreateIndex
CREATE INDEX "partner_answers_entity_type_entity_id_idx" ON "partner_answers"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "partner_answers_dossier_id_idx" ON "partner_answers"("dossier_id");

-- CreateIndex
CREATE INDEX "partner_answers_secure_share_id_idx" ON "partner_answers"("secure_share_id");

-- CreateIndex
CREATE INDEX "partner_answers_user_id_idx" ON "partner_answers"("user_id");

-- CreateIndex
CREATE INDEX "partner_answers_reviewed_by_id_idx" ON "partner_answers"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "programs_promoter_id_idx" ON "programs"("promoter_id");

-- CreateIndex
CREATE INDEX "programs_country_code_region_id_publication_idx" ON "programs"("country_code", "region_id", "publication");

-- CreateIndex
CREATE INDEX "programs_slug_idx" ON "programs"("slug");

-- CreateIndex
CREATE INDEX "programs_region_id_idx" ON "programs"("region_id");

-- CreateIndex
CREATE INDEX "programs_city_id_idx" ON "programs"("city_id");

-- CreateIndex
CREATE INDEX "programs_reviewed_by_id_idx" ON "programs"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "programs_created_by_id_idx" ON "programs"("created_by_id");

-- CreateIndex
CREATE INDEX "programs_updated_by_id_idx" ON "programs"("updated_by_id");

-- CreateIndex
CREATE INDEX "properties_publication_availability_idx" ON "properties"("publication", "availability");

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_rooms_idx" ON "properties"("rooms");

-- CreateIndex
CREATE INDEX "properties_country_code_region_id_city_id_idx" ON "properties"("country_code", "region_id", "city_id");

-- CreateIndex
CREATE INDEX "properties_price_from_ref_idx" ON "properties"("price_from_ref");

-- CreateIndex
CREATE INDEX "properties_monthly_from_ref_idx" ON "properties"("monthly_from_ref");

-- CreateIndex
CREATE INDEX "properties_surface_min_idx" ON "properties"("surface_min");

-- CreateIndex
CREATE INDEX "properties_delivery_date_idx" ON "properties"("delivery_date");

-- CreateIndex
CREATE INDEX "properties_standing_idx" ON "properties"("standing");

-- CreateIndex
CREATE INDEX "properties_promoter_id_idx" ON "properties"("promoter_id");

-- CreateIndex
CREATE INDEX "properties_program_id_idx" ON "properties"("program_id");

-- CreateIndex
CREATE INDEX "properties_financing_eligible_idx" ON "properties"("financing_eligible");

-- CreateIndex
CREATE INDEX "properties_first_published_at_idx" ON "properties"("first_published_at");

-- CreateIndex
CREATE INDEX "properties_featured_rank_idx" ON "properties"("featured_rank");

-- CreateIndex
CREATE INDEX "properties_search_text_idx" ON "properties" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "properties_region_id_idx" ON "properties"("region_id");

-- CreateIndex
CREATE INDEX "properties_city_id_idx" ON "properties"("city_id");

-- CreateIndex
CREATE INDEX "properties_reviewed_by_id_idx" ON "properties"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "properties_created_by_id_idx" ON "properties"("created_by_id");

-- CreateIndex
CREATE INDEX "properties_updated_by_id_idx" ON "properties"("updated_by_id");

-- CreateIndex
CREATE INDEX "lots_property_id_status_idx" ON "lots"("property_id", "status");

-- CreateIndex
CREATE INDEX "lots_price_idx" ON "lots"("price");

-- CreateIndex
CREATE INDEX "lots_property_id_reference_idx" ON "lots"("property_id", "reference");

-- CreateIndex
CREATE INDEX "lots_plan_media_id_idx" ON "lots"("plan_media_id");

-- CreateIndex
CREATE INDEX "lots_created_by_id_idx" ON "lots"("created_by_id");

-- CreateIndex
CREATE INDEX "lots_updated_by_id_idx" ON "lots"("updated_by_id");

-- CreateIndex
CREATE INDEX "media_owner_type_owner_id_kind_sort_order_idx" ON "media"("owner_type", "owner_id", "kind", "sort_order");

-- CreateIndex
CREATE INDEX "media_uploaded_by_id_idx" ON "media"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "media_created_by_id_idx" ON "media"("created_by_id");

-- CreateIndex
CREATE INDEX "media_updated_by_id_idx" ON "media"("updated_by_id");

-- CreateIndex
CREATE INDEX "property_pois_program_id_idx" ON "property_pois"("program_id");

-- CreateIndex
CREATE INDEX "property_pois_property_id_idx" ON "property_pois"("property_id");

-- CreateIndex
CREATE INDEX "property_pois_created_by_id_idx" ON "property_pois"("created_by_id");

-- CreateIndex
CREATE INDEX "property_pois_updated_by_id_idx" ON "property_pois"("updated_by_id");

-- CreateIndex
CREATE INDEX "program_updates_program_id_idx" ON "program_updates"("program_id");

-- CreateIndex
CREATE INDEX "program_updates_created_by_id_idx" ON "program_updates"("created_by_id");

-- CreateIndex
CREATE INDEX "program_updates_updated_by_id_idx" ON "program_updates"("updated_by_id");

-- CreateIndex
CREATE INDEX "financing_eligibilities_program_id_idx" ON "financing_eligibilities"("program_id");

-- CreateIndex
CREATE INDEX "financing_eligibilities_property_id_idx" ON "financing_eligibilities"("property_id");

-- CreateIndex
CREATE INDEX "financing_eligibilities_checked_by_id_idx" ON "financing_eligibilities"("checked_by_id");

-- CreateIndex
CREATE INDEX "financing_eligibilities_created_by_id_idx" ON "financing_eligibilities"("created_by_id");

-- CreateIndex
CREATE INDEX "financing_eligibilities_updated_by_id_idx" ON "financing_eligibilities"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "financing_eligibilities_bank_id_program_id_key" ON "financing_eligibilities"("bank_id", "program_id");

-- CreateIndex
CREATE UNIQUE INDEX "financing_eligibilities_bank_id_property_id_key" ON "financing_eligibilities"("bank_id", "property_id");

-- CreateIndex
CREATE INDEX "slug_histories_entity_type_entity_id_idx" ON "slug_histories"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "slug_histories_entity_type_slug_key" ON "slug_histories"("entity_type", "slug");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_status_assigned_agent_id_idx" ON "clients"("status", "assigned_agent_id");

-- CreateIndex
CREATE INDEX "clients_last_activity_at_idx" ON "clients"("last_activity_at");

-- CreateIndex
CREATE INDEX "clients_country_of_residence_idx" ON "clients"("country_of_residence");

-- CreateIndex
CREATE INDEX "clients_search_text_idx" ON "clients" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "clients_user_id_idx" ON "clients"("user_id");

-- CreateIndex
CREATE INDEX "clients_qualified_by_id_idx" ON "clients"("qualified_by_id");

-- CreateIndex
CREATE INDEX "clients_assigned_agent_id_idx" ON "clients"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "clients_merged_into_id_idx" ON "clients"("merged_into_id");

-- CreateIndex
CREATE INDEX "clients_created_by_id_idx" ON "clients"("created_by_id");

-- CreateIndex
CREATE INDEX "clients_updated_by_id_idx" ON "clients"("updated_by_id");

-- CreateIndex
CREATE INDEX "client_contacts_client_id_idx" ON "client_contacts"("client_id");

-- CreateIndex
CREATE INDEX "client_contacts_created_by_id_idx" ON "client_contacts"("created_by_id");

-- CreateIndex
CREATE INDEX "client_contacts_updated_by_id_idx" ON "client_contacts"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_reference_key" ON "leads"("reference");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_client_id_idx" ON "leads"("client_id");

-- CreateIndex
CREATE INDEX "leads_assigned_agent_id_idx" ON "leads"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "leads_kind_idx" ON "leads"("kind");

-- CreateIndex
CREATE INDEX "leads_dossier_id_idx" ON "leads"("dossier_id");

-- CreateIndex
CREATE INDEX "leads_sla_due_at_idx" ON "leads"("sla_due_at");

-- CreateIndex
CREATE INDEX "leads_property_id_idx" ON "leads"("property_id");

-- CreateIndex
CREATE INDEX "leads_program_id_idx" ON "leads"("program_id");

-- CreateIndex
CREATE INDEX "leads_lot_id_idx" ON "leads"("lot_id");

-- CreateIndex
CREATE INDEX "leads_simulation_id_idx" ON "leads"("simulation_id");

-- CreateIndex
CREATE INDEX "leads_applicant_user_id_idx" ON "leads"("applicant_user_id");

-- CreateIndex
CREATE INDEX "leads_reviewed_by_id_idx" ON "leads"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "leads_context_dossier_id_idx" ON "leads"("context_dossier_id");

-- CreateIndex
CREATE INDEX "leads_closed_by_id_idx" ON "leads"("closed_by_id");

-- CreateIndex
CREATE INDEX "leads_created_by_id_idx" ON "leads"("created_by_id");

-- CreateIndex
CREATE INDEX "leads_updated_by_id_idx" ON "leads"("updated_by_id");

-- CreateIndex
CREATE INDEX "lead_files_lead_id_idx" ON "lead_files"("lead_id");

-- CreateIndex
CREATE INDEX "lead_files_uploaded_by_id_idx" ON "lead_files"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "favorites_property_id_idx" ON "favorites"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_alerts_unsubscribe_token_hash_key" ON "search_alerts"("unsubscribe_token_hash");

-- CreateIndex
CREATE INDEX "search_alerts_email_idx" ON "search_alerts"("email");

-- CreateIndex
CREATE INDEX "search_alerts_client_id_idx" ON "search_alerts"("client_id");

-- CreateIndex
CREATE INDEX "alert_deliveries_property_id_idx" ON "alert_deliveries"("property_id");

-- CreateIndex
CREATE INDEX "notes_entity_type_entity_id_idx" ON "notes"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "notes_author_id_idx" ON "notes"("author_id");

-- CreateIndex
CREATE INDEX "notes_created_by_id_idx" ON "notes"("created_by_id");

-- CreateIndex
CREATE INDEX "notes_updated_by_id_idx" ON "notes"("updated_by_id");

-- CreateIndex
CREATE INDEX "dossiers_stage_status_idx" ON "dossiers"("stage", "status");

-- CreateIndex
CREATE INDEX "dossiers_assigned_agent_id_status_idx" ON "dossiers"("assigned_agent_id", "status");

-- CreateIndex
CREATE INDEX "dossiers_client_id_idx" ON "dossiers"("client_id");

-- CreateIndex
CREATE INDEX "dossiers_last_activity_at_idx" ON "dossiers"("last_activity_at");

-- CreateIndex
CREATE INDEX "dossiers_sla_due_at_idx" ON "dossiers"("sla_due_at");

-- CreateIndex
CREATE INDEX "dossiers_property_id_idx" ON "dossiers"("property_id");

-- CreateIndex
CREATE INDEX "dossiers_promoter_id_idx" ON "dossiers"("promoter_id");

-- CreateIndex
CREATE INDEX "dossiers_origin_lead_id_idx" ON "dossiers"("origin_lead_id");

-- CreateIndex
CREATE INDEX "dossiers_lot_id_idx" ON "dossiers"("lot_id");

-- CreateIndex
CREATE INDEX "dossiers_program_id_idx" ON "dossiers"("program_id");

-- CreateIndex
CREATE INDEX "dossiers_checklist_template_id_idx" ON "dossiers"("checklist_template_id");

-- CreateIndex
CREATE INDEX "dossiers_accepted_submission_id_idx" ON "dossiers"("accepted_submission_id");

-- CreateIndex
CREATE INDEX "dossiers_created_by_id_idx" ON "dossiers"("created_by_id");

-- CreateIndex
CREATE INDEX "dossiers_updated_by_id_idx" ON "dossiers"("updated_by_id");

-- CreateIndex
CREATE INDEX "dossier_parties_dossier_id_idx" ON "dossier_parties"("dossier_id");

-- CreateIndex
CREATE INDEX "dossier_parties_client_id_idx" ON "dossier_parties"("client_id");

-- CreateIndex
CREATE INDEX "dossier_parties_created_by_id_idx" ON "dossier_parties"("created_by_id");

-- CreateIndex
CREATE INDEX "dossier_parties_updated_by_id_idx" ON "dossier_parties"("updated_by_id");

-- CreateIndex
CREATE INDEX "dossier_stage_histories_dossier_id_changed_at_idx" ON "dossier_stage_histories"("dossier_id", "changed_at");

-- CreateIndex
CREATE INDEX "dossier_stage_histories_changed_by_id_idx" ON "dossier_stage_histories"("changed_by_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_property_id_idx" ON "dossier_candidates"("property_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_lot_id_idx" ON "dossier_candidates"("lot_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_lead_id_idx" ON "dossier_candidates"("lead_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_proposed_by_id_idx" ON "dossier_candidates"("proposed_by_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_created_by_id_idx" ON "dossier_candidates"("created_by_id");

-- CreateIndex
CREATE INDEX "dossier_candidates_updated_by_id_idx" ON "dossier_candidates"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_candidates_dossier_id_property_id_key" ON "dossier_candidates"("dossier_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_reference_key" ON "reservations"("reference");

-- CreateIndex
CREATE INDEX "reservations_lot_id_idx" ON "reservations"("lot_id");

-- CreateIndex
CREATE INDEX "reservations_dossier_id_idx" ON "reservations"("dossier_id");

-- CreateIndex
CREATE INDEX "reservations_client_id_idx" ON "reservations"("client_id");

-- CreateIndex
CREATE INDEX "reservations_deposit_proof_document_id_idx" ON "reservations"("deposit_proof_document_id");

-- CreateIndex
CREATE INDEX "reservations_deposit_refund_proof_document_id_idx" ON "reservations"("deposit_refund_proof_document_id");

-- CreateIndex
CREATE INDEX "reservations_contract_document_id_idx" ON "reservations"("contract_document_id");

-- CreateIndex
CREATE INDEX "reservations_created_by_id_idx" ON "reservations"("created_by_id");

-- CreateIndex
CREATE INDEX "reservations_updated_by_id_idx" ON "reservations"("updated_by_id");

-- CreateIndex
CREATE INDEX "appointments_client_id_idx" ON "appointments"("client_id");

-- CreateIndex
CREATE INDEX "appointments_dossier_id_idx" ON "appointments"("dossier_id");

-- CreateIndex
CREATE INDEX "appointments_candidate_id_idx" ON "appointments"("candidate_id");

-- CreateIndex
CREATE INDEX "appointments_property_id_idx" ON "appointments"("property_id");

-- CreateIndex
CREATE INDEX "appointments_staff_user_id_idx" ON "appointments"("staff_user_id");

-- CreateIndex
CREATE INDEX "appointments_on_behalf_contact_id_idx" ON "appointments"("on_behalf_contact_id");

-- CreateIndex
CREATE INDEX "appointments_created_by_id_idx" ON "appointments"("created_by_id");

-- CreateIndex
CREATE INDEX "appointments_updated_by_id_idx" ON "appointments"("updated_by_id");

-- CreateIndex
CREATE INDEX "client_timeline_entries_dossier_id_occurred_at_idx" ON "client_timeline_entries"("dossier_id", "occurred_at");

-- CreateIndex
CREATE INDEX "checklist_templates_bank_id_idx" ON "checklist_templates"("bank_id");

-- CreateIndex
CREATE INDEX "checklist_templates_created_by_id_idx" ON "checklist_templates"("created_by_id");

-- CreateIndex
CREATE INDEX "checklist_templates_updated_by_id_idx" ON "checklist_templates"("updated_by_id");

-- CreateIndex
CREATE INDEX "checklist_items_template_id_idx" ON "checklist_items"("template_id");

-- CreateIndex
CREATE INDEX "checklist_items_example_media_id_idx" ON "checklist_items"("example_media_id");

-- CreateIndex
CREATE INDEX "checklist_items_created_by_id_idx" ON "checklist_items"("created_by_id");

-- CreateIndex
CREATE INDEX "checklist_items_updated_by_id_idx" ON "checklist_items"("updated_by_id");

-- CreateIndex
CREATE INDEX "dossier_documents_dossier_id_status_idx" ON "dossier_documents"("dossier_id", "status");

-- CreateIndex
CREATE INDEX "dossier_documents_status_due_at_idx" ON "dossier_documents"("status", "due_at");

-- CreateIndex
CREATE INDEX "dossier_documents_expires_at_idx" ON "dossier_documents"("expires_at");

-- CreateIndex
CREATE INDEX "dossier_documents_party_id_idx" ON "dossier_documents"("party_id");

-- CreateIndex
CREATE INDEX "dossier_documents_checklist_item_id_idx" ON "dossier_documents"("checklist_item_id");

-- CreateIndex
CREATE INDEX "dossier_documents_submission_id_idx" ON "dossier_documents"("submission_id");

-- CreateIndex
CREATE INDEX "dossier_documents_validated_by_id_idx" ON "dossier_documents"("validated_by_id");

-- CreateIndex
CREATE INDEX "dossier_documents_waived_by_id_idx" ON "dossier_documents"("waived_by_id");

-- CreateIndex
CREATE INDEX "dossier_documents_created_by_id_idx" ON "dossier_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "dossier_documents_updated_by_id_idx" ON "dossier_documents"("updated_by_id");

-- CreateIndex
CREATE INDEX "document_versions_uploaded_by_id_idx" ON "document_versions"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "document_versions_decided_by_id_idx" ON "document_versions"("decided_by_id");

-- CreateIndex
CREATE INDEX "document_versions_deleted_by_id_idx" ON "document_versions"("deleted_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_number_key" ON "document_versions"("document_id", "number");

-- CreateIndex
CREATE INDEX "document_files_version_id_idx" ON "document_files"("version_id");

-- CreateIndex
CREATE INDEX "document_files_document_id_idx" ON "document_files"("document_id");

-- CreateIndex
CREATE INDEX "document_reminders_dossier_id_reminded_at_idx" ON "document_reminders"("dossier_id", "reminded_at");

-- CreateIndex
CREATE INDEX "document_reminders_triggered_by_id_idx" ON "document_reminders"("triggered_by_id");

-- CreateIndex
CREATE INDEX "document_reminders_communication_id_idx" ON "document_reminders"("communication_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_submissions_reference_key" ON "bank_submissions"("reference");

-- CreateIndex
CREATE INDEX "bank_submissions_bank_id_status_idx" ON "bank_submissions"("bank_id", "status");

-- CreateIndex
CREATE INDEX "bank_submissions_dossier_id_idx" ON "bank_submissions"("dossier_id");

-- CreateIndex
CREATE INDEX "bank_submissions_expected_decision_at_idx" ON "bank_submissions"("expected_decision_at");

-- CreateIndex
CREATE INDEX "bank_submissions_bank_product_id_idx" ON "bank_submissions"("bank_product_id");

-- CreateIndex
CREATE INDEX "bank_submissions_recipient_contact_id_idx" ON "bank_submissions"("recipient_contact_id");

-- CreateIndex
CREATE INDEX "bank_submissions_submitted_by_id_idx" ON "bank_submissions"("submitted_by_id");

-- CreateIndex
CREATE INDEX "bank_submissions_offer_document_id_idx" ON "bank_submissions"("offer_document_id");

-- CreateIndex
CREATE INDEX "bank_submissions_created_by_id_idx" ON "bank_submissions"("created_by_id");

-- CreateIndex
CREATE INDEX "bank_submissions_updated_by_id_idx" ON "bank_submissions"("updated_by_id");

-- CreateIndex
CREATE INDEX "submission_documents_dossier_document_id_idx" ON "submission_documents"("dossier_document_id");

-- CreateIndex
CREATE INDEX "submission_documents_created_by_id_idx" ON "submission_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "submission_documents_updated_by_id_idx" ON "submission_documents"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_documents_submission_id_dossier_document_id_key" ON "submission_documents"("submission_id", "dossier_document_id");

-- CreateIndex
CREATE INDEX "submission_packages_submission_id_idx" ON "submission_packages"("submission_id");

-- CreateIndex
CREATE INDEX "submission_packages_generated_by_id_idx" ON "submission_packages"("generated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "secure_shares_token_hash_key" ON "secure_shares"("token_hash");

-- CreateIndex
CREATE INDEX "secure_shares_entity_type_entity_id_idx" ON "secure_shares"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "secure_shares_package_id_idx" ON "secure_shares"("package_id");

-- CreateIndex
CREATE INDEX "secure_shares_export_job_id_idx" ON "secure_shares"("export_job_id");

-- CreateIndex
CREATE INDEX "secure_shares_organization_id_idx" ON "secure_shares"("organization_id");

-- CreateIndex
CREATE INDEX "secure_shares_revoked_by_id_idx" ON "secure_shares"("revoked_by_id");

-- CreateIndex
CREATE INDEX "secure_shares_created_by_id_idx" ON "secure_shares"("created_by_id");

-- CreateIndex
CREATE INDEX "bank_submission_events_submission_id_created_at_idx" ON "bank_submission_events"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "bank_submission_events_actor_id_idx" ON "bank_submission_events"("actor_id");

-- CreateIndex
CREATE INDEX "simulations_anonymous_id_idx" ON "simulations"("anonymous_id");

-- CreateIndex
CREATE INDEX "simulations_client_id_idx" ON "simulations"("client_id");

-- CreateIndex
CREATE INDEX "simulations_dossier_id_idx" ON "simulations"("dossier_id");

-- CreateIndex
CREATE INDEX "simulations_lead_id_idx" ON "simulations"("lead_id");

-- CreateIndex
CREATE INDEX "simulations_property_id_idx" ON "simulations"("property_id");

-- CreateIndex
CREATE INDEX "simulations_lot_id_idx" ON "simulations"("lot_id");

-- CreateIndex
CREATE INDEX "simulations_bank_product_id_idx" ON "simulations"("bank_product_id");

-- CreateIndex
CREATE INDEX "simulations_created_by_id_idx" ON "simulations"("created_by_id");

-- CreateIndex
CREATE INDEX "email_templates_created_by_id_idx" ON "email_templates"("created_by_id");

-- CreateIndex
CREATE INDEX "email_templates_updated_by_id_idx" ON "email_templates"("updated_by_id");

-- CreateIndex
CREATE INDEX "email_template_versions_updated_by_id_idx" ON "email_template_versions"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_template_versions_template_id_version_key" ON "email_template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "communications_dedupe_key_key" ON "communications"("dedupe_key");

-- CreateIndex
CREATE INDEX "communications_dossier_id_occurred_at_idx" ON "communications"("dossier_id", "occurred_at");

-- CreateIndex
CREATE INDEX "communications_client_id_occurred_at_idx" ON "communications"("client_id", "occurred_at");

-- CreateIndex
CREATE INDEX "communications_provider_message_id_idx" ON "communications"("provider_message_id");

-- CreateIndex
CREATE INDEX "communications_delivery_state_scheduled_for_idx" ON "communications"("delivery_state", "scheduled_for");

-- CreateIndex
CREATE INDEX "communications_lead_id_idx" ON "communications"("lead_id");

-- CreateIndex
CREATE INDEX "communications_submission_id_idx" ON "communications"("submission_id");

-- CreateIndex
CREATE INDEX "communications_event_id_idx" ON "communications"("event_id");

-- CreateIndex
CREATE INDEX "communications_registration_id_idx" ON "communications"("registration_id");

-- CreateIndex
CREATE INDEX "communications_simulation_id_idx" ON "communications"("simulation_id");

-- CreateIndex
CREATE INDEX "communications_promoter_id_idx" ON "communications"("promoter_id");

-- CreateIndex
CREATE INDEX "communications_bank_id_idx" ON "communications"("bank_id");

-- CreateIndex
CREATE INDEX "communications_feedback_id_idx" ON "communications"("feedback_id");

-- CreateIndex
CREATE INDEX "communications_data_request_id_idx" ON "communications"("data_request_id");

-- CreateIndex
CREATE INDEX "communications_export_job_id_idx" ON "communications"("export_job_id");

-- CreateIndex
CREATE INDEX "communications_staff_user_id_idx" ON "communications"("staff_user_id");

-- CreateIndex
CREATE INDEX "communications_rule_id_idx" ON "communications"("rule_id");

-- CreateIndex
CREATE INDEX "communications_sent_by_id_idx" ON "communications"("sent_by_id");

-- CreateIndex
CREATE INDEX "communications_resent_from_id_idx" ON "communications"("resent_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "mail_webhook_events_provider_event_id_key" ON "mail_webhook_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "mail_webhook_events_provider_message_id_idx" ON "mail_webhook_events"("provider_message_id");

-- CreateIndex
CREATE INDEX "mail_webhook_events_received_at_idx" ON "mail_webhook_events"("received_at");

-- CreateIndex
CREATE INDEX "conversations_dossier_id_idx" ON "conversations"("dossier_id");

-- CreateIndex
CREATE INDEX "conversations_partner_organization_id_idx" ON "conversations"("partner_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_thread_key" ON "conversations"("client_id", "dossier_id", "partner_organization_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_sender_user_id_idx" ON "messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "message_attachments_filed_as_document_id_idx" ON "message_attachments"("filed_as_document_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_updated_at_idx" ON "notifications"("user_id", "read_at", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_client_id_idx" ON "notification_preferences"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_rules_code_key" ON "workflow_rules"("code");

-- CreateIndex
CREATE INDEX "workflow_rules_trigger_idx" ON "workflow_rules"("trigger");

-- CreateIndex
CREATE INDEX "workflow_rules_created_by_id_idx" ON "workflow_rules"("created_by_id");

-- CreateIndex
CREATE INDEX "workflow_rules_updated_by_id_idx" ON "workflow_rules"("updated_by_id");

-- CreateIndex
CREATE INDEX "workflow_executions_status_scheduled_for_idx" ON "workflow_executions"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "workflow_executions_status_next_attempt_at_idx" ON "workflow_executions"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_executions_rule_id_trigger_event_id_key" ON "workflow_executions"("rule_id", "trigger_event_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_status_due_at_idx" ON "tasks"("assignee_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_dossier_id_idx" ON "tasks"("dossier_id");

-- CreateIndex
CREATE INDEX "tasks_client_id_idx" ON "tasks"("client_id");

-- CreateIndex
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");

-- CreateIndex
CREATE INDEX "tasks_submission_id_idx" ON "tasks"("submission_id");

-- CreateIndex
CREATE INDEX "tasks_event_id_idx" ON "tasks"("event_id");

-- CreateIndex
CREATE INDEX "tasks_property_id_idx" ON "tasks"("property_id");

-- CreateIndex
CREATE INDEX "tasks_promoter_id_idx" ON "tasks"("promoter_id");

-- CreateIndex
CREATE INDEX "tasks_bank_id_idx" ON "tasks"("bank_id");

-- CreateIndex
CREATE INDEX "tasks_bank_product_id_idx" ON "tasks"("bank_product_id");

-- CreateIndex
CREATE INDEX "tasks_appointment_id_idx" ON "tasks"("appointment_id");

-- CreateIndex
CREATE INDEX "tasks_reservation_id_idx" ON "tasks"("reservation_id");

-- CreateIndex
CREATE INDEX "tasks_feedback_id_idx" ON "tasks"("feedback_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "tasks_rule_id_idx" ON "tasks"("rule_id");

-- CreateIndex
CREATE INDEX "tasks_completed_by_id_idx" ON "tasks"("completed_by_id");

-- CreateIndex
CREATE INDEX "tasks_updated_by_id_idx" ON "tasks"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_code_key" ON "surveys"("code");

-- CreateIndex
CREATE INDEX "surveys_created_by_id_idx" ON "surveys"("created_by_id");

-- CreateIndex
CREATE INDEX "surveys_updated_by_id_idx" ON "surveys"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_invitations_token_hash_key" ON "survey_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "survey_invitations_reminder_token_hash_key" ON "survey_invitations"("reminder_token_hash");

-- CreateIndex
CREATE INDEX "survey_invitations_scheduled_for_idx" ON "survey_invitations"("scheduled_for");

-- CreateIndex
CREATE INDEX "survey_invitations_survey_id_idx" ON "survey_invitations"("survey_id");

-- CreateIndex
CREATE INDEX "survey_invitations_client_id_idx" ON "survey_invitations"("client_id");

-- CreateIndex
CREATE INDEX "survey_invitations_dossier_id_idx" ON "survey_invitations"("dossier_id");

-- CreateIndex
CREATE INDEX "survey_invitations_event_id_idx" ON "survey_invitations"("event_id");

-- CreateIndex
CREATE INDEX "feedbacks_status_created_at_idx" ON "feedbacks"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedbacks_survey_id_idx" ON "feedbacks"("survey_id");

-- CreateIndex
CREATE INDEX "feedbacks_dossier_id_idx" ON "feedbacks"("dossier_id");

-- CreateIndex
CREATE INDEX "feedbacks_invitation_id_idx" ON "feedbacks"("invitation_id");

-- CreateIndex
CREATE INDEX "feedbacks_client_id_idx" ON "feedbacks"("client_id");

-- CreateIndex
CREATE INDEX "feedbacks_property_id_idx" ON "feedbacks"("property_id");

-- CreateIndex
CREATE INDEX "feedbacks_event_id_idx" ON "feedbacks"("event_id");

-- CreateIndex
CREATE INDEX "feedbacks_promoter_id_idx" ON "feedbacks"("promoter_id");

-- CreateIndex
CREATE INDEX "feedbacks_bank_id_idx" ON "feedbacks"("bank_id");

-- CreateIndex
CREATE INDEX "feedbacks_author_organization_id_idx" ON "feedbacks"("author_organization_id");

-- CreateIndex
CREATE INDEX "feedbacks_handled_by_id_idx" ON "feedbacks"("handled_by_id");

-- CreateIndex
CREATE INDEX "feedbacks_created_by_id_idx" ON "feedbacks"("created_by_id");

-- CreateIndex
CREATE INDEX "feedbacks_updated_by_id_idx" ON "feedbacks"("updated_by_id");

-- CreateIndex
CREATE INDEX "events_cover_media_id_idx" ON "events"("cover_media_id");

-- CreateIndex
CREATE INDEX "events_host_user_id_idx" ON "events"("host_user_id");

-- CreateIndex
CREATE INDEX "events_created_by_id_idx" ON "events"("created_by_id");

-- CreateIndex
CREATE INDEX "events_updated_by_id_idx" ON "events"("updated_by_id");

-- CreateIndex
CREATE INDEX "event_partners_event_id_idx" ON "event_partners"("event_id");

-- CreateIndex
CREATE INDEX "event_partners_promoter_id_idx" ON "event_partners"("promoter_id");

-- CreateIndex
CREATE INDEX "event_partners_bank_id_idx" ON "event_partners"("bank_id");

-- CreateIndex
CREATE INDEX "event_partners_partner_id_idx" ON "event_partners"("partner_id");

-- CreateIndex
CREATE INDEX "event_partners_created_by_id_idx" ON "event_partners"("created_by_id");

-- CreateIndex
CREATE INDEX "event_partners_updated_by_id_idx" ON "event_partners"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_manage_token_hash_key" ON "event_registrations"("manage_token_hash");

-- CreateIndex
CREATE INDEX "event_registrations_client_id_idx" ON "event_registrations"("client_id");

-- CreateIndex
CREATE INDEX "event_registrations_checked_in_by_id_idx" ON "event_registrations"("checked_in_by_id");

-- CreateIndex
CREATE INDEX "event_registrations_created_by_id_idx" ON "event_registrations"("created_by_id");

-- CreateIndex
CREATE INDEX "event_registrations_updated_by_id_idx" ON "event_registrations"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_check_in_code_key" ON "event_registrations"("event_id", "check_in_code");

-- CreateIndex
CREATE UNIQUE INDEX "event_notify_requests_unsubscribe_token_hash_key" ON "event_notify_requests"("unsubscribe_token_hash");

-- CreateIndex
CREATE INDEX "event_notify_requests_event_id_idx" ON "event_notify_requests"("event_id");

-- CreateIndex
CREATE INDEX "event_notify_requests_client_id_idx" ON "event_notify_requests"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_notify_requests_target_key" ON "event_notify_requests"("email", "event_id", "location_label");

-- CreateIndex
CREATE INDEX "content_blocks_created_by_id_idx" ON "content_blocks"("created_by_id");

-- CreateIndex
CREATE INDEX "content_blocks_updated_by_id_idx" ON "content_blocks"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_key_locale_key" ON "content_blocks"("key", "locale");

-- CreateIndex
CREATE INDEX "content_block_versions_block_id_created_at_idx" ON "content_block_versions"("block_id", "created_at");

-- CreateIndex
CREATE INDEX "content_block_versions_updated_by_id_idx" ON "content_block_versions"("updated_by_id");

-- CreateIndex
CREATE INDEX "pages_created_by_id_idx" ON "pages"("created_by_id");

-- CreateIndex
CREATE INDEX "pages_updated_by_id_idx" ON "pages"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_locale_key" ON "pages"("slug", "locale");

-- CreateIndex
CREATE INDEX "faq_items_created_by_id_idx" ON "faq_items"("created_by_id");

-- CreateIndex
CREATE INDEX "faq_items_updated_by_id_idx" ON "faq_items"("updated_by_id");

-- CreateIndex
CREATE INDEX "testimonials_photo_media_id_idx" ON "testimonials"("photo_media_id");

-- CreateIndex
CREATE INDEX "testimonials_client_id_idx" ON "testimonials"("client_id");

-- CreateIndex
CREATE INDEX "testimonials_created_by_id_idx" ON "testimonials"("created_by_id");

-- CreateIndex
CREATE INDEX "testimonials_updated_by_id_idx" ON "testimonials"("updated_by_id");

-- CreateIndex
CREATE INDEX "legal_documents_created_by_id_idx" ON "legal_documents"("created_by_id");

-- CreateIndex
CREATE INDEX "legal_documents_updated_by_id_idx" ON "legal_documents"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_version_locale_key" ON "legal_documents"("type", "version", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_from_path_key" ON "redirects"("from_path");

-- CreateIndex
CREATE INDEX "redirects_created_by_id_idx" ON "redirects"("created_by_id");

-- CreateIndex
CREATE INDEX "redirects_updated_by_id_idx" ON "redirects"("updated_by_id");

-- CreateIndex
CREATE INDEX "translations_created_by_id_idx" ON "translations"("created_by_id");

-- CreateIndex
CREATE INDEX "translations_updated_by_id_idx" ON "translations"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "translations_entity_type_entity_id_field_locale_key" ON "translations"("entity_type", "entity_id", "field", "locale");

-- CreateIndex
CREATE INDEX "settings_created_by_id_idx" ON "settings"("created_by_id");

-- CreateIndex
CREATE INDEX "settings_updated_by_id_idx" ON "settings"("updated_by_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_client_id_created_at_idx" ON "audit_logs"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_dossier_id_created_at_idx" ON "audit_logs"("dossier_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_elevation_audit_id_idx" ON "audit_logs"("elevation_audit_id");

-- CreateIndex
CREATE INDEX "audit_logs_partner_organization_id_idx" ON "audit_logs"("partner_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_parked_at_available_at_idx" ON "outbox_events"("processed_at", "parked_at", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_occurred_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_idx" ON "idempotency_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_scope_key" ON "idempotency_keys"("key", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "data_requests_reference_key" ON "data_requests"("reference");

-- CreateIndex
CREATE INDEX "data_requests_client_id_idx" ON "data_requests"("client_id");

-- CreateIndex
CREATE INDEX "data_requests_handled_by_id_idx" ON "data_requests"("handled_by_id");

-- CreateIndex
CREATE INDEX "data_requests_export_job_id_idx" ON "data_requests"("export_job_id");

-- CreateIndex
CREATE INDEX "data_requests_created_by_id_idx" ON "data_requests"("created_by_id");

-- CreateIndex
CREATE INDEX "data_requests_updated_by_id_idx" ON "data_requests"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_owner_id_list_key_name_key" ON "saved_views"("owner_id", "list_key", "name");

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");

-- CreateIndex
CREATE INDEX "job_runs_triggered_by_id_idx" ON "job_runs"("triggered_by_id");

-- CreateIndex
CREATE INDEX "import_jobs_created_by_id_idx" ON "import_jobs"("created_by_id");

-- CreateIndex
CREATE INDEX "export_jobs_requested_by_id_idx" ON "export_jobs"("requested_by_id");

-- CreateIndex
CREATE INDEX "uploads_status_expires_at_idx" ON "uploads"("status", "expires_at");

-- CreateIndex
CREATE INDEX "uploads_requested_by_id_idx" ON "uploads"("requested_by_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonated_by_id_fkey" FOREIGN KEY ("impersonated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "dossier_parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_source_communication_id_fkey" FOREIGN KEY ("source_communication_id") REFERENCES "communications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_proof_document_id_fkey" FOREIGN KEY ("proof_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_times" ADD CONSTRAINT "travel_times_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_vetted_by_id_fkey" FOREIGN KEY ("vetted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_property_country_code_fkey" FOREIGN KEY ("property_country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_required_checklist_id_fkey" FOREIGN KEY ("required_checklist_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_secure_share_id_fkey" FOREIGN KEY ("secure_share_id") REFERENCES "secure_shares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_plan_media_id_fkey" FOREIGN KEY ("plan_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_updates" ADD CONSTRAINT "program_updates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_updates" ADD CONSTRAINT "program_updates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_updates" ADD CONSTRAINT "program_updates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_daily_stats" ADD CONSTRAINT "property_daily_stats_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_country_of_residence_fkey" FOREIGN KEY ("country_of_residence") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_qualified_by_id_fkey" FOREIGN KEY ("qualified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_context_dossier_id_fkey" FOREIGN KEY ("context_dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_files" ADD CONSTRAINT "lead_files_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_files" ADD CONSTRAINT "lead_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "search_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_origin_lead_id_fkey" FOREIGN KEY ("origin_lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_accepted_submission_id_fkey" FOREIGN KEY ("accepted_submission_id") REFERENCES "bank_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_stage_histories" ADD CONSTRAINT "dossier_stage_histories_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_stage_histories" ADD CONSTRAINT "dossier_stage_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_candidates" ADD CONSTRAINT "dossier_candidates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_proof_document_id_fkey" FOREIGN KEY ("deposit_proof_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_refund_proof_document_id_fkey" FOREIGN KEY ("deposit_refund_proof_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_contract_document_id_fkey" FOREIGN KEY ("contract_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "dossier_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_on_behalf_contact_id_fkey" FOREIGN KEY ("on_behalf_contact_id") REFERENCES "client_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_timeline_entries" ADD CONSTRAINT "client_timeline_entries_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_example_media_id_fkey" FOREIGN KEY ("example_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "dossier_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_waived_by_id_fkey" FOREIGN KEY ("waived_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dossier_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dossier_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reminders" ADD CONSTRAINT "document_reminders_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_bank_product_id_fkey" FOREIGN KEY ("bank_product_id") REFERENCES "bank_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_recipient_contact_id_fkey" FOREIGN KEY ("recipient_contact_id") REFERENCES "bank_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_offer_document_id_fkey" FOREIGN KEY ("offer_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_dossier_document_id_fkey" FOREIGN KEY ("dossier_document_id") REFERENCES "dossier_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_documents" ADD CONSTRAINT "submission_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_packages" ADD CONSTRAINT "submission_packages_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_packages" ADD CONSTRAINT "submission_packages_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "submission_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submission_events" ADD CONSTRAINT "bank_submission_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_submission_events" ADD CONSTRAINT "bank_submission_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_bank_product_id_fkey" FOREIGN KEY ("bank_product_id") REFERENCES "bank_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template_versions" ADD CONSTRAINT "email_template_versions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedbacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_data_request_id_fkey" FOREIGN KEY ("data_request_id") REFERENCES "data_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "workflow_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_resent_from_id_fkey" FOREIGN KEY ("resent_from_id") REFERENCES "communications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_partner_organization_id_fkey" FOREIGN KEY ("partner_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_filed_as_document_id_fkey" FOREIGN KEY ("filed_as_document_id") REFERENCES "dossier_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "workflow_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "bank_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bank_product_id_fkey" FOREIGN KEY ("bank_product_id") REFERENCES "bank_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "feedbacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "workflow_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "survey_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_author_organization_id_fkey" FOREIGN KEY ("author_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notify_requests" ADD CONSTRAINT "event_notify_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notify_requests" ADD CONSTRAINT "event_notify_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_versions" ADD CONSTRAINT "content_block_versions_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_block_versions" ADD CONSTRAINT "content_block_versions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_photo_media_id_fkey" FOREIGN KEY ("photo_media_id") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_elevation_audit_id_fkey" FOREIGN KEY ("elevation_audit_id") REFERENCES "audit_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_partner_organization_id_fkey" FOREIGN KEY ("partner_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_defaults" ADD CONSTRAINT "saved_view_defaults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════════════════
-- Hand-written part of the init migration (work package 1.2).
-- Everything Prisma cannot express. Prisma ignores partial indexes and CHECK
-- constraints when diffing, so none of this drifts. Each statement cites its rule.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Functions ──────────────────────────────────────────────────────────────

-- MOD-015, ARC-074, TRV-103: unaccent() is only STABLE; an IMMUTABLE wrapper with an explicit
-- dictionary is required to use it in triggers, indexes and generated expressions.
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $func$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $func$;

-- MOD-015, ARC-074 (01-domaine/04 § 1.1): Client.searchText is computed by the database from
-- name, e-mail, phone and city — unaccented first, then lower-cased (the cluster may use the C
-- locale, where lower() leaves accented capitals untouched). Queries must normalise the search
-- term the same way: lower(public.f_unaccent($1)).
CREATE OR REPLACE FUNCTION public.clients_search_text() RETURNS trigger
  LANGUAGE plpgsql
  AS $func$
BEGIN
  NEW.search_text := lower(public.f_unaccent(concat_ws(' ',
    NEW.first_name, NEW.last_name, NEW.email::text, NEW.phone, NEW.city_of_residence)));
  RETURN NEW;
END
$func$;
CREATE TRIGGER clients_search_text BEFORE INSERT OR UPDATE ON "clients"
  FOR EACH ROW EXECUTE FUNCTION public.clients_search_text();

-- ─── Required list columns ──────────────────────────────────────────────────
-- 01-domaine/02 to 05, column "Oblig. = oui": Prisma cannot declare a list NOT NULL.
ALTER TABLE "bank_products" ALTER COLUMN "eligible_residency" SET NOT NULL;
ALTER TABLE "bank_products" ALTER COLUMN "accepted_income_currencies" SET NOT NULL;
ALTER TABLE "bank_products" ALTER COLUMN "accepted_residence_countries" SET NOT NULL;
ALTER TABLE "programs" ALTER COLUMN "amenities" SET NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "features" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "alternate_emails" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "nationalities" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "preferred_countries" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "preferred_region_ids" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "preferred_types" SET NOT NULL;
ALTER TABLE "clients" ALTER COLUMN "not_duplicate_of_ids" SET NOT NULL;
ALTER TABLE "checklist_templates" ALTER COLUMN "residency_filter" SET NOT NULL;
ALTER TABLE "checklist_items" ALTER COLUMN "applies_to_roles" SET NOT NULL;
ALTER TABLE "checklist_items" ALTER COLUMN "accepted_formats" SET NOT NULL;
ALTER TABLE "dossier_documents" ALTER COLUMN "accepted_formats" SET NOT NULL;
ALTER TABLE "document_reminders" ALTER COLUMN "document_ids" SET NOT NULL;
ALTER TABLE "document_reminders" ALTER COLUMN "counted_document_ids" SET NOT NULL;
ALTER TABLE "secure_shares" ALTER COLUMN "gestures" SET NOT NULL;
ALTER TABLE "email_templates" ALTER COLUMN "variables" SET NOT NULL;
ALTER TABLE "email_templates" ALTER COLUMN "required_variables" SET NOT NULL;
ALTER TABLE "email_templates" ALTER COLUMN "secret_variables" SET NOT NULL;
ALTER TABLE "email_templates" ALTER COLUMN "sent_by" SET NOT NULL;
ALTER TABLE "event_registrations" ALTER COLUMN "topics" SET NOT NULL;
ALTER TABLE "faq_items" ALTER COLUMN "placements" SET NOT NULL;
-- ─── Partial unique indexes on ⌫ tables (MOD-006: WHERE deleted_at IS NULL) ──
CREATE UNIQUE INDEX "promoters_organization_id_key" ON "promoters" ("organization_id") WHERE "deleted_at" IS NULL;  -- 02 § 3.1, MOD-006
CREATE UNIQUE INDEX "promoters_slug_key" ON "promoters" ("slug") WHERE "deleted_at" IS NULL;                        -- 02 § 3.1, MOD-006
CREATE UNIQUE INDEX "banks_organization_id_key" ON "banks" ("organization_id") WHERE "deleted_at" IS NULL;          -- 02 § 3.3, MOD-006
CREATE UNIQUE INDEX "banks_slug_key" ON "banks" ("slug") WHERE "deleted_at" IS NULL;                                -- 02 § 3.3, MOD-006
CREATE UNIQUE INDEX "programs_slug_key" ON "programs" ("slug") WHERE "deleted_at" IS NULL;                          -- 03 § 1, MOD-006
CREATE UNIQUE INDEX "properties_reference_key" ON "properties" ("reference") WHERE "deleted_at" IS NULL;            -- 03 § 2, MOD-006
CREATE UNIQUE INDEX "properties_slug_key" ON "properties" ("slug") WHERE "deleted_at" IS NULL;                      -- 03 § 2, MOD-006
CREATE UNIQUE INDEX "dossiers_reference_key" ON "dossiers" ("reference") WHERE "deleted_at" IS NULL;                -- 04 § 2.1, MOD-006
CREATE UNIQUE INDEX "events_reference_key" ON "events" ("reference") WHERE "deleted_at" IS NULL;                    -- 05 § 3.1, MOD-006
CREATE UNIQUE INDEX "events_slug_key" ON "events" ("slug") WHERE "deleted_at" IS NULL;                              -- 05 § 3.1, MOD-006
CREATE UNIQUE INDEX "faq_items_slug_locale_key" ON "faq_items" ("slug", "locale") WHERE "deleted_at" IS NULL;       -- 05 § 4.3, MOD-006
CREATE UNIQUE INDEX "email_templates_code_locale_key" ON "email_templates" ("code", "locale") WHERE "deleted_at" IS NULL; -- 05 § 1.1, MOD-006 (COM-053)

-- MOD-019 (optional single column: filled values only) + MOD-006, FIA-002 "un e-mail = une fiche".
CREATE UNIQUE INDEX "clients_email_key" ON "clients" ("email") WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "clients_user_id_key" ON "clients" ("user_id") WHERE "user_id" IS NOT NULL AND "deleted_at" IS NULL;

-- ─── Other partial unique indexes ───────────────────────────────────────────
-- MOD-102: exactly one OPERATOR organization.
CREATE UNIQUE INDEX "organizations_operator_key" ON "organizations" ("type") WHERE "type" = 'OPERATOR';
-- 02 § 1.3: (userId, organizationId) among non-revoked memberships.
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships" ("user_id", "organization_id") WHERE "revoked_at" IS NULL;
-- 02 § 3.2 / § 3.4: at most one primary contact per promoter / per bank.
CREATE UNIQUE INDEX "promoter_contacts_primary_key" ON "promoter_contacts" ("promoter_id") WHERE "is_primary";
CREATE UNIQUE INDEX "bank_contacts_primary_key" ON "bank_contacts" ("bank_id") WHERE "is_primary";
-- MOD-116: at most one PENDING answer per object and gesture, for gestures that decide.
CREATE UNIQUE INDEX "partner_answers_pending_key" ON "partner_answers" ("entity_type", "entity_id", "gesture")
  WHERE "status" = 'PENDING'
    AND "gesture" IN ('OPTION_ANSWER', 'RESERVATION_CONFIRM', 'DEPOSIT_OUTCOME', 'VISIT_HOST', 'DELIVERY_UPDATE', 'DECISION', 'OFFER_EXTEND', 'PRODUCT_UPDATE');
-- 03 § 4: at most one cover per owner.
CREATE UNIQUE INDEX "media_cover_key" ON "media" ("owner_type", "owner_id") WHERE "is_cover" AND "deleted_at" IS NULL;
-- MOD-310, FIA-002: one OPEN or ON_HOLD dossier per client and retained property.
CREATE UNIQUE INDEX "dossiers_client_property_open_key" ON "dossiers" ("client_id", "property_id")
  WHERE "property_id" IS NOT NULL AND "status" IN ('OPEN', 'ON_HOLD') AND "deleted_at" IS NULL;
-- MOD-320: exactly one PRIMARY party per dossier (at most one here; creation with the dossier).
CREATE UNIQUE INDEX "dossier_parties_primary_key" ON "dossier_parties" ("dossier_id") WHERE "role" = 'PRIMARY';
-- 04 § 2.4, FIA-002: at most one SELECTED candidate per dossier.
CREATE UNIQUE INDEX "dossier_candidates_selected_key" ON "dossier_candidates" ("dossier_id") WHERE "status" = 'SELECTED';
-- 04 § 2.4 (selectionRequestedAt): a single candidate per dossier can carry the pending selection.
CREATE UNIQUE INDEX "dossier_candidates_selection_requested_key" ON "dossier_candidates" ("dossier_id") WHERE "selection_requested_at" IS NOT NULL;
-- MOD-330, FIA-002: one active reservation per lot.
CREATE UNIQUE INDEX "reservations_lot_active_key" ON "reservations" ("lot_id") WHERE "status" IN ('OPTION', 'RESERVED');
-- MOD-331, FIA-002: one active reservation per dossier.
CREATE UNIQUE INDEX "reservations_dossier_active_key" ON "reservations" ("dossier_id") WHERE "status" IN ('OPTION', 'RESERVED');
-- 04 § 3.1: one default template per scope (and per bank); a null bank counts as a value (MOD-019 rule).
CREATE UNIQUE INDEX "checklist_templates_default_key" ON "checklist_templates" ("scope", "bank_id") NULLS NOT DISTINCT
  WHERE "is_default" AND "deleted_at" IS NULL;
-- 04 § 3.2, MOD-342: code unique among the template's lines in force.
CREATE UNIQUE INDEX "checklist_items_template_code_key" ON "checklist_items" ("template_id", "code") WHERE "retired_in_version" IS NULL;
-- MOD-355, FIA-002: one unfinished submission per dossier and bank.
CREATE UNIQUE INDEX "bank_submissions_dossier_bank_open_key" ON "bank_submissions" ("dossier_id", "bank_id")
  WHERE "status" IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED');
-- 05 § 1.4: one preference row per (user, group) and per (client, group); the empty column does NOT count.
CREATE UNIQUE INDEX "notification_preferences_user_group_key" ON "notification_preferences" ("user_id", "group") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "notification_preferences_client_group_key" ON "notification_preferences" ("client_id", "group") WHERE "client_id" IS NOT NULL;
-- 05 § 1.6, FIA-002: one automatic task per dedupe key among OPEN tasks (MOD-019: filled values only).
CREATE UNIQUE INDEX "tasks_dedupe_key_open_key" ON "tasks" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL AND "status" = 'OPEN' AND "deleted_at" IS NULL;
-- 05 § 3.3, FIA-002: one registration per e-mail and Café among non-cancelled registrations.
CREATE UNIQUE INDEX "event_registrations_event_email_key" ON "event_registrations" ("event_id", "email") WHERE "status" <> 'CANCELLED';

-- ─── NULLS NOT DISTINCT keys (MOD-019 list) ─────────────────────────────────
-- DossierDocument (dossierId, partyId, code), when code is filled; a common document (no party) counts as a value.
CREATE UNIQUE INDEX "dossier_documents_dossier_party_code_key" ON "dossier_documents" ("dossier_id", "party_id", "code") NULLS NOT DISTINCT
  WHERE "code" IS NOT NULL;
-- Conversation (clientId, dossierId, partnerOrganizationId): one general thread per client.
-- Declared in Prisma with @@unique(map: "conversations_thread_key"); recreated here with NULLS NOT DISTINCT.
DROP INDEX "conversations_thread_key";
CREATE UNIQUE INDEX "conversations_thread_key" ON "conversations" ("client_id", "dossier_id", "partner_organization_id") NULLS NOT DISTINCT;
-- SurveyInvitation (surveyId, clientId, dossierId, eventId) among non-cancelled invitations.
CREATE UNIQUE INDEX "survey_invitations_context_key" ON "survey_invitations" ("survey_id", "client_id", "dossier_id", "event_id") NULLS NOT DISTINCT
  WHERE "cancelled_at" IS NULL;
-- EventNotifyRequest (email, eventId, locationLabel). Declared in Prisma, recreated with NULLS NOT DISTINCT.
DROP INDEX "event_notify_requests_target_key";
CREATE UNIQUE INDEX "event_notify_requests_target_key" ON "event_notify_requests" ("email", "event_id", "location_label") NULLS NOT DISTINCT;
-- Sequence (name, scope): both columns are NOT NULL and form the primary key — already covered.

-- ─── CHECK constraints (FIA-002: numeric bounds of the "Règles" column, plus stated value rules) ─
-- 02 § 1.3 Membership: elevatedUntil and elevationReason required with elevatedRole.
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_elevation_check"
  CHECK ("elevated_role" IS NULL OR ("elevated_until" IS NOT NULL AND "elevation_reason" IS NOT NULL));
-- 02 § 1.5 AuthToken: userId required for CLIENT_PREVIEW and LOGIN_CHALLENGE.
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_check"
  CHECK ("purpose" NOT IN ('CLIENT_PREVIEW', 'LOGIN_CHALLENGE') OR "user_id" IS NOT NULL);
-- 02 § 1.6 Consent (immutable rows).
ALTER TABLE "consents" ADD CONSTRAINT "consents_subject_check"            -- MOD-106: at least one subject
  CHECK (num_nonnulls("user_id", "client_id", "lead_id", "registration_id") >= 1);
ALTER TABLE "consents" ADD CONSTRAINT "consents_party_check"              -- partyId required for PARTY_AUTHORIZATION
  CHECK ("type" <> 'PARTY_AUTHORIZATION' OR "party_id" IS NOT NULL);
ALTER TABLE "consents" ADD CONSTRAINT "consents_document_version_check"   -- documentVersion required (TERMS_OF_USE, PRIVACY_POLICY; PARTNER_CHARTER per § 3.11)
  CHECK ("type" NOT IN ('TERMS_OF_USE', 'PRIVACY_POLICY', 'PARTNER_CHARTER') OR "document_version" IS NOT NULL);
ALTER TABLE "consents" ADD CONSTRAINT "consents_wording_check"            -- wording required for these four types
  CHECK ("type" NOT IN ('CONTACT_REQUEST', 'MARKETING_EMAIL', 'DATA_SHARING_PARTNERS', 'PARTY_AUTHORIZATION') OR "wording" IS NOT NULL);
ALTER TABLE "consents" ADD CONSTRAINT "consents_staff_proof_check"        -- consent recorded by the team: proof or note required
  CHECK ("recorded_by_id" IS NULL OR "proof_document_id" IS NOT NULL OR "proof_note" IS NOT NULL);
-- 02 § 2.5 ExchangeRate.
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_rate_check" CHECK ("rate" > 0);
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currencies_check" CHECK ("to_currency" <> "from_currency");
-- 02 § 3.1 Promoter: foundedYear from 1900 (the upper bound, the current year, is checked by the schema).
ALTER TABLE "promoters" ADD CONSTRAINT "promoters_founded_year_check" CHECK ("founded_year" >= 1900);
-- 02 § 3.2 / § 3.4 contacts: email or phone; answersRequests requires an e-mail address.
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_reachable_check" CHECK (num_nonnulls("email", "phone") >= 1);
ALTER TABLE "promoter_contacts" ADD CONSTRAINT "promoter_contacts_answers_requests_check" CHECK (NOT "answers_requests" OR "email" IS NOT NULL);
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_reachable_check" CHECK (num_nonnulls("email", "phone") >= 1);
ALTER TABLE "bank_contacts" ADD CONSTRAINT "bank_contacts_answers_requests_check" CHECK (NOT "answers_requests" OR "email" IS NOT NULL);
-- 02 § 3.3 Bank: PORTAL transmission only for a level-3 bank.
ALTER TABLE "banks" ADD CONSTRAINT "banks_transmission_mode_check" CHECK ("default_transmission_mode" <> 'PORTAL' OR "access_level" = 'PORTAL');
-- 02 § 3.5 BankProduct.
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_islamic_label_check" CHECK ("islamic_contract_label" IS NULL OR "financing_type" = 'ISLAMIC');
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_nominal_rate_check" CHECK ("nominal_rate_bps" BETWEEN 0 AND 3000);
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_amounts_check" CHECK ("min_amount" > 0 AND "max_amount" > 0 AND "min_amount" <= "max_amount");
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_durations_check"
  CHECK ("min_duration_months" BETWEEN 12 AND 480 AND "max_duration_months" BETWEEN 12 AND 480 AND "min_duration_months" <= "max_duration_months");
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_debt_ratio_check" CHECK ("max_debt_ratio_pct" BETWEEN 1 AND 100);
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_down_payment_check" CHECK ("min_down_payment_pct" BETWEEN 0 AND 90);
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_max_age_check" CHECK ("max_age_at_end" BETWEEN 50 AND 90);
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_insurance_rate_check" CHECK ("insurance_rate_bps" BETWEEN 0 AND 500);
ALTER TABLE "bank_products" ADD CONSTRAINT "bank_products_file_fee_pct_check" CHECK ("file_fee_pct" BETWEEN 0 AND 10);
-- 03 § 1 / § 2: deliveryDate required unless DELIVERED.
ALTER TABLE "programs" ADD CONSTRAINT "programs_delivery_date_check" CHECK ("delivery_status" = 'DELIVERED' OR "delivery_date" IS NOT NULL);
ALTER TABLE "properties" ADD CONSTRAINT "properties_delivery_date_check" CHECK ("delivery_status" = 'DELIVERED' OR "delivery_date" IS NOT NULL);
-- 03 § 2 Property.
ALTER TABLE "properties" ADD CONSTRAINT "properties_rooms_check" CHECK (       -- required 1–12 for APARTMENT, DUPLEX, VILLA; 1 for STUDIO; null for LAND, COMMERCIAL
  ("type" IN ('APARTMENT', 'DUPLEX', 'VILLA') AND "rooms" BETWEEN 1 AND 12)
  OR ("type" = 'STUDIO' AND "rooms" = 1)
  OR ("type" IN ('LAND', 'COMMERCIAL') AND "rooms" IS NULL));
ALTER TABLE "properties" ADD CONSTRAINT "properties_bedrooms_check" CHECK ("bedrooms" BETWEEN 0 AND 11 AND "bedrooms" < "rooms");
ALTER TABLE "properties" ADD CONSTRAINT "properties_bathrooms_check" CHECK ("bathrooms" BETWEEN 0 AND 10);
ALTER TABLE "properties" ADD CONSTRAINT "properties_surface_check" CHECK ("surface_m2" > 0 AND "surface_m2" <= 100000);
ALTER TABLE "properties" ADD CONSTRAINT "properties_relevance_score_check" CHECK ("relevance_score" BETWEEN 0 AND 100);
ALTER TABLE "properties" ADD CONSTRAINT "properties_completeness_score_check" CHECK ("completeness_score" BETWEEN 0 AND 100);
-- 03 § 3 Lot.
ALTER TABLE "lots" ADD CONSTRAINT "lots_floor_check" CHECK ("floor" BETWEEN -2 AND 80);
ALTER TABLE "lots" ADD CONSTRAINT "lots_surface_check" CHECK ("surface_m2" > 0);
ALTER TABLE "lots" ADD CONSTRAINT "lots_price_check" CHECK ("price" > 0);
-- 03 § 4 Media.
ALTER TABLE "media" ADD CONSTRAINT "media_source_check" CHECK ("storage_key" IS NOT NULL OR "external_url" IS NOT NULL);
ALTER TABLE "media" ADD CONSTRAINT "media_room_label_check" CHECK ("kind" <> 'PANO_360' OR "room_label" IS NOT NULL);
ALTER TABLE "media" ADD CONSTRAINT "media_cover_kind_check" CHECK (NOT "is_cover" OR "kind" IN ('PHOTO', 'RENDER_3D'));
-- 03 § 5 PropertyPoi: program or property (one of the two); 1 to 120 minutes.
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_owner_check" CHECK (num_nonnulls("program_id", "property_id") = 1);
ALTER TABLE "property_pois" ADD CONSTRAINT "property_pois_minutes_check" CHECK ("minutes" BETWEEN 1 AND 120);
-- 03 § 6 ProgramUpdate.
ALTER TABLE "program_updates" ADD CONSTRAINT "program_updates_percent_check" CHECK ("percent" BETWEEN 0 AND 100);
-- 03 § 7 FinancingEligibility: program or property (one of the two).
ALTER TABLE "financing_eligibilities" ADD CONSTRAINT "financing_eligibilities_target_check" CHECK (num_nonnulls("program_id", "property_id") = 1);
-- 04 § 1.1 Client.
ALTER TABLE "clients" ADD CONSTRAINT "clients_score_check" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "clients" ADD CONSTRAINT "clients_income_currency_check"            -- MOD-008
  CHECK (num_nonnulls("monthly_income", "other_monthly_income", "monthly_debts") = 0 OR "income_currency" IS NOT NULL);
ALTER TABLE "clients" ADD CONSTRAINT "clients_down_payment_currency_check" CHECK ("down_payment" IS NULL OR "down_payment_currency" IS NOT NULL);   -- MOD-008
ALTER TABLE "clients" ADD CONSTRAINT "clients_budget_currency_check" CHECK ("budget_max" IS NULL OR "budget_currency" IS NOT NULL);                 -- MOD-008
ALTER TABLE "clients" ADD CONSTRAINT "clients_budget_monthly_currency_check" CHECK ("budget_monthly" IS NULL OR "budget_monthly_currency" IS NOT NULL); -- MOD-008
ALTER TABLE "clients" ADD CONSTRAINT "clients_do_not_contact_check" CHECK (NOT "do_not_contact" OR "do_not_contact_reason" IS NOT NULL);           -- CRM-060
ALTER TABLE "clients" ADD CONSTRAINT "clients_restriction_check" CHECK ("restricted_at" IS NULL OR "restriction_reason" IS NOT NULL);
-- 04 § 1.3 Lead.
ALTER TABLE "leads" ADD CONSTRAINT "leads_spam_score_check" CHECK ("spam_score" BETWEEN 0 AND 100);
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_fields_check"                -- partner application fields only on PARTNER_REQUEST
  CHECK ("kind" = 'PARTNER_REQUEST' OR ("partner_kind" IS NULL AND "application_status" IS NULL));
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_interest_check"             -- PROPERTY_INTEREST: propertyId, or else programId (DEM-012)
  CHECK ("kind" <> 'PROPERTY_INTEREST' OR num_nonnulls("property_id", "program_id") >= 1);
-- 04 § 2.1 Dossier.
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_duration_check" CHECK ("duration_months" BETWEEN 12 AND 480);
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_completeness_check" CHECK ("completeness_pct" BETWEEN 0 AND 100);
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_currencies_check" CHECK (       -- MOD-008: never an amount without its currency
  ("purchase_price" IS NULL OR "purchase_currency" IS NOT NULL)
  AND ("down_payment" IS NULL OR "down_payment_currency" IS NOT NULL)
  AND ("loan_amount_requested" IS NULL OR "loan_currency" IS NOT NULL)
  AND ("sale_amount" IS NULL OR "sale_currency" IS NOT NULL)
  AND ("commission_amount" IS NULL OR "commission_currency" IS NOT NULL)
  AND ("client_fee_amount" IS NULL OR "client_fee_currency" IS NOT NULL));
-- 04 § 2.2 DossierParty.
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_client_check"    -- clientId required for PRIMARY, null otherwise
  CHECK (("role" = 'PRIMARY') = ("client_id" IS NOT NULL));
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_primary_fields_check" CHECK (   -- MOD-322: PRIMARY reads everything from Client
  "role" <> 'PRIMARY' OR num_nonnulls("first_name", "last_name", "relationship", "birth_date", "email", "phone", "country_of_residence",
    "residency_status", "employment_type", "profession", "monthly_income", "monthly_debts", "income_currency") = 0);
ALTER TABLE "dossier_parties" ADD CONSTRAINT "dossier_parties_income_currency_check"          -- MOD-008
  CHECK (num_nonnulls("monthly_income", "monthly_debts") = 0 OR "income_currency" IS NOT NULL);
-- 04 § 2.5 Reservation.
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_check" CHECK ("deposit_amount" > 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_deposit_currency_check"                -- MOD-008 (refund in the deposit currency)
  CHECK (num_nonnulls("deposit_amount", "deposit_refunded_amount") = 0 OR "deposit_currency" IS NOT NULL);
-- 04 § 2.6 Appointment.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_period_check" CHECK ("ends_at" > "starts_at");
-- 04 § 3.1 ChecklistTemplate: bankId required for BANK_FILE, forbidden for CLIENT_FILE.
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_bank_check" CHECK (("scope" = 'BANK_FILE') = ("bank_id" IS NOT NULL));
-- 04 § 3.2 / § 3.3: maxFiles 1 to 20.
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_max_files_check" CHECK ("max_files" BETWEEN 1 AND 20);
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_max_files_check" CHECK ("max_files" BETWEEN 1 AND 20);
-- 04 § 4.1 BankSubmission.
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_requested_amount_check" CHECK ("requested_amount" > 0);
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_requested_duration_check" CHECK ("requested_duration_months" BETWEEN 12 AND 480);
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_approved_amount_check" CHECK ("approved_amount" > 0);
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_approved_rate_check" CHECK ("approved_rate_bps" BETWEEN 0 AND 3000);
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_approved_duration_check" CHECK ("approved_duration_months" BETWEEN 12 AND 480);
ALTER TABLE "bank_submissions" ADD CONSTRAINT "bank_submissions_approved_insurance_check" CHECK ("approved_insurance_rate_bps" BETWEEN 0 AND 500);
-- 04 § 4.3 SecureShare: the target required by the purpose.
ALTER TABLE "secure_shares" ADD CONSTRAINT "secure_shares_target_check" CHECK (
  ("purpose" = 'SUBMISSION_PACKAGE' AND "package_id" IS NOT NULL)
  OR ("purpose" = 'PERSONAL_DATA_EXPORT' AND "export_job_id" IS NOT NULL)
  OR ("purpose" = 'PARTNER_REQUEST' AND "entity_type" IS NOT NULL AND "entity_id" IS NOT NULL));
-- 02 § 3.8 PartnerAnswer: route LINK (with its link) or PORTAL (with its user).
ALTER TABLE "partner_answers" ADD CONSTRAINT "partner_answers_route_check" CHECK (
  ("route" = 'LINK' AND "secure_share_id" IS NOT NULL) OR ("route" = 'PORTAL' AND "user_id" IS NOT NULL));
-- 05 § 1.2 Communication.
ALTER TABLE "communications" ADD CONSTRAINT "communications_delivery_state_check" CHECK (("channel" = 'EMAIL') = ("delivery_state" IS NOT NULL)); -- e-mail only
ALTER TABLE "communications" ADD CONSTRAINT "communications_call_outcome_check" CHECK ("channel" <> 'CALL' OR "call_outcome" IS NOT NULL);
-- 05 § 1.4 NotificationPreference: exactly one of userId, clientId.
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_owner_check" CHECK (num_nonnulls("user_id", "client_id") = 1);
-- 05 § 1.5 WorkflowRule: delayValue 0 to 365.
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_delay_check" CHECK ("delay_value" BETWEEN 0 AND 365);
-- 05 § 2.2 SurveyInvitation: cancelReason required with cancelledAt.
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_cancel_check" CHECK ("cancelled_at" IS NULL OR "cancel_reason" IS NOT NULL);
-- 05 § 2.3 Feedback.
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_nps_check" CHECK ("nps_score" BETWEEN 0 AND 10);
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_csat_check" CHECK ("csat_score" BETWEEN 1 AND 5);
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_listing_error_check" CHECK ("kind" <> 'LISTING_ERROR' OR "listing_error_kind" IS NOT NULL);
-- 05 § 3.1 Event; MOD-410 and FIA-002 (capacity ≥ seats taken).
ALTER TABLE "events" ADD CONSTRAINT "events_period_check" CHECK ("ends_at" > "starts_at");
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_check" CHECK ("capacity" BETWEEN 1 AND 500);
ALTER TABLE "events" ADD CONSTRAINT "events_seats_taken_check" CHECK ("seats_taken" <= "capacity");
ALTER TABLE "events" ADD CONSTRAINT "events_max_seats_check" CHECK ("max_seats_per_registration" >= 1);
-- 05 § 3.2 EventPartner: exactly one of promoterId, bankId, partnerId.
ALTER TABLE "event_partners" ADD CONSTRAINT "event_partners_target_check" CHECK (num_nonnulls("promoter_id", "bank_id", "partner_id") = 1);
-- 05 § 3.3 EventRegistration: at least one seat (the upper bound is the event's maxSeatsPerRegistration).
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_seats_check" CHECK ("seats" >= 1);
-- 05 § 4.4 Testimonial: written consent required to publish.
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_consent_check" CHECK (NOT "is_published" OR "consent_at" IS NOT NULL);
-- 05 § 4.6 Redirect.
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_status_code_check" CHECK ("status_code" IN (301, 302));
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_from_path_check" CHECK ("from_path" LIKE '/%');
