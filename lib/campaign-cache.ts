import { unstable_cache } from "next/cache";
import type { QueryResultRow } from "pg";
import { queryDb } from "./db";

// Only the public campaign catalogue may use this cache. User data must not.
// SQL and bound values are arguments so every filter/page has its own cache key.
const readCachedCampaigns = unstable_cache(
  async (text: string, values: readonly unknown[]) => {
    const result = await queryDb(text, values);
    // pg QueryResult contains driver metadata; persist JSON-compatible rows only.
    return { rows: result.rows };
  },
  ["re-place-public-campaigns-v1"],
  { revalidate: 600, tags: ["re-place-campaigns"] },
);

export async function queryCampaignDb<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<{ rows: T[] }> {
  return (await readCachedCampaigns(text, values)) as { rows: T[] };
}
