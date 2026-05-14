import { describe, expect, it } from "vitest";
import type { SessionResponse } from "@clientloop/contracts";
import { seedTenantId, seedUserId } from "@clientloop/domain";
import {
  canCreateForView,
  deriveCreatePermissions,
  deriveCustomFieldPermissions,
  deriveDataPermissions,
  deriveTimelinePermissions
} from "./session-permissions";

describe("session permission helpers", () => {
  it("allows local fallback permissions when no API session is present", () => {
    const createPermissions = deriveCreatePermissions(null, true);
    const dataPermissions = deriveDataPermissions(null, true);

    expect(createPermissions.canCreateAccounts).toBe(true);
    expect(createPermissions.canCreateOpportunities).toBe(true);
    expect(dataPermissions.canExportContacts).toBe(true);
    expect(dataPermissions.canImportContacts).toBe(true);
  });

  it("maps tenant-scoped permissions to create and data controls", () => {
    const session = sessionWithPermissions([
      { id: "account-create", resource: "account", action: "create", condition: "tenant" },
      { id: "contact-create", resource: "contact", action: "create", condition: "tenant" },
      { id: "contact-export", resource: "contact", action: "export", condition: "tenant" }
    ]);

    const createPermissions = deriveCreatePermissions(session, false);
    const dataPermissions = deriveDataPermissions(session, false);

    expect(createPermissions.canCreateAccounts).toBe(true);
    expect(createPermissions.canCreateContacts).toBe(true);
    expect(createPermissions.canCreateLeads).toBe(false);
    expect(createPermissions.canCreateOpportunities).toBe(false);
    expect(dataPermissions.canExportContacts).toBe(true);
    expect(dataPermissions.canExportAccounts).toBe(false);
    expect(dataPermissions.canImportContacts).toBe(true);
  });

  it("disables contextual create in the data view", () => {
    const createPermissions = deriveCreatePermissions(
      sessionWithPermissions([
        { id: "admin-manage", resource: "admin", action: "manage", condition: "tenant" }
      ]),
      false
    );

    expect(canCreateForView(createPermissions, "pipeline")).toBe(true);
    expect(canCreateForView(createPermissions, "data")).toBe(false);
  });

  it("maps own-scoped timeline update permissions to matching records", () => {
    const session = sessionWithPermissions([
      { id: "task-update", resource: "task", action: "update", condition: "own" },
      { id: "note-update", resource: "note", action: "update", condition: "own" },
      { id: "activity-update", resource: "activity", action: "update", condition: "own" }
    ]);
    const permissions = deriveTimelinePermissions(session, false);

    expect(
      permissions.canUpdateTask({
        assignedUserId: seedUserId,
        createdBy: "other-user"
      } as Parameters<typeof permissions.canUpdateTask>[0])
    ).toBe(true);
    expect(
      permissions.canUpdateNote({
        createdBy: seedUserId
      } as Parameters<typeof permissions.canUpdateNote>[0])
    ).toBe(true);
    expect(
      permissions.canUpdateActivity({
        createdBy: "other-user"
      } as Parameters<typeof permissions.canUpdateActivity>[0])
    ).toBe(false);
  });

  it("maps custom field permissions to definition and record value controls", () => {
    const session = sessionWithPermissions([
      { id: "custom-field-create", resource: "custom_field", action: "create", condition: "tenant" },
      { id: "account-update", resource: "account", action: "update", condition: "own" }
    ]);
    const permissions = deriveCustomFieldPermissions(session, false);

    expect(permissions.canCreateDefinitions).toBe(true);
    expect(permissions.canUpdateRecordValues("account", { ownerUserId: seedUserId })).toBe(true);
    expect(permissions.canUpdateRecordValues("account", { ownerUserId: "other-user" })).toBe(false);
    expect(permissions.canUpdateRecordValues("contact", { ownerUserId: seedUserId })).toBe(false);
  });
});

function sessionWithPermissions(
  permissions: SessionResponse["user"]["permissions"]
): SessionResponse {
  return {
    authenticated: true,
    tenantId: seedTenantId,
    user: {
      id: seedUserId,
      email: "alex.rep@clientloop.test",
      displayName: "Alex Rep",
      permissions
    },
    csrfToken: "csrf-token"
  };
}
