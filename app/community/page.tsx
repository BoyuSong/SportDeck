import { Suspense } from "react";
import SportsDeckClient from "@/app/SportsDeckClient";

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <SportsDeckClient initialView="community" />
    </Suspense>
  );
}
