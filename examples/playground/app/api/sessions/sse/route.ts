import { sseHub } from "../../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Can filter by userId or listen globally
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "demo_user_1";

  return sseHub.createStreamResponse(userId);
}
