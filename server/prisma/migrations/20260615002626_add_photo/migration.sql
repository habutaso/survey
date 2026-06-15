-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "part" TEXT,
    "step" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Photo_surveyId_idx" ON "Photo"("surveyId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
