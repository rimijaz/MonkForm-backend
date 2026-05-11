async function testAdminApi() {
  try {
    console.log('🔍 Testing admin API endpoints...');
    
    // First login to get token
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin123@gmail.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Login successful');
    console.log('👤 User Role:', loginData.user.role);
    
    const token = loginData.token;
    console.log('🔑 Token received');
    
    // Test getAllUsers endpoint
    console.log('\n🔍 Testing /admin/users endpoint...');
    const usersResponse = await fetch('http://localhost:5000/api/admin/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    const usersData = await usersResponse.json();
    
    if (usersResponse.ok) {
      console.log('✅ Get all users successful');
      console.log('📊 Users count:', usersData.length);
      console.log('👥 Users:', usersData.map(u => ({
        email: u.email,
        role: u.role,
        formsCount: u.formsCount
      })));
    } else {
      console.error('❌ Get all users failed:', usersData);
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

// Run the test
testAdminApi();
