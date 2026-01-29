import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'admin' | 'student';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session configuration: 2 days
const SESSION_MAX_AGE = 2 * 24 * 60 * 60; // 2 days in seconds
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      return null;
    }
    return data?.role as AppRole;
  };

  // Function to save session to localStorage with expiry
  const saveSessionToStorage = (sessionData: Session | null) => {
    if (sessionData) {
      const sessionInfo = {
        session: sessionData,
        expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
      };
      localStorage.setItem('sb-auth-token', JSON.stringify(sessionInfo));
      
      // Set cookie for 2 days
      const expires = new Date();
      expires.setDate(expires.getDate() + 2);
      document.cookie = `sb-auth-session=${JSON.stringify(sessionInfo)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } else {
      localStorage.removeItem('sb-auth-token');
      document.cookie = 'sb-auth-session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    }
  };

  // Function to refresh session
  const refreshSession = async () => {
    const { data: { session: currentSession }, error } = await supabase.auth.refreshSession();
    if (!error && currentSession) {
      setSession(currentSession);
      setUser(currentSession.user);
      saveSessionToStorage(currentSession);
    }
  };

  // Initial setup: listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, authSession) => {
        setSession(authSession);
        setUser(authSession?.user ?? null);
        saveSessionToStorage(authSession);

        if (authSession?.user) {
          setTimeout(() => {
            fetchUserRole(authSession.user.id).then(setRole);
          }, 0);
        } else {
          setRole(null);
        }
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      saveSessionToStorage(existingSession);
      
      if (existingSession?.user) {
        fetchUserRole(existingSession.user.id).then(setRole);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Periodic session refresh
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        await refreshSession();
      }
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    saveSessionToStorage(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}