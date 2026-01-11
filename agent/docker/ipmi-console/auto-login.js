// Auto-login helper script for BMC web interfaces
// This is a placeholder for future implementation
// Different BMC vendors require different login automation

console.log('Auto-login script loaded');

// Generic login detector - checks for common login form patterns
function detectLoginForm() {
    const inputs = document.querySelectorAll('input');
    let usernameField = null;
    let passwordField = null;
    let submitButton = null;

    inputs.forEach(input => {
        const type = input.type.toLowerCase();
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();

        if (type === 'text' || name.includes('user') || id.includes('user')) {
            usernameField = input;
        }
        if (type === 'password') {
            passwordField = input;
        }
    });

    // Look for submit button
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    submitButton = buttons[0];

    return { usernameField, passwordField, submitButton };
}

// Attempt auto-login if IPMI credentials are available
function attemptAutoLogin() {
    const { usernameField, passwordField, submitButton } = detectLoginForm();

    if (usernameField && passwordField && window.IPMI_USER && window.IPMI_PASS) {
        usernameField.value = window.IPMI_USER;
        passwordField.value = window.IPMI_PASS;

        if (submitButton) {
            submitButton.click();
        }
    }
}

// Run on page load
if (document.readyState === 'complete') {
    setTimeout(attemptAutoLogin, 2000);
} else {
    window.addEventListener('load', () => setTimeout(attemptAutoLogin, 2000));
}
