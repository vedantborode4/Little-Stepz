export * from "./types";
export * from "./refunds";

import type { PolicyPage, PolicySlug } from "./types";
import { about } from "./policies/about";
import { privacy } from "./policies/privacy";
import { shipping } from "./policies/shipping";
import { returns } from "./policies/returns";
import { cancellation } from "./policies/cancellation";
import { warranty } from "./policies/warranty";
import { terms } from "./policies/terms";
import { dataDeletion } from "./policies/data-deletion";

export const policies: Record<PolicySlug, PolicyPage> = {
  about,
  privacy,
  shipping,
  returns,
  cancellation,
  warranty,
  terms,
  "data-deletion": dataDeletion,
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
  "data-deletion",
];

export function getPolicy(slug: PolicySlug): PolicyPage {
  return policies[slug];
}
