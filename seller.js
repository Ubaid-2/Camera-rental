
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

    // Sanitize Inputs
    const cleanName = sanitizeInput(name);
    const cleanDesc = sanitizeInput(desc);

    const coverFile = coverInput.files[0];
    const galleryFiles = galleryInput.files;

    if (!cleanName || !price || !coverFile) {
        alert("Please fill in fields and upload at least a Cover Photo.");
        return;
    }

    // Security: Validate Image File Type/Size
    if (!validateImageFile(coverFile)) return;
    for (let i = 0; i < galleryFiles.length; i++) {
        if (!validateImageFile(galleryFiles[i])) return;
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
                name: cleanName,
                description: cleanDesc,
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

    const cleanName = sanitizeInput(name);
    const cleanDesc = sanitizeInput(desc);

    if (!cleanName || !price) {
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
                name: cleanName,
                description: cleanDesc,
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

// Tab Switching
function showSellerSection(section) {
    document.getElementById('section-listings').style.display = 'none';
    document.getElementById('section-requests').style.display = 'none';
    document.getElementById('section-history').style.display = 'none';

    document.getElementById('btn-listings').classList.add('btn-outline');
    document.getElementById('btn-requests').classList.add('btn-outline');
    document.getElementById('btn-history').classList.add('btn-outline');

    document.getElementById('btn-add-new').style.display = 'none';

    if (section === 'listings') {
        document.getElementById('section-listings').style.display = 'grid';
        document.getElementById('btn-listings').classList.remove('btn-outline');
        document.getElementById('btn-add-new').style.display = 'block';

    } else if (section === 'requests') {
        document.getElementById('section-requests').style.display = 'block';
        document.getElementById('btn-requests').classList.remove('btn-outline');
        loadRentalRequests(true); // Load only pending

    } else if (section === 'history') {
        document.getElementById('section-history').style.display = 'block';
        document.getElementById('btn-history').classList.remove('btn-outline');
        loadRentalRequests(false); // Load history
    }
}

// Load Rental Requests (Filtered)
async function loadRentalRequests(pendingOnly) {
    const containerId = pendingOnly ? 'requests-container' : 'history-container';
    const container = document.getElementById(containerId);

    container.innerHTML = '<p style="text-align: center; color: #94a3b8;">Loading...</p>';

    const { data: { user } } = await sb.auth.getUser();

    // Fetch rentals for cameras owned by this user
    let query = sb
        .from('rentals')
        .select(`
            *,
            cameras!inner(*),
            profiles:buyer_id(*)
        `)
        .eq('cameras.owner_id', user.id)
        .order('created_at', { ascending: false });

    if (pendingOnly) {
        query = query.eq('status', 'pending');
    } else {
        query = query.neq('status', 'pending');
    }

    const { data: rentals, error } = await query;

    if (error) {
        container.innerHTML = `<p style="color: red">Error: ${error.message}</p>`;
        return;
    }

    if (!rentals || rentals.length === 0) {
        container.innerHTML = `<p style="color: #94a3b8;">No ${pendingOnly ? 'pending requests' : 'rental history'} found.</p>`;
        return;
    }

    container.innerHTML = rentals.map(r => {
        const buyerName = r.profiles ? (r.profiles.full_name || r.profiles.email) : 'Unknown Buyer';
        const camName = r.cameras ? r.cameras.name : 'Unknown Camera';

        // Status badge colors
        let badgeColor = 'orange';
        if (r.status === 'approved') badgeColor = 'green';
        if (r.status === 'rejected') badgeColor = 'red';
        if (r.status === 'completed') badgeColor = 'blue';

        // Generate Signed URL for proof if exists
        // Note: As discussed in schema, we assume authenticated users can view proofs for prototype simplicity.
        // Ideally we generate a signed URL here if the bucket was private-private.
        // Since we used a policy 'Authenticated Users can view', we can construct the public URL or use createSignedUrl.
        // Let's use createSignedUrl to be safe/consistent with best practices.

        let proofLink = '';
        if (r.payment_proof_url) {
            // We do this async inside map... wait this is messy. 
            // Better to just show a "View Proof" button that calls a function to open it.
            proofLink = `<button onclick="viewPaymentProof('${r.payment_proof_url}')" style="background:none; border:none; text-decoration:underline; color:var(--primary-color); cursor:pointer; font-size:0.9rem;">View Payment Proof</button>`;
        }

        return `
        <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h4 style="margin:0 0 0.5rem 0;">Request for <strong>${camName}</strong></h4>
                <p style="margin:0; font-size:0.9rem; opacity:0.8;">Buyer: <strong>${buyerName}</strong></p>
                <div style="background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:4px; margin:0.5rem 0;">
                    <p style="margin:0; font-size:0.85rem;">Dates: <strong>${r.start_date}</strong> to <strong>${r.end_date}</strong></p>
                    <p style="margin:0; font-size:0.85rem;">Total: <strong style="color:var(--primary-color);">PKR ${r.total_price}</strong></p>
                    <p style="margin:0; font-size:0.85rem;">Transaction ID: <strong>${r.transaction_id || 'N/A'}</strong></p>
                    <p style="margin:0; font-size:0.85rem;">Pickup Time: <strong>${r.pickup_time || 'N/A'}</strong></p>
                    ${proofLink}
                </div>
                <p style="margin-top:0.5rem; font-weight:bold; color:${badgeColor}; text-transform:uppercase; font-size:0.8rem;">Status: ${r.status}</p>
            </div>
            
            ${pendingOnly ? `
            <div style="display:flex; gap:0.5rem; align-self: center;">
                <button onclick="updateRentalStatus('${r.id}', 'approved')" style="background:#22c55e; color:white; border:none; padding:0.5rem 1rem; border-radius:4px; cursor:pointer;">Approve</button>
                <button onclick="updateRentalStatus('${r.id}', 'rejected')" style="background:#ef4444; color:white; border:none; padding:0.5rem 1rem; border-radius:4px; cursor:pointer;">Reject</button>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

// Helper to open proof
async function viewPaymentProof(path) {
    if (!path) return;
    try {
        const { data, error } = await sb.storage.from('payment_proofs').createSignedUrl(path, 3600);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
    } catch (err) {
        alert("Error loading proof: " + err.message);
    }
}

async function updateRentalStatus(rentalId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this request?`)) return;

    const { data, error } = await sb
        .from('rentals')
        .update({ status: newStatus })
        .eq('id', rentalId)
        .select();

    if (error) {
        console.error("Error updating rental status:", error);
        alert(`Error updating status: ${error.message}\n\nPlease ensure your database RLS policies are correctly configured.`);
    } else {
        console.log("Rental status updated successfully:", data);
        alert(`Request ${newStatus} successfully.`);
        loadRentalRequests(true); // Refresh pending list
    }
}

// NEW: Confirm payment received
async function confirmPayment(rentalId) {
    if (!confirm("Confirm you have received the payment?")) return;

    const { error } = await sb
        .from('rentals')
        .update({ status: 'payment_confirmed' })
        .eq('id', rentalId);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Payment confirmed! Rental is now ready for pickup.");
        loadRentalRequests(true);
    }
}

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Init
checkAuth();
