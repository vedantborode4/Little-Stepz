export * from "./types";

import type { PolicyPage, PolicySlug } from "./types";
import { about } from "./policies/about";
import { privacy } from "./policies/privacy";
import { shipping } from "./policies/shipping";
import { returns } from "./policies/returns";
import { cancellation } from "./policies/cancellation";
import { warranty } from "./policies/warranty";
import { terms } from "./policies/terms";

export const policies: Record<PolicySlug, PolicyPage> = {
  about,
  privacy,
  shipping,
  returns,
  cancellation,
  warranty,
  terms,
};

/** Ordered list for footer / menu rendering. */
export const policyOrder: PolicySlug[] = [
  "about",
  "shipping",
  "returns",
  "cancellation",
  "warranty",
  "privacy",
  "terms",
];

export function getPolicy(slug: PolicySlug): PolicyPage {
  return policies[slug];
}
