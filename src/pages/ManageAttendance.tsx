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
import { CalendarIcon, Loader2, Check, X, Clock, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  email: string;
  full_name: string;
  attendance_status?: string;
}

export default function ManageAttendance() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, [date]);

  const fetchStudents = async () => {
    setIsLoading(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Fetch all student user IDs from user_roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        toast({
          title: 'Error',
          description: 'Failed to load student roles',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const userIds = (userRoles || []).map(ur => ur.user_id);

      if (userIds.length === 0) {
        setStudents([]);
        toast({
          title: 'Info',
          description: 'No students found in the system',
        });
        setIsLoading(false);
        return;
      }

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast({
          title: 'Error',
          description: 'Failed to load student profiles',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Fetch attendance for the date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('user_id, status')
        .eq('date', dateStr);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
      }

      // Merge data
      const attendanceMap = new Map((attendanceData || []).map((a: any) => [a.user_id, a.status]));
      
      const studentsWithAttendance = (profiles || [])
        .map((profile: any) => ({
          id: profile.id,
          email: profile.email || '',
          full_name: profile.full_name || '',
          attendance_status: attendanceMap.get(profile.id) || null
        }));

      setStudents(studentsWithAttendance);
      
      if (studentsWithAttendance.length === 0 && !studentsError) {
        toast({
          title: 'Info',
          description: 'No students found in the system',
        });
      }
    } catch (error) {
      console.error('Error in fetchStudents:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'leave' | 'not_taken') => {
    setSavingId(studentId);
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Check if attendance record exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', studentId)
        .eq('date', dateStr)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('attendance')
          .update({ status })
          .eq('user_id', studentId)
          .eq('date', dateStr);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('attendance')
          .insert({
            user_id: studentId,
            date: dateStr,
            status
          });

        if (error) throw error;
      }

      // Update local state
      setStudents(students.map(s => 
        s.id === studentId ? { ...s, attendance_status: status } : s
      ));

      toast({
        title: 'Success',
        description: `Attendance marked as ${status}`,
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark attendance',
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          Not Checked
        </span>
      );
    }

    const styles: Record<string, string> = {
      present: 'status-present',
      absent: 'status-absent',
      leave: 'status-leave',
      not_taken: 'bg-gray-400 text-white',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-muted'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Manage Attendance</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Mark and edit attendance for all students
            </p>
          </div>

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
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Users and Attendance Tables */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-xl md:text-2xl">
              Attendance for {format(date, 'MMM d, yyyy')}
            </CardTitle>
            <CardDescription>
              {students.length} student{students.length !== 1 ? 's' : ''} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm md:text-base">
                No students found
              </p>
            ) : (
              <div className="space-y-8">
                {/* Students Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Students List</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Name</TableHead>
                          <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium text-sm md:text-base">
                              {student.full_name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs md:text-sm">{student.email}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Attendance Table */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Mark Attendance</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs md:text-sm">Name</TableHead>
                          <TableHead className="hidden sm:table-cell text-xs md:text-sm">Email</TableHead>
                          <TableHead className="text-xs md:text-sm">Status</TableHead>
                          <TableHead className="text-xs md:text-sm text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium text-sm md:text-base">
                              {student.full_name}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-xs md:text-sm">{student.email}</TableCell>
                            <TableCell className="text-xs md:text-sm">
                              {getStatusBadge(student.attendance_status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <Button
                                  size="sm"
                                  variant={student.attendance_status === 'absent' ? 'default' : 'outline'}
                                  className={cn(
                                    'h-8 px-2 text-xs',
                                    student.attendance_status === 'absent' && 'bg-destructive hover:bg-destructive',
                                    student.attendance_status && student.attendance_status !== 'absent' && 'opacity-50 cursor-not-allowed'
                                  )}
                                  onClick={() => markAttendance(student.id, 'absent')}
                                  disabled={savingId === student.id || (role !== 'super_admin' && student.attendance_status !== null && student.attendance_status !== 'absent')}
                                  title="Mark as Absent"
                                >
                                  {savingId === student.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={student.attendance_status === 'present' ? 'default' : 'outline'}
                                  className={cn(
                                    'h-8 px-2 text-xs',
                                    student.attendance_status === 'present' && 'bg-success hover:bg-success',
                                    student.attendance_status && student.attendance_status !== 'present' && 'opacity-50 cursor-not-allowed'
                                  )}
                                  onClick={() => markAttendance(student.id, 'present')}
                                  disabled={savingId === student.id || (role !== 'super_admin' && student.attendance_status !== null && student.attendance_status !== 'present')}
                                  title="Mark as Present"
                                >
                                  {savingId === student.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={student.attendance_status === 'leave' ? 'default' : 'outline'}
                                  className={cn(
                                    'h-8 px-2 text-xs',
                                    student.attendance_status === 'leave' && 'bg-info hover:bg-info',
                                    student.attendance_status && student.attendance_status !== 'leave' && 'opacity-50 cursor-not-allowed'
                                  )}
                                  onClick={() => markAttendance(student.id, 'leave')}
                                  disabled={savingId === student.id || (role !== 'super_admin' && student.attendance_status !== null && student.attendance_status !== 'leave')}
                                  title="Mark as Leave"
                                >
                                  {savingId === student.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Clock className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={student.attendance_status === 'not_taken' ? 'default' : 'outline'}
                                  className={cn(
                                    'h-8 px-2 text-xs',
                                    student.attendance_status === 'not_taken' && 'bg-gray-500 hover:bg-gray-600',
                                    student.attendance_status && student.attendance_status !== 'not_taken' && 'opacity-50 cursor-not-allowed'
                                  )}
                                  onClick={() => markAttendance(student.id, 'not_taken')}
                                  disabled={savingId === student.id || (role !== 'super_admin' && student.attendance_status !== null && student.attendance_status !== 'not_taken')}
                                  title="Mark as Not Taken"
                                >
                                  {savingId === student.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Ban className="w-3 h-3" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
