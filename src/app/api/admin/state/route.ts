import { handle } from "@/lib/http";
import { adminView } from "@/lib/views";

export async function GET() {
  return handle(async () => adminView(), "admin");
}
