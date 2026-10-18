import { notFound } from "next/navigation";
import { NetworkPreview } from "./preview";

// Design preview with made-up data. Not available in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <NetworkPreview />;
}
