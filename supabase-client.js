// C:\Users\hp\.gemini\antigravity\scratch\camera-rental-system\supabase-client.js

// Ensure supabase is available globally from the CDN
const { createClient } = supabase;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('Please update config.js with your Supabase credentials');
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
