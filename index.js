async function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const message = document.getElementById('login-message');
  message.textContent = '';

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (res.ok) {
    message.style.color = 'lightgreen';
    message.textContent = `Welcome back, ${data.username}! Your UID is ${data.uid}.`;
  } else {
    message.style.color = 'salmon';
    message.textContent = data.error || 'Login failed';
  }
}

async function register() {
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const message = document.getElementById('register-message');
  message.textContent = '';

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (res.ok) {
    message.style.color = 'lightgreen';
    message.textContent = 'Registration successful! You can now log in.';
  } else {
    message.style.color = 'salmon';
    message.textContent = data.error || 'Registration failed';
  }
}
