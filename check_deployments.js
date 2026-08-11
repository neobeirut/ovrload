async function checkDeployments() {
  const urls = [
    "https://ovrload-nine.vercel.app/shop",
    "https://ovrload-backend-production.up.railway.app/shop",
    "https://ovrload-nine.vercel.app/shop/checkout",
    "https://ovrload-backend-production.up.railway.app/shop/checkout"
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log(`\nURL: ${url}`);
      console.log(`Status: ${res.status}`);
      console.log(`Includes 'Pickup': ${text.includes('Pickup')}`);
      console.log(`Includes 'Location not required': ${text.includes('Location not required') || text.includes('Location')}`);
      console.log(`First 200 chars: ${text.slice(0, 200)}`);
    } catch (e) {
      console.error(`Failed ${url}: ${e.message}`);
    }
  }
}

checkDeployments();
