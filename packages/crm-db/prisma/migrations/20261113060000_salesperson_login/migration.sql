-- A salesperson can be linked to the CRM login that sees their commission ("My commission").
ALTER TABLE "public"."Salesperson" ADD COLUMN     "userId" TEXT;

CREATE UNIQUE INDEX "Salesperson_userId_key" ON "public"."Salesperson"("userId");

ALTER TABLE "public"."Salesperson" ADD CONSTRAINT "Salesperson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
