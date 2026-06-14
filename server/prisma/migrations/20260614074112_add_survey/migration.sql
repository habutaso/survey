-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "surveyType" TEXT NOT NULL,
    "parentSurveyId" TEXT,
    "status" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "structureType" TEXT NOT NULL,
    "buildingName" TEXT,
    "floors" INTEGER,
    "victimName" TEXT,
    "victimContact" TEXT,
    "victimAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "damageRatio" DOUBLE PRECISION,
    "damageLevel" TEXT,
    "assessmentBasis" JSONB,
    "officialSurveyId" TEXT,
    "officialChosenBy" TEXT,
    "officialChosenAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstSurvey" (
    "surveyId" TEXT NOT NULL,
    "externalForceFlags" JSONB NOT NULL,
    "tiltRatio" DOUBLE PRECISION,
    "inundationDepthCm" DOUBLE PRECISION,
    "floorApportionment" JSONB,

    CONSTRAINT "FirstSurvey_pkey" PRIMARY KEY ("surveyId")
);

-- CreateTable
CREATE TABLE "SecondSurvey" (
    "surveyId" TEXT NOT NULL,
    "partDamages" JSONB NOT NULL,
    "floorApportionment" JSONB,

    CONSTRAINT "SecondSurvey_pkey" PRIMARY KEY ("surveyId")
);

-- AddForeignKey
ALTER TABLE "FirstSurvey" ADD CONSTRAINT "FirstSurvey_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecondSurvey" ADD CONSTRAINT "SecondSurvey_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
