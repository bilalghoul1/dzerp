import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function VentesIndexPage() {
  redirect("/documents/quotation");
}
