import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { validateStoredSession, clearStoredSession } from '@/lib/session';

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
      try {
        localStorage.setItem('sb-auth-token', JSON.stringify(sessionInfo));
      } catch (e) {
        console.warn('Failed to save session to localStorage', e);
      }
    } else {
      try {
        localStorage.removeItem('sb-auth-token');
      } catch (e) {
        // ignore
      }
    }
  };

  // No explicit refreshSession: rely on supabase client's autoRefreshToken and periodic getSession check

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

    // Validate any stored session first; cleanup if expired or malformed
    try {
      const ok = validateStoredSession();
      if (!ok) {
        clearStoredSession();
      }
    } catch (e) {
      clearStoredSession();
    }

    // Check for existing session from supabase
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

  // Periodic session check to keep local state in sync
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const currentSession = (data as any)?.session ?? null;
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user ?? null);
          saveSessionToStorage(currentSession);
        }
      } catch (e) {
        console.warn('Error checking session', e);
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