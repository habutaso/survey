-- CreateIndex
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- CreateIndex
CREATE INDEX "Survey_surveyType_idx" ON "Survey"("surveyType");

-- CreateIndex
CREATE INDEX "Survey_createdBy_idx" ON "Survey"("createdBy");

-- CreateIndex
CREATE INDEX "Survey_createdAt_idx" ON "Survey"("createdAt");
