import { redirect } from "next/navigation";

export default function FeedPage() {
  redirect("/profile?section=feed");
}
