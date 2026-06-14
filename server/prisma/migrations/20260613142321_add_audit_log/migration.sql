-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
