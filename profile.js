// profile.js

async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    loadProfile(session.user.id);
}

async function loadProfile(userId) {
    const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        alert("Error loading profile: " + error.message);
        return;
    }

    // Set Header Info
    document.getElementById('profile-email').textContent = profile.email;

    // Status Badge
    const roleSpan = `<span style="opacity:0.7; font-weight:500; margin-right:0.5rem;">${profile.role.toUpperCase()}</span>`;
    const statusClass = profile.status === 'approved' ? 'status-approved' : 'status-pending';
    const statusSpan = `<span class="status-badge ${statusClass}">${profile.status.toUpperCase()}</span>`;
    document.getElementById('profile-role-status').innerHTML = roleSpan + statusSpan;

    // Set Inputs
    document.getElementById('full-name').value = profile.full_name || '';
    document.getElementById('phone').value = profile.phone || '';

    // Set Avatar (Secure Link)
    if (profile.user_photo_url) {
        if (profile.user_photo_url.startsWith('http')) {
            document.getElementById('profile-img').src = profile.user_photo_url;
        } else {
            // Try Public Bucket First (New System)
            const { data } = await sb.storage.from('camera_images').createSignedUrl(profile.user_photo_url, 3600);
            if (data) document.getElementById('profile-img').src = data.signedUrl;

            // Fallback (for old profiles)? Not easy to check without 404. We assume new approach.
        }
    }
}

async function updateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    btn.textContent = "Saving...";
    btn.disabled = true;

    const fullName = document.getElementById('full-name').value;
    const phone = document.getElementById('phone').value;

    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb
        .from('profiles')
        .update({
            full_name: fullName,
            phone: phone
        })
        .eq('id', user.id);

    if (error) {
        alert("Error updating profile: " + error.message);
    } else {
        alert("Profile updated successfully!");
    }
    btn.textContent = "Save Changes";
    btn.disabled = false;
}

async function uploadAvatar() {
    const fileInput = document.getElementById('avatar-upload');
    const file = fileInput.files[0];
    if (!file) return;

    const { data: { user } } = await sb.auth.getUser();

    // Show loading state on image
    const img = document.getElementById('profile-img');
    img.style.opacity = '0.5';

    // 1. Upload File
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}_selfie_${Date.now()}.${fileExt}`; // New unique name

    const { error: upErr } = await sb.storage
        .from('camera_images') // Using PUBLIC bucket for user photos now
        .upload(fileName, file);

    if (upErr) {
        alert("Error uploading photo: " + upErr.message);
        img.style.opacity = '1';
        return;
    }

    // 2. Update Profile
    const { error: updateErr } = await sb
        .from('profiles')
        .update({ user_photo_url: fileName })
        .eq('id', user.id);

    if (updateErr) {
        alert("Error updating profile link: " + updateErr.message);
    } else {
        // Refresh to show new image (get new signed url)
        loadProfile(user.id);
    }
    img.style.opacity = '1';
}

function handleLogout() {
    sb.auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// Init
checkAuth();
