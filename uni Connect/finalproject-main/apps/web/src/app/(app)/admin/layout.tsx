import { AdminSubNav } from "@/components/layout/admin-subnav";
import { requireRole } from "@/lib/auth/session";

// Staff only. Each page narrows this further (e.g. approvals are admin-only).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("lecturer");
  return (
    <>
      <AdminSubNav role={user.role} />
      {children}
    </>
  );
}
