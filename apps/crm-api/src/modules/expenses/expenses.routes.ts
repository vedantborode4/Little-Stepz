import { Router, type Request, type Response } from "express";
import {
  createExpenseSchema,
  EXPENSE_KIND_LABELS,
  expenseCategorySchema,
  expenseListQuery,
  idParam,
  includeInactiveQuery,
  updateExpenseCategorySchema,
  voidExpenseSchema,
} from "@repo/crm-schema";
import { requirePermission } from "../../core/auth";
import { sendExport } from "../../core/export";
import { requestContext, sendData } from "../../core/http";
import * as expenses from "./expenses.service";

const manage = requirePermission("expenses.manage");

export const expensesRoutes = Router();

expensesRoutes.get("/categories", manage, async (req: Request, res: Response) => {
  const { includeInactive } = includeInactiveQuery.parse(req.query);
  sendData(res, await expenses.listCategories(includeInactive));
});

expensesRoutes.post("/categories", manage, async (req: Request, res: Response) => {
  sendData(res, await expenses.createCategory(expenseCategorySchema.parse(req.body), requestContext(req)), 201);
});

expensesRoutes.patch("/categories/:id", manage, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await expenses.updateCategory(id, updateExpenseCategorySchema.parse(req.body), requestContext(req)));
});

expensesRoutes.get("/", manage, async (req: Request, res: Response) => {
  const query = expenseListQuery.parse(req.query);
  const result = await expenses.listExpenses(query);
  if (query.format) {
    return sendExport(res, {
      filename: "expenses",
      format: query.format,
      rows: result.items,
      columns: [
        { header: "Expense", value: (e) => e.code },
        { header: "Date", value: (e) => e.businessDate },
        { header: "Category", value: (e) => e.category.name },
        { header: "Kind", value: (e) => EXPENSE_KIND_LABELS[e.kind] },
        { header: "Order", value: (e) => e.order?.code ?? "" },
        { header: "Paid from", value: (e) => e.account.name, width: 22 },
        { header: "Amount (INR)", value: (e) => (e.reversalOf ? -Number(e.amount) : Number(e.amount)) },
        { header: "Vendor", value: (e) => e.vendor ?? "", width: 22 },
        { header: "Reference", value: (e) => e.reference ?? "" },
        { header: "Voids", value: (e) => e.reversalOf?.code ?? "" },
        { header: "Voided by", value: (e) => e.reversedBy?.code ?? "" },
        { header: "Notes", value: (e) => e.notes ?? "", width: 30 },
      ],
    });
  }
  sendData(res, result);
});

expensesRoutes.post("/", manage, async (req: Request, res: Response) => {
  sendData(res, await expenses.createExpense(createExpenseSchema.parse(req.body), requestContext(req)), 201);
});

expensesRoutes.get("/:id", manage, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendData(res, await expenses.getExpense(id));
});

expensesRoutes.post("/:id/void", manage, async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { reason } = voidExpenseSchema.parse(req.body);
  sendData(res, await expenses.voidExpense(id, reason, requestContext(req)));
});
