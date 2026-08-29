-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('PENDING', 'PASSED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('NEW', 'UNCHANGED', 'CHANGED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "repoSlug" TEXT,
    "githubToken" TEXT,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Build" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "prNumber" INTEGER,
    "status" "BuildStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Build_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "baselineKey" TEXT,
    "diffKey" TEXT,
    "diffPercent" DOUBLE PRECISION,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'UNCHANGED',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "snapshotId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_token_key" ON "Project"("token");

-- CreateIndex
CREATE INDEX "Build_projectId_createdAt_idx" ON "Build"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Snapshot_buildId_idx" ON "Snapshot"("buildId");

-- CreateIndex
CREATE UNIQUE INDEX "Baseline_projectId_branch_name_viewport_key" ON "Baseline"("projectId", "branch", "name", "viewport");

-- AddForeignKey
ALTER TABLE "Build" ADD CONSTRAINT "Build_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "Build"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baseline" ADD CONSTRAINT "Baseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
