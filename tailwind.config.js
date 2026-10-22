/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'], // Supports light, dark, and grayscale themes
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
  	extend: {
  		fontFamily: {
  			poppins: [
  				'Poppins',
  				'sans-serif'
  			]
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  						chart: {
				'1': 'hsl(var(--chart-1))',
				'2': 'hsl(var(--chart-2))',
				'3': 'hsl(var(--chart-3))',
				'4': 'hsl(var(--chart-4))',
				'5': 'hsl(var(--chart-5))'
			},
			warning: {
				DEFAULT: 'hsl(var(--warning))',
				foreground: 'hsl(var(--warning-foreground))'
			},
			success: {
				DEFAULT: 'hsl(var(--success))',
				foreground: 'hsl(var(--success-foreground))'
			},
			'sidebar-background': 'hsl(var(--sidebar-background))',
			'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
			'sidebar-primary': 'hsl(var(--sidebar-primary))',
			'sidebar-primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
			'sidebar-accent': 'hsl(var(--sidebar-accent))',
			'sidebar-accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
			'sidebar-border': 'hsl(var(--sidebar-border))',
			'dashboard-card': 'hsl(var(--dashboard-card))',
			'dashboard-card-border': 'hsl(var(--dashboard-card-border))',
			'dashboard-stat-positive': 'hsl(var(--dashboard-stat-positive))',
			'dashboard-stat-negative': 'hsl(var(--dashboard-stat-negative))',
			'dashboard-stat-neutral': 'hsl(var(--dashboard-stat-neutral))',
			'icon-dashboard': 'hsl(var(--icon-dashboard))',
			'icon-agents': 'hsl(var(--icon-agents))',
			'icon-memory': 'hsl(var(--icon-memory))',
			'icon-workflows': 'hsl(var(--icon-workflows))',
			'icon-integrations': 'hsl(var(--icon-integrations))',
			'icon-credentials': 'hsl(var(--icon-credentials))',
			'icon-teams': 'hsl(var(--icon-teams))',
			'icon-workspaces': 'hsl(var(--icon-workspaces))',
			'icon-projects': 'hsl(var(--icon-projects))',
			'icon-settings': 'hsl(var(--icon-settings))',
			'icon-monitoring': 'hsl(var(--icon-monitoring))'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};