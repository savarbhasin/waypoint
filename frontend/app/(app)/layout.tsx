import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { getSessionOrNull } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull();
  if (!session) redirect("/sign-in");

  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
