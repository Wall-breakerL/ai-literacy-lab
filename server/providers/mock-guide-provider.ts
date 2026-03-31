import type { GuideProvider } from "@/server/providers/interfaces";
import { SCENE_BLUEPRINT_BY_ID, type SceneId } from "@/domain";

export class MockGuideProvider implements GuideProvider {
  buildBriefing(sceneId: SceneId): string {
    return SCENE_BLUEPRINT_BY_ID[sceneId].briefingZh;
  }

  replyToUser(sceneId: SceneId, userMessage: string): string {
    const sceneTitle = SCENE_BLUEPRINT_BY_ID[sceneId].titleZh;
    return `【Agent A 引导】收到你在「${sceneTitle}」的输入：${userMessage.slice(0, 80)}。请给出下一步可验证的判断依据。`;
  }
}
