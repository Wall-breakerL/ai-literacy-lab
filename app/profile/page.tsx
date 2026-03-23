import { redirect } from "next/navigation";

/** 旧版 `/profile` 入口：重定向至身份与入场（`/setup`） */
export default function ProfileRedirectPage() {
  redirect("/setup");
}
