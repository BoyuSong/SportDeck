import { Suspense } from "react";
import SportsDeckClient from "@/app/SportsDeckClient";

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <SportsDeckClient initialView="account" />
    </Suspense>
  );
}
