import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AchatsIndexPage() {
  redirect("/documents/purchase_request");
}
