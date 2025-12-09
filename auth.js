// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\auth.js

async function signUp(email, password, role, cnicFront, cnicBack, userPhoto) {
    if (!cnicFront || !cnicBack || !userPhoto) {
        alert("Please upload ALL 3 required photos (CNIC Front, Back, and Your Photo).");
        return;
    }

    // 1. Sign up with Supabase Auth
    const { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        alert("Error signing up: " + error.message);
        return;
    }

    // 2. Create profile entry
    if (data.user) {
        // Helper to upload one file
        const uploadFile = async (file, suffix, bucket = 'cnic_images') => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${data.user.id}_${suffix}.${fileExt}`;
            const { error: upErr } = await sb.storage
                .from(bucket)
                .upload(fileName, file);

            if (upErr) throw upErr;

            // SECURE CHANGE: We now return the path
            return fileName;
        };

        try {
            console.log("Uploading verification documents...");

            // Upload CNIC to secure bucket, Selfie to public bucket (camera_images)
            const [frontUrl, backUrl, photoUrl] = await Promise.all([
                uploadFile(cnicFront, 'front', 'cnic_images'),
                uploadFile(cnicBack, 'back', 'cnic_images'),
                uploadFile(userPhoto, 'selfie', 'camera_images')
            ]);

            console.log("Files uploaded. Creating profile...");

            const { error: profileError } = await sb
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    email: email,
                    role: role,
                    cnic_front_url: frontUrl,
                    cnic_back_url: backUrl,
                    user_photo_url: photoUrl,
                    status: 'pending'
                }]);

            if (profileError) {
                console.error("Error creating profile:", profileError);
                alert("Account created but profile setup failed. Error: " + profileError.message);
            } else {
                console.log("Profile created successfully!");
                alert("Signup successful! Your account is PENDING APPROVAL. You cannot log in yet.");
                window.location.reload();
            }

        } catch (err) {
            console.error("Error uploading files:", err);
            alert("Signup failed during file upload: " + err.message);
        }
    }
}

async function signIn(email, password, expectedRole) {
    const { data, error } = await sb.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Login failed: " + error.message);
        return;
    }

    // Check role and status
    if (data.user) {
        const { data: profile, error: profileErr } = await sb
            .from('profiles')
            .select('role, status')
            .eq('id', data.user.id)
            .single();

        if (profileErr) {
            console.error("Profile fetch error:", profileErr);
            // If it's a "Row not found" error (code PGRST116), it means no profile exists
            if (profileErr.code !== 'PGRST116') {
                alert("Login failed due to database error: " + profileErr.message);
                await sb.auth.signOut();
                return;
            }
            // If it IS PGRST116, we fall through to 'if (profile)' check which handles missing profile
        }

        if (profile) {
            if (profile.role !== expectedRole && expectedRole !== 'admin') { // Allow admin to login if we had a shared login, but we sort of don't. Kept simple.
                alert(`Access denied. You are not a ${expectedRole}.`);
                await sb.auth.signOut();
                return;
            }

            if (profile.status !== 'approved') {
                alert(`Your account status is ${profile.status}. You cannot log in until approved.`);
                await sb.auth.signOut();
                return;
            }

            // Success
            if (expectedRole === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = expectedRole === 'seller' ? 'seller_dashboard.html' : 'buyer_dashboard.html';
            }

        } else {
            alert("Profile not found.");
            await sb.auth.signOut();
        }
    }
}
