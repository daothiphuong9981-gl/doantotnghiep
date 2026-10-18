import { readJson, respond } from "@/lib/api";
import { chat } from "@/lib/services/assistant";

/** POST /api/ai/chat - { session_id, message, lat?, lng? }. Trả lời, bộ lọc AI đã hiểu, danh sách sân, số lượt còn lại. */
export async function POST(request: Request) {
  return respond(await chat(await readJson(request)));
}
