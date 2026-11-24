// TemploWeb · cliente compartido de Supabase y utilidades.
// Requiere config.js cargado antes y el CDN de supabase-js.
(function () {
  var cfg = window.TW_CONFIG || {};
  var sb = null;
  if (cfg.SUPABASE_URL && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
  }
  window.TW = {
    cfg: cfg,
    sb: sb,
    // Precio con formato local; vacio si no hay precio cargado.
    precio: function (valor, moneda) {
      if (valor === null || valor === undefined || valor === "") return "";
      var n = Number(valor);
      if (isNaN(n)) return "";
      if (n === 0) return "Gratis";
      return "$ " + n.toLocaleString("es-AR") + (moneda && moneda !== "ARS" ? " " + moneda : "");
    },
    // Escape basico para interpolar datos de usuarios en HTML.
    esc: function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    // Markdown minimo y seguro para articulos y textos largos:
    // parrafos, negritas, italicas, enlaces y listas simples.
    md: function (texto) {
      var t = TW.esc(texto || "");
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return t.split(/\n\s*\n/).map(function (bloque) {
        var lineas = bloque.split("\n");
        var esLista = lineas.every(function (l) { return /^\s*-\s+/.test(l); });
        if (esLista) {
          return "<ul>" + lineas.map(function (l) {
            return "<li>" + l.replace(/^\s*-\s+/, "") + "</li>";
          }).join("") + "</ul>";
        }
        return "<p>" + lineas.join("<br>") + "</p>";
      }).join("");
    },
    usuario: async function () {
      if (!sb) return null;
      var r = await sb.auth.getUser();
      return r.data ? r.data.user : null;
    },
    // Pide al servidor una URL firmada de Cloudinary (ver api/firmar.js).
    // Devuelve la URL temporal o null si el usuario no tiene acceso.
    urlFirmada: async function (datos) {
      if (!sb) return null;
      var sesion = await sb.auth.getSession();
      var token = sesion.data && sesion.data.session ? sesion.data.session.access_token : null;
      if (!token) return null;
      var resp = await fetch("/api/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(datos)
      });
      if (!resp.ok) return null;
      var json = await resp.json();
      return json.url || null;
    }
  };
})();
