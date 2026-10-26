import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";

/** A form so it works without JavaScript; the action signs out and returns to /login. */
export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  return (
    <form action={signOut} className={className}>
      <Button type="submit" variant={variant} className="w-full">
        <LogOut data-icon="inline-start" />
        Log out
      </Button>
    </form>
  );
}
