import { PlainScreen } from "@/components/fx/plain-screen";

export default function StageLayout({ children }: LayoutProps<"/stage">) {
  return (
    <>
      <PlainScreen />
      {children}
    </>
  );
}
