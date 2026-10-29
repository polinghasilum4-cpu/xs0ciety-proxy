/**
 * xs0ciety Proxy v2 — error lebih jelas
 */
const ALLOWED_ORIGINS = [
  "https://xs0cietylabsz.biz.id",
  "https://www.xs0cietylabsz.biz.id",
];

const TARGETS = {
  instagram:        "https://api-instagram-five.vercel.app/api/v2/instagram",
  twitter:          "https://api-instagram-five.vercel.app/api/v2/twitter",
  pinterest:        "https://api-instagram-five.vercel.app/api/v2/pinterest",
  pxbee:            "https://api-instagram-five.vercel.app/api/v2/pxbee",
  qr:               "https://api-instagram-five.vercel.app/api/v2/qr",
  "faceswap-video": "https://api-instagram-five.vercel.app/api/v2/faceswap-video",

  soundcloud:        "https://api-soundcloud.vercel.app/api/v2/soundcloud",
  faceswap:         "https://api-soundcloud.vercel.app/api/v2/faceswap",
  voice:            "https://api-soundcloud.vercel.app/api/v2/voice-changer",
  "voice-changer":  "https://api-soundcloud.vercel.app/api/v2/voice-changer",
  upload:           "https://api-soundcloud.vercel.app/api/v2/upload",
  iqc:              "https://api-soundcloud.vercel.app/api/v2/iqc",
  savefrom:         "https://api-soundcloud.vercel.app/api/v2/savefrom",
  mail:             "https://api-soundcloud.vercel.app/api/v2/mail",

  spotify:          "https://api-spotify-tawny.vercel.app/api/v2/spotify",
};

module.exports = async (req, res) => {
  const origin = (req.headers.origin || "").toString();
  const referer = (req.headers.referer || "").toString();

  // CORS
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") return res.status(204).end();

  // Origin check — izinkan jika Origin ATAU Referer dari domain resmi
  const fromAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    ALLOWED_ORIGINS.some((o) => referer.startsWith(o));

  if (!fromAllowed) {
    return res.status(403).json({
      status: false,
      message: "Forbidden: origin not allowed",
      debug: { origin, referer: referer.slice(0, 80) }
    });
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
    return res.status(500).json({
      status: false,
      message: "XS_API_SECRET belum di-set di Environment Variables proxy"
    });
  }

  let realUrl = TARGETS[target];
  const forwardQuery = { ...req.query };
  delete forwardQuery.target;
  const qs = new URLSearchParams(forwardQuery).toString();
  if (qs) realUrl += (realUrl.includes("?") ? "&" : "?") + qs;

  try {
    const headers = {
      "X-XS-Key": apiKey,
      "User-Agent": req.headers["user-agent"] || "xs0ciety-proxy/2",
      "Origin": ALLOWED_ORIGINS[0],
      "Referer": ALLOWED_ORIGINS[0] + "/",
    };

    const fetchOpts = { method: req.method || "GET", headers };

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
    const buf = Buffer.from(await upstream.arrayBuffer());

    // Kalau upstream error, kasih info lebih jelas
    if (upstream.status === 401 || upstream.status === 403) {
      let body;
      try { body = JSON.parse(buf.toString()); } catch { body = buf.toString().slice(0, 200); }
      return res.status(upstream.status).json({
        status: false,
        message: "Upstream menolak request (cek XS_API_SECRET di API utama & proxy harus SAMA)",
        upstreamStatus: upstream.status,
        upstreamBody: body
      });
    }

    res.setHeader("Content-Type", respCt);
    res.status(upstream.status);
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
