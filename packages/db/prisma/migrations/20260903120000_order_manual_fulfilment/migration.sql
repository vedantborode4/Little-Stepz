-- Local (non-courier) fulfilment. Defaults false so every existing order keeps
-- going through Delhivery exactly as before.
ALTER TABLE "Order" ADD COLUMN "manualFulfilment" BOOLEAN NOT NULL DEFAULT false;
