import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AttendanceReport {
  id: string;
  date: string;
  status: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface DailyStats {
  present: number;
  absent: number;
  leave: number;
}

export default function Reports() {
  const { role } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [attendance, setAttendance] = useState<AttendanceReport[]>([]);
  const [stats, setStats] = useState<DailyStats>({ present: 0, absent: 0, leave: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        status,
        profiles!inner(full_name, email)
      `)
      .eq('date', dateStr)
      .order('status');

    if (!error && data) {
      setAttendance(data as unknown as AttendanceReport[]);
      setStats({
        present: data.filter(a => a.status === 'present').length,
        absent: data.filter(a => a.status === 'absent').length,
        leave: data.filter(a => a.status === 'leave').length,
      });
    }
    setIsLoading(false);
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

  const downloadReport = () => {
    const headers = ['Name', 'Email', 'Status'];
    const rows = attendance.map(a => [a.profiles.full_name, a.profiles.email, a.status]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${format(date, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (role !== 'super_admin' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Attendance Reports</h1>
            <p className="text-muted-foreground mt-1">
              View and download daily attendance reports
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button onClick={downloadReport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-success">{stats.present}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{stats.absent}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Leave</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-info">{stats.leave}</p>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">
              Attendance for {format(date, 'MMMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {attendance.length} record{attendance.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : attendance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No attendance records for this date
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.profiles.full_name}
                      </TableCell>
                      <TableCell>{record.profiles.email}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}