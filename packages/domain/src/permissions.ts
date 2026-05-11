import type {
  AccessPrincipal,
  CRMRecord,
  Permission,
  PermissionAction,
  PermissionResource
} from "./types";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface AuthorizationTarget {
  tenantId: string;
  ownerUserId?: string | null | undefined;
  assignedUserId?: string | null | undefined;
  createdBy?: string | null | undefined;
  teamIds?: string[] | undefined;
}

export function permissionsFor(principal: AccessPrincipal): Permission[] {
  return principal.roles.flatMap((role) => role.permissions);
}

export function canAccess(
  principal: AccessPrincipal,
  resource: PermissionResource,
  action: PermissionAction,
  target?: AuthorizationTarget
): boolean {
  if (principal.user.status !== "active") {
    return false;
  }

  const permissions = permissionsFor(principal);
  const adminGrant = permissions.some(
    (permission) => permission.resource === "admin" && permission.action === "manage"
  );

  if (adminGrant) {
    return true;
  }

  return permissions.some((permission) => {
    if (permission.resource !== resource) {
      return false;
    }

    if (permission.action !== action && permission.action !== "manage") {
      return false;
    }

    if (!target) {
      return permission.condition === "all" || permission.condition === "tenant";
    }

    if (target.tenantId !== principal.tenantId) {
      return false;
    }

    switch (permission.condition) {
      case "all":
      case "tenant":
        return true;
      case "own":
        return (
          target.ownerUserId === principal.user.id ||
          target.assignedUserId === principal.user.id ||
          target.createdBy === principal.user.id
        );
      case "team":
        return Boolean(
          target.teamIds?.some((teamId) => principal.user.teamIds.includes(teamId))
        );
      default:
        return false;
    }
  });
}

export function assertCan(
  principal: AccessPrincipal,
  resource: PermissionResource,
  action: PermissionAction,
  target?: AuthorizationTarget
): void {
  if (!canAccess(principal, resource, action, target)) {
    throw new AuthorizationError(`Not allowed to ${action} ${resource}`);
  }
}

export function targetFromRecord(record: CRMRecord): AuthorizationTarget {
  const maybeOwner = "ownerUserId" in record ? record.ownerUserId : undefined;
  const maybeAssignee = "assignedUserId" in record ? record.assignedUserId : undefined;

  return {
    tenantId: record.tenantId,
    ownerUserId: maybeOwner,
    assignedUserId: maybeAssignee,
    createdBy: record.createdBy
  };
}
