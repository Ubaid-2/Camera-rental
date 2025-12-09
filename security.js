// Security Utility Functions
// Prevents XSS by encoding special characters
function sanitizeInput(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;'
    };
    const reg = /[&<>"'/]/ig;
    return str.replace(reg, (match) => (map[match]));
}

// Validates file input to assume it is an image
function validateImageFile(file) {
    if (!file) return false;
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert("Invalid file type. Please upload an image (JPEG, PNG, GIF, WEBP).");
        return false;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("File is too large. Max size is 5MB.");
        return false;
    }
    return true;
}
