-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'responder', 'viewer');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('operational', 'degraded', 'partial_outage', 'major_outage');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('triggered', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "IncidentEventType" AS ENUM ('triggered', 'acknowledged', 'escalated', 'comment', 'resolved');

-- CreateEnum
CREATE TYPE "EscalationTargetType" AS ENUM ('rotation', 'user');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentStatus" "ServiceStatus" NOT NULL DEFAULT 'operational',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rotation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentPointer" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RotationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationPolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationStep" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "escalationPolicyId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "waitMinutes" INTEGER NOT NULL,
    "targetType" "EscalationTargetType" NOT NULL,
    "targetRotationId" TEXT,
    "targetUserId" TEXT,

    CONSTRAINT "EscalationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'triggered',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'high',
    "escalationPolicyId" TEXT,
    "currentEscalationStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "IncidentEventType" NOT NULL,
    "actorId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Service_orgId_idx" ON "Service"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_orgId_name_key" ON "Service"("orgId", "name");

-- CreateIndex
CREATE INDEX "Rotation_orgId_idx" ON "Rotation"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Rotation_orgId_name_key" ON "Rotation"("orgId", "name");

-- CreateIndex
CREATE INDEX "RotationMember_orgId_idx" ON "RotationMember"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationId_userId_key" ON "RotationMember"("rotationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationId_position_key" ON "RotationMember"("rotationId", "position");

-- CreateIndex
CREATE INDEX "EscalationPolicy_orgId_idx" ON "EscalationPolicy"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationPolicy_orgId_name_key" ON "EscalationPolicy"("orgId", "name");

-- CreateIndex
CREATE INDEX "EscalationStep_orgId_idx" ON "EscalationStep"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "EscalationStep_escalationPolicyId_stepOrder_key" ON "EscalationStep"("escalationPolicyId", "stepOrder");

-- CreateIndex
CREATE INDEX "Incident_orgId_idx" ON "Incident"("orgId");

-- CreateIndex
CREATE INDEX "Incident_orgId_status_idx" ON "Incident"("orgId", "status");

-- CreateIndex
CREATE INDEX "IncidentEvent_orgId_idx" ON "IncidentEvent"("orgId");

-- CreateIndex
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_orgId_idx" ON "ApiKey"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_prefix_key" ON "ApiKey"("prefix");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rotation" ADD CONSTRAINT "Rotation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationStep" ADD CONSTRAINT "EscalationStep_escalationPolicyId_fkey" FOREIGN KEY ("escalationPolicyId") REFERENCES "EscalationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationStep" ADD CONSTRAINT "EscalationStep_targetRotationId_fkey" FOREIGN KEY ("targetRotationId") REFERENCES "Rotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_escalationPolicyId_fkey" FOREIGN KEY ("escalationPolicyId") REFERENCES "EscalationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

