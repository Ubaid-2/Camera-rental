// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\auth.js

async function signUp(email, password, role) {
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
        // Check if we have a session (logged in)
        const { data: sessionData } = await sb.auth.getSession();

        if (!sessionData.session) {
            console.warn("No active session after signup. Email confirmation likely required.");
            alert("Signup successful! PLEASE CHECK YOUR EMAIL to confirm your account.");
            return;
        }

        console.log("Attempting to create profile for user:", data.user.id);

        const { error: profileError } = await sb
            .from('profiles')
            .insert([{ id: data.user.id, email: email, role: role }]);

        if (profileError) {
            console.error("Error creating profile:", profileError);
            alert("Account created but profile setup failed. Error: " + profileError.message);
        } else {
            console.log("Profile created successfully!");
            alert("Signup successful! Please log in.");
            window.location.reload();
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

    // Check role
    if (data.user) {
        const { data: profile } = await sb
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profile && profile.role === expectedRole) {
            // Success
            window.location.href = expectedRole === 'seller' ? 'seller_dashboard.html' : 'buyer_dashboard.html';
        } else {
            alert(`Access denied. You are not a ${expectedRole}.`);
            await sb.auth.signOut();
        }
    }
}
