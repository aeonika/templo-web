// TemploWeb · firma de subidas a Cloudinary (Vercel Function).
//
// El panel del maestro sube archivos directo del navegador a
// Cloudinary, pero la firma la genera aca: sin sesion valida y sin un
// sitio propio no hay firma, y el API secret nunca sale del servidor.
// Lo pago se sube con type "authenticated" (privado); lo gratis, publico.
const { createClient } = require("@supabase/supabase-js");
const cloudinary = require("cloudinary").v2;

module.exports = async function (req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo no permitido" });
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Sin sesion" });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const { data: ud, error: eUser } = await admin.auth.getUser(token);
  if (eUser || !ud.user) return res.status(401).json({ error: "Sesion invalida" });

  const { data: sitio } = await admin.from("sitios").select("id")
    .eq("dueno_id", ud.user.id).maybeSingle();
  if (!sitio) return res.status(403).json({ error: "El usuario no tiene un sitio" });

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const resourceType = ["image", "video", "raw"].indexOf(cuerpo.resource_type) >= 0 ? cuerpo.resource_type : "raw";
  const privado = !!cuerpo.privado;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "templo-web/" + sitio.id;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  const aFirmar = { timestamp: timestamp, folder: folder };
  if (privado) aFirmar.type = "authenticated";
  const signature = cloudinary.utils.api_sign_request(aFirmar, process.env.CLOUDINARY_API_SECRET);

  return res.status(200).json({
    cloud: process.env.CLOUDINARY_CLOUD,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp: timestamp,
    signature: signature,
    folder: folder,
    type: privado ? "authenticated" : null,
    resource_type: resourceType
  });
};
