import { CenteredLayout } from "@/components/layout/centered-layout";

// Wide enough for the registration form; shorter pages narrow their own card (AuthCard size="md").
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <CenteredLayout width="lg">{children}</CenteredLayout>;
}
