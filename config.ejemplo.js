// TemploWeb · configuracion publica del frontend.
// Copiar este archivo como config.js y completar con los datos del
// proyecto Supabase y de la cuenta Cloudinary.
// La clave anonima de Supabase es publica por diseno: la seguridad la
// ponen las politicas RLS del esquema. NUNCA pongas aca el service role
// ni el API secret de Cloudinary: esos viven solo en las variables de
// entorno de Vercel que leen las funciones de /api.
window.TW_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON: "TU-CLAVE-ANONIMA",
  CLOUDINARY_CLOUD: "tu-cloud-name"
};
