import { analyzeSentiment, moderateText, type CommentAiFields } from "@/utils/ai";

export async function getCommentAiFields(body: string): Promise<CommentAiFields> {
  const [moderation, sentiment] = await Promise.all([
    moderateText({ text: body }),
    analyzeSentiment({ text: body }),
  ]);

  return {
    flagged: moderation.flagged,
    aiScore: moderation.aiScore,
    aiComment: moderation.aiComment,
    sentimentLabel: sentiment.label,
    sentimentScore: sentiment.score,
  };
}
