import {
  Briefcase,
  BriefcaseBusiness,
  Code,
  Coffee,
  Cog,
  GraduationCap,
  Hash,
  Languages,
  LifeBuoy,
  Monitor,
  Scale,
  type LucideIcon,
} from "lucide-react";

import { spaceTypeInfo, type SpaceType } from "@/lib/community";
import { cn } from "@/lib/utils";

/** Spaces store a lucide icon name; unknown names fall back to "#". */
export const SPACE_ICON_NAMES = [
  "Hash",
  "GraduationCap",
  "Monitor",
  "Code",
  "BriefcaseBusiness",
  "Briefcase",
  "Scale",
  "Cog",
  "Languages",
  "LifeBuoy",
  "Coffee",
] as const;

const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  BriefcaseBusiness,
  Code,
  Coffee,
  Cog,
  GraduationCap,
  Languages,
  LifeBuoy,
  Monitor,
  Scale,
};

const SIZES = {
  sm: "size-[26px] rounded-[9px] [&_svg]:size-3.5",
  md: "size-11 rounded-[14px] [&_svg]:size-5",
  lg: "size-16 rounded-[18px] [&_svg]:size-7",
} as const;

export function SpaceIcon({
  icon,
  type,
  size = "md",
  className,
}: {
  icon: string | null;
  type: SpaceType;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || Hash;
  return (
    <span
      aria-hidden
      className={cn(
        "tint grid shrink-0 place-items-center border",
        `tint-${spaceTypeInfo(type).tint}`,
        SIZES[size],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
