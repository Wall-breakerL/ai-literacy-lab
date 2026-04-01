"use client";

import { useMemo } from "react";
import type { SessionEvent } from "@/domain";
import { APARTMENT_TRADEOFF_SCENE } from "@/domain/scenes/apartment-tradeoff";
import { BRAND_NAMING_SPRINT_SCENE } from "@/domain/scenes/brand-naming-sprint";

export interface DeliverableStatus {
  id: string;
  label: string;
  done: boolean;
}

export interface ApartmentDeliverables {
  mainRecommendation: DeliverableStatus;
  backupOption: DeliverableStatus;
  verificationQuestions: DeliverableStatus;
}

export interface BrandDeliverables {
  finalName: DeliverableStatus;
  backupName: DeliverableStatus;
  reason: DeliverableStatus;
  tagline: DeliverableStatus;
}

export type SceneDeliverables = ApartmentDeliverables | BrandDeliverables;

function match(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function parseApartmentDeliverables(events: SessionEvent[]): ApartmentDeliverables {
  const userMessages = events
    .filter((e) => e.type === "USER_MESSAGE")
    .map((e) => e.payload.message);

  const combined = userMessages.join("\n");

  // Main recommendation: user mentions picking a specific apartment (A, B, or C)
  const mainRecommendation = match(combined, [
    /推荐\s*[ABC]/i,
    /选\s*[ABC]/i,
    /主推\s*[ABC]/i,
    /倾向于\s*[ABC]/i,
    /建议选\s*[ABC]/i,
    /最终选择\s*[ABC]/i,
    /推荐是\s*[ABC]/i,
    /^我选[A-C]$/im,
    /^选[A-C]$/im,
  ]);

  // Backup option: user mentions a backup choice
  const backupOption = match(combined, [
    /备选\s*[ABC]/i,
    /第二选择\s*[ABC]/i,
    /备选是\s*[ABC]/i,
    /次选\s*[ABC]/i,
    /备.+选.+[ABC]/i,
  ]);

  // Verification questions: user lists at least 3 distinct questions
  // Count question-like sentences (ending with ? or containing question words)
  const questionMatches = combined.match(/[？?。]\s*|[^\n？?。]+[^\S\n]*[^\n？?。]+(?=[？?]|$)/g) ?? [];
  const questionLines = userMessages.filter((msg) => {
    const qCount = (msg.match(/[？?]/g) ?? []).length;
    return qCount >= 1;
  });
  // Check if at least 3 distinct question indicators exist across messages
  const questionIndicators = [
    /宠物.*合同/i,
    /服务费/i,
    /噪音.*实测/i,
    /入住.*确认/i,
    /合同.*条款/i,
    /押金.*退还/i,
    /房东.*承诺/i,
    /中介.*费用/i,
    /真实.*情况/i,
  ];
  const matchedQuestions = questionIndicators.filter((p) => p.test(combined)).length;
  const hasThreeQuestions = matchedQuestions >= 3 || questionLines.length >= 3;

  return {
    mainRecommendation: { id: "mainRecommendation", label: "主推荐", done: mainRecommendation },
    backupOption: { id: "backupOption", label: "备选", done: backupOption },
    verificationQuestions: { id: "verificationQuestions", label: "3个待确认问题", done: hasThreeQuestions },
  };
}

function parseBrandDeliverables(events: SessionEvent[]): BrandDeliverables {
  const userMessages = events
    .filter((e) => e.type === "USER_MESSAGE")
    .map((e) => e.payload.message);

  const combined = userMessages.join("\n");

  // Final name: user proposes a brand name (non-trivial string with Chinese characters)
  // Heuristic: mentions "最终名" or "就叫" or quotes a name-like phrase
  const finalName = match(combined, [
    /最终名.{0,6}[\u4e00-\u9fa5]{2,8}/i,
    /就叫[\u4e00-\u9fa5]{2,6}/i,
    /最终.*[命名叫][\u4e00-\u9fa5]{2,6}/i,
    /品牌名.{0,4}[\u4e00-\u9fa5]{2,6}/i,
    /名字.*[\u4e00-\u9fa5]{2,6}/i,
  ]);

  // Backup name
  const backupName = match(combined, [
    /备选名.{0,6}[\u4e00-\u9fa5]{2,8}/i,
    /备选.*[命名][\u4e00-\u9fa5]{2,6}/i,
  ]);

  // Reason
  const reason = match(combined, [
    /理由.{0,20}[\u4e00-\u9fa5]+/i,
    /因为.{0,20}[\u4e00-\u9fa5]{3,}/i,
    /符合.*因为/i,
  ]);

  // Tagline
  const tagline = match(combined, [
    /tagline/i,
    /口号/i,
    /标语/i,
    /slogan/i,
    /一句话.{0,10}[\u4e00-\u9fa5]+/i,
  ]);

  return {
    finalName: { id: "finalName", label: "最终名", done: finalName },
    backupName: { id: "backupName", label: "备选名", done: backupName },
    reason: { id: "reason", label: "一句理由", done: reason },
    tagline: { id: "tagline", label: "一条tagline", done: tagline },
  };
}

export function useDeliverablesTracker(
  sceneId: string,
  events: SessionEvent[],
): SceneDeliverables | null {
  return useMemo(() => {
    if (sceneId === "apartment-tradeoff") {
      return parseApartmentDeliverables(events);
    }
    if (sceneId === "brand-naming-sprint") {
      return parseBrandDeliverables(events);
    }
    return null;
  }, [sceneId, events]);
}

export function getDeliverablesForScene(sceneId: string) {
  if (sceneId === "apartment-tradeoff") {
    return APARTMENT_TRADEOFF_SCENE.deliverables;
  }
  if (sceneId === "brand-naming-sprint") {
    return BRAND_NAMING_SPRINT_SCENE.deliverables;
  }
  return [];
}
