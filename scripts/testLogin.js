async function testLogin() {
  try {
    console.log('🔍 Testing admin login endpoint...');
    
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin123@gmail.com',
        password: 'admin123'
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Login successful!');
      console.log('📋 Response:', data);
      console.log('👤 User Role:', data.user.role);
      console.log('🔑 Token received:', data.token ? 'Yes' : 'No');
    } else {
      console.error('❌ Login failed:');
      console.error('Status:', response.status);
      console.error('Message:', data);
    }
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
  }
}

// Run the test
testLogin();
