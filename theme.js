// Theme Management
const STORAGE_KEY = 'lenslocker_theme';
const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
    applyTheme(savedTheme);
    injectToggle();
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === LIGHT_MODE) {
        root.classList.add('light-mode');
    } else {
        root.classList.remove('light-mode');
    }
    localStorage.setItem(STORAGE_KEY, theme);
    updateIcon(theme);
}

function toggleTheme() {
    const current = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
    const newTheme = current === DARK_MODE ? LIGHT_MODE : DARK_MODE;
    applyTheme(newTheme);
}

function injectToggle() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        const btn = document.createElement('button');
        btn.onclick = toggleTheme;
        btn.id = 'theme-toggle-btn';
        btn.className = 'btn btn-outline';
        btn.style.marginLeft = '1rem';
        btn.style.padding = '0.5rem';
        btn.style.fontSize = '1.2rem';
        btn.innerHTML = '🌙'; // Default icon, updated by updateIcon

        // Insert as first item or append? Append seems safer for spacing
        navLinks.appendChild(btn);

        // Initial icon set
        const current = localStorage.getItem(STORAGE_KEY) || DARK_MODE;
        updateIcon(current);
    }
}

function updateIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = theme === LIGHT_MODE ? '☀️' : '🌙';
        btn.title = theme === LIGHT_MODE ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initTheme);
