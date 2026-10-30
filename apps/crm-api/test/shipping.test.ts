import { randomInt, randomUUID } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@repo/crm-db/client";
import { api, sessionAs, type TestSession } from "./helpers";

let admin: TestSession;
let cashier: TestSession;
let ops: TestSession;
let categoryId: string;
let store: string;
let courierId: string;

const uid = () => randomUUID().slice(0, 6).toUpperCase();
const awb = () => `AWB${randomInt(0, 1e9)}${uid()}`;

beforeAll(async () => {
  [admin, cashier, ops] = await Promise.all([sessionAs("ADMIN"), sessionAs("CASHIER"), sessionAs("OPS")]);
  categoryId = (
    await api()
      .post("/api/v1/categories")
      .set(admin.auth)
      .send({ name: `Ship ${uid()}` })
  ).body.data.id;
  store = (
    await api()
      .post("/api/v1/settings/locations")
      .set(admin.auth)
      .send({ code: `SH${uid()}`, name: "Ship store", type: "STORE" })
  ).body.data.id;
  const courier = await api()
    .post("/api/v1/couriers")
    .set(admin.auth)
    .send({ name: `Delhivery ${uid()}`, trackingUrlTemplate: "https://www.delhivery.com/track/package/{awb}" });
  expect(courier.status).toBe(201);
  courierId = courier.body.data.id;
});

async function item(stock = 5) {
  const res = await api()
    .post("/api/v1/products")
    .set(admin.auth)
    .send({ name: `Ship item ${uid()}`, categoryId, gstRate: "18", variants: [{ sku: `SH-${uid()}`, regularPrice: "1000" }] });
  const variantId = res.body.data.variants[0].id as string;
  await api()
    .post("/api/v1/inventory/opening")
    .set(admin.auth)
    .send({ locationId: store, lines: [{ variantId, quantity: stock, unitCost: "400" }] });
  return variantId;
}

async function customer() {
  const res = await api()
    .post("/api/v1/customers")
    .set(admin.auth)
    .send({ name: `Ship to ${uid()}`, mobile: `9${String(randomInt(0, 1e9)).padStart(9, "0")}`, city: "Pune", pincode: "411001" });
  return res.body.data.id as string;
}

async function deliveryOrder(variantId: string, customerId?: string, extra: Record<string, unknown> = {}) {
  const res = await api()
    .post("/api/v1/sales")
    .set(admin.auth)
    .send({
      locationId: store,
      channel: "INSTAGRAM",
      fulfilment: "DELIVERY",
      customerId: customerId ?? (await customer()),
      shippingCharged: "99",
      confirm: true,
      lines: [{ variantId, quantity: 1 }],
      ...extra,
    });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; code: string };
}

const createShipment = (body: Record<string, unknown>, session = ops) => api().post("/api/v1/shipments").set(session.auth).send(body);
const move = (id: string, status: string, note?: string) =>
  api().post(`/api/v1/shipments/${id}/status`).set(ops.auth).send({ status, note });
const order = async (id: string) => (await api().get(`/api/v1/sales/${id}`).set(admin.auth)).body.data;
const physical = async (variantId: string) =>
  (await api().get(`/api/v1/inventory/variants/${variantId}`).set(admin.auth)).body.data.stock.physical;

describe("Scenario G — customer, order, courier and AWB through to delivered", () => {
  it("drives the order from the shipment and keeps the history", async () => {
    const variantId = await item();
    const buyer = await customer();
    const o = await deliveryOrder(variantId, buyer);
    const code = awb();

    const created = await createShipment({
      orderId: o.id,
      courierId,
      courierCost: "65",
      packages: [{ awb: code.toLowerCase(), weightKg: "0.8" }],
    });
    expect(created.status).toBe(201);
    const s = created.body.data;
    expect(s).toMatchObject({
      code: expect.stringMatching(/^SHP-\d{5}$/),
      status: "PENDING",
      awbs: [code],
      courierCost: "65.00",
      chargedToCustomer: "99.00",
      nextStatuses: ["PACKED", "DISPATCHED", "CANCELLED"],
    });
    expect(s.packages[0].trackingUrl).toBe(`https://www.delhivery.com/track/package/${code}`);
    expect((await order(o.id)).activeShipment).toMatchObject({ id: s.id, status: "PENDING" });

    expect((await move(s.id, "PACKED")).body.data.status).toBe("PACKED");
    expect((await order(o.id)).status).toBe("PACKED");
    expect(await physical(variantId)).toBe(5);

    await move(s.id, "DISPATCHED", "Picked up 4pm");
    expect(await order(o.id)).toMatchObject({ status: "DISPATCHED", fulfilledAt: expect.any(String) });
    expect(await physical(variantId)).toBe(4);

    await move(s.id, "IN_TRANSIT");
    const delivered = await move(s.id, "DELIVERED", "Signed by customer");
    expect(delivered.body.data).toMatchObject({ status: "DELIVERED", deliveredAt: expect.any(String), nextStatuses: [] });
    expect(delivered.body.data.events.map((e: { status: string }) => e.status)).toEqual([
      "PENDING",
      "PACKED",
      "DISPATCHED",
      "IN_TRANSIT",
      "DELIVERED",
    ]);
    expect((await order(o.id)).status).toBe("DELIVERED");
    expect(await physical(variantId)).toBe(4);

    await expect(prisma.shipmentEvent.deleteMany({ where: { shipmentId: s.id } })).rejects.toThrow();
  });
});

describe("shipment rules", () => {
  it("needs a courier and an AWB to dispatch, and keeps statuses in order", async () => {
    const variantId = await item();
    const o = await deliveryOrder(variantId);
    const s = (await createShipment({ orderId: o.id })).body.data;
    expect((await move(s.id, "DELIVERED")).body.error.code).toBe("INVALID_TRANSITION");
    expect((await move(s.id, "DISPATCHED")).body.error.code).toBe("COURIER_REQUIRED");
    await api().patch(`/api/v1/shipments/${s.id}`).set(ops.auth).send({ courierId });
    expect((await move(s.id, "DISPATCHED")).body.error.code).toBe("AWB_REQUIRED");
    const withParcel = await api().post(`/api/v1/shipments/${s.id}/packages`).set(ops.auth).send({ awb: awb() });
    expect(withParcel.body.data.packages).toHaveLength(1);
    expect((await move(s.id, "DISPATCHED")).body.data.status).toBe("DISPATCHED");

    const pkgId = withParcel.body.data.packages[0].id as string;
    expect((await api().delete(`/api/v1/shipments/${s.id}/packages/${pkgId}`).set(ops.auth)).body.error.code).toBe("ALREADY_DISPATCHED");
    await expect(prisma.shipmentPackage.delete({ where: { id: pkgId } })).rejects.toThrow(/locked/);
    expect((await api().patch(`/api/v1/shipments/${s.id}`).set(ops.auth).send({ courierId: null })).body.error.code).toBe(
      "ALREADY_DISPATCHED",
    );
    expect((await api().patch(`/api/v1/shipments/${s.id}`).set(ops.auth).send({ courierCost: "80" })).body.data.courierCost).toBe("80.00");
  });

  it("never books the same AWB twice", async () => {
    const variantId = await item();
    const code = awb();
    const first = await deliveryOrder(variantId);
    const second = await deliveryOrder(variantId);
    expect((await createShipment({ orderId: first.id, courierId, packages: [{ awb: code }] })).status).toBe(201);
    const clash = await createShipment({ orderId: second.id, courierId, packages: [{ awb: code }] });
    expect(clash.body.error.code).toBe("AWB_TAKEN");
  });

  it("allows one open shipment per order, and a new one after cancelling", async () => {
    const variantId = await item();
    const o = await deliveryOrder(variantId);
    const s = (await createShipment({ orderId: o.id, courierId })).body.data;
    expect((await createShipment({ orderId: o.id })).body.error.code).toBe("SHIPMENT_EXISTS");
    await move(s.id, "CANCELLED", "Courier didn't turn up");
    expect((await order(o.id)).activeShipment).toBeNull();
    expect((await createShipment({ orderId: o.id, courierId })).status).toBe(201);
  });

  it("records a parcel coming back, so the goods can then be returned on the order", async () => {
    const variantId = await item();
    const o = await deliveryOrder(variantId);
    const s = (await createShipment({ orderId: o.id, courierId, packages: [{ awb: awb() }] })).body.data;
    await move(s.id, "DISPATCHED");
    await move(s.id, "RTO", "Customer not reachable");
    const back = await move(s.id, "RETURNED");
    expect(back.body.data.status).toBe("RETURNED");
    const detail = await order(o.id);
    expect(detail.events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["shipment_rto", "shipment_returned"]));
    expect(detail.activeShipment).toBeNull();

    const ret = await api()
      .post(`/api/v1/sales/${o.id}/returns`)
      .set(admin.auth)
      .send({ reason: "RTO", lines: [{ orderLineId: detail.lines[0].id, quantity: 1, condition: "RESELLABLE" }], shippingRefund: "99" });
    expect(ret.status).toBe(201);
    expect(await physical(variantId)).toBe(5);
  });

  it("picks up an order that was already dispatched by hand", async () => {
    const variantId = await item();
    const o = await deliveryOrder(variantId);
    await api().post(`/api/v1/sales/${o.id}/fulfil`).set(admin.auth);
    const s = await createShipment({ orderId: o.id, courierId, packages: [{ awb: awb() }] });
    expect(s.body.data).toMatchObject({ status: "DISPATCHED", dispatchedAt: expect.any(String) });
    expect(await physical(variantId)).toBe(4);
  });

  it("only ships delivery orders, and only for staff who handle shipping", async () => {
    const variantId = await item();
    const counter = await api()
      .post("/api/v1/sales")
      .set(admin.auth)
      .send({ locationId: store, channel: "STORE", confirm: true, lines: [{ variantId, quantity: 1 }] });
    expect((await createShipment({ orderId: counter.body.data.id })).body.error.code).toBe("NOT_DELIVERY");

    const o = await deliveryOrder(variantId);
    expect((await createShipment({ orderId: o.id }, cashier)).status).toBe(403);
    expect((await api().get("/api/v1/couriers").set(ops.auth)).status).toBe(200);
    expect(
      (
        await api()
          .post("/api/v1/couriers")
          .set(ops.auth)
          .send({ name: `X ${uid()}` })
      ).status,
    ).toBe(403);
    const bad = await api()
      .post("/api/v1/couriers")
      .set(admin.auth)
      .send({ name: `Y ${uid()}`, trackingUrlTemplate: "https://x.example/track" });
    expect(bad.status).toBe(400);
  });

  it("summarises the board, including delivery orders still waiting for a shipment", async () => {
    const before = (await api().get("/api/v1/shipments/summary").set(ops.auth)).body.data;
    const variantId = await item();
    await deliveryOrder(variantId);
    const after = (await api().get("/api/v1/shipments/summary").set(ops.auth)).body.data;
    expect(after.awaitingShipment - before.awaitingShipment).toBe(1);
    const open = await api().get("/api/v1/shipments").query({ open: "true" }).set(ops.auth);
    expect(open.body.data.items.every((s: { status: string }) => !["DELIVERED", "RETURNED", "CANCELLED"].includes(s.status))).toBe(true);
  });
});
