import { PlainScreen } from "@/components/fx/plain-screen";

export default function HopLayout({ children }: LayoutProps<"/h">) {
  return (
    <>
      <PlainScreen />
      {children}
    </>
  );
}
