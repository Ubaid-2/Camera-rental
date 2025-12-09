// Theme & UI Management
const STORAGE_KEY = 'lenslocker_theme';
const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
    applyTheme(savedTheme);
    setupThemeToggles();
    setupMobileSidebar();
    // Wait for Supabase to be ready
    setTimeout(checkUserStatus, 500);
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
    const settingsToggle = document.getElementById('theme-toggle');
    if (settingsToggle) {
        settingsToggle.onclick = toggleTheme;
    }

    const nav = document.querySelector('.sidebar-nav');
    if (nav && !document.getElementById('sidebar-theme-btn')) {
        const btn = document.createElement('a');
        btn.id = 'sidebar-theme-btn';
        btn.href = '#';
        btn.className = 'nav-item';
        btn.onclick = (e) => { e.preventDefault(); toggleTheme(); };

        // Insert before login is tricky without specific selector, simply append for now or insert before the spacer if possible
        // But we want it relative to other items.
        // Let's insert it before the spacer div
        const spacer = nav.querySelector('div[style*="margin-top: auto"]');
        if (spacer) {
            nav.insertBefore(btn, spacer);
        } else {
            nav.appendChild(btn);
        }
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
    // 1. Inject Overlay if missing
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = closeSidebar; // Click overlay to close
        document.body.appendChild(overlay);
    }

    // 2. Inject Hamburger Button if missing
    if (!document.getElementById('mobile-menu-btn')) {
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.className = 'mobile-menu-toggle'; // Use CSS class
        btn.innerHTML = '<span class="material-icons-round" style="font-size: 1.5rem;">menu</span>';

        btn.onclick = (e) => {
            e.stopPropagation();
            toggleSidebar();
        };

        document.body.appendChild(btn);
    }

    // Close on link click (mobile UX)
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const btn = document.getElementById('mobile-menu-btn');

    if (sidebar) {
        sidebar.classList.toggle('active');
        const isActive = sidebar.classList.contains('active');

        if (overlay) {
            if (isActive) overlay.classList.add('active');
            else overlay.classList.remove('active');
        }

        // Update Icon
        if (btn) {
            const iconName = isActive ? 'close' : 'menu';
            btn.innerHTML = `<span class="material-icons-round" style="font-size: 1.5rem;">${iconName}</span>`;
        }
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const btn = document.getElementById('mobile-menu-btn');

    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    if (btn) btn.innerHTML = '<span class="material-icons-round" style="font-size: 1.5rem;">menu</span>';
}

// User Profile Injection
async function checkUserStatus() {
    if (typeof sb === 'undefined') {
        // Retry once if loaded too fast
        setTimeout(checkUserStatus, 1000);
        return;
    }

    const { data: { session } } = await sb.auth.getSession();
    const nav = document.querySelector('.sidebar-nav');

    // Remove existing Login button if logged in, or Profile section if logged out
    const loginBtn = nav.querySelector('a[href*="login.html"]'); // Roughly find login buttons

    if (session) {
        // User is logged in
        // 1. Hide Login Button (specifically the big one)
        // We might have multiple login buttons (Seller Portal, Login). 
        // Let's filter out the generic generic login btn
        const mainLoginBtn = Array.from(nav.querySelectorAll('.nav-item')).find(el => el.textContent.includes('Login'));
        if (mainLoginBtn) mainLoginBtn.style.display = 'none';

        // 2. Fetch Profile Info
        const { data: profile } = await sb
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const name = profile ? (profile.full_name || session.user.email.split('@')[0]) : 'User';
        const role = profile ? profile.role : 'Member';

        // Handle Avatar
        let avatarUrl = 'https://via.placeholder.com/40';
        if (profile && profile.user_photo_url) {
            // Check if it's already a full URL or needs signing
            if (profile.user_photo_url.startsWith('http')) {
                avatarUrl = profile.user_photo_url;
            } else {
                const { data } = await sb.storage.from('camera_images').createSignedUrl(profile.user_photo_url, 3600);
                if (data) avatarUrl = data.signedUrl;
            }
        }

        // 3. Create User Section
        if (!document.getElementById('sidebar-user-section')) {
            const userSection = document.createElement('div');
            userSection.id = 'sidebar-user-section';
            userSection.className = 'sidebar-user';

            // Determine dashboard link based on role
            const dashboardLink = role === 'seller' ? 'seller_dashboard.html' : 'buyer_dashboard.html';

            userSection.innerHTML = `
                <a href="${dashboardLink}" class="user-profile-preview">
                    <img src="${avatarUrl}" class="user-avatar-small" alt="Profile">
                    <div class="user-info-small">
                        <div class="user-name-small">${name}</div>
                        <div class="user-role-small">${role}</div>
                    </div>
                </a>
                <a href="#" id="sidebar-logout-btn" class="nav-item" style="color: #ef4444; justify-content: flex-start;">
                    <span class="material-icons-round">logout</span>
                    <span class="nav-text">Logout</span>
                </a>
            `;

            nav.appendChild(userSection);

            // Attach Logout Handler
            document.getElementById('sidebar-logout-btn').onclick = async (e) => {
                e.preventDefault();
                await sb.auth.signOut();
                window.location.href = 'index.html';
            };
        }
    } else {
        // Not logged in
        // Ensure Login button is visible
        const mainLoginBtn = Array.from(nav.querySelectorAll('.nav-item')).find(el => el.textContent.includes('Login'));
        if (mainLoginBtn) mainLoginBtn.style.display = 'flex';

        // Remove user section if exists (e.g. after logout without reload)
        const userSection = document.getElementById('sidebar-user-section');
        if (userSection) userSection.remove();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initTheme);
