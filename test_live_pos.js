async function checkPOS() {
  try {
    console.log("Checking POS page URL...");
    const pageRes = await fetch("https://ovrload-backend-production.up.railway.app/pos");
    console.log("Page status:", pageRes.status);
    const html = await pageRes.text();
    console.log("Page HTML length:", html.length);
    console.log("Page HTML preview:", html.substring(0, 300));

    console.log("\nChecking POS products API...");
    const prodRes = await fetch("https://ovrload-backend-production.up.railway.app/api/pos/products");
    console.log("Products API status:", prodRes.status);
    const prodData = await prodRes.json();
    console.log("Categories count:", prodData.categories?.length);
    console.log("Products count:", prodData.products?.length);

  } catch (err) {
    console.error("Fetch error:", err);
  }
}

checkPOS();
