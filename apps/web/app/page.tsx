import { Suspense } from "react";
import { CRMWorkspace } from "../components/crm-workspace";
import { loadDashboardData } from "../lib/dashboard-data";

export default async function Home() {
  const dashboard = await loadDashboardData();
  return (
    <Suspense fallback={null}>
      <CRMWorkspace initialDashboard={dashboard} />
    </Suspense>
  );
}
