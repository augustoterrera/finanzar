import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/options";

export function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  return session?.user ?? null;
}
