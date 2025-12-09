
// Check auth
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'buyer_login.html';
        return;
    }
    document.getElementById('user-display').textContent = session.user.email;
    loadMarketplace();
    updateCartBadge();
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

    const badge = document.getElementById('cart-badge');
    badge.classList.add('pulse');
    setTimeout(() => badge.classList.remove('pulse'), 500);

    alert("Added to cart!");
}

function removeFromCart(camId) {
    CART = CART.filter(item => item.id !== camId);
    saveCart();
    loadCart();
}

// Load marketplace
async function loadMarketplace() {
    const container = document.getElementById('listings-container');

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

    const ownerIds = [...new Set(cameras.map(c => c.owner_id))];
    const { data: owners } = await sb
        .from('profiles')
        .select('id, full_name, email, user_photo_url')
        .in('id', ownerIds);

    const ownerMap = {};
    if (owners) {
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
        const safeOwnerName = sanitizeInput(owner.name);
        const safeCamName = sanitizeInput(cam.name);
        const safeCamDesc = sanitizeInput(cam.description);

        return `
        <div class="card" style="cursor:pointer; position:relative;">
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

// Product Details Modal
async function openProductDetails(cam) {
    const modal = document.getElementById('product-modal');
    document.getElementById('detail-title').innerText = cam.name;
    document.getElementById('detail-price').innerText = `PKR ${cam.price_per_day} / day`;
    document.getElementById('detail-desc').innerText = cam.description;

    const rentBtn = document.getElementById('detail-rent-btn');
    rentBtn.innerText = "Add to Cart";
    rentBtn.onclick = () => {
        addToCart(cam);
        closeProductModal();
    };

    const mainImg = document.getElementById('detail-main-img');
    const thumbContainer = document.getElementById('detail-thumbnails');
    mainImg.src = cam.signedUrl;
    thumbContainer.innerHTML = '<p>Loading gallery...</p>';
    modal.style.display = 'block';

    const { data: galleryItems } = await sb
        .from('camera_gallery')
        .select('image_url')
        .eq('camera_id', cam.id);

    let allPaths = [cam.image_url];
    if (galleryItems) {
        galleryItems.forEach(item => allPaths.push(item.image_url));
    }

    const signedUrls = await Promise.all(allPaths.map(async (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        const { data } = await sb.storage.from('camera_images').createSignedUrl(path, 3600);
        return data ? data.signedUrl : null;
    }));

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

// Tab Switching
function showBuyerSection(section) {
    document.getElementById('section-browse').style.display = section === 'browse' ? 'block' : 'none';
    document.getElementById('section-rentals').style.display = section === 'rentals' ? 'block' : 'none';
    document.getElementById('section-cart').style.display = section === 'cart' ? 'block' : 'none';

    const btnBrowse = document.getElementById('btn-browse');
    const btnRentals = document.getElementById('btn-rentals');
    const btnCart = document.getElementById('btn-cart');

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
    const footer = document.getElementById('cart-footer');

    if (CART.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:3rem;"><span class="material-icons-round" style="font-size:3rem; color:#94a3b8;">shopping_cart</span><p style="color:#94a3b8; margin-top:1rem;">Your cart is empty. Start browsing!</p></div>';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'flex';

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
}

// Modal functions
function openCheckoutModal() {
    document.getElementById('checkout-modal').style.display = 'block';

    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('cart-start-date');
    const endInput = document.getElementById('cart-end-date');

    startInput.min = today;
    endInput.min = today;

    startInput.addEventListener('change', () => {
        endInput.min = startInput.value;
        updateModalTotal();
    });
    endInput.addEventListener('change', updateModalTotal);

    updateModalTotal();
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').style.display = 'none';
}

function updateModalTotal() {
    const start = document.getElementById('cart-start-date').value;
    const end = document.getElementById('cart-end-date').value;
    const display = document.getElementById('modal-total-display');

    if (!start || !end) {
        display.innerText = "PKR 0 (Select Dates)";
        return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate > endDate) {
        display.innerText = "Invalid Date Range";
        return;
    }

    let diffTime = Math.abs(endDate - startDate);
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) diffDays = 1;

    let totalPerDay = CART.reduce((sum, item) => sum + parseFloat(item.price_per_day), 0);
    let grandTotal = totalPerDay * diffDays;

    display.innerText = `PKR ${grandTotal.toLocaleString()} (${diffDays} days)`;
}

// Overlap check
async function checkAvailability(cameraIds, startDate, endDate) {
    if (!cameraIds || cameraIds.length === 0) return true;

    const { data: conflicts, error } = await sb
        .from('rentals')
        .select('camera_id, start_date, end_date')
        .in('camera_id', cameraIds)
        .neq('status', 'rejected')
        .neq('status', 'cancelled')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

    if (error) {
        console.error("Availability Check Error:", error);
        throw new Error("Could not verify availability.");
    }

    return conflicts && conflicts.length > 0 ? false : true;
}

// SIMPLIFIED CHECKOUT - NO PAYMENT YET
async function checkoutCart() {
    const start = document.getElementById('cart-start-date').value;
    const end = document.getElementById('cart-end-date').value;
    const pickupTime = document.getElementById('cart-pickup-time').value;
    const renterName = document.getElementById('cart-name').value;
    const renterPhone = document.getElementById('cart-phone').value;
    const renterAddress = document.getElementById('cart-address').value;

    if (!start || !end) {
        alert("Please select start and end dates.");
        return;
    }
    if (new Date(start) > new Date(end)) {
        alert("End date must be after start date.");
        return;
    }
    if (!renterName || !renterPhone || !renterAddress) {
        alert("Please fill in all contact info.");
        return;
    }
    if (!pickupTime) {
        alert("Please select a pickup time.");
        return;
    }

    const submitBtn = document.getElementById('btn-confirm-checkout');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Checking Availability...";
    submitBtn.disabled = true;

    try {
        const cameraIds = CART.map(c => c.id);
        const isAvailable = await checkAvailability(cameraIds, start, end);

        if (!isAvailable) {
            alert("One or more items are NOT available for the selected dates.");
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
            return;
        }

        submitBtn.innerText = "Submitting...";
        const { data: { user } } = await sb.auth.getUser();

        const startDate = new Date(start);
        const endDate = new Date(end);
        let diffDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) diffDays = 1;

        const rentalRecords = CART.map(cam => ({
            camera_id: cam.id,
            buyer_id: user.id,
            start_date: start,
            end_date: end,
            total_price: parseFloat(cam.price_per_day) * diffDays,
            pickup_time: sanitizeInput(pickupTime),
            renter_name: sanitizeInput(renterName),
            renter_phone: sanitizeInput(renterPhone),
            renter_address: sanitizeInput(renterAddress),
            status: 'pending'
        }));

        const { error } = await sb.from('rentals').insert(rentalRecords);
        if (error) throw error;

        alert("Request submitted! Seller will review. You'll pay after approval.");
        CART = [];
        saveCart();
        closeCheckoutModal();
        showBuyerSection('rentals');

    } catch (error) {
        console.error("Checkout Error:", error);
        alert("Request failed: " + error.message);
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

// NEW: Submit payment after approval
async function submitPayment(rentalId) {
    const method = document.querySelector(`input[name="payment-method-${rentalId}"]:checked`);

    if (!method) {
        alert("Please select a payment method.");
        return;
    }

    const paymentMethod = method.value;

    if (paymentMethod === 'online') {
        const trxId = document.getElementById(`trx-id-${rentalId}`).value;
        const proofFile = document.getElementById(`proof-file-${rentalId}`).files[0];

        if (!trxId) {
            alert("Please enter transaction ID.");
            return;
        }
        if (!proofFile) {
            alert("Please upload payment screenshot.");
            return;
        }
        if (!validateImageFile(proofFile)) return;

        try {
            const { data: { user } } = await sb.auth.getUser();
            const ext = proofFile.name.split('.').pop();
            const fileName = `${user.id}_payment_${Date.now()}.${ext}`;

            const { error: upErr } = await sb.storage
                .from('payment_proofs')
                .upload(fileName, proofFile);

            if (upErr) throw upErr;

            const { error } = await sb
                .from('rentals')
                .update({
                    payment_method: 'online',
                    transaction_id: sanitizeInput(trxId),
                    payment_proof_url: fileName,
                    status: 'payment_pending'
                })
                .eq('id', rentalId);

            if (error) throw error;

            alert("Payment submitted! Seller will confirm receipt.");
            loadMyRentals();

        } catch (error) {
            console.error("Payment Error:", error);
            alert("Payment submission failed: " + error.message);
        }
    } else {
        const { error } = await sb
            .from('rentals')
            .update({
                payment_method: 'face-to-face',
                status: 'payment_pending'
            })
            .eq('id', rentalId);

        if (error) {
            alert("Error: " + error.message);
        } else {
            alert("Face-to-face payment selected. Seller will confirm after meetup.");
            loadMyRentals();
        }
    }
}

async function cancelBooking(rentalId) {
    if (!confirm("Cancel this booking?")) return;

    const { error } = await sb
        .from('rentals')
        .update({ status: 'cancelled' })
        .eq('id', rentalId);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert("Booking cancelled.");
        loadMyRentals();
    }
}

// Load My Rentals with PAYMENT FORM for approved
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
        container.innerHTML = '<p style="text-align:center; color: #94a3b8;">No rental requests yet.</p>';
        return;
    }

    container.innerHTML = rentals.map(r => {
        const camName = r.cameras ? r.cameras.name : 'Unknown Camera';
        let badgeColor = 'orange';
        if (r.status === 'approved') badgeColor = 'green';
        if (r.status === 'rejected') badgeColor = 'red';
        if (r.status === 'completed') badgeColor = 'blue';
        if (r.status === 'cancelled') badgeColor = 'gray';
        if (r.status === 'payment_pending') badgeColor = 'yellow';
        if (r.status === 'payment_confirmed') badgeColor = 'limegreen';

        let actionHtml = '';

        // PENDING - can cancel
        if (r.status === 'pending') {
            actionHtml = `<button onclick="cancelBooking('${r.id}')" style="background:transparent; border:1px solid #ef4444; color:#ef4444; padding:0.5rem 1rem; border-radius:4px; cursor:pointer;">Cancel</button>`;
        }

        // APPROVED - SHOW PAYMENT FORM
        if (r.status === 'approved') {
            actionHtml = `
                <div style="background:rgba(34,197,94,0.1); padding:1rem; border-radius:8px; margin-top:1rem; border:1px solid #22c55e;">
                    <h4 style="margin:0 0 0.5rem 0; color:#22c55e;">✅ Approved! Complete Payment</h4>
                    <p style="margin:0; font-size:0.9rem;">Send PKR ${r.total_price} to:</p>
                    <p style="margin:0.25rem 0; font-weight:bold; color:var(--primary-color);">03065471848 (Easypaisa/SadaPay)</p>
                    
                    <div style="margin-top:1rem;">
                        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                            <input type="radio" name="payment-method-${r.id}" value="online"> Online Payment
                        </label>
                        <div id="online-fields-${r.id}" style="margin-left:1.5rem; display:none;">
                            <input type="text" id="trx-id-${r.id}" placeholder="Transaction ID" style="width:100%; margin-bottom:0.5rem; padding:0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white;">
                            <input type="file" id="proof-file-${r.id}" accept="image/*" style="width:100%; margin-bottom:0.5rem; padding:0.5rem;">
                        </div>
                        
                        <label style="display:flex; align-items:center; gap:0.5rem;">
                            <input type="radio" name="payment-method-${r.id}" value="face-to-face"> Face-to-Face Payment
                        </label>
                    </div>
                    
                    <button onclick="submitPayment('${r.id}')" style="margin-top:1rem; background:#22c55e; color:white; border:none; padding:0.5rem 1.5rem; border-radius:4px; cursor:pointer; width:100%;">Submit Payment</button>
                </div>
                <script>
                    document.querySelectorAll('input[name="payment-method-${r.id}"]').forEach(radio => {
                        radio.addEventListener('change', (e) => {
                            document.getElementById('online-fields-${r.id}').style.display = e.target.value === 'online' ? 'block' : 'none';
                        });
                    });
                </script>
            `;
        }

        // PAYMENT_PENDING
        if (r.status === 'payment_pending') {
            actionHtml = `<div style="background:rgba(251,191,36,0.1); padding:0.5rem 1rem; border-radius:4px; color:#fbbf24; border:1px solid #fbbf24;">⏳ Waiting for seller confirmation...</div>`;
        }

        // PAYMENT_CONFIRMED
        if (r.status === 'payment_confirmed') {
            actionHtml = `<div style="background:rgba(34,197,94,0.1); padding:0.5rem 1rem; border-radius:4px; color:#22c55e; border:1px solid #22c55e;">✅ Payment Confirmed - Ready for Pickup!</div>`;
        }

        return `
        <div class="glass-panel" style="padding: 1.5rem;">
            <h4 style="margin:0 0 0.5rem 0;">${camName}</h4>
            <p style="margin:0; font-size:0.9rem; opacity:0.8;">Dates: ${r.start_date} to ${r.end_date}</p>
            <p style="margin:0; font-size:0.9rem; opacity:0.8;">Total: <strong style="color:var(--primary-color);">PKR ${r.total_price}</strong></p>
            <p style="margin-top:0.5rem; font-weight:bold; color:${badgeColor}; text-transform:uppercase; font-size:0.8rem;">Status: ${r.status.replace('_', ' ')}</p>
            ${actionHtml}
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
