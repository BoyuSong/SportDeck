"use client";

import { useParams } from "next/navigation";
import { FollowListPage } from "@/components/follow-list-page";

export default function UserFollowersPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <FollowListPage
      mode="followers"
      title="Followers"
      description="See which supporters are following this profile and keeping up with the conversation."
      emptyMessage="This supporter does not have followers yet."
      endpoint={`/api/users/${id}/followers`}
      backHref={`/users/${id}`}
      secondaryHref={`/users/${id}/following`}
      secondaryLabel="View following"
      readOnly
      requireAuth={false}
    />
  );
}
