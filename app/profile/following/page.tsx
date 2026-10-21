import { FollowListPage } from "@/components/follow-list-page";

export default function FollowingPage() {
  return (
    <FollowListPage
      mode="following"
      title="People you follow"
      description="Track the fans you care about and jump back into their latest threads and replies."
      emptyMessage="You are not following anyone yet. Visit supporter profiles and start building your personal feed."
      secondaryHref="/profile/followers"
      secondaryLabel="View followers"
    />
  );
}
