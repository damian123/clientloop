import type {
  Account,
  Activity,
  Contact,
  CustomFieldDefinition,
  Lead,
  Note,
  Opportunity,
  Permission,
  Role,
  Task,
  User
} from "./types";

export const seedTenantId = "00000000-0000-4000-8000-000000000001";
export const seedUserId = "00000000-0000-4000-8000-000000000101";
export const seedManagerId = "00000000-0000-4000-8000-000000000102";
export const seedTeamId = "00000000-0000-4000-8000-000000000201";
const now = "2026-05-11T00:00:00.000Z";

const allResources: Permission["resource"][] = [
  "account",
  "contact",
  "lead",
  "opportunity",
  "activity",
  "task",
  "note",
  "custom_field",
  "user",
  "admin"
];

const managerPermissions: Permission[] = allResources.flatMap((resource, index) => [
  {
    id: `perm-${index}-read`,
    resource,
    action: "read",
    condition: "tenant"
  },
  {
    id: `perm-${index}-manage`,
    resource,
    action: "manage",
    condition: "tenant"
  }
]);

const repPermissions: Permission[] = allResources.flatMap((resource, index) => [
  {
    id: `rep-perm-${index}-read`,
    resource,
    action: "read",
    condition: "tenant"
  },
  {
    id: `rep-perm-${index}-update-own`,
    resource,
    action: "update",
    condition: "own"
  },
  {
    id: `rep-perm-${index}-create`,
    resource,
    action: "create",
    condition: "tenant"
  }
]);

const audit = {
  tenantId: seedTenantId,
  createdAt: now,
  updatedAt: now,
  createdBy: seedUserId,
  updatedBy: seedUserId,
  version: 1
};

export const seedRoles: Role[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    name: "Sales Manager",
    permissions: managerPermissions,
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    name: "Sales Rep",
    permissions: repPermissions,
    ...audit
  }
];

export const seedUsers: User[] = [
  {
    id: seedUserId,
    email: "alex.rep@clientloop.test",
    displayName: "Alex Rep",
    status: "active",
    roleIds: [seedRoles[1]!.id],
    teamIds: [seedTeamId],
    ...audit
  },
  {
    id: seedManagerId,
    email: "morgan.manager@clientloop.test",
    displayName: "Morgan Manager",
    status: "active",
    roleIds: [seedRoles[0]!.id],
    teamIds: [seedTeamId],
    ...audit
  }
];

export const seedCustomFieldDefinitions: CustomFieldDefinition[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    entityType: "account",
    key: "health_score",
    label: "Health score",
    fieldType: "number",
    required: false,
    isIndexed: true,
    schema: { minimum: 0, maximum: 100 },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    entityType: "opportunity",
    key: "forecast_category",
    label: "Forecast category",
    fieldType: "single_select",
    required: false,
    isIndexed: true,
    schema: { options: ["pipeline", "best_case", "commit"] },
    ...audit
  }
];

export const seedAccounts: Account[] = [
  {
    id: "00000000-0000-4000-8000-000000001001",
    name: "Northstar Robotics",
    domain: "northstar.example",
    ownerUserId: seedUserId,
    status: "prospect",
    customFields: { health_score: 76 },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000001002",
    name: "Brightline Health",
    domain: "brightline.example",
    ownerUserId: seedUserId,
    status: "customer",
    customFields: { health_score: 91 },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000001003",
    name: "Harbor Finance",
    domain: "harbor.example",
    ownerUserId: seedManagerId,
    status: "partner",
    customFields: { health_score: 63 },
    ...audit
  }
];

export const seedContacts: Contact[] = [
  {
    id: "00000000-0000-4000-8000-000000002001",
    accountId: seedAccounts[0]!.id,
    firstName: "Nina",
    lastName: "Patel",
    email: "nina@northstar.example",
    phone: "+1 415 555 0134",
    ownerUserId: seedUserId,
    customFields: {},
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000002002",
    accountId: seedAccounts[1]!.id,
    firstName: "Owen",
    lastName: "Lee",
    email: "owen@brightline.example",
    phone: "+1 212 555 0178",
    ownerUserId: seedUserId,
    customFields: {},
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000002003",
    firstName: "Maya",
    lastName: "Chen",
    email: "maya@independent.example",
    ownerUserId: seedManagerId,
    customFields: {},
    ...audit
  }
];

export const seedLeads: Lead[] = [
  {
    id: "00000000-0000-4000-8000-000000003001",
    source: "conference",
    companyName: "Summit Retail",
    contactName: "Iris Novak",
    email: "iris@summit.example",
    status: "qualified",
    customFields: {},
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000003002",
    source: "website",
    companyName: "Atlas Labs",
    contactName: "Sam Rivera",
    email: "sam@atlas.example",
    status: "new",
    customFields: {},
    ...audit
  }
];

export const seedOpportunities: Opportunity[] = [
  {
    id: "00000000-0000-4000-8000-000000004001",
    accountId: seedAccounts[0]!.id,
    primaryContactId: seedContacts[0]!.id,
    name: "Northstar expansion",
    stage: "discovery",
    amount: 82000,
    currency: "USD",
    expectedCloseDate: "2026-06-30",
    ownerUserId: seedUserId,
    probabilityPct: 35,
    customFields: { forecast_category: "pipeline" },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000004002",
    accountId: seedAccounts[1]!.id,
    primaryContactId: seedContacts[1]!.id,
    name: "Brightline renewal",
    stage: "proposal",
    amount: 126000,
    currency: "USD",
    expectedCloseDate: "2026-06-14",
    ownerUserId: seedUserId,
    probabilityPct: 64,
    customFields: { forecast_category: "best_case" },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000004003",
    accountId: seedAccounts[2]!.id,
    name: "Harbor partner rollout",
    stage: "negotiation",
    amount: 210000,
    currency: "USD",
    expectedCloseDate: "2026-07-18",
    ownerUserId: seedManagerId,
    probabilityPct: 72,
    customFields: { forecast_category: "commit" },
    ...audit
  }
];

export const seedTasks: Task[] = [
  {
    id: "00000000-0000-4000-8000-000000005001",
    parent: { type: "opportunity", id: seedOpportunities[0]!.id },
    title: "Send discovery recap",
    description: "Summarize pain points and integration requirements.",
    status: "open",
    priority: "high",
    dueAt: "2026-05-13T17:00:00.000Z",
    assignedUserId: seedUserId,
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000005002",
    parent: { type: "account", id: seedAccounts[1]!.id },
    title: "Confirm renewal signer",
    status: "in_progress",
    priority: "medium",
    dueAt: "2026-05-15T17:00:00.000Z",
    assignedUserId: seedUserId,
    ...audit
  }
];

export const seedNotes: Note[] = [
  {
    id: "00000000-0000-4000-8000-000000006001",
    parent: { type: "account", id: seedAccounts[0]!.id },
    body: "Northstar wants rollout planning before procurement review.",
    bodyFormat: "plain_text",
    ...audit
  }
];

export const seedActivities: Activity[] = [
  {
    id: "00000000-0000-4000-8000-000000007001",
    parent: { type: "opportunity", id: seedOpportunities[1]!.id },
    type: "meeting",
    subject: "Renewal pricing review",
    occurredAt: "2026-05-10T19:00:00.000Z",
    payload: { durationMinutes: 45, attendees: ["Owen Lee", "Alex Rep"] },
    ...audit
  },
  {
    id: "00000000-0000-4000-8000-000000007002",
    parent: { type: "lead", id: seedLeads[0]!.id },
    type: "call",
    subject: "Qualified inbound lead",
    occurredAt: "2026-05-09T16:30:00.000Z",
    payload: { disposition: "qualified" },
    ...audit
  }
];

export function createSeedData() {
  return {
    tenantId: seedTenantId,
    users: structuredClone(seedUsers),
    roles: structuredClone(seedRoles),
    customFieldDefinitions: structuredClone(seedCustomFieldDefinitions),
    accounts: structuredClone(seedAccounts),
    contacts: structuredClone(seedContacts),
    leads: structuredClone(seedLeads),
    opportunities: structuredClone(seedOpportunities),
    tasks: structuredClone(seedTasks),
    notes: structuredClone(seedNotes),
    activities: structuredClone(seedActivities)
  };
}
