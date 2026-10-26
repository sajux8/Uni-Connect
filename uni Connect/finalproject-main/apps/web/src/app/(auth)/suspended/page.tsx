import type { Metadata } from "next";

import { AccountBlocked } from "@/components/auth/account-blocked";
import { requireUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: ROUTES["/suspended"].title };

export default async function Page() {
  const user = await requireUser("/suspended");
  return <AccountBlocked user={user} kind="suspended" />;
}
