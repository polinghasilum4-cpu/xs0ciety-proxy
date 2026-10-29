/**
 * xs0ciety API Gateway Proxy
 * Key hanya di server (XS_API_SECRET). Tidak pernah ke browser.
 */

const ALLOWED_ORIGINS = [
  "https://xs0cietylabsz.biz.id",
  "https://www.xs0cietylabsz.biz.id",
];

// Lengkap sesuai struktur folder API kamu
const TARGETS = {
  // --- api-instagram ---
  instagram:        "https://api-instagram-five.vercel.app/api/v2/instagram",
  twitter:          "https://api-instagram-five.vercel.app/api/v2/twitter",
  pinterest:        "https://api-instagram-five.vercel.app/api/v2/pinterest",
  pxbee:            "https://api-instagram-five.vercel.app/api/v2/pxbee",
  qr:               "https://api-instagram-five.vercel.app/api/v2/qr",
  "faceswap-video": "https://api-instagram-five.vercel.app/api/v2/faceswap-video",

  // --- api-soundcloud ---
  soundcloud:        "https://api-soundcloud.vercel.app/api/v2/soundcloud",
  faceswap:         "https://api-soundcloud.vercel.app/api/v2/faceswap",
  voice:            "https://api-soundcloud.vercel.app/api/v2/voice-changer",
  "voice-changer":  "https://api-soundcloud.vercel.app/api/v2/voice-changer",
  upload:           "https://api-soundcloud.vercel.app/api/v2/upload",
  iqc:              "https://api-soundcloud.vercel.app/api/v2/iqc",
  savefrom:         "https://api-soundcloud.vercel.app/api/v2/savefrom",
  mail:             "https://api-soundcloud.vercel.app/api/v2/mail",

  // --- api-spotify ---
  spotify:          "https://api-spotify-tawny.vercel.app/api/v2/spotify",
};

module.exports = async (req, res) => {
  const origin = (req.headers.origin || "").toString();

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ status: false, message: "Forbidden" });
  }

  const target = (req.query.target || "").toLowerCase().trim();
  if (!target || !TARGETS[target]) {
    return res.status(400).json({
      status: false,
      message: "target tidak valid",
      allowed: Object.keys(TARGETS).sort()
    });
  }

  const apiKey = process.env.XS_API_SECRET;
  if (!apiKey) {
    return res.status(500).json({ status: false, message: "Server misconfigured (no secret)" });
  }

  let realUrl = TARGETS[target];
  const forwardQuery = { ...req.query };
  delete forwardQuery.target;

  const qs = new URLSearchParams(forwardQuery).toString();
  if (qs) {
    realUrl += (realUrl.includes("?") ? "&" : "?") + qs;
  }

  try {
    const headers = {
      "X-XS-Key": apiKey,
      "User-Agent": req.headers["user-agent"] || "xs0ciety-proxy/1.0",
    };

    const fetchOpts = {
      method: req.method || "GET",
      headers,
    };

    if (req.method === "POST") {
      const ct = req.headers["content-type"] || "";
      if (ct.includes("multipart/form-data")) {
        headers["Content-Type"] = ct;
        if (req.body) {
          fetchOpts.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        }
      } else {
        headers["Content-Type"] = "application/json";
        fetchOpts.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      }
    }

    const upstream = await fetch(realUrl, fetchOpts);
    const respCt = upstream.headers.get("content-type") || "application/json";

    res.setHeader("Content-Type", respCt);
    res.status(upstream.status);

    const buf = Buffer.from(await upstream.arrayBuffer());
    return res.send(buf);
  } catch (err) {
    console.error("[proxy]", target, err.message);
    return res.status(502).json({
      status: false,
      message: "Proxy error",
      error: err.message
    });
  }
};
