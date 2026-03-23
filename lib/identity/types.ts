export type IdentitySource = "manual_prompt" | "structured_form" | "default_profile";

export type IdentityStructuredSummary = {
  roleContext: string;
  domain: string;
  goals: string[];
  constraints: string[];
  communicationStyle: string;
  aiFamiliarity: string;
  riskSensitivity: string;
};

export type IdentityDossier = {
  identityId: string;
  source: IdentitySource;
  rawPrompt: string;
  compiledPrompt: string;
  structuredSummary: IdentityStructuredSummary;
  version: string;
  createdAt: string;
};
