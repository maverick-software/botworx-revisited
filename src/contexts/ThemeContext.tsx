import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'chatgpt';

interface ThemeContextValue {
	theme: ThemeMode;
	setTheme: (mode: ThemeMode) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>(() => {
		try {
			const stored = localStorage.getItem('theme');
			if (stored === 'dark' || stored === 'light' || stored === 'chatgpt') return stored as ThemeMode;
		} catch {}
		return 'light';
	});

	useEffect(() => {
		try { localStorage.setItem('theme', theme); } catch {}
		const root = document.documentElement;
		
		// Remove all theme classes first
		root.classList.remove('dark', 'chatgpt');
		
		// Add the appropriate theme class
		if (theme === 'dark') {
			root.classList.add('dark');
		} else if (theme === 'chatgpt') {
			root.classList.add('chatgpt');
		}
		// 'light' theme is the default, no class needed
	}, [theme]);

	const setTheme = (mode: ThemeMode) => setThemeState(mode);
	
	// Toggle cycles through: light -> dark -> Dark Gray -> light
	const toggleTheme = () => setThemeState((prev) => {
		if (prev === 'light') return 'dark';
		if (prev === 'dark') return 'chatgpt';
		return 'light';
	});

	const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggleTheme }), [theme]);

	return (
		<ThemeContext.Provider value={value}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
	return ctx;
}


