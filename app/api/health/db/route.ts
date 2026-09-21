import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  if (!hasDatabaseUrl) {
    return NextResponse.json(
      { ok: false, hasDatabaseUrl: false, error: "DATABASE_URL_MISSING" },
      { status: 500 },
    );
  }

  try {
    const result = await queryDb<{ count: number }>(
      "SELECT count(*)::int AS count FROM campaigns",
    );

    return NextResponse.json({
      ok: true,
      hasDatabaseUrl: true,
      campaigns: Number(result.rows[0]?.count ?? 0),
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { code?: string };
    return NextResponse.json(
      {
        ok: false,
        hasDatabaseUrl: true,
        error: err.code || err.name || "DB_CONNECTION_FAILED",
        message: err.message.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgres://***@"),
      },
      { status: 500 },
    );
  }
}
