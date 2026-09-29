import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("database health check unavailable");
    }

    await queryDb("SELECT 1");

    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch {
    console.error("[Re:Place] database health check failed");

    return NextResponse.json(
      { ok: false },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
