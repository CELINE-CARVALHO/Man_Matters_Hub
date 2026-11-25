export const CATEGORIES = ["Haircare", "Skincare", "Beard Care", "Supplements/Wellness"] as const;
export type Category = (typeof CATEGORIES)[number];
export const MIN_INTERVIEWS = 3;
export const NOTE_FIELDS = [
  ["purchase_motivation", "Purchase motivation"],
  ["liked", "What they liked"],
  ["disliked", "What they disliked"],
  ["difficulties", "Main difficulties"],
  ["expectations", "Customer expectations"],
  ["incidents", "Actual incidents"],
  ["observations", "Additional observations"],
] as const;
export type NoteField = (typeof NOTE_FIELDS)[number][0];
export const JOURNEY_STAGES = ["Discovery", "Purchase", "First use", "Ongoing use", "Results & repurchase"];
