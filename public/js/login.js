document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginPasscode = document.getElementById('login-passcode');
  const loginError = document.getElementById('login-error');

  if (loginPasscode) {
    loginPasscode.focus();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const passcode = loginPasscode.value;

    try {
      const res = await fetch('api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      if (res.ok) {
        // Auth success: redirect to admin page
        window.location.href = 'admin';
      } else {
        const data = await res.json();
        loginError.textContent = data.error || 'Invalid passcode';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Connection error. Please try again.';
      loginError.style.display = 'block';
    }
  });
});
