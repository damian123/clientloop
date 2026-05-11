import type { DashboardResponse } from "@clientloop/contracts";
import { createSeedData, seedTenantId, seedUserId } from "@clientloop/domain";
import { CRMClient } from "@clientloop/ui-sdk";

export async function loadDashboardData(): Promise<DashboardResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL;

  if (baseUrl) {
    try {
      const client = new CRMClient({
        baseUrl,
        tenantId: seedTenantId,
        userId: seedUserId
      });
      return await client.dashboard();
    } catch {
      return seedDashboard();
    }
  }

  return seedDashboard();
}

function seedDashboard(): DashboardResponse {
  const seed = createSeedData();

  return {
    accounts: seed.accounts,
    contacts: seed.contacts,
    leads: seed.leads,
    opportunities: seed.opportunities,
    tasks: seed.tasks,
    notes: seed.notes,
    activities: seed.activities,
    customFieldDefinitions: seed.customFieldDefinitions
  };
}
