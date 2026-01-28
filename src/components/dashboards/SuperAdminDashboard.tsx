import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCog, GraduationCap, CalendarCheck } from 'lucide-react';

interface Stats {
  totalStudents: number;
  totalAdmins: number;
  presentToday: number;
  absentToday: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalAdmins: 0,
    presentToday: 0,
    absentToday: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch role counts
    const { data: roles } = await supabase.from('user_roles').select('role');
    const studentCount = roles?.filter(r => r.role === 'student').length || 0;
    const adminCount = roles?.filter(r => r.role === 'admin').length || 0;

    // Fetch today's attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('date', today);

    const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
    const absentCount = attendance?.filter(a => a.status === 'absent').length || 0;

    setStats({
      totalStudents: studentCount,
      totalAdmins: adminCount,
      presentToday: presentCount,
      absentToday: absentCount,
    });
  };

  const statCards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: GraduationCap,
      color: 'bg-info',
    },
    {
      title: 'Total Admins',
      value: stats.totalAdmins,
      icon: UserCog,
      color: 'bg-accent',
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      icon: CalendarCheck,
      color: 'bg-success',
    },
    {
      title: 'Absent Today',
      value: stats.absentToday,
      icon: Users,
      color: 'bg-destructive',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Super Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage admins, students, and view overall mess statistics
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

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="/manage-users"
              className="flex items-center gap-3 p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Manage Users</p>
                <p className="text-sm text-muted-foreground">Add or remove admins and students</p>
              </div>
            </a>
            <a
              href="/reports"
              className="flex items-center gap-3 p-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <CalendarCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">View Reports</p>
                <p className="text-sm text-muted-foreground">Check attendance statistics</p>
              </div>
            </a>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Today's Overview</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Attendance Rate</span>
                <span className="font-semibold">
                  {stats.totalStudents > 0
                    ? Math.round((stats.presentToday / stats.totalStudents) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-success h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      stats.totalStudents > 0
                        ? (stats.presentToday / stats.totalStudents) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{stats.presentToday} present</span>
                <span>{stats.absentToday} absent</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}