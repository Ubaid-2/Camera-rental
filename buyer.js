
// Check auth
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'buyer_login.html';
        return;
    }
    document.getElementById('user-display').textContent = session.user.email;
    loadMarketplace();
    updateCartBadge(); // Init badge
}

// Global Cart State
let CART = JSON.parse(localStorage.getItem('lenslocker_cart')) || [];

function saveCart() {
    localStorage.setItem('lenslocker_cart', JSON.stringify(CART));
    updateCartBadge();
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (CART.length > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = CART.length;
    } else {
        badge.style.display = 'none';
    }
}

function addToCart(cam) {
    if (CART.find(item => item.id === cam.id)) {
        alert("This item is already in your cart!");
        return;
    }

    CART.push(cam);
    saveCart();

    // Animate badge
    const badge = document.getElementById('cart-badge');
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 500);

    alert("Added to cart!");
}

function removeFromCart(camId) {
    CART = CART.filter(item => item.id !== camId);
    saveCart();
    loadCart(); // Refresh view
}

// Load marketplace with SECURE SIGNED URLs and Add to Cart button
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

        // Defense in Depth: Sanitize before display
        const safeOwnerName = sanitizeInput(owner.name);
        const safeCamName = sanitizeInput(cam.name);
        const safeCamDesc = sanitizeInput(cam.description);

        return `
        <div class="card" style="cursor:pointer; position:relative;">
            <!-- Seller Badge -->
            <div onclick="event.stopPropagation(); window.location.href='seller_profile.html?id=${cam.owner_id}'" 
                 style="position:absolute; top:10px; left:10px; display:flex; align-items:center; gap:8px; background:rgba(0,0,0,0.6); padding:4px 10px 4px 4px; border-radius:20px; backdrop-filter:blur(4px); z-index:10; transition: transform 0.2s;"
                 onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <img src="${owner.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:2px solid white;">
                <span style="color:white; font-size:0.8rem; font-weight:600;">${safeOwnerName}</span>
            </div>

            <div onclick='openProductDetails(${JSON.stringify(cam).replace(/'/g, "&#39;")})'>
                <img src="${cam.signedUrl}" alt="${safeCamName}" style="height:200px; object-fit:cover;">
                <div class="card-body">
                    <h3>${safeCamName}</h3>
                    <p style="color: var(--text-color); opacity: 0.8; min-height: 3rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safeCamDesc}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                        <span style="font-weight: 700; color: var(--primary-color); font-size: 1.2rem;">PKR ${cam.price_per_day} <span style="font-size: 0.9rem; opacity: 0.7;">/ day</span></span>
                    </div>
                    <div style="display:flex; gap:0.5rem; margin-top:1rem;">
                         <button onclick="event.stopPropagation(); addToCart(${JSON.stringify(cam).replace(/'/g, "&#39;")})" class="btn btn-primary" style="flex:1; padding: 0.5rem;">Add to Cart</button>
                         <button class="btn btn-outline" style="padding: 0.5rem;">Details</button>
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

    // Set Rent Button Action -> Add To Cart
    const rentBtn = document.getElementById('detail-rent-btn');
    rentBtn.innerText = "Add to Cart";
    rentBtn.onclick = () => {
        addToCart(cam);
        closeProductModal();
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

// Tab Switching (Updated)
function showBuyerSection(section) {
    document.getElementById('section-browse').style.display = section === 'browse' ? 'block' : 'none';
    document.getElementById('section-rentals').style.display = section === 'rentals' ? 'block' : 'none';
    document.getElementById('section-cart').style.display = section === 'cart' ? 'block' : 'none';

    const btnBrowse = document.getElementById('btn-browse');
    const btnRentals = document.getElementById('btn-rentals');
    const btnCart = document.getElementById('btn-cart');

    // Reset all
    btnBrowse.classList.add('btn-outline');
    btnRentals.classList.add('btn-outline');
    btnCart.classList.add('btn-outline');

    if (section === 'browse') {
        btnBrowse.classList.remove('btn-outline');
    } else if (section === 'rentals') {
        btnRentals.classList.remove('btn-outline');
        loadMyRentals();
    } else if (section === 'cart') {
        btnCart.classList.remove('btn-outline');
        loadCart();
    }
}

// Cart Logic
async function loadCart() {
    const container = document.getElementById('cart-container');
    const controls = document.getElementById('cart-checkout-controls');

    if (CART.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem;"><span class="material-icons-round" style="font-size:3rem; color:#94a3b8;">shopping_cart</span><p style="color:#94a3b8; margin-top:1rem;">Your cart is empty. Start browsing!</p></div>';
        controls.style.display = 'none';
        return;
    }

    controls.style.display = 'block';

    // We already have signed URLs in the CART object (from loadMarketplace)
    // But they might expire if the user waits too long. Ideally we re-sign them, but for prototype let's assume they work 
    // or just show placeholders if needed. 
    // To be safe, let's just use the cart data.

    container.innerHTML = CART.map(cam => `
        <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; gap: 1rem;">
            <img src="${cam.signedUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
            <div style="flex: 1;">
                <h4 style="margin: 0;">${cam.name}</h4>
                <p style="margin: 0; color: var(--primary-color);">PKR ${cam.price_per_day} / day</p>
            </div>
            <button onclick="removeFromCart('${cam.id}')" class="btn btn-outline" style="border-color:#ef4444; color:#ef4444;">Remove</button>
        </div>
    `).join('');

    updateCartTotal();
}

function updateCartTotal() {
    const start = document.getElementById('cart-start-date').value;
    const end = document.getElementById('cart-end-date').value;
    const display = document.getElementById('cart-total-display');

    if (!start || !end) {
        display.innerText = "PKR 0 (Select Dates)";
        return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        display.innerText = "Invalid Dates";
        return;
    }

    let totalPerDay = CART.reduce((sum, item) => sum + parseFloat(item.price_per_day), 0);
    let grandTotal = totalPerDay * diffDays;

    display.innerText = `PKR ${grandTotal.toLocaleString()}`;
}

// Add listeners to date inputs
const cartStart = document.getElementById('cart-start-date');
const cartEnd = document.getElementById('cart-end-date');
if (cartStart && cartEnd) {
    cartStart.addEventListener('change', updateCartTotal);
    cartEnd.addEventListener('change', updateCartTotal);
}

async function checkoutCart() {
    const start = document.getElementById('cart-start-date').value;
    const end = document.getElementById('cart-end-date').value;

    if (!start || !end) {
        alert("Please select start and end dates for your rental.");
        return;
    }

    if (new Date(start) >= new Date(end)) {
        alert("End date must be after start date.");
        return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));

    // Prepare Batch Insert
    const { data: { user } } = await sb.auth.getUser();

    const rentalRecords = CART.map(cam => ({
        camera_id: cam.id,
        buyer_id: user.id,
        start_date: start,
        end_date: end,
        total_price: parseFloat(cam.price_per_day) * diffDays,
        status: 'pending'
    }));

    // Insert
    const { error } = await sb.from('rentals').insert(rentalRecords);

    if (error) {
        alert("Checkout failed: " + error.message);
    } else {
        alert("Rental requests sent successfully!");
        CART = [];
        saveCart();
        showBuyerSection('rentals'); // Go to requests view
    }
}

// Load My Rentals
async function loadMyRentals() {
    const container = document.getElementById('rentals-container');
    container.innerHTML = '<p style="text-align: center; color: #94a3b8;">Loading rentals...</p>';

    const { data: { user } } = await sb.auth.getUser();

    const { data: rentals, error } = await sb
        .from('rentals')
        .select(`
            *,
            cameras!inner(*)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color: red">Error: ${error.message}</p>`;
        return;
    }

    if (!rentals || rentals.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #94a3b8;">You haven\'t made any rental requests yet.</p>';
        return;
    }

    container.innerHTML = rentals.map(r => {
        const camName = r.cameras ? r.cameras.name : 'Unknown Camera';

        let badgeColor = 'orange';
        if (r.status === 'approved') badgeColor = 'green';
        if (r.status === 'rejected') badgeColor = 'red';
        if (r.status === 'completed') badgeColor = 'blue';

        return `
        <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h4 style="margin:0 0 0.5rem 0;">${camName}</h4>
                <p style="margin:0; font-size:0.9rem; opacity:0.8;">Dates: ${r.start_date} to ${r.end_date}</p>
                <p style="margin:0; font-size:0.9rem; opacity:0.8;">Total: <strong style="color:var(--primary-color);">PKR ${r.total_price}</strong></p>
                <p style="margin-top:0.5rem; font-weight:bold; color:${badgeColor}; text-transform:uppercase; font-size:0.8rem;">Status: ${r.status}</p>
            </div>
            ${r.status === 'approved' ? `
            <div style="background:rgba(34, 197, 94, 0.1); padding:0.5rem 1rem; border-radius:4px; color:#22c55e; border:1px solid #22c55e;">
                <span class="material-icons-round" style="vertical-align:middle; font-size:1.2rem; margin-right:4px;">check_circle</span>
                Ready for Pickup
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

async function handleLogout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Init
checkAuth();
