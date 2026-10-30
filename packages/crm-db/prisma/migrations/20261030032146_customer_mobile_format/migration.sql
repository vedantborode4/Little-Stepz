-- Phones are stored only in E.164 (normalised by the shared schema). Anything
-- else would silently defeat the duplicate-mobile check, so it's refused here.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_phones_e164" CHECK (
  ("mobile" IS NULL OR "mobile" ~ '^\+[1-9][0-9]{7,14}$') AND ("whatsapp" IS NULL OR "whatsapp" ~ '^\+[1-9][0-9]{7,14}$')
);
