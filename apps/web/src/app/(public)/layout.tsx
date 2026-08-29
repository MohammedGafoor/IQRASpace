import type { ReactNode } from "react";
import { PublicHeader } from "@/components/shell/PublicHeader";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
