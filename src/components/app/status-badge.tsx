import { Badge, type BadgeProps } from "@/components/ui/badge";
import { badgeTone, statusLabel } from "@/lib/labels";

interface StatusBadgeProps {
  kind: "order" | "lead" | "invoice" | "payment" | "delivery" | "quotation";
  status: string;
  className?: string;
}

export function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  return (
    <Badge variant={badgeTone(kind, status) as BadgeProps["variant"]} className={className}>
      {statusLabel(kind, status)}
    </Badge>
  );
}