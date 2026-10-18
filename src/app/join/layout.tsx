import { PlainScreen } from "@/components/fx/plain-screen";

export default function JoinLayout({ children }: LayoutProps<"/join">) {
  return (
    <>
      <PlainScreen />
      {children}
    </>
  );
}
