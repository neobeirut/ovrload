const { createHmac } = require('crypto');

function base64UrlEncode(input) {
  const raw = Buffer.from(String(input), "utf8").toString("base64");
  return raw.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signAdminTokenPayload(payloadB64, secret) {
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64");
  return sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function createAdminToken(adminUserId, secret = "overload_secret_key_2024") {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    admin_user_id: Number(adminUserId),
    iat: now,
    exp: now + 360000,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = signAdminTokenPayload(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function testFetch() {
  const token = createAdminToken(1);
  console.log("Generated test admin token:", token);

  const urls = [
    "https://ovrload-backend-production.up.railway.app/api/orders/admin",
    "https://flowonline.me/api/orders/admin",
    "https://neo-web-admin.vercel.app/api/orders/admin"
  ];

  for (const url of urls) {
    try {
      console.log(`\nFetching ${url}...`);
      const res = await fetch(url, {
        headers: {
          "x-admin-token": token,
          "x-admin-id": "1"
        }
      });
      console.log("Status:", res.status);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log("Response orders count:", json.orders ? json.orders.length : 0);
        if (json.orders && json.orders.length > 0) {
          console.log("First order:", { id: json.orders[0].id, name: json.orders[0].customer_name, phone: json.orders[0].customer_phone });
        } else {
          console.log("JSON response:", json);
        }
      } catch (e) {
        console.log("Raw text response (first 200 chars):", text.slice(0, 200));
      }
    } catch (err) {
      console.error(`Error fetching ${url}:`, err.message);
    }
  }
}

testFetch();
