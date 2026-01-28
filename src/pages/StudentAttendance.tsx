import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import StudentDashboard from '@/components/dashboards/StudentDashboard';

export default function StudentAttendance() {
  const { role } = useAuth();

  if (role !== 'student') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <StudentDashboard />
    </DashboardLayout>
  );
}