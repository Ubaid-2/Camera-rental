// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\buyer.js

// Check auth
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'buyer_login.html';
        return;
    }
    document.getElementById('user-display').textContent = session.user.email;
    loadMarketplace();
}

async function loadMarketplace() {
    const container = document.getElementById('listings-container');

    // Fetch all cameras
    const { data: cameras, error } = await sb
        .from('cameras')
        .select('*')
        .eq('available', true)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color: red">Error loading cameras: ${error.message}</p>`;
        return;
    }

    if (cameras.length === 0) {
        container.innerHTML = `<p style="color: #94a3b8;">No cameras available at the moment.</p>`;
        return;
    }

    container.innerHTML = cameras.map(cam => `
        <div class="card">
            <img src="${cam.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${cam.name}">
            <div class="card-body">
                <h3>${cam.name}</h3>
                <p style="color: #94a3b8; min-height: 3rem;">${cam.description}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                    <span style="font-weight: 700; color: var(--primary-color); font-size: 1.2rem;">$${cam.price_per_day} <span style="font-size: 0.9rem; color: #94a3b8;">/ day</span></span>
                    <button onclick="openRentModal('${cam.id}', '${cam.name}', ${cam.price_per_day})" class="btn btn-primary" style="padding: 0.5rem 1rem;">Rent</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Global modal helpers
window.openRentModal = (id, name, price) => {
    document.getElementById('rent-camera-id').value = id;
    document.getElementById('rent-camera-name').textContent = name;
    document.getElementById('rent-camera-price').value = price;
    document.getElementById('rent-modal').style.display = 'block';
    calculateTotal();
};

window.hideRentModal = () => {
    document.getElementById('rent-modal').style.display = 'none';
};

// Calculate price on date change
document.getElementById('start-date').addEventListener('change', calculateTotal);
document.getElementById('end-date').addEventListener('change', calculateTotal);

function calculateTotal() {
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    const pricePerDay = parseFloat(document.getElementById('rent-camera-price').value);

    if (start && end) {
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            document.getElementById('total-price').textContent = `$${(diffDays * pricePerDay).toFixed(2)}`;
            return;
        }
    }
    document.getElementById('total-price').textContent = '$0';
}

async function confirmRent() {
    const camId = document.getElementById('rent-camera-id').value;
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    const totalStr = document.getElementById('total-price').textContent.replace('$', '');

    if (!start || !end) {
        alert("Please select dates");
        return;
    }

    const { data: { user } } = await sb.auth.getUser();

    const { error } = await sb
        .from('rentals')
        .insert([{
            camera_id: camId,
            buyer_id: user.id,
            start_date: start,
            end_date: end,
            total_price: parseFloat(totalStr),
            status: 'pending'
        }]);

    if (error) {
        alert("Error requesting rental: " + error.message);
    } else {
        alert("Rental request sent! Wait for seller approval.");
        hideRentModal();
    }
}

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Init
checkAuth();
