import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function getRequestUser(request: NextRequest): Promise<User | null> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ApiError("Supabase env belum diisi di server.", 500);
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function requireUser(request: NextRequest): Promise<User> {
  const user = await getRequestUser(request);
  if (!user) throw new ApiError("Sesi tidak valid. Silakan login ulang.", 401);
  return user;
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Kesalahan server.";
  console.error("[api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function assertOwned<T extends { owner_id?: string }>(
  row: T | null,
  userId: string,
  label = "Data",
): T {
  if (!row) throw new ApiError(`${label} tidak ditemukan.`, 404);
  if (row.owner_id !== userId) throw new ApiError("Akses ditolak.", 403);
  return row;
}
