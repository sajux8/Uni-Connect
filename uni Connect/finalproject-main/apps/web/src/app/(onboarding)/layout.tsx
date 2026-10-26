import { CenteredLayout } from "@/components/layout/centered-layout";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return <CenteredLayout width="lg">{children}</CenteredLayout>;
}
