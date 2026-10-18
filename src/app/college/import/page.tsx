import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ImportView } from "./import-view";

export const metadata = { title: "Import alumni" };

export default function ImportPage() {
  return (
    <PageShell
      eyebrow="For the placement cell"
      title={["Bring your", "_alumni_"]}
      lede="Add the alumni your college already knows. See who has joined and write each of the rest a short invitation from your own mail."
    >
      <p className="mb-6 text-sm">
        <Link href="/college" className="font-semibold underline">Back to the college dashboard</Link>
      </p>
      <ImportView siteUrl={(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "")} />
    </PageShell>
  );
}
