import { redirect } from "next/navigation";

export default function LegacyAlarmPage() {
  redirect("/settings/alarm");
}
