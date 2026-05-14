import type { ExportEntity, SessionResponse } from "@clientloop/contracts";
import type {
  Activity,
  Note,
  PermissionAction,
  PermissionResource,
  RecordEntityType,
  Task
} from "@clientloop/domain";

export type CreateViewMode = "pipeline" | "leads" | "accounts" | "contacts" | "data";

export type PermissionTarget = {
  ownerUserId?: string | null | undefined;
  assignedUserId?: string | null | undefined;
  createdBy?: string | null | undefined;
};

export type DataPermissions = {
  canExportAccounts: boolean;
  canExportContacts: boolean;
  canExportOpportunities: boolean;
  canImportAccounts: boolean;
  canImportContacts: boolean;
  canImportOpportunities: boolean;
};

export type CreatePermissions = {
  canCreateAccounts: boolean;
  canCreateContacts: boolean;
  canCreateLeads: boolean;
  canCreateOpportunities: boolean;
};

export type TimelinePermissions = {
  canCreateActivities: boolean;
  canCreateNotes: boolean;
  canCreateTasks: boolean;
  canUpdateActivity: (activity: Activity) => boolean;
  canUpdateNote: (note: Note) => boolean;
  canUpdateTask: (task: Task) => boolean;
};

export type CustomFieldPermissions = {
  canCreateDefinitions: boolean;
  canUpdateRecordValues: (entityType: RecordEntityType, target: PermissionTarget) => boolean;
};

export function deriveDataPermissions(
  session: SessionResponse | null,
  fallback: boolean
): DataPermissions {
  return {
    canExportAccounts: canSessionAccess(session, "account", "export", fallback),
    canExportContacts: canSessionAccess(session, "contact", "export", fallback),
    canExportOpportunities: canSessionAccess(session, "opportunity", "export", fallback),
    canImportAccounts: canSessionAccess(session, "account", "create", fallback),
    canImportContacts: canSessionAccess(session, "contact", "create", fallback),
    canImportOpportunities: canSessionAccess(session, "opportunity", "create", fallback)
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

export function deriveTimelinePermissions(
  session: SessionResponse | null,
  fallback: boolean
): TimelinePermissions {
  return {
    canCreateActivities: canSessionAccess(session, "activity", "create", fallback),
    canCreateNotes: canSessionAccess(session, "note", "create", fallback),
    canCreateTasks: canSessionAccess(session, "task", "create", fallback),
    canUpdateActivity: (activity) =>
      canSessionAccess(session, "activity", "update", fallback, {
        createdBy: activity.createdBy
      }),
    canUpdateNote: (note) =>
      canSessionAccess(session, "note", "update", fallback, {
        createdBy: note.createdBy
      }),
    canUpdateTask: (task) =>
      canSessionAccess(session, "task", "update", fallback, {
        assignedUserId: task.assignedUserId,
        createdBy: task.createdBy
      })
  };
}

export function deriveCustomFieldPermissions(
  session: SessionResponse | null,
  fallback: boolean
): CustomFieldPermissions {
  return {
    canCreateDefinitions: canSessionAccess(session, "custom_field", "create", fallback),
    canUpdateRecordValues: (entityType, target) =>
      canSessionAccess(session, entityType, "update", fallback, target)
  };
}

export function canSessionAccess(
  session: SessionResponse | null,
  resource: PermissionResource,
  action: PermissionAction,
  fallback: boolean,
  target?: PermissionTarget
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
    (permission) => {
      if (permission.resource !== resource) {
        return false;
      }

      if (permission.action !== action && permission.action !== "manage") {
        return false;
      }

      if (permission.condition === "tenant" || permission.condition === "all") {
        return true;
      }

      if (permission.condition === "own" && target) {
        return (
          target.ownerUserId === session.user.id ||
          target.assignedUserId === session.user.id ||
          target.createdBy === session.user.id
        );
      }

      return false;
    }
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
