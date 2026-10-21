"use client";

import { useParams } from "next/navigation";
import { FollowListPage } from "@/components/follow-list-page";

export default function UserFollowingPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <FollowListPage
      mode="following"
      title="Following"
      description="See which supporters this profile follows to shape their personalized feed."
      emptyMessage="This supporter is not following anyone yet."
      endpoint={`/api/users/${id}/following`}
      backHref={`/users/${id}`}
      secondaryHref={`/users/${id}/followers`}
      secondaryLabel="View followers"
      readOnly
      requireAuth={false}
    />
  );
}
