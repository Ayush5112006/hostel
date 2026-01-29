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
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [notMarked, setNotMarked] = useState<any[]>([]);
  const [stats, setStats] = useState<DailyStats>({ present: 0, absent: 0, leave: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAttendance();
  }, [date]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Fetch all student user IDs from user_roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      const userIds = (userRoles || []).map(ur => ur.user_id);

      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const studentsData = (profiles || []).map(p => ({
        user_id: p.id,
        profiles: p
      }));

      setAllStudents(studentsData);

      // Fetch attendance records for the date
      const { data, error } = await supabase
        .from('attendance')
        .select('id, date, status, user_id')
        .eq('date', dateStr);

      if (!error && data) {
        // Create attendance reports with profile data
        const attendanceReports = data.map((a: any) => {
          const profile = profiles?.find(p => p.id === a.user_id);
          return {
            id: a.id,
            date: a.date,
            status: a.status,
            user_id: a.user_id,
            profiles: profile || { full_name: 'Unknown', email: '' }
          };
        });

        // Sort by status order: absent, present, leave
        const statusOrder = { absent: 0, present: 1, leave: 2 };
        const sorted = attendanceReports.sort((a, b) => 
          (statusOrder[a.status as keyof typeof statusOrder] ?? 99) - 
          (statusOrder[b.status as keyof typeof statusOrder] ?? 99)
        );
        
        setAttendance(sorted);
        
        // Find students not marked
        const markedUserIds = new Set(data.map((a: any) => a.user_id));
        const notMarkedStudents = studentsData
          .filter(s => !markedUserIds.has(s.user_id));
        
        setNotMarked(notMarkedStudents);
        
        setStats({
          present: data.filter(a => a.status === 'present').length,
          absent: data.filter(a => a.status === 'absent').length,
          leave: data.filter(a => a.status === 'leave').length,
        });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
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
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Attendance Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              View and download daily attendance reports
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal w-full sm:w-auto')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{format(date, 'PPP')}</span>
                  <span className="sm:hidden">{format(date, 'MMM dd')}</span>
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
            <CardTitle className="font-display text-xl md:text-2xl">
              Attendance for {format(date, 'MMM d, yyyy')}
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
            ) : attendance.length === 0 && notMarked.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm md:text-base">
                No students found for this date
              </p>
            ) : (
              <div className="space-y-6">
                {/* Not Marked Section */}
                {notMarked.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full"></span>
                      Not Checked ({notMarked.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <Table className="border border-muted/20 rounded-lg">
                        <TableHeader>
                          <TableRow className="bg-muted/5">
                            <TableHead className="text-xs md:text-sm">Name</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                            <TableHead className="text-xs md:text-sm">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {notMarked.map((record) => (
                            <TableRow key={record.user_id || record.profiles?.id}>
                              <TableCell className="font-medium text-sm md:text-base">
                                {record.profiles?.full_name || 'N/A'}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs md:text-sm">{record.profiles?.email || 'N/A'}</TableCell>
                              <TableCell className="text-xs md:text-sm">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                  Not Checked
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Absent Section */}
                {attendance.filter(a => a.status === 'absent').length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-destructive mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-destructive rounded-full"></span>
                      Absent ({stats.absent})
                    </h3>
                    <div className="overflow-x-auto">
                      <Table className="border border-destructive/20 rounded-lg">
                        <TableHeader>
                          <TableRow className="bg-destructive/5">
                            <TableHead className="text-xs md:text-sm">Name</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                            <TableHead className="text-xs md:text-sm">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendance.filter(a => a.status === 'absent').map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium text-sm md:text-base">
                                {record.profiles.full_name}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs md:text-sm">{record.profiles.email}</TableCell>
                              <TableCell className="text-xs md:text-sm">{getStatusBadge(record.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Present Section */}
                {attendance.filter(a => a.status === 'present').length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-success mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-success rounded-full"></span>
                      Present ({stats.present})
                    </h3>
                    <div className="overflow-x-auto">
                      <Table className="border border-success/20 rounded-lg">
                        <TableHeader>
                          <TableRow className="bg-success/5">
                            <TableHead className="text-xs md:text-sm">Name</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                            <TableHead className="text-xs md:text-sm">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendance.filter(a => a.status === 'present').map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium text-sm md:text-base">
                                {record.profiles.full_name}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs md:text-sm">{record.profiles.email}</TableCell>
                              <TableCell className="text-xs md:text-sm">{getStatusBadge(record.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* On Leave Section */}
                {attendance.filter(a => a.status === 'leave').length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-info mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-info rounded-full"></span>
                      On Leave ({stats.leave})
                    </h3>
                    <div className="overflow-x-auto">
                      <Table className="border border-info/20 rounded-lg">
                        <TableHeader>
                          <TableRow className="bg-info/5">
                            <TableHead className="text-xs md:text-sm">Name</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                            <TableHead className="text-xs md:text-sm">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendance.filter(a => a.status === 'leave').map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium text-sm md:text-base">
                                {record.profiles.full_name}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-xs md:text-sm">{record.profiles.email}</TableCell>
                              <TableCell className="text-xs md:text-sm">{getStatusBadge(record.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}