import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, CalendarCheck, CalendarX, Home, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface TodayStats {
  present: number;
  absent: number;
  leave: number;
  notChecked: number;
  total: number;
}

interface RecentAttendance {
  id: string;
  status: string;
  date: string;
  marked_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<TodayStats>({
    present: 0,
    absent: 0,
    leave: 0,
    notChecked: 0,
    total: 0,
  });
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendance[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  

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

    const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
    const absentCount = attendance?.filter(a => a.status === 'absent').length || 0;
    const leaveCount = attendance?.filter(a => a.status === 'leave').length || 0;
    const notCheckedCount = Math.max(0, totalStudents - (presentCount + absentCount + leaveCount));

    setStats({
      present: presentCount,
      absent: absentCount,
      leave: leaveCount,
      notChecked: notCheckedCount,
      total: totalStudents,
    });
  };

  const fetchRecentAttendance = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Get all student user IDs
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      const userIds = (userRoles || []).map(ur => ur.user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const studentsData = (profiles || []).map(p => ({
        user_id: p.id,
        profiles: p
      }));

      setAllStudents(studentsData);

      // Get today's attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('id, status, date, user_id, marked_at')
        .eq('date', today);

      if (!attendanceError && attendance) {
        // Merge with profile data
        const attendanceWithProfiles = attendance.map((a: any) => {
          const profile = profiles?.find(p => p.id === a.user_id);
          return {
            id: a.id,
            status: a.status,
            date: a.date,
            user_id: a.user_id,
            marked_at: a.marked_at,
            profiles: profile || { full_name: 'Unknown', email: '' }
          };
        });

        setRecentAttendance(attendanceWithProfiles);
      }
    } catch (error) {
      console.error('Error in fetchRecentAttendance:', error);
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
    { title: 'Not Checked', value: stats.notChecked, icon: AlertCircle, color: 'bg-warning' },
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-display">Today's Attendance</CardTitle>
            <CardDescription>Attendance grouped by status for {format(new Date(), 'MMM d, yyyy')}</CardDescription>
          </div>
          {/* Removed Fill Not Checked button */}
        </CardHeader>
        <CardContent>
          {allStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No students found</p>
          ) : (
            <div className="space-y-6">
              {/* Not Checked Section */}
              {(recentAttendance.filter(a => !a.status).length > 0 || allStudents.length === recentAttendance.length) && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Not Checked ({allStudents.filter(s => !recentAttendance.find(a => a.profiles.email === s.profiles?.email)).length})
                  </h3>
                  <div className="space-y-2">
                    {allStudents
                      .filter(s => !recentAttendance.find(a => a.profiles.email === s.profiles?.email))
                      .map((student) => (
                        <div key={student.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                          <div>
                            <p className="font-medium text-sm">{student.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{student.profiles?.email}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">--:--</span>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                              Not Checked
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Absent Section */}
              {recentAttendance.filter(a => a.status === 'absent').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-destructive mb-2">
                    Absent ({recentAttendance.filter(a => a.status === 'absent').length})
                  </h3>
                  <div className="space-y-2">
                    {recentAttendance.filter(a => a.status === 'absent').map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                        <div>
                          <p className="font-medium text-sm">{record.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.profiles.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {record.marked_at ? format(new Date(record.marked_at), 'h:mm a') : '--:--'}
                          </span>
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Present Section */}
              {recentAttendance.filter(a => a.status === 'present').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-success mb-2">
                    Present ({recentAttendance.filter(a => a.status === 'present').length})
                  </h3>
                  <div className="space-y-2">
                    {recentAttendance.filter(a => a.status === 'present').map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-success/10">
                        <div>
                          <p className="font-medium text-sm">{record.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.profiles.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {record.marked_at ? format(new Date(record.marked_at), 'h:mm a') : '--:--'}
                          </span>
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* On Leave Section */}
              {recentAttendance.filter(a => a.status === 'leave').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-info mb-2">
                    On Leave ({recentAttendance.filter(a => a.status === 'leave').length})
                  </h3>
                  <div className="space-y-2">
                    {recentAttendance.filter(a => a.status === 'leave').map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-info/10">
                        <div>
                          <p className="font-medium text-sm">{record.profiles.full_name}</p>
                          <p className="text-xs text-muted-foreground">{record.profiles.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {record.marked_at ? format(new Date(record.marked_at), 'h:mm a') : '--:--'}
                          </span>
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}