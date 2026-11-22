import { buildSchema, graphql } from "graphql";

// Fabric GraphQL API (design: docs in workspace/jpos-import/fabric-api-design.md).
// Read only. Data comes from the D1 sync of the JPOS export: api_fabrics
// (one row per fabric), api_fabric_tiers (the FabricTierPricing ladder) and
// api_fabric_stores (jj_fabricperstore presence per store). Prices are never
// invented: a garment price is null when the fabric's tier has no price for
// that garment kind.

export const FABRIC_GRAPHQL_SCHEMA = `
type GarmentPrices {
  suit: Float
  suitVest: Float
  sportCoat: Float
  dressPants: Float
  vest: Float
  dressShirt: Float
}
type Pricing {
  tier: Float
  fabricPrice: Float
  priceCategory: String
  salePrice: Float
  garments: GarmentPrices
}
type StorePresence {
  storeId: Int
  hanger: Int
}
type GarmentMake {
  garment: String!
  yardsPerGarment: Float!
  count: Int!
  value: Float
}
type Inventory {
  stock: Float
  qtyActual: Float
  qtyReserved: Float
  backorderQty: Float
  purchaseOrderQty: Float
  minimumQty: Float
  stores: [StorePresence!]!
  makes: [GarmentMake!]!
}
type Fabric {
  code: String
  oldCode: String
  id: Int
  type: String
  description: String
  mill: String
  color: String
  colorFamily: String
  pattern: String
  patternCategory: String
  material: String
  content: String
  weight: Float
  season: String
  weave: String
  occasion: String
  image: String
  swatch: Boolean
  active: Boolean
  pricing: Pricing
  inventory: Inventory
}
type FabricList {
  total: Int!
  page: Int!
  pageSize: Int!
  results: [Fabric!]!
}
type Tier {
  tier: Float
  suit: Float
  suitVest: Float
  sportCoat: Float
  dressPants: Float
  vest: Float
  dressShirt: Float
}
type Query {
  fabric(code: String!, type: String): Fabric
  fabrics(q: String, type: String, color: String, colorFamily: String,
    pattern: String, patternCategory: String, material: String, mill: String,
    season: String, weave: String, occasion: String, tier: Float,
    tierMin: Float, tierMax: Float, active: Boolean, store: Int,
    inStock: Boolean, sort: String, page: Int, pageSize: Int): FabricList
  tiers: [Tier!]!
}
`;

type Row = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s === "" ? null : s;
}

function fabricObject(db: D1Database, row: Row) {
  const tier = num(row.tier);
  return {
    code: str(row.code),
    oldCode: str(row.old_code),
    id: num(row.fabric_id),
    type: str(row.type),
    description: str(row.description),
    mill: str(row.mill),
    color: str(row.color),
    colorFamily: str(row.color_family),
    pattern: str(row.pattern),
    patternCategory: str(row.pattern_category),
    material: str(row.material),
    content: str(row.content),
    weight: num(row.weight),
    season: str(row.season),
    weave: str(row.weave),
    occasion: str(row.occasion),
    image: str(row.image),
    swatch: row.swatch === 1 || row.swatch === true,
    active: row.active === 1 || row.active === true,
    pricing: async () => {
      let garments = {
        suit: null as number | null,
        suitVest: null as number | null,
        sportCoat: null as number | null,
        dressPants: null as number | null,
        vest: null as number | null,
        dressShirt: null as number | null,
      };
      if (tier !== null) {
        const ladder = await db
          .prepare("SELECT * FROM api_fabric_tiers WHERE tier = ?")
          .bind(tier)
          .first<Row>();
        if (ladder) {
          garments = {
            suit: num(ladder.suit),
            suitVest: num(ladder.suit_vest),
            sportCoat: num(ladder.sport_coat),
            dressPants: num(ladder.dress_pants),
            vest: num(ladder.vest),
            dressShirt: num(ladder.dress_shirt),
          };
        }
      }
      return {
        tier,
        fabricPrice: num(row.fabric_price),
        priceCategory: str(row.price_cat),
        salePrice: num(row.sale_price),
        garments,
      };
    },
    inventory: async () => {
      const stores = await db
        .prepare(
          "SELECT store_id, hanger FROM api_fabric_stores WHERE fabric_id = ? ORDER BY store_id"
        )
        .bind(row.fabric_id)
        .all<Row>();
      // What the stock on hand would make, and what those garments would
      // sell for at this fabric's tier prices. Yards per garment are the
      // shop's real cutting figures, mined from JPOS fabricused history
      // (api_garment_yield). A value is null whenever the tier has no
      // price for that garment kind; the count is still reported.
      const stock = num(row.stock);
      let ladder: Row | null = null;
      if (tier !== null) {
        ladder = await db
          .prepare("SELECT * FROM api_fabric_tiers WHERE tier = ?")
          .bind(tier)
          .first<Row>();
      }
      const yieldRows = await db
        .prepare("SELECT garment, yards_per FROM api_garment_yield")
        .bind()
        .all<Row>();
      const ladderCol: Record<string, string> = {
        suit: "suit",
        suitVest: "suit_vest",
        sportCoat: "sport_coat",
        dressPants: "dress_pants",
        vest: "vest",
        dressShirt: "dress_shirt",
      };
      const order = ["suit", "suitVest", "sportCoat", "dressPants", "vest", "dressShirt"];
      const yields = new Map(
        (yieldRows.results || []).map((y) => [String(y.garment), num(y.yards_per)])
      );
      const makes = order
        .filter((g) => yields.has(g) && yields.get(g)! > 0)
        .map((g) => {
          const yardsPer = yields.get(g)!;
          const count = stock !== null && stock > 0 ? Math.floor(stock / yardsPer) : 0;
          const price = ladder ? num(ladder[ladderCol[g]]) : null;
          return {
            garment: g,
            yardsPerGarment: yardsPer,
            count,
            value: price !== null ? count * price : null,
          };
        });
      return {
        stock,
        qtyActual: num(row.qty_actual),
        qtyReserved: num(row.qty_reserved),
        backorderQty: num(row.backorder_qty),
        purchaseOrderQty: num(row.po_qty),
        minimumQty: num(row.minimum_qty),
        stores: (stores.results || []).map((s) => ({
          storeId: num(s.store_id),
          hanger: num(s.hanger),
        })),
        makes,
      };
    },
  };
}

// The filter allow-list: GraphQL argument name to SQL condition. Adding a
// future query parameter is one entry here plus the schema argument.
const EQUALITY_FILTERS: Record<string, string> = {
  type: "type",
  color: "color",
  colorFamily: "color_family",
  pattern: "pattern",
  patternCategory: "pattern_category",
  material: "material",
  mill: "mill",
  season: "season",
  weave: "weave",
  occasion: "occasion",
};
const SORTS: Record<string, string> = {
  code: "code ASC",
  mill: "mill ASC, code ASC",
  tier: "tier ASC, code ASC",
  "price-asc": "fabric_price ASC, code ASC",
  "price-desc": "fabric_price DESC, code ASC",
};

function listWhere(args: Record<string, unknown>) {
  const conds: string[] = [];
  const binds: unknown[] = [];
  if (typeof args.q === "string" && args.q.trim()) {
    conds.push("(code LIKE ? OR description LIKE ?)");
    const like = "%" + args.q.trim() + "%";
    binds.push(like, like);
  }
  for (const [arg, col] of Object.entries(EQUALITY_FILTERS)) {
    const v = args[arg];
    if (typeof v === "string" && v.trim()) {
      conds.push(col + " COLLATE NOCASE = ?");
      binds.push(v.trim());
    }
  }
  if (typeof args.tier === "number") {
    conds.push("tier = ?");
    binds.push(args.tier);
  }
  if (typeof args.tierMin === "number") {
    conds.push("tier >= ?");
    binds.push(args.tierMin);
  }
  if (typeof args.tierMax === "number") {
    conds.push("tier <= ?");
    binds.push(args.tierMax);
  }
  const active = typeof args.active === "boolean" ? args.active : true;
  conds.push("active = ?");
  binds.push(active ? 1 : 0);
  if (typeof args.store === "number") {
    conds.push(
      "fabric_id IN (SELECT fabric_id FROM api_fabric_stores WHERE store_id = ?)"
    );
    binds.push(args.store);
  }
  if (args.inStock === true) conds.push("stock > 0");
  return { where: conds.length ? " WHERE " + conds.join(" AND ") : "", binds };
}

function rootValue(db: D1Database) {
  return {
    fabric: async (args: { code: string; type?: string }) => {
      let sql =
        "SELECT * FROM api_fabrics WHERE code COLLATE NOCASE = ?";
      const binds: unknown[] = [String(args.code || "")];
      if (typeof args.type === "string" && args.type.trim()) {
        sql += " AND type COLLATE NOCASE = ?";
        binds.push(args.type.trim());
      }
      sql += " ORDER BY active DESC, fabric_id ASC LIMIT 1";
      const row = await db.prepare(sql).bind(...binds).first<Row>();
      return row ? fabricObject(db, row) : null;
    },
    fabrics: async (args: Record<string, unknown>) => {
      const page = Math.max(1, Math.floor(Number(args.page) || 1));
      const pageSize = Math.min(
        200,
        Math.max(1, Math.floor(Number(args.pageSize) || 36))
      );
      const { where, binds } = listWhere(args);
      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM api_fabrics" + where)
        .bind(...binds)
        .first<Row>();
      const sort =
        SORTS[typeof args.sort === "string" ? args.sort : "code"] ||
        SORTS.code;
      const rows = await db
        .prepare(
          "SELECT * FROM api_fabrics" +
            where +
            " ORDER BY " +
            sort +
            " LIMIT ? OFFSET ?"
        )
        .bind(...binds, pageSize, (page - 1) * pageSize)
        .all<Row>();
      return {
        total: num(count?.n) || 0,
        page,
        pageSize,
        results: (rows.results || []).map((r) => fabricObject(db, r)),
      };
    },
    tiers: async () => {
      const rows = await db
        .prepare("SELECT * FROM api_fabric_tiers ORDER BY tier ASC")
        .bind()
        .all<Row>();
      return (rows.results || []).map((r) => ({
        tier: num(r.tier),
        suit: num(r.suit),
        suitVest: num(r.suit_vest),
        sportCoat: num(r.sport_coat),
        dressPants: num(r.dress_pants),
        vest: num(r.vest),
        dressShirt: num(r.dress_shirt),
      }));
    },
  };
}

const schema = buildSchema(FABRIC_GRAPHQL_SCHEMA);

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function fabricGraphql(request: Request, env: Env) {
  if (!env.DB) return reply({ errors: [{ message: "Fabric data is unavailable" }] }, 503);
  const url = new URL(request.url);
  let query = "";
  let variables: Record<string, unknown> | undefined;
  let operationName: string | undefined;
  if (request.method === "GET") {
    query = url.searchParams.get("query") || "";
    const rawVars = url.searchParams.get("variables");
    if (rawVars) {
      try {
        variables = JSON.parse(rawVars);
      } catch {
        return reply({ errors: [{ message: "variables must be valid JSON" }] }, 400);
      }
    }
    operationName = url.searchParams.get("operationName") || undefined;
    if (!query) {
      return reply({
        service: "suits.me fabric GraphQL API",
        version: "v1",
        endpoint: "/api/graphql",
        example:
          'POST a JSON body {"query":"{ fabric(code:\\"CN17300\\") { code mill pricing { tier garments { suit dressPants } } inventory { stock stores { storeId hanger } } } }"} or send the same query in the ?query= URL parameter.',
      });
    }
  } else if (request.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return reply({ errors: [{ message: "Request body must be JSON" }] }, 400);
    }
    query = typeof body.query === "string" ? body.query : "";
    variables = body.variables as Record<string, unknown> | undefined;
    operationName =
      typeof body.operationName === "string" ? body.operationName : undefined;
    if (!query) return reply({ errors: [{ message: "Missing query" }] }, 400);
  } else {
    return reply({ errors: [{ message: "Method not allowed" }] }, 405);
  }
  const result = await graphql({
    schema,
    source: query,
    rootValue: rootValue(env.DB),
    variableValues: variables,
    operationName,
  });
  return reply(result, result.errors && !result.data ? 400 : 200);
}
