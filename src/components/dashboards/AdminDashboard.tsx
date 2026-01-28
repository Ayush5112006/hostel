import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, CalendarCheck, CalendarX, Home } from 'lucide-react';
import { format } from 'date-fns';

interface TodayStats {
  present: number;
  absent: number;
  leave: number;
  total: number;
}

interface RecentAttendance {
  id: string;
  status: string;
  date: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<TodayStats>({
    present: 0,
    absent: 0,
    leave: 0,
    total: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);

  useEffect(() => {
    fetchStats();
    fetchRecentAttendance();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Get total students
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'student');

    const totalStudents = roles?.length || 0;

    // Get today's attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('date', today);

    setStats({
      present: attendance?.filter(a => a.status === 'present').length || 0,
      absent: attendance?.filter(a => a.status === 'absent').length || 0,
      leave: attendance?.filter(a => a.status === 'leave').length || 0,
      total: totalStudents,
    });
  };

  const fetchRecentAttendance = async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        status,
        date,
        profiles!inner(full_name, email)
      `)
      .order('marked_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecentAttendance(data as unknown as RecentAttendance[]);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      present: 'status-present',
      absent: 'status-absent',
      leave: 'status-leave',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const statCards = [
    { title: 'Present', value: stats.present, icon: CalendarCheck, color: 'bg-success' },
    { title: 'Absent', value: stats.absent, icon: CalendarX, color: 'bg-destructive' },
    { title: 'On Leave', value: stats.leave, icon: Home, color: 'bg-info' },
    { title: 'Total Students', value: stats.total, icon: Users, color: 'bg-accent' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor daily attendance and generate reports
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 glass-card">
        <CardHeader>
          <CardTitle className="font-display">Recent Attendance</CardTitle>
          <CardDescription>Latest attendance records from students</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records yet</p>
          ) : (
            <div className="space-y-3">
              {recentAttendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">{record.profiles.full_name}</p>
                    <p className="text-sm text-muted-foreground">{record.profiles.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(record.date), 'MMM d, yyyy')}
                    </span>
                    {getStatusBadge(record.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}