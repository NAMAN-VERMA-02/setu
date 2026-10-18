import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RequestsPreview } from "./preview";

// Design preview with made-up data. Not available in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="mb-8 text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">Requests</h1>
      <Suspense>
        <RequestsPreview />
      </Suspense>
    </main>
  );
}
