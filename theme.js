// Theme & UI Management
const STORAGE_KEY = 'lenslocker_theme';
const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
    applyTheme(savedTheme);
    setupThemeToggles();
    setupMobileSidebar();
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === LIGHT_MODE) {
        root.classList.add('light-mode');
    } else {
        root.classList.remove('light-mode');
    }
    localStorage.setItem(STORAGE_KEY, theme);
    updateIcons(theme);
}

function toggleTheme() {
    const current = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
    const newTheme = current === DARK_MODE ? LIGHT_MODE : DARK_MODE;
    applyTheme(newTheme);
}

function setupThemeToggles() {
    // We might have multiple toggle buttons (Sidebar, Settings Page)
    // Add logic here if we had specific buttons for theme, but for sidebar we inject or rely on existing markup
    const settingsToggle = document.getElementById('theme-toggle');
    if (settingsToggle) {
        settingsToggle.onclick = toggleTheme;
    }

    // If there is a sidebar theme button (we might need to add one dynamically or assume it's there)
    // Note: In new index.html, we didn't explicitly add a theme button in the sidebar list, 
    // but we can add one or letting users use Settings page is cleaner for "Minimized" look.
    // Let's add one to bottom of sidebar if it exists
    const nav = document.querySelector('.sidebar-nav');
    if (nav && !document.getElementById('sidebar-theme-btn')) {
        const btn = document.createElement('a');
        btn.id = 'sidebar-theme-btn';
        btn.href = '#';
        btn.className = 'nav-item';
        btn.onclick = (e) => { e.preventDefault(); toggleTheme(); };

        // Insert before login or at end
        nav.appendChild(btn);
    }
    updateIcons(localStorage.getItem(STORAGE_KEY));
}

function updateIcons(theme) {
    const icon = theme === LIGHT_MODE ? 'light_mode' : 'dark_mode';
    const text = theme === LIGHT_MODE ? 'Light Mode' : 'Dark Mode';

    // Sidebar Btn
    const sidebarBtn = document.getElementById('sidebar-theme-btn');
    if (sidebarBtn) {
        sidebarBtn.innerHTML = `
            <span class="material-icons-round">${icon}</span>
            <span class="nav-text">${text}</span>
        `;
    }

    // Settings Page Btn
    const settingsBtn = document.getElementById('theme-toggle');
    if (settingsBtn) {
        settingsBtn.innerHTML = `<span class="material-icons-round" style="vertical-align: middle; margin-right: 0.5rem;">${icon}</span> Toggle Theme`;
    }
}

// Mobile Sidebar Logic (The Drawer)
function setupMobileSidebar() {
    // Inject Hamburger Button if not present
    if (!document.getElementById('mobile-menu-btn')) {
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.className = 'btn';
        btn.style.position = 'fixed';
        btn.style.top = '1rem';
        btn.style.left = '1rem'; // Left aligned for drawer
        btn.style.zIndex = '1001';
        btn.style.padding = '0.5rem';
        btn.style.display = 'none'; // Hidden by default (desktop)
        btn.style.background = 'var(--glass-bg)';
        btn.style.backdropFilter = 'blur(10px)';
        btn.style.border = '1px solid var(--glass-border)';
        btn.style.borderRadius = '0.5rem';
        btn.innerHTML = '<span class="material-icons-round" style="color: var(--text-color); font-size: 1.5rem;">menu</span>';

        btn.onclick = () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('active');
                const isActive = sidebar.classList.contains('active');
                const icon = isActive ? 'close' : 'menu';

                // Move button if needed? styling handles z-index, so button stays on top.
                // Maybe change icon color or background to stand out against drawer
                btn.innerHTML = `<span class="material-icons-round" style="color: var(--text-color); font-size: 1.5rem;">${icon}</span>`;
            }
        };

        // Close sidebar when clicking outside (on main content)
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const btn = document.getElementById('mobile-menu-btn');

            if (sidebar && sidebar.classList.contains('active')) {
                // If click is NOT on sidebar AND NOT on button
                if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
                    sidebar.classList.remove('active');
                    btn.innerHTML = '<span class="material-icons-round" style="color: var(--text-color); font-size: 1.5rem;">menu</span>';
                }
            }
        });

        document.body.appendChild(btn);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initTheme);
