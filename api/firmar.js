// TemploWeb · entrega segura de contenido pago (Vercel Function).
//
// El navegador pide una URL temporal para una leccion o documento.
// Esta funcion es la unica que conoce el API secret de Cloudinary y
// solo firma si se cumplen TODAS estas condiciones:
//   1. Hay una sesion valida de Supabase (JWT en Authorization).
//   2. El usuario tiene acceso: es el dueno del sitio, la leccion es
//      preview, tiene suscripcion activa al curso, compro el documento
//      o el documento es gratis.
//   3. Si el contenido es pago, el sitio esta en plan premium.
// La URL generada vence en 15 minutos (expires_at de Cloudinary).
const { createClient } = require("@supabase/supabase-js");
const cloudinary = require("cloudinary").v2;

const MINUTOS = 15;

module.exports = async function (req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo no permitido" });
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Sin sesion" });

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const { data: ud, error: eUser } = await admin.auth.getUser(token);
  if (eUser || !ud.user) return res.status(401).json({ error: "Sesion invalida" });
  const uid = ud.user.id;

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const esLeccion = !!cuerpo.leccion_id;
  const id = cuerpo.leccion_id || cuerpo.documento_id;
  if (!id) return res.status(400).json({ error: "Falta el contenido" });
  const tabla = esLeccion ? "lecciones" : "documentos";

  const { data: item } = await admin.from(tabla).select("*").eq("id", id).maybeSingle();
  if (!item || !item.cloudinary_id) return res.status(404).json({ error: "Contenido no encontrado" });

  const { data: sitio } = await admin.from("sitios").select("dueno_id, plan").eq("id", item.sitio_id).maybeSingle();
  if (!sitio) return res.status(404).json({ error: "Sitio no encontrado" });

  let acceso = sitio.dueno_id === uid;
  let esPago = false;
  if (!acceso && esLeccion) {
    esPago = !item.es_preview;
    if (item.es_preview) acceso = true;
    else {
      const { data: su } = await admin.from("suscripciones").select("id")
        .eq("alumno_id", uid).eq("curso_id", item.curso_id).eq("estado", "activa")
        .or("vence.is.null,vence.gt." + new Date().toISOString()).maybeSingle();
      acceso = !!su;
    }
  }
  if (!acceso && !esLeccion) {
    esPago = Number(item.precio) > 0;
    if (!esPago) acceso = true;
    else {
      const { data: ac } = await admin.from("accesos_documentos").select("id")
        .eq("alumno_id", uid).eq("documento_id", item.id).eq("estado", "activa").maybeSingle();
      acceso = !!ac;
    }
  }
  if (!acceso) return res.status(403).json({ error: "Sin acceso a este contenido" });
  if (esPago && sitio.plan !== "premium") {
    return res.status(403).json({ error: "El sitio no tiene activo el plan premium" });
  }

  const resourceType = esLeccion
    ? (item.tipo === "documento" ? "raw" : "video")
    : "raw";
  // En Cloudinary, el public_id de un archivo RAW incluye la extension
  // ("carpeta/archivo.pdf") y la descarga privada lo pide completo y
  // sin formato aparte; quitarle la extension da «Resource not found».
  // En video/imagen el id va sin extension y el formato va separado.
  let publicId, formato;
  if (resourceType === "raw") {
    publicId = item.cloudinary_id;
    formato = "";
  } else {
    const punto = item.cloudinary_id.lastIndexOf(".");
    publicId = punto > 0 ? item.cloudinary_id.slice(0, punto) : item.cloudinary_id;
    formato = punto > 0 ? item.cloudinary_id.slice(punto + 1) : "";
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  const url = cloudinary.utils.private_download_url(publicId, formato, {
    type: "authenticated",
    resource_type: resourceType,
    expires_at: Math.floor(Date.now() / 1000) + MINUTOS * 60
  });
  return res.status(200).json({ url: url, vence_en_minutos: MINUTOS });
};
