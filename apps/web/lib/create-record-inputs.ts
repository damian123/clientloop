import type {
  CreateAccountInput,
  CreateContactInput,
  CreateLeadInput,
  CreateOpportunityInput
} from "@clientloop/contracts";
import type { Account, OpportunityStage } from "@clientloop/domain";

export type AccountCreateDraft = {
  name: string;
  domain: string;
  status: Account["status"];
};

export type ContactCreateDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountId: string;
};

export type LeadCreateDraft = {
  contactName: string;
  companyName: string;
  email: string;
  source: string;
};

export type OpportunityCreateDraft = {
  accountId: string;
  primaryContactId: string;
  name: string;
  stage: OpportunityStage;
  amount: string;
  expectedCloseDate: string;
  probabilityPct: string;
};

export function emptyAccountCreateDraft(): AccountCreateDraft {
  return {
    name: "",
    domain: "",
    status: "prospect"
  };
}

export function accountCreateInput(draft: AccountCreateDraft): CreateAccountInput | null {
  const name = draft.name.trim();
  if (!name) {
    return null;
  }

  return {
    name,
    domain: draft.domain.trim() || undefined,
    status: draft.status,
    customFields: {}
  };
}

export function emptyContactCreateDraft(): ContactCreateDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    accountId: ""
  };
}

export function contactCreateInput(draft: ContactCreateDraft): CreateContactInput | null {
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const email = draft.email.trim();

  if (!firstName || !lastName || !isValidOptionalEmail(email)) {
    return null;
  }

  return {
    firstName,
    lastName,
    accountId: draft.accountId || undefined,
    email: email || undefined,
    phone: draft.phone.trim() || undefined,
    customFields: {}
  };
}

export function contactCreateValidationMessage(draft: ContactCreateDraft) {
  const email = draft.email.trim();
  if (email && !isValidOptionalEmail(email)) {
    return "Enter a valid email address or leave email blank.";
  }

  return "";
}

export function emptyLeadCreateDraft(): LeadCreateDraft {
  return {
    contactName: "",
    companyName: "",
    email: "",
    source: ""
  };
}

export function leadCreateInput(draft: LeadCreateDraft): CreateLeadInput | null {
  const contactName = draft.contactName.trim();
  const source = draft.source.trim();
  const email = draft.email.trim();

  if (!contactName || !source || !isValidOptionalEmail(email)) {
    return null;
  }

  return {
    contactName,
    source,
    companyName: draft.companyName.trim() || undefined,
    email: email || undefined,
    status: "new",
    customFields: {}
  };
}

export function leadCreateValidationMessage(draft: LeadCreateDraft) {
  const email = draft.email.trim();
  if (email && !isValidOptionalEmail(email)) {
    return "Enter a valid email address or leave email blank.";
  }

  return "";
}

export function emptyOpportunityCreateDraft(): OpportunityCreateDraft {
  return {
    accountId: "",
    primaryContactId: "",
    name: "",
    stage: "qualification",
    amount: "",
    expectedCloseDate: "",
    probabilityPct: ""
  };
}

export function opportunityCreateInput(
  draft: OpportunityCreateDraft,
  ownerUserId: string
): CreateOpportunityInput | null {
  const name = draft.name.trim();
  const amount = optionalNonnegativeNumber(draft.amount);
  const probabilityPct = optionalIntegerInRange(draft.probabilityPct, 0, 100);

  if (!name || !draft.accountId || amount === null || probabilityPct === null) {
    return null;
  }

  return {
    accountId: draft.accountId,
    primaryContactId: draft.primaryContactId || undefined,
    name,
    stage: draft.stage,
    amount: amount ?? undefined,
    currency: "USD",
    expectedCloseDate: draft.expectedCloseDate || undefined,
    ownerUserId,
    probabilityPct: probabilityPct ?? undefined,
    customFields: {}
  };
}

export function opportunityCreateValidationMessage(draft: OpportunityCreateDraft) {
  if (draft.amount.trim() && optionalNonnegativeNumber(draft.amount) === null) {
    return "Enter a nonnegative amount or leave amount blank.";
  }

  if (
    draft.probabilityPct.trim() &&
    optionalIntegerInRange(draft.probabilityPct, 0, 100) === null
  ) {
    return "Enter a whole probability from 0 to 100 or leave probability blank.";
  }

  return "";
}

function optionalNonnegativeNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function optionalIntegerInRange(value: string, min: number, max: number) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  return Number.isInteger(numeric) && numeric >= min && numeric <= max ? numeric : null;
}

function isValidOptionalEmail(value: string) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
