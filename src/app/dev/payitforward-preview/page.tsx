import { notFound } from "next/navigation";
import { Preview } from "./preview";

// Design preview with made-up data. Not available in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Preview />;
}
