
      // Initialize Tailwind CSS custom theme
      
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              'accent-primary': 'var(--accent-primary)',
              'accent-primary-dark': 'var(--accent-primary-dark)',
              'bg-main': 'var(--bg-main)',
              'bg-pane-light': 'var(--bg-pane-light)',
              'bg-pane-dark': 'var(--bg-pane-dark)',
              'text-primary': 'var(--text-primary)',
              'text-secondary': 'var(--text-secondary)',
              'text-tertiary': 'var(--text-tertiary)',
              'border-color': 'var(--border-color)',
            }
          }
        }
      }
    

/* ===== next early block ===== */


      try {
        const defaultTheme = 'reputify';
        const theme = localStorage.getItem('codex-notes-theme') || defaultTheme;
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'reputify') {
           document.documentElement.classList.add('reputify-theme');
        }
      } catch (e) {}
    