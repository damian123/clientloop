import type { ExportEntity, SessionResponse } from "@clientloop/contracts";
import type { PermissionAction, PermissionResource } from "@clientloop/domain";

export type CreateViewMode = "pipeline" | "leads" | "accounts" | "contacts" | "data";

export type DataPermissions = {
  canExportAccounts: boolean;
  canExportContacts: boolean;
  canExportOpportunities: boolean;
  canImportContacts: boolean;
};

export type CreatePermissions = {
  canCreateAccounts: boolean;
  canCreateContacts: boolean;
  canCreateLeads: boolean;
  canCreateOpportunities: boolean;
};

export function deriveDataPermissions(
  session: SessionResponse | null,
  fallback: boolean
): DataPermissions {
  return {
    canExportAccounts: canSessionAccess(session, "account", "export", fallback),
    canExportContacts: canSessionAccess(session, "contact", "export", fallback),
    canExportOpportunities: canSessionAccess(session, "opportunity", "export", fallback),
    canImportContacts: canSessionAccess(session, "contact", "create", fallback)
  };
}

export function deriveCreatePermissions(
  session: SessionResponse | null,
  fallback: boolean
): CreatePermissions {
  return {
    canCreateAccounts: canSessionAccess(session, "account", "create", fallback),
    canCreateContacts: canSessionAccess(session, "contact", "create", fallback),
    canCreateLeads: canSessionAccess(session, "lead", "create", fallback),
    canCreateOpportunities: canSessionAccess(session, "opportunity", "create", fallback)
  };
}

export function canSessionAccess(
  session: SessionResponse | null,
  resource: PermissionResource,
  action: PermissionAction,
  fallback: boolean
) {
  if (fallback) {
    return true;
  }

  if (!session) {
    return false;
  }

  if (
    session.user.permissions.some(
      (permission) => permission.resource === "admin" && permission.action === "manage"
    )
  ) {
    return true;
  }

  return session.user.permissions.some(
    (permission) =>
      permission.resource === resource &&
      (permission.action === action || permission.action === "manage") &&
      (permission.condition === "tenant" || permission.condition === "all")
  );
}

export function canExportEntity(permissions: DataPermissions, entity: ExportEntity) {
  switch (entity) {
    case "accounts":
      return permissions.canExportAccounts;
    case "contacts":
      return permissions.canExportContacts;
    case "opportunities":
      return permissions.canExportOpportunities;
  }
}

export function canCreateForView(permissions: CreatePermissions, viewMode: CreateViewMode) {
  switch (viewMode) {
    case "pipeline":
      return permissions.canCreateOpportunities;
    case "leads":
      return permissions.canCreateLeads;
    case "accounts":
      return permissions.canCreateAccounts;
    case "contacts":
      return permissions.canCreateContacts;
    case "data":
      return false;
  }
}
