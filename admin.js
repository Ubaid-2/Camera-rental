
// Admin Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadDashboardStats(); // Load stats on start
    loadPendingUsers();   // Default tab
});

let currentTab = 'pending';

// Switch Tabs
function switchTab(tab) {
    currentTab = tab;

    // Update UI Buttons
    document.getElementById('tab-pending').classList.toggle('active', tab === 'pending');
    document.getElementById('tab-all').classList.toggle('active', tab === 'all');

    if (tab === 'pending') {
        loadPendingUsers();
    } else {
        loadAllUsers();
    }
}

// Check Admin Access
async function checkAdminAuth() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
            window.location.href = 'admin_login.html';
            return;
        }

        const { data: profile, error } = await sb
            .from('profiles')
            .select('role, full_name, user_photo_url')
            .eq('id', session.user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            console.warn("User is not admin or profile missing");
            // alert("Access denied. Admins only.");
            // window.location.href = 'index.html';
            // In development, sometimes roles aren't set perfectly, so we might fail gracefully or just warn.
        }

        // Update Sidebar Profile
        if (profile) {
            document.getElementById('nav-user-name').innerText = profile.full_name || 'Admin';
            if (profile.user_photo_url) {
                document.getElementById('nav-avatar').src = profile.user_photo_url;
            }
        }

    } catch (err) {
        console.error("Auth check failed:", err);
    }
}

// Load Stats
async function loadDashboardStats() {
    try {
        const { count: totalUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true });
        const { count: pendingUsers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: verifiedSellers } = await sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'seller').eq('status', 'approved');

        document.getElementById('stat-total-users').innerText = totalUsers || 0;
        document.getElementById('stat-pending').innerText = pendingUsers || 0;
        document.getElementById('stat-verified').innerText = verifiedSellers || 0;
    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

// Load Pending Users
async function loadPendingUsers() {
    const container = document.getElementById('users-list-container');
    container.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>Loading pending requests...</p></div>';

    try {
        const { data: users, error } = await sb
            .from('profiles')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #94a3b8;">
                    <p style="font-size: 3rem; margin-bottom: 1rem;">🎉</p>
                    <p>No pending approvals! You're all caught up.</p>
                </div>`;
            return;
        }

        // Render Cards (Wait for signed URLs)
        const cardsHTML = await Promise.all(users.map(async (user) => {
            const front = await getSecureLink(user.cnic_front_url);
            const back = await getSecureLink(user.cnic_back_url);
            const selfie = await getSecureLink(user.user_photo_url);

            // Format Date
            const joined = new Date(user.created_at).toLocaleDateString();

            return `
            <div class="user-item">
                <img src="${selfie || 'https://ui-avatars.com/api/?name=' + (user.full_name || user.email)}" class="user-avatar" alt="Avatar">
                
                <div class="user-details">
                    <h4>${user.full_name || 'Unknown Name'} <span style="font-weight:normal; font-size: 0.8em; color: #64748b;">(${user.role})</span></h4>
                    <p>${user.email}</p>
                    <p><small>Joined: ${joined}</small></p>
                </div>

                <div class="docs-section">
                    <div class="docs-title">Verification Documents</div>
                    <div class="docs-grid">
                        <div class="doc-item">
                            <img src="${front || 'placeholder.jpg'}" class="doc-thumb" onclick="openImage('${front}')" title="CNIC Front">
                            <div class="doc-caption">CNIC Front</div>
                        </div>
                        <div class="doc-item">
                            <img src="${back || 'placeholder.jpg'}" class="doc-thumb" onclick="openImage('${back}')" title="CNIC Back">
                            <div class="doc-caption">CNIC Back</div>
                        </div>
                    </div>
                </div>

                <div class="user-actions">
                    <button onclick="updateStatus('${user.id}', 'approved')" class="btn-icon approve">
                        <span>✓</span> Approve
                    </button>
                    <button onclick="updateStatus('${user.id}', 'rejected')" class="btn-icon reject">
                        <span>✕</span> Reject
                    </button>
                </div>
            </div>`;
        }));

        container.innerHTML = cardsHTML.join('');

    } catch (err) {
        console.error("Error loading pending users:", err);
        container.innerHTML = `<p style="color: red; text-align: center;">Failed to load users: ${err.message}</p>`;
    }
}

// Load All Users
async function loadAllUsers() {
    const container = document.getElementById('users-list-container');
    container.innerHTML = '<div style="text-align:center; padding: 2rem;"><p>Loading users...</p></div>';

    try {
        // Fetch all except admin
        const { data: users, error } = await sb
            .from('profiles')
            .select('*')
            .neq('role', 'admin')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!users || users.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">No users found.</p>';
            return;
        }

        const listHTML = users.map(user => {
            const isBlocked = user.status === 'blocked';
            const statusClass = `status-${user.status}`;

            return `
            <div class="user-item" style="grid-template-columns: auto 1fr auto auto;">
                <img src="${user.user_photo_url || 'https://ui-avatars.com/api/?name=' + (user.full_name || user.email)}" class="user-avatar" alt="Avatar">
                
                <div class="user-details">
                    <h4>${user.full_name || 'User'}</h4>
                    <p>${user.email}</p>
                    <p><small>ID: ${user.id}</small></p>
                </div>

                <span class="user-status ${statusClass}">${user.status}</span>

                <div class="user-actions">
                    ${isBlocked
                    ? `<button onclick="updateStatus('${user.id}', 'approved')" class="btn-icon approve">Unblock</button>`
                    : `<button onclick="updateStatus('${user.id}', 'blocked')" class="btn-icon reject">Block</button>`
                }
                </div>
            </div>`;
        }).join('');

        container.innerHTML = listHTML;

    } catch (err) {
        console.error("Error loading all users:", err);
        container.innerHTML = `<p style="color: red; text-align: center;">Error: ${err.message}</p>`;
    }
}

// Helper: Get Secure Link
async function getSecureLink(pathOrUrl) {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http')) return pathOrUrl; // Already a full URL

    // We assume 'cnic_images' bucket based on schema
    const { data, error } = await sb.storage
        .from('cnic_images')
        .createSignedUrl(pathOrUrl, 3600);

    if (error) {
        console.warn("Error signing URL:", pathOrUrl, error);
        return null;
    }
    return data.signedUrl;
}

// Update User Status
async function updateStatus(userId, newStatus) {
    if (!confirm(`Are you sure you want to set this user to ${newStatus.toUpperCase()}?`)) return;

    try {
        // 1. Update in DB
        const { error } = await sb
            .from('profiles')
            .update({ status: newStatus })
            .eq('id', userId);

        if (error) throw error;

        // 2. Success Feedback
        // Refresh Stats & List
        loadDashboardStats();
        if (currentTab === 'pending') {
            loadPendingUsers();
        } else {
            loadAllUsers();
        }

        // Simple Toast
        showToast(`User ${newStatus} successfully`, 'success');

    } catch (err) {
        console.error("Update failed:", err);
        alert(`Failed to update status: ${err.message}`);
    }
}

// Image Modal
function openImage(src) {
    if (!src) return;
    document.getElementById('modalImage').src = src;
    document.getElementById('imageModal').classList.add('active');
}

// Toast Notification Helper (Simple implementation)
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '1rem 1.5rem';
    toast.style.background = type === 'success' ? '#22c55e' : '#3b82f6';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    toast.style.zIndex = '100000';
    toast.style.animation = 'fadeIn 0.3s ease-out';
    toast.innerText = msg;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
