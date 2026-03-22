/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `tenants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."tenants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BOB',
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/La_Paz';

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "public"."tenants"("email");
