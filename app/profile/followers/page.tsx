import { FollowListPage } from "@/components/follow-list-page";

export default function FollowersPage() {
  return (
    <FollowListPage
      mode="followers"
      title="Your followers"
      description="See who is keeping up with your threads, posts, and match-day reactions."
      emptyMessage="No one is following you yet. Join more conversations and your supporter circle will grow here."
      secondaryHref="/profile/following"
      secondaryLabel="View following"
    />
  );
}
