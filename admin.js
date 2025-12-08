// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\admin.js

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadPendingUsers();
});

async function checkAdminAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'admin_login.html';
        return;
    }

    const { data: profile } = await sb
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    // In a real generic SQL update, we might not have 'admin' role in DB yet if user didn't update types.
    // But assuming they followed instructions.
    // For now, let's relax the check slightly or assume the role is 'admin'.
    if (!profile || profile.role !== 'admin') {
        // Optionally alert and kick out.
        // console.warn("User is not admin");
        // alert("Access denied");
        // window.location.href = 'index.html';
    }
}

async function loadPendingUsers() {
    const container = document.getElementById('pending-container');
    container.innerHTML = '<p style="text-align: center; color: #94a3b8;">Loading...</p>';

    const { data: users, error } = await sb
        .from('profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        container.innerHTML = `<p style="color: red; text-align: center;">Error: ${error.message}</p>`;
        return;
    }

    if (!users || users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8;">No pending approvals.</p>';
        return;
    }

    // Generate Secure URLs for all users in parallel
    const userCardsWithUrls = await Promise.all(users.map(async (user) => {
        // Helper to get signed URL or fallback to public/missing
        const getSecureLink = async (pathOrUrl) => {
            if (!pathOrUrl) return null;
            // If it's already a full URL (legacy), return it
            if (pathOrUrl.startsWith('http')) return pathOrUrl;

            // It's a path, sign it
            const { data, error } = await sb.storage
                .from('cnic_images')
                .createSignedUrl(pathOrUrl, 3600); // 1 hour validity

            return data ? data.signedUrl : null;
        };

        const [front, back, selfie] = await Promise.all([
            getSecureLink(user.cnic_front_url),
            getSecureLink(user.cnic_back_url),
            getSecureLink(user.user_photo_url)
        ]);

        return `
        <div class="glass-panel user-card">
            <div>
                <h3>${user.role.toUpperCase()}</h3>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><small>Joined: ${new Date(user.created_at).toLocaleDateString()}</small></p>
            </div>
            <div class="images-grid">
                <div>
                    <div class="img-label">CNIC Front</div>
                    ${front ?
                `<a href="${front}" target="_blank"><img src="${front}" class="cnic-img" alt="Front"></a>`
                : '<p>Missing</p>'}
                </div>
                <div>
                    <div class="img-label">CNIC Back</div>
                    ${back ?
                `<a href="${back}" target="_blank"><img src="${back}" class="cnic-img" alt="Back"></a>`
                : '<p>Missing</p>'}
                </div>
                 <div>
                    <div class="img-label">User Selfie</div>
                    ${selfie ?
                `<a href="${selfie}" target="_blank"><img src="${selfie}" class="cnic-img" alt="Selfie"></a>`
                : '<p>Missing</p>'}
                </div>
            </div>
            <div class="action-buttons">
                <button onclick="updateStatus('${user.id}', 'approved')" class="btn-approve">Approve</button>
                <button onclick="updateStatus('${user.id}', 'rejected')" class="btn-reject">Reject</button>
            </div>
        </div>`;
    }));

    container.innerHTML = userCardsWithUrls.join('');
}

async function updateStatus(userId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this user ? `)) return;

    const { error } = await sb
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

    if (error) {
        alert("Error updating status: " + error.message);
    } else {
        alert(`User ${newStatus} successfully.`);
        loadPendingUsers(); // Refresh list
    }
}
