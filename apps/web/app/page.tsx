import { CRMWorkspace } from "../components/crm-workspace";
import { loadDashboardData } from "../lib/dashboard-data";

export default async function Home() {
  const dashboard = await loadDashboardData();
  return <CRMWorkspace initialDashboard={dashboard} />;
}
