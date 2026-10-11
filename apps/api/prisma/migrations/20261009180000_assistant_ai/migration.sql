-- 05-phases-ulterieures/04 IA-005, IA-013 — conversational assistant (ASS-052, D-090): conversations kept 30 days, monthly spend.
-- Required list columns are NOT NULL (convention of the init migration).
-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "property_references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "handoff_reason" VARCHAR(40),
    "visitor_turns" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" BIGINT NOT NULL DEFAULT 0,
    "flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_months" (
    "usage" VARCHAR(40) NOT NULL,
    "month" CHAR(7) NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cost_micros" BIGINT NOT NULL DEFAULT 0,
    "alerted_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_usage_months_pkey" PRIMARY KEY ("usage","month")
);

-- CreateIndex
CREATE INDEX "assistant_conversations_expires_at_idx" ON "assistant_conversations"("expires_at");

