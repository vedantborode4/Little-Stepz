import { z } from "zod";
import type { SyncConnection, SyncSource } from "@repo/crm-schema";
import { env } from "../../config/env";
import { ApiError } from "../../core/http";

/*
 * The website is only ever read. These shapes are the contract in
 * docs/crm/WEBSITE_SYNC_CONTRACT.md; responses are validated because they come
 * from another system.
 */

const amount = z.union([z.string(), z.number()]).transform((v) => String(v));

const websiteVariant = z.object({
  id: z.string().min(1),
  sku: z.string().nullable(),
  name: z.string(),
  price: amount,
  salePrice: amount.nullable(),
  stock: z.number().int(),
});

const websiteProduct = z.object({
  id: z.string().min(1),
  name: z.string(),
  status: z.string(),
  variants: z.array(websiteVariant),
});
export type WebsiteProduct = z.infer<typeof websiteProduct>;

const websiteOrder = z.object({
  id: z.string().min(1),
  orderNumber: z.string(),
  status: z.string(),
  isPreOrder: z.boolean(),
  total: amount,
  placedAt: z.string(),
  paymentRefs: z.array(z.string()),
});
export type WebsiteOrder = z.infer<typeof websiteOrder>;

const page = <T extends z.ZodType>(item: T) => z.object({ data: z.object({ items: z.array(item), nextCursor: z.string().nullable() }) });

export interface WebsiteSource {
  kind: SyncSource;
  host: string | null;
  fetchProducts(): Promise<WebsiteProduct[]>;
  /** Orders placed or updated since the given ISO date. */
  fetchOrders(since: string): Promise<WebsiteOrder[]>;
}

const MAX_PAGES = 200;
const TIMEOUT_MS = 15_000;

/** GET-only client for the website's export endpoints, authenticated with a service key. */
export function httpSource(baseUrl: string, key: string): WebsiteSource {
  const base = baseUrl.replace(/\/+$/, "");

  async function getAll<T extends z.ZodType>(path: string, item: T, params: Record<string, string> = {}): Promise<z.infer<T>[]> {
    const out: z.infer<T>[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < MAX_PAGES; i++) {
      const url = new URL(`${base}${path}`);
      for (const [k, v] of Object.entries({ ...params, ...(cursor && { cursor }) })) url.searchParams.set(k, v);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "GET",
          headers: { "X-CRM-Service-Key": key, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        throw new ApiError(502, "SYNC_UNREACHABLE", `The website could not be reached: ${(err as Error).message}`);
      }
      if (res.status === 401 || res.status === 403) throw new ApiError(502, "SYNC_UNAUTHORISED", "The website refused the CRM service key");
      if (!res.ok) throw new ApiError(502, "SYNC_FAILED", `The website answered ${res.status} for ${path}`);
      const parsed = page(item).safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new ApiError(502, "SYNC_BAD_RESPONSE", `The website's ${path} response doesn't match the contract`);
      out.push(...parsed.data.data.items);
      cursor = parsed.data.data.nextCursor;
      if (!cursor) return out;
    }
    throw new ApiError(502, "SYNC_TOO_LARGE", `More than ${MAX_PAGES} pages from ${path}`);
  }

  return {
    kind: "LIVE",
    host: new URL(base).host,
    fetchProducts: () => getAll("/crm-export/products", websiteProduct),
    fetchOrders: (since) => getAll("/crm-export/orders", websiteOrder, { since }),
  };
}

/**
 * SAMPLE data shaped like the website's export, for demos only. It uses the
 * demo catalogue's SKUs so a dry run shows matches, a website-only product and
 * an unlinked variant. It is never the real website and is refused in production.
 */
export const mockSource: WebsiteSource = {
  kind: "MOCK",
  host: null,
  async fetchProducts() {
    return [
      {
        id: "web-p-yegao",
        name: "YEGAO 1:64 Die-cast Car",
        status: "ACTIVE",
        variants: [
          { id: "web-v-yg64-red", sku: "YG64-RED", name: "Red", price: "499", salePrice: "449", stock: 3 },
          { id: "web-v-yg64-blue", sku: "YG64-BLUE", name: "Blue", price: "499", salePrice: null, stock: 2 },
          { id: "web-v-yg64-black", sku: "YG64-BLACK", name: "Black", price: "499", salePrice: null, stock: 4 },
        ],
      },
      {
        id: "web-p-mjx",
        name: "MJX Hyper Go Brushless RC Car",
        status: "ACTIVE",
        variants: [{ id: "web-v-mjx-14", sku: "MJX-HG-14", name: "Default", price: "19999", salePrice: null, stock: 6 }],
      },
      {
        id: "web-p-stanley",
        name: "Stanley Quencher 40oz",
        status: "ACTIVE",
        variants: [
          { id: "web-v-stn-cream", sku: "STN-Q40-CREAM", name: "Cream", price: "4500", salePrice: "4200", stock: 5 },
          { id: "web-v-stn-rose", sku: "STN-Q40-ROSE", name: "Rose Quartz", price: "4500", salePrice: null, stock: 2 },
        ],
      },
      {
        id: "web-p-lego",
        name: "LEGO City Police Car (website only)",
        status: "ACTIVE",
        variants: [{ id: "web-v-lego-60312", sku: "LEGO-60312", name: "Default", price: "999", salePrice: null, stock: 8 }],
      },
    ];
  },
  async fetchOrders() {
    return [
      {
        id: "web-o-1",
        orderNumber: "LS-SAMPLE-1001",
        status: "DELIVERED",
        isPreOrder: false,
        total: "948",
        placedAt: "2026-10-20T10:15:00Z",
        paymentRefs: ["pay_SAMPLE001"],
      },
      {
        id: "web-o-2",
        orderNumber: "LS-SAMPLE-1002",
        status: "CONFIRMED",
        isPreOrder: false,
        total: "19999",
        placedAt: "2026-10-27T08:40:00Z",
        paymentRefs: ["pay_SAMPLE002"],
      },
      {
        id: "web-o-3",
        orderNumber: "LS-SAMPLE-1003",
        status: "BOOKED",
        isPreOrder: true,
        total: "4000",
        placedAt: "2026-10-28T16:05:00Z",
        paymentRefs: ["pay_SAMPLE003"],
      },
    ];
  },
};

export function syncConnection(): SyncConnection {
  return env.WEBSITE_SYNC_MODE === "live" ? "LIVE" : env.WEBSITE_SYNC_MODE === "mock" ? "MOCK" : "OFF";
}

/** The configured source, or a clear refusal while the website isn't connected. */
export function configuredSource(): WebsiteSource {
  const connection = syncConnection();
  if (connection === "LIVE") return httpSource(env.WEBSITE_SYNC_URL!, env.WEBSITE_SYNC_KEY!);
  if (connection === "MOCK") return mockSource;
  throw new ApiError(409, "SYNC_OFF", "The website is not connected. Set WEBSITE_SYNC_MODE once the export endpoints are live.");
}
