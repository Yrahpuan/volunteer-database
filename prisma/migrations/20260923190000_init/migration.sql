-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INSTITUTE_COORDINATOR', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "VolunteerType" AS ENUM ('REGISTERED_MEMBER', 'EFFECTIVE_MEMBER');

-- CreateEnum
CREATE TYPE "VolunteerActivityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ParticipationMode" AS ENUM ('ALL_SCHEDULES', 'SELECTED_SCHEDULES');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VALID', 'EXPIRING', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('VOLUNTEER', 'COORDINATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentTypeCode" AS ENUM ('BACKGROUND_CHECK', 'VOLUNTEER_AGREEMENT', 'LGPD_CONSENT', 'FOOD_HANDLING', 'DRIVER_RESPONSIBILITY', 'CONFIDENTIALITY', 'IMAGE_USAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "volunteer_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "crm_person_id" TEXT,
    "full_name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birth_date" DATE,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "volunteer_type" "VolunteerType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_activities" (
    "id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "erp_activity_id" TEXT NOT NULL,
    "selected_schedule_ids" TEXT[],
    "participation_mode" "ParticipationMode" NOT NULL,
    "status" "VolunteerActivityStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteer_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "volunteer_activity_id" UUID NOT NULL,
    "erp_schedule_id" TEXT NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "code" "DocumentTypeCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "default_validity_days" INTEGER,
    "access_level" "DocumentAccessLevel" NOT NULL DEFAULT 'ADMIN',

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "volunteer_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "issue_date" DATE,
    "expiration_date" DATE,
    "certificate_number" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_volunteer_id_key" ON "users"("volunteer_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_crm_person_id_key" ON "volunteers"("crm_person_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_cpf_key" ON "volunteers"("cpf");

-- CreateIndex
CREATE INDEX "volunteers_full_name_idx" ON "volunteers"("full_name");

-- CreateIndex
CREATE INDEX "volunteers_crm_person_id_idx" ON "volunteers"("crm_person_id");

-- CreateIndex
CREATE INDEX "volunteers_volunteer_type_idx" ON "volunteers"("volunteer_type");

-- CreateIndex
CREATE INDEX "volunteer_activities_erp_activity_id_idx" ON "volunteer_activities"("erp_activity_id");

-- CreateIndex
CREATE INDEX "volunteer_activities_volunteer_id_status_idx" ON "volunteer_activities"("volunteer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_activities_volunteer_id_erp_activity_id_key" ON "volunteer_activities"("volunteer_id", "erp_activity_id");

-- CreateIndex
CREATE INDEX "attendance_records_volunteer_id_occurrence_date_idx" ON "attendance_records"("volunteer_id", "occurrence_date");

-- CreateIndex
CREATE INDEX "attendance_records_erp_schedule_id_occurrence_date_idx" ON "attendance_records"("erp_schedule_id", "occurrence_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_volunteer_id_erp_schedule_id_occurrence__key" ON "attendance_records"("volunteer_id", "erp_schedule_id", "occurrence_date");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_code_key" ON "document_types"("code");

-- CreateIndex
CREATE INDEX "documents_volunteer_id_idx" ON "documents"("volunteer_id");

-- CreateIndex
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");

-- CreateIndex
CREATE INDEX "documents_expiration_date_idx" ON "documents"("expiration_date");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_activities" ADD CONSTRAINT "volunteer_activities_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_volunteer_activity_id_fkey" FOREIGN KEY ("volunteer_activity_id") REFERENCES "volunteer_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
