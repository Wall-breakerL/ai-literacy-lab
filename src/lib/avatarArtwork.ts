export type AvatarProp =
  | "system-diagram"
  | "blueprint"
  | "diamond"
  | "toolbox"
  | "lightbulb"
  | "pen"
  | "chef-pan"
  | "palette"
  | "crown"
  | "briefcase"
  | "flag"
  | "handshake"
  | "chess-board"
  | "scales"
  | "compass"
  | "research-orbit";

export interface AvatarArtwork {
  prop: AvatarProp;
  hair: "cap" | "sweep" | "bob" | "tuft";
  motif: "grid" | "stars" | "rings" | "paths";
}

export const AVATAR_ARTWORK: Record<string, AvatarArtwork> = {
  IFAG: { prop: "system-diagram", hair: "cap", motif: "grid" },
  IFAL: { prop: "blueprint", hair: "bob", motif: "grid" },
  IFTG: { prop: "diamond", hair: "tuft", motif: "paths" },
  IFTL: { prop: "toolbox", hair: "sweep", motif: "paths" },
  IEAG: { prop: "lightbulb", hair: "cap", motif: "stars" },
  IEAL: { prop: "pen", hair: "bob", motif: "rings" },
  IETG: { prop: "chef-pan", hair: "tuft", motif: "stars" },
  IETL: { prop: "palette", hair: "sweep", motif: "rings" },
  CFAG: { prop: "crown", hair: "cap", motif: "grid" },
  CFAL: { prop: "briefcase", hair: "bob", motif: "grid" },
  CFTG: { prop: "flag", hair: "tuft", motif: "paths" },
  CFTL: { prop: "handshake", hair: "sweep", motif: "paths" },
  CEAG: { prop: "chess-board", hair: "cap", motif: "stars" },
  CEAL: { prop: "scales", hair: "bob", motif: "rings" },
  CETG: { prop: "compass", hair: "tuft", motif: "stars" },
  CETL: { prop: "research-orbit", hair: "sweep", motif: "rings" },
};

export function getAvatarArtwork(code?: string): AvatarArtwork {
  return AVATAR_ARTWORK[code ?? ""] ?? AVATAR_ARTWORK.CEAL;
}
