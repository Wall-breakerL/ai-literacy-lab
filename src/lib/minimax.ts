import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MINIMAX_API_KEY!,
  baseURL: process.env.MINIMAX_BASE_URL!,
});

export const MODEL = "MiniMax-M2.7";

export default client;
