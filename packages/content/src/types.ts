export type PolicyBlock =
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export interface PolicySection {
  /** Optional top-level section heading (rendered larger than a subheading). */
  heading?: string;
  blocks: PolicyBlock[];
}

export type PolicySlug =
  | "about"
  | "privacy"
  | "shipping"
  | "returns"
  | "cancellation"
  | "warranty"
  | "terms"
  | "data-deletion";

export interface PolicyPage {
  slug: PolicySlug;
  title: string;
  /** Short lead paragraph shown under the title. */
  intro?: string;
  sections: PolicySection[];
}
