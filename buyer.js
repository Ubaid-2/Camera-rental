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

// Load marketplace with SECURE SIGNED URLs
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
        container.innerHTML = `<p style="color: var(--text-color); opacity: 0.7;">No cameras available at the moment.</p>`;
        return;
    }

    // Generate Signed URLs for CAMEAS
    const camerasWithUrls = await Promise.all(cameras.map(async (cam) => {
        let imageUrl = 'https://via.placeholder.com/400x300?text=No+Image';
        if (cam.image_url) {
            if (cam.image_url.startsWith('http')) {
                imageUrl = cam.image_url;
            } else {
                const { data } = await sb.storage.from('camera_images').createSignedUrl(cam.image_url, 3600);
                if (data) imageUrl = data.signedUrl;
            }
        }
        return { ...cam, signedUrl: imageUrl };
    }));

    // Fetch Sellers Info
    const ownerIds = [...new Set(cameras.map(c => c.owner_id))];
    const { data: owners } = await sb
        .from('profiles')
        .select('id, full_name, email, user_photo_url')
        .in('id', ownerIds);

    const ownerMap = {};
    if (owners) {
        // Pre-fetch owner avatars
        await Promise.all(owners.map(async (o) => {
            let avatar = 'https://via.placeholder.com/40?text=U';
            if (o.user_photo_url) {
                const { data } = await sb.storage.from('cnic_images').createSignedUrl(o.user_photo_url, 3600);
                if (data) avatar = data.signedUrl;
            }
            ownerMap[o.id] = {
                name: o.full_name || o.email.split('@')[0],
                avatar: avatar
            };
        }));
    }

    container.innerHTML = camerasWithUrls.map(cam => {
        const owner = ownerMap[cam.owner_id] || { name: 'Unknown', avatar: '' };
        return `
        <div class="card" style="cursor:pointer; position:relative;">
            <!-- Seller Badge -->
            <div onclick="event.stopPropagation(); window.location.href='seller_profile.html?id=${cam.owner_id}'" 
                 style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.6); padding:4px 10px 4px 4px; border-radius:20px; backdrop-filter:blur(4px); z-index:10; transition: transform 0.2s;"
                 onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${owner.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid white;">
                <span style="color:white; font-size:0.8rem; font-weight:600;">${owner.name}</span>
            </div>

            <div onclick='openProductDetails(${JSON.stringify(cam).replace(/'/g, "&#39;")})'>
                <img src="${cam.signedUrl}" alt="${cam.name}" style="height:200px; object-fit:cover;">
                <div class="card-body">
                    <h3>${cam.name}</h3>
                    <p style="color: var(--text-color); opacity: 0.8; min-height: 3rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${cam.description}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                        <span style="font-weight: 700; color: var(--primary-color); font-size: 1.2rem;">PKR ${cam.price_per_day} <span style="font-size: 0.9rem; opacity: 0.7;">/ day</span></span>
                        <button class="btn btn-outline" style="padding: 0.5rem 1rem;">View Details</button>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

// Open Product Details Modal (Gallery)
async function openProductDetails(cam) {
    const modal = document.getElementById('product-modal');

    // Set Basic Info
    document.getElementById('detail-title').innerText = cam.name;
    document.getElementById('detail-price').innerText = `PKR ${cam.price_per_day} / day`;
    document.getElementById('detail-desc').innerText = cam.description;

    // Set Rent Button Action
    const rentBtn = document.getElementById('detail-rent-btn');
    rentBtn.onclick = () => {
        closeProductModal();
        openRentModal(cam.id, cam.name, cam.price_per_day);
    };

    // Load Images (Cover + Gallery)
    const mainImg = document.getElementById('detail-main-img');
    const thumbContainer = document.getElementById('detail-thumbnails');

    mainImg.src = cam.signedUrl; // Start with cover
    thumbContainer.innerHTML = '<p>Loading gallery...</p>';
    modal.style.display = 'block';

    // Fetch Gallery from DB
    const { data: galleryItems } = await sb
        .from('camera_gallery')
        .select('image_url')
        .eq('camera_id', cam.id);

    // Prepare list of all image paths (Cover + Gallery)
    let allPaths = [cam.image_url]; // Cover is first
    if (galleryItems) {
        galleryItems.forEach(item => allPaths.push(item.image_url));
    }

    // Generate Signed URLs for all
    const signedUrls = await Promise.all(allPaths.map(async (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path; // Legacy
        const { data } = await sb.storage.from('camera_images').createSignedUrl(path, 3600);
        return data ? data.signedUrl : null;
    }));

    // Render Thumbnails
    thumbContainer.innerHTML = '';
    signedUrls.forEach((url, index) => {
        if (!url) return;
        const thumb = document.createElement('img');
        thumb.src = url;
        thumb.style.width = '80px';
        thumb.style.height = '60px';
        thumb.style.objectFit = 'cover';
        thumb.style.borderRadius = '4px';
        thumb.style.cursor = 'pointer';
        thumb.style.border = index === 0 ? '2px solid var(--primary-color)' : '2px solid transparent';

        thumb.onclick = () => {
            mainImg.src = url;
            // Highlight active
            Array.from(thumbContainer.children).forEach(t => t.style.border = '2px solid transparent');
            thumb.style.border = '2px solid var(--primary-color)';
        };
        thumbContainer.appendChild(thumb);
    });
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

function closeRentModal() {
    document.getElementById('rent-modal').style.display = 'none';
}

// Global modal helpers
window.openRentModal = (id, name, price) => {
    document.getElementById('rent-camera-id').value = id;
    document.getElementById('rent-camera-name').textContent = name;
    document.getElementById('rent-camera-price').value = price;
    document.getElementById('rent-modal').style.display = 'block';
    updateTotal();
};

window.closeRentModal = closeRentModal;

// Calculate price on date change
// Calculate price logic
function updateTotal() {
    const days = document.getElementById('rent-days').value;
    const priceStr = document.getElementById('rent-camera-price').value;

    if (days && priceStr) {
        const pricePerDay = parseFloat(priceStr);
        const total = Math.ceil(days * pricePerDay);
        document.getElementById('total-price').textContent = `PKR ${total.toFixed(2)}`;
        // Also update modal display if needed
        const modalTotal = document.getElementById('modal-total-price');
        if (modalTotal) modalTotal.textContent = total.toFixed(2);
    }
}

// Attach listener
const rentDaysInput = document.getElementById('rent-days');
if (rentDaysInput) {
    rentDaysInput.addEventListener('change', updateTotal);
    rentDaysInput.addEventListener('input', updateTotal);
}

async function confirmRent() {
    const camId = document.getElementById('rent-camera-id').value;
    const start = document.getElementById('start-date').value;
    const end = document.getElementById('end-date').value;
    const totalStr = document.getElementById('total-price').textContent.replace('PKR ', '');

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
