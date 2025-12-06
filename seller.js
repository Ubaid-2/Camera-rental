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

// Load listings for this seller
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
        container.innerHTML = `<p style="color: #94a3b8;">You haven't listed any cameras yet.</p>`;
        return;
    }

    container.innerHTML = cameras.map(cam => `
        <div class="card">
            <img src="${cam.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${cam.name}">
            <div class="card-body">
                <h3>${cam.name}</h3>
                <p style="color: #94a3b8;">${cam.description}</p>
                <div style="font-weight: 700; color: var(--primary-color); margin-top: 1rem;">
                    $${cam.price_per_day} / day
                </div>
            </div>
        </div>
    `).join('');
}

// Add new camera logic
async function addCamera() {
    const name = document.getElementById('camera-name').value;
    const desc = document.getElementById('camera-desc').value;
    const price = document.getElementById('camera-price').value;
    const img = document.getElementById('camera-image').value;

    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb
        .from('cameras')
        .insert([{
            owner_id: user.id,
            name: name,
            description: desc,
            price_per_day: price,
            image_url: img
        }]);

    if (error) {
        alert("Error adding listing: " + error.message);
    } else {
        alert("Listing added successfully!");
        hideAddModal();
        loadListings(user.id);
    }
}

function showAddModal() { document.getElementById('add-modal').style.display = 'block'; }
function hideAddModal() { document.getElementById('add-modal').style.display = 'none'; }

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Init
checkAuth();
