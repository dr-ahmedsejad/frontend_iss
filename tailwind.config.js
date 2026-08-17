/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        iss: {
          primary:      '#006633',
          'primary-lt': '#008844',
          'primary-dk': '#004d24',
          secondary:    '#C82020',
          'secondary-lt':'#E03535',
          accent:       '#E5C018',
          'accent-lt':  '#F5D340',
          dark:         '#0a0f1a',
          'dark-soft':  '#1e293b',
          gray:         '#64748b',
          'gray-lt':    '#94a3b8',
          light:        '#f8fafc',
        },
        // Tokens sémantiques de statut (workflow LMD)
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger:  '#ef4444',
          info:    '#3b82f6',
          neutral: '#6b7280',
        },
      },
      fontFamily: {
        display: ["'Cairo'", 'sans-serif'],
        body:    ["'Cairo'", 'sans-serif'],
      },
      boxShadow: {
        card:          '0 8px 25px rgba(0,0,0,0.08)',
        'card-lg':     '0 16px 48px rgba(0,0,0,0.12)',
        'glow-primary':'0 4px 20px rgba(0,92,47,0.3)',
        'glow-accent': '0 8px 25px rgba(212,175,55,0.3)',
        drawer:        '-5px 0 25px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
