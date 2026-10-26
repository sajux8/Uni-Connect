import Link from "next/link";
import { Compass } from "lucide-react";

import { CenteredLayout } from "@/components/layout/centered-layout";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <CenteredLayout>
      <EmptyState
        icon={Compass}
        title="We couldn't find that page"
        description="The link may be broken, or the page may have moved."
        action={
          <Link href="/home" className={buttonVariants()}>
            Back to home
          </Link>
        }
      />
    </CenteredLayout>
  );
}
