-- AddForeignKey
ALTER TABLE "public"."PurchaseShipment" ADD CONSTRAINT "PurchaseShipment_stockDocumentId_fkey" FOREIGN KEY ("stockDocumentId") REFERENCES "public"."StockDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_stockDocumentId_fkey" FOREIGN KEY ("stockDocumentId") REFERENCES "public"."StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
