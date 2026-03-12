import type { UserProfile } from "./types";
import type { ScenarioId } from "./constants";

/**
 * Returns scenario IDs for the given profile. Role determines which scenarios apply.
 * Student → message_student, choice_student; General → message_general, choice_general.
 */
export function getScenariosForProfile(profile: UserProfile): ScenarioId[] {
  return profile.role === "student"
    ? ["message_student", "choice_student"]
    : ["message_general", "choice_general"];
}

/**
 * Get the first scenario to use for MVP (single scenario per session).
 */
export function getFirstScenarioForProfile(profile: UserProfile): ScenarioId {
  const ids = getScenariosForProfile(profile);
  return ids[0];
}
