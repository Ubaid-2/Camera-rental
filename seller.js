// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\seller.js

// Check auth
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'seller_login.html';
        return;
    }
    document.getElementById('user-display').textContent = session.user.email;
    loadListings(session.user.id);
}

// Load listings for this seller with SECURE SIGNED URLs
async function loadListings(userId) {
    const container = document.getElementById('listings-container');

    const { data: cameras, error } = await sb
        .from('cameras')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color: red">Error loading listings: ${error.message}</p>`;
        return;
    }

    if (cameras.length === 0) {
        container.innerHTML = `<p style="color: var(--text-color); opacity: 0.7;">You haven't listed any cameras yet.</p>`;
        return;
    }

    // Generate Signed URLs
    const camerasWithUrls = await Promise.all(cameras.map(async (cam) => {
        let imageUrl = 'https://via.placeholder.com/400x300?text=No+Image';
        if (cam.image_url) {
            if (cam.image_url.startsWith('http')) {
                imageUrl = cam.image_url; // Legacy
            } else {
                // Generate Signed URL
                const { data } = await sb.storage.from('camera_images').createSignedUrl(cam.image_url, 3600);
                if (data) imageUrl = data.signedUrl;
            }
        }
        return { ...cam, signedUrl: imageUrl };
    }));

    container.innerHTML = camerasWithUrls.map(cam => `
        <div class="card">
            <img src="${cam.signedUrl}" alt="${cam.name}">
            <div class="card-body">
                <h3>${cam.name}</h3>
                <p style="color: var(--text-color); opacity: 0.8;">${cam.description}</p>
                <div style="font-weight: 700; color: var(--primary-color); margin-top: 1rem; display:flex; justify-content:space-between; align-items:center;">
                    <span>PKR ${cam.price_per_day} / day</span>
                    <button onclick='openEditModal(${JSON.stringify(cam).replace(/'/g, "&#39;")})' class="btn btn-outline" style="font-size:0.8rem; padding:0.4rem 0.8rem;">Edit</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Preview Gallery Images
function previewGallery() {
    const input = document.getElementById('gallery-files');
    const container = document.getElementById('gallery-preview');
    container.innerHTML = '';

    if (input.files.length > 8) {
        alert("Maximum 8 images allowed!");
        input.value = ''; // Clear
        return;
    }

    Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '60px';
            img.style.height = '60px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            container.appendChild(img);
        }
        reader.readAsDataURL(file);
    });
}

// Add new camera logic with MULTI-IMAGE UPLOAD
async function addCamera() {
    const name = document.getElementById('camera-name').value;
    const desc = document.getElementById('camera-desc').value;
    const price = document.getElementById('camera-price').value;

    const coverInput = document.getElementById('camera-image-file'); // Main Cover
    const galleryInput = document.getElementById('gallery-files');   // Gallery

    const coverFile = coverInput.files[0];
    const galleryFiles = galleryInput.files;

    if (!name || !price || !coverFile) {
        alert("Please fill in fields and upload at least a Cover Photo.");
        return;
    }

    if (galleryFiles.length > 8) {
        alert("Maximum 8 gallery images allowed.");
        return;
    }

    const startBtn = document.querySelector('button[onclick="addCamera()"]');
    startBtn.textContent = "Uploading...";
    startBtn.disabled = true;

    try {
        const { data: { user } } = await sb.auth.getUser();

        // 1. Upload Cover Photo
        const coverExt = coverFile.name.split('.').pop();
        const coverName = `${user.id}_cover_${Date.now()}.${coverExt}`;

        const { error: upErr } = await sb.storage
            .from('camera_images')
            .upload(coverName, coverFile);

        if (upErr) throw upErr;

        // 2. Insert Camera Record
        const { data: cameraData, error: camErr } = await sb
            .from('cameras')
            .insert([{
                owner_id: user.id,
                name: name,
                description: desc,
                price_per_day: price,
                image_url: coverName // Main Cover Path
            }])
            .select()
            .single();

        if (camErr) throw camErr;
        const cameraId = cameraData.id;

        // 3. Upload & Insert Gallery Images (Parallel)
        if (galleryFiles.length > 0) {
            const galleryPromises = Array.from(galleryFiles).map(async (file, idx) => {
                const ext = file.name.split('.').pop();
                const fileName = `${user.id}_${cameraId}_${idx}_${Date.now()}.${ext}`;

                // Upload
                const { error: gUpErr } = await sb.storage
                    .from('camera_images')
                    .upload(fileName, file);

                if (gUpErr) throw gUpErr;

                // Insert to Gallery Table
                return sb.from('camera_gallery').insert([{
                    camera_id: cameraId,
                    image_url: fileName
                }]);
            });

            await Promise.all(galleryPromises);
        }

        alert("Listing added successfully with images!");
        hideAddModal();
        loadListings(user.id);

    } catch (error) {
        console.error(error);
        alert("Error creating listing: " + error.message);
    } finally {
        startBtn.textContent = "Post Listing";
        startBtn.disabled = false;
    }
}

function showAddModal() { document.getElementById('add-modal').style.display = 'block'; }
function hideAddModal() { document.getElementById('add-modal').style.display = 'none'; }

// Edit Modal Functions
window.openEditModal = (cam) => {
    document.getElementById('edit-camera-id').value = cam.id;
    document.getElementById('edit-camera-name').value = cam.name;
    document.getElementById('edit-camera-desc').value = cam.description;
    document.getElementById('edit-camera-price').value = cam.price_per_day;
    document.getElementById('edit-modal').style.display = 'block';
};

window.hideEditModal = () => {
    document.getElementById('edit-modal').style.display = 'none';
};

window.updateCamera = async () => {
    const id = document.getElementById('edit-camera-id').value;
    const name = document.getElementById('edit-camera-name').value;
    const desc = document.getElementById('edit-camera-desc').value;
    const price = document.getElementById('edit-camera-price').value;

    if (!name || !price) {
        alert("Name and Price are required.");
        return;
    }

    const startBtn = document.querySelector('button[onclick="updateCamera()"]');
    const originalText = startBtn.textContent;
    startBtn.textContent = "Saving...";
    startBtn.disabled = true;

    try {
        const { error } = await sb
            .from('cameras')
            .update({
                name: name,
                description: desc,
                price_per_day: price
            })
            .eq('id', id);

        if (error) throw error;

        alert("Details updated successfully!");
        hideEditModal();

        // Refresh listings
        const { data: { user } } = await sb.auth.getUser();
        loadListings(user.id);

    } catch (err) {
        alert("Error updating: " + err.message);
        console.error(err);
    } finally {
        startBtn.textContent = originalText;
        startBtn.disabled = false;
    }
};

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Init
checkAuth();
