import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CalendarCheck, CalendarX, Home, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type AttendanceStatus = 'present' | 'absent' | 'leave';

interface AttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todayStatus, setTodayStatus] = useState<AttendanceStatus | null>(null);
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<AttendanceStatus | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [stats, setStats] = useState({ present: 0, absent: 0, leave: 0 });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user) {
      fetchTodayStatus();
      fetchRecentRecords();
      fetchStats();
    }
  }, [user]);

  const fetchTodayStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('attendance')
      .select('status')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (data) {
      setTodayStatus(data.status as AttendanceStatus);
    }
  };

  const fetchRecentRecords = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('attendance')
      .select('id, date, status')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7);

    if (data) {
      setRecentRecords(data as AttendanceRecord[]);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('attendance')
      .select('status')
      .eq('user_id', user.id);

    if (data) {
      setStats({
        present: data.filter(r => r.status === 'present').length,
        absent: data.filter(r => r.status === 'absent').length,
        leave: data.filter(r => r.status === 'leave').length,
      });
    }
  };

  const markAttendance = async (status: AttendanceStatus) => {
    if (!user) return;

    setIsLoading(status);

    const { error } = await supabase.from('attendance').upsert(
      {
        user_id: user.id,
        date: today,
        status,
        marked_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,date',
      }
    );

    setIsLoading(null);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to mark attendance. Please try again.',
        variant: 'destructive',
      });
    } else {
      setTodayStatus(status);
      fetchRecentRecords();
      fetchStats();
      toast({
        title: 'Success',
        description: `Marked as ${status} for today.`,
      });
    }
  };

  const oneTimeFillPresent = async () => {
    if (!user || todayStatus) {
      toast({
        title: 'Info',
        description: 'You have already marked your attendance for today',
      });
      return;
    }

    setIsAutoFilling(true);
    await markAttendance('present');
    setIsAutoFilling(false);
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <CalendarCheck className="w-5 h-5" />;
      case 'absent':
        return <CalendarX className="w-5 h-5" />;
      case 'leave':
        return <Home className="w-5 h-5" />;
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

  const attendanceOptions: { status: AttendanceStatus; label: string; description: string; color: string }[] = [
    {
      status: 'present',
      label: 'Present',
      description: 'I ate at the mess today',
      color: 'bg-success hover:bg-success/90',
    },
    {
      status: 'absent',
      label: 'Absent',
      description: "I didn't eat at the mess",
      color: 'bg-destructive hover:bg-destructive/90',
    },
    {
      status: 'leave',
      label: 'Leave',
      description: 'I went home / away',
      color: 'bg-info hover:bg-info/90',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Mark your daily mess attendance
        </p>
      </div>

      {/* Today's Status Card */}
      <Card className="glass-card mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex-1">
            <CardTitle className="font-display">
              Today's Status - {format(new Date(), 'EEEE, MMMM d')}
            </CardTitle>
            <CardDescription>
              {todayStatus
                ? '✓ Attendance locked - cannot be changed'
                : 'Mark your attendance for today'}
            </CardDescription>
          </div>
          {!todayStatus && (
            <Button
              onClick={oneTimeFillPresent}
              disabled={isAutoFilling}
              className="ml-4 bg-success hover:bg-success/90"
            >
              {isAutoFilling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Filling...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  One Time Fill
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {attendanceOptions.map((option) => (
              <Button
                key={option.status}
                onClick={() => markAttendance(option.status)}
                disabled={isLoading !== null || (todayStatus !== null && todayStatus !== option.status)}
                className={`h-auto py-6 flex flex-col items-center gap-2 ${
                  todayStatus === option.status
                    ? option.color + ' ring-2 ring-offset-2 ring-offset-background ring-foreground'
                    : todayStatus !== null
                    ? 'bg-muted opacity-50 cursor-not-allowed text-muted-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
              >
                {isLoading === option.status ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : todayStatus === option.status ? (
                  <Check className="w-6 h-6" />
                ) : (
                  getStatusIcon(option.status)
                )}
                <span className="font-semibold">{option.label}</span>
                <span className="text-xs opacity-80">{option.description}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats and History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Your Statistics</CardTitle>
            <CardDescription>Overall attendance summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-success/10">
                <p className="text-3xl font-bold text-success">{stats.present}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-destructive/10">
                <p className="text-3xl font-bold text-destructive">{stats.absent}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-info/10">
                <p className="text-3xl font-bold text-info">{stats.leave}</p>
                <p className="text-sm text-muted-foreground">Leave</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Recent History</CardTitle>
            <CardDescription>Your last 7 attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRecords.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No records yet. Mark your first attendance!
              </p>
            ) : (
              <div className="space-y-2">
                {recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <span className="text-sm">
                      {format(new Date(record.date), 'EEE, MMM d')}
                    </span>
                    {getStatusBadge(record.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}