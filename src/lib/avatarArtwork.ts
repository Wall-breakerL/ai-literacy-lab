export type AvatarProp =
  | "clipboard"
  | "wrench"
  | "bolt"
  | "spark"
  | "magnifier"
  | "loop"
  | "compass"
  | "wand"
  | "blueprint"
  | "brush"
  | "blocks"
  | "seedling"
  | "map"
  | "flask"
  | "prism"
  | "orbit";

export interface AvatarArtwork {
  prop: AvatarProp;
  hair: "cap" | "sweep" | "bob" | "tuft";
  motif: "grid" | "stars" | "rings" | "paths";
}

export const AVATAR_ARTWORK: Record<string, AvatarArtwork> = {
  IFAG: { prop: "clipboard", hair: "cap", motif: "grid" },
  IFAL: { prop: "wrench", hair: "bob", motif: "grid" },
  IFTG: { prop: "bolt", hair: "tuft", motif: "paths" },
  IFTL: { prop: "spark", hair: "sweep", motif: "paths" },
  IEAG: { prop: "magnifier", hair: "cap", motif: "stars" },
  IEAL: { prop: "loop", hair: "bob", motif: "rings" },
  IETG: { prop: "compass", hair: "tuft", motif: "stars" },
  IETL: { prop: "wand", hair: "sweep", motif: "rings" },
  CFAG: { prop: "blueprint", hair: "cap", motif: "grid" },
  CFAL: { prop: "brush", hair: "bob", motif: "grid" },
  CFTG: { prop: "blocks", hair: "tuft", motif: "paths" },
  CFTL: { prop: "seedling", hair: "sweep", motif: "paths" },
  CEAG: { prop: "map", hair: "cap", motif: "stars" },
  CEAL: { prop: "flask", hair: "bob", motif: "rings" },
  CETG: { prop: "prism", hair: "tuft", motif: "stars" },
  CETL: { prop: "orbit", hair: "sweep", motif: "rings" },
};

export function getAvatarArtwork(code?: string): AvatarArtwork {
  return AVATAR_ARTWORK[code ?? ""] ?? AVATAR_ARTWORK.CEAL;
}
