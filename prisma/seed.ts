import { Prisma, PrismaClient } from "@prisma/client";
import {
  createSeedData,
  seedManagerId,
  seedTeamId,
  seedTenantId,
  seedUserId
} from "@clientloop/domain";

const prisma = new PrismaClient();
const seed = createSeedData();
const now = new Date("2026-05-11T00:00:00.000Z");

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function main() {
  await prisma.tenant.upsert({
    where: { id: seedTenantId },
    update: {
      name: "ClientLoop Demo"
    },
    create: {
      id: seedTenantId,
      name: "ClientLoop Demo",
      createdAt: now,
      updatedAt: now
    }
  });

  for (const role of seed.roles) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: seedTenantId,
          name: role.name
        }
      },
      update: {
        updatedAt: now,
        updatedBy: seedUserId,
        version: role.version
      },
      create: {
        id: role.id,
        tenantId: seedTenantId,
        name: role.name,
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: role.version
      }
    });
  }

  for (const role of seed.roles) {
    for (const permission of role.permissions) {
      const persistedPermission = await prisma.permission.upsert({
        where: {
          resource_action_conditionKey: {
            resource: permission.resource,
            action: permission.action,
            conditionKey: permission.condition ?? "none"
          }
        },
        update: {},
        create: {
          resource: permission.resource,
          action: permission.action,
          conditionKey: permission.condition ?? "none"
        }
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: persistedPermission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: persistedPermission.id
        }
      });
    }
  }

  for (const user of seed.users) {
    await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: seedTenantId,
          email: user.email
        }
      },
      update: {
        displayName: user.displayName,
        status: user.status,
        updatedAt: now,
        updatedBy: seedUserId,
        version: user.version
      },
      create: {
        id: user.id,
        tenantId: seedTenantId,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: user.version
      }
    });

    for (const roleId of user.roleIds) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId
          }
        },
        update: {},
        create: {
          userId: user.id,
          roleId
        }
      });
    }
  }

  for (const account of seed.accounts) {
    await prisma.account.upsert({
      where: { id: account.id },
      update: {
        name: account.name,
        domain: account.domain ?? null,
        ownerUserId: account.ownerUserId ?? null,
        status: account.status,
        customFields: asJson(account.customFields),
        updatedAt: now,
        updatedBy: seedUserId,
        version: account.version
      },
      create: {
        id: account.id,
        tenantId: seedTenantId,
        name: account.name,
        domain: account.domain ?? null,
        ownerUserId: account.ownerUserId ?? null,
        status: account.status,
        customFields: asJson(account.customFields),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: account.version
      }
    });
  }

  for (const contact of seed.contacts) {
    await prisma.contact.upsert({
      where: { id: contact.id },
      update: {
        accountId: contact.accountId ?? null,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        ownerUserId: contact.ownerUserId ?? null,
        customFields: asJson(contact.customFields),
        updatedAt: now,
        updatedBy: seedUserId,
        version: contact.version
      },
      create: {
        id: contact.id,
        tenantId: seedTenantId,
        accountId: contact.accountId ?? null,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        ownerUserId: contact.ownerUserId ?? null,
        customFields: asJson(contact.customFields),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: contact.version
      }
    });
  }

  for (const lead of seed.leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {
        source: lead.source,
        companyName: lead.companyName ?? null,
        contactName: lead.contactName,
        email: lead.email ?? null,
        status: lead.status,
        convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
        convertedAccountId: lead.convertedAccountId ?? null,
        convertedContactId: lead.convertedContactId ?? null,
        convertedOpportunityId: lead.convertedOpportunityId ?? null,
        customFields: asJson(lead.customFields),
        updatedAt: now,
        updatedBy: seedUserId,
        version: lead.version
      },
      create: {
        id: lead.id,
        tenantId: seedTenantId,
        source: lead.source,
        companyName: lead.companyName ?? null,
        contactName: lead.contactName,
        email: lead.email ?? null,
        status: lead.status,
        convertedAt: lead.convertedAt ? new Date(lead.convertedAt) : null,
        convertedAccountId: lead.convertedAccountId ?? null,
        convertedContactId: lead.convertedContactId ?? null,
        convertedOpportunityId: lead.convertedOpportunityId ?? null,
        customFields: asJson(lead.customFields),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: lead.version
      }
    });
  }

  for (const opportunity of seed.opportunities) {
    await prisma.opportunity.upsert({
      where: { id: opportunity.id },
      update: {
        accountId: opportunity.accountId,
        primaryContactId: opportunity.primaryContactId ?? null,
        name: opportunity.name,
        stage: opportunity.stage,
        amount: opportunity.amount ?? null,
        currency: opportunity.currency,
        expectedCloseDate: opportunity.expectedCloseDate
          ? new Date(`${opportunity.expectedCloseDate}T00:00:00.000Z`)
          : null,
        ownerUserId: opportunity.ownerUserId,
        probabilityPct: opportunity.probabilityPct ?? null,
        customFields: asJson(opportunity.customFields),
        updatedAt: now,
        updatedBy: seedUserId,
        version: opportunity.version
      },
      create: {
        id: opportunity.id,
        tenantId: seedTenantId,
        accountId: opportunity.accountId,
        primaryContactId: opportunity.primaryContactId ?? null,
        name: opportunity.name,
        stage: opportunity.stage,
        amount: opportunity.amount ?? null,
        currency: opportunity.currency,
        expectedCloseDate: opportunity.expectedCloseDate
          ? new Date(`${opportunity.expectedCloseDate}T00:00:00.000Z`)
          : null,
        ownerUserId: opportunity.ownerUserId,
        probabilityPct: opportunity.probabilityPct ?? null,
        customFields: asJson(opportunity.customFields),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: opportunity.version
      }
    });
  }

  for (const task of seed.tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        parentType: task.parent?.type ?? null,
        parentId: task.parent?.id ?? null,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt ? new Date(task.dueAt) : null,
        assignedUserId: task.assignedUserId,
        updatedAt: now,
        updatedBy: seedUserId,
        version: task.version
      },
      create: {
        id: task.id,
        tenantId: seedTenantId,
        parentType: task.parent?.type ?? null,
        parentId: task.parent?.id ?? null,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        dueAt: task.dueAt ? new Date(task.dueAt) : null,
        assignedUserId: task.assignedUserId,
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: task.version
      }
    });
  }

  for (const note of seed.notes) {
    await prisma.note.upsert({
      where: { id: note.id },
      update: {
        parentType: note.parent.type,
        parentId: note.parent.id,
        body: note.body,
        bodyFormat: note.bodyFormat,
        updatedAt: now,
        updatedBy: seedUserId,
        version: note.version
      },
      create: {
        id: note.id,
        tenantId: seedTenantId,
        parentType: note.parent.type,
        parentId: note.parent.id,
        body: note.body,
        bodyFormat: note.bodyFormat,
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: note.version
      }
    });
  }

  for (const activity of seed.activities) {
    await prisma.activity.upsert({
      where: { id: activity.id },
      update: {
        parentType: activity.parent.type,
        parentId: activity.parent.id,
        kind: activity.type,
        subject: activity.subject,
        occurredAt: new Date(activity.occurredAt),
        payload: asJson(activity.payload),
        updatedAt: now,
        updatedBy: seedUserId,
        version: activity.version
      },
      create: {
        id: activity.id,
        tenantId: seedTenantId,
        parentType: activity.parent.type,
        parentId: activity.parent.id,
        kind: activity.type,
        subject: activity.subject,
        occurredAt: new Date(activity.occurredAt),
        payload: asJson(activity.payload),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: activity.version
      }
    });
  }

  for (const definition of seed.customFieldDefinitions) {
    await prisma.customFieldDefinition.upsert({
      where: {
        tenantId_entityType_key: {
          tenantId: seedTenantId,
          entityType: definition.entityType,
          key: definition.key
        }
      },
      update: {
        label: definition.label,
        fieldType: definition.fieldType,
        required: definition.required,
        isIndexed: definition.isIndexed,
        schema: asJson(definition.schema ?? {}),
        updatedAt: now,
        updatedBy: seedUserId,
        version: definition.version
      },
      create: {
        id: definition.id,
        tenantId: seedTenantId,
        entityType: definition.entityType,
        key: definition.key,
        label: definition.label,
        fieldType: definition.fieldType,
        required: definition.required,
        isIndexed: definition.isIndexed,
        schema: asJson(definition.schema ?? {}),
        createdAt: now,
        updatedAt: now,
        createdBy: seedUserId,
        updatedBy: seedUserId,
        version: definition.version
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: seedTenantId,
      entityType: "tenant",
      entityId: seedTenantId,
      action: "seeded",
      actorUserId: seedManagerId,
      occurredAt: now,
      after: asJson({
        teamId: seedTeamId,
        accounts: seed.accounts.length,
        opportunities: seed.opportunities.length
      })
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
