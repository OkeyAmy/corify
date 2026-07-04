import { Suspense } from 'react';
import Dashboard from '../../components/Dashboard';

export default function DashboardPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="dashboard-loading">Loading Corify...</div>}>
      <Dashboard />
    </Suspense>
  );
}
