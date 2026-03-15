'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    id: string;
    name: string | null;
    email: string;
    photoURL?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (data: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: () => { },
    logout: () => { },
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkSession() {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                }
            } catch (error) {
                console.error('Session check failed', error);
            } finally {
                setLoading(false);
            }
        }
        checkSession();
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        router.push('/');
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/me', { method: 'POST' }); // Trigger logout
            setUser(null);
            router.push('/auth/login');
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
