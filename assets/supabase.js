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
      t = t.replace(/(^|\n)###\s+([^\n]+)/g, "\n\n<h3>$2</h3>\n\n");
      t = t.replace(/(^|\n)##\s+([^\n]+)/g, "\n\n<h2>$2</h2>\n\n");
      return t.split(/\n\s*\n/).filter(function (b) { return b.trim(); }).map(function (bloque) {
        if (/^<h[23]>/.test(bloque.trim())) return bloque.trim();
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
    // Sesion completa: usuario + perfil (nombre y si es Master de la
    // plataforma). Devuelve null si no hay sesion iniciada.
    sesion: async function () {
      if (!sb) return null;
      var r = await sb.auth.getUser();
      var user = r.data ? r.data.user : null;
      if (!user) return null;
      var rp = await sb.from("perfiles").select("nombre, es_admin").eq("id", user.id).maybeSingle();
      var perfil = rp.data || {};
      return { usuario: user, perfil: perfil, esMaster: !!perfil.es_admin };
    },
    // Pinta el estado de sesion en #s-sesion dentro de un sitio (o aula):
    // sin sesion, el enlace Ingresar; con sesion, nombre + rol en ESE
    // sitio (Master, Admin si es el dueno, Miembro, Usuario), el acceso
    // que corresponda (Administrar sitio para el dueno) y Salir.
    pintarSesionSitio: async function (sitio) {
      var zona = document.getElementById("s-sesion");
      if (!zona || !sb) return;
      var ses = await TW.sesion();
      if (!ses) { zona.innerHTML = '<a href="/panel.html' + (sitio && sitio.slug ? "?s=" + encodeURIComponent(sitio.slug) : "") + '">Ingresar</a>'; return; }
      var u = ses.usuario;
      var esDueno = !!(sitio && sitio.dueno_id && sitio.dueno_id === u.id);
      var rol, rolTxt;
      if (ses.esMaster) { rol = "master"; rolTxt = "Master"; }
      else if (esDueno) { rol = "admin"; rolTxt = "Admin"; }
      else {
        var rm = sitio ? await sb.from("miembros").select("usuario_id").eq("sitio_id", sitio.id).eq("usuario_id", u.id).maybeSingle() : { data: null };
        if (rm.data) { rol = "miembro"; rolTxt = "Miembro"; }
        else { rol = "usuario"; rolTxt = "Usuario"; }
      }
      var html = '<span class="s-sesion-datos"><span class="s-rol s-rol--' + rol + '">' + rolTxt + "</span></span>";
      var icoLlave = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="16" r="4.2"/><path d="M11.2 12.8L20 4"/><path d="M16.4 7.6l2.4 2.4"/><path d="M13.9 10.1l2 2"/></svg>';
      var icoUsuario = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5"/></svg>';
      if (esDueno) html += '<a class="s-sesion-ico es-llave" href="/panel.html" title="Administrar sitio" aria-label="Administrar sitio">' + icoLlave + "</a>";
      else if (ses.esMaster) html += '<a class="s-sesion-ico es-llave" href="/admin.html" title="Administración" aria-label="Administración">' + icoLlave + "</a>";
      else html += '<a class="s-sesion-ico" href="/panel.html" title="Mi panel" aria-label="Mi panel">' + icoUsuario + "</a>";
      html += '<button class="s-salir" id="s-salir-nav" type="button">Salir</button>';
      zona.innerHTML = html;
      var b = document.getElementById("s-salir-nav");
      if (b) b.addEventListener("click", async function () { await sb.auth.signOut(); location.reload(); });
    },
    // Marca de la plataforma (nombre y logo) que el Master guarda en
    // config_plataforma: pinta el nombre en .marca-nombre, reemplaza el
    // signo de fabrica (.marca-signo) por el logo si hay uno cargado y lo
    // usa como icono de la pestaña. Sin valores guardados, no toca nada.
    aplicarMarca: async function () {
      if (!sb) return;
      var r = await sb.from("config_plataforma").select("clave, valor").in("clave", ["marca_nombre", "marca_logo_url"]);
      var datos = {};
      (r.data || []).forEach(function (x) { datos[x.clave] = x.valor; });
      var nombre = (datos.marca_nombre || "").trim();
      var logo = (datos.marca_logo_url || "").trim();
      if (nombre) {
        document.querySelectorAll(".marca-nombre").forEach(function (el) { el.textContent = nombre; });
        document.title = document.title.replace("TemploWeb", nombre);
      }
      if (logo) {
        document.querySelectorAll(".marca-signo").forEach(function (el) {
          var img = document.createElement("img");
          img.src = logo;
          img.alt = "";
          img.className = "marca-logo";
          el.replaceWith(img);
        });
        document.querySelectorAll(".p-marca").forEach(function (el) {
          if (el.querySelector(".marca-logo")) return;
          var img2 = document.createElement("img");
          img2.src = logo;
          img2.alt = "";
          img2.className = "marca-logo";
          el.prepend(img2);
        });
        var fav = document.querySelector('link[rel="icon"]');
        if (!fav) { fav = document.createElement("link"); fav.rel = "icon"; document.head.appendChild(fav); }
        fav.href = logo;
      }
    },
    // Pantalla de carga: cada pagina trae un #splash visible desde el
    // primer pintado, que tapa el destello de los valores de fabrica
    // mientras llegan los datos reales; estos helpers lo retiran cuando
    // la pagina ya pinto su contenido verdadero.
    finSplash: function () { if (window.__finSplash) window.__finSplash(); },
    // En las paginas de un sitio, la pantalla de carga adopta la
    // identidad del sitio (el fondo de su tema, su logo y su nombre)
    // apenas se lo lee de la base.
    splashSitio: function (sitio) {
      var s = document.getElementById("splash");
      if (!s || !sitio) return;
      var img = document.getElementById("splash-logo");
      if (img && sitio.logo_url) { img.src = sitio.logo_url; img.hidden = false; }
      var nom = document.getElementById("splash-nombre");
      if (nom) nom.textContent = sitio.nombre || "";
    },
    // Comprime una imagen en el navegador antes de subirla: la achica al
    // maximo indicado (lado mayor) y la pasa a WebP con calidad 0.82, que
    // se ve igual y pesa mucho menos. Si el resultado pesara mas que el
    // original, o el archivo no es JPEG/PNG/WebP (un GIF animado o un SVG
    // se respetan), devuelve el archivo tal cual. Nunca lanza error.
    comprimirImagen: async function (archivo, maximo) {
      if (!archivo || !/^image\/(jpeg|png|webp)$/.test(archivo.type)) return archivo;
      var max = maximo || 1600;
      try {
        var bmp = await createImageBitmap(archivo);
        var escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
        var w = Math.max(1, Math.round(bmp.width * escala));
        var h = Math.max(1, Math.round(bmp.height * escala));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        var blob = await new Promise(function (res) { canvas.toBlob(res, "image/webp", 0.82); });
        var ext = ".webp";
        if (!blob) {
          blob = await new Promise(function (res) { canvas.toBlob(res, "image/jpeg", 0.85); });
          ext = ".jpg";
        }
        if (!blob || blob.size >= archivo.size) return archivo;
        var nombre = (archivo.name || "imagen").replace(/\.[^.]+$/, "") + ext;
        return new File([blob], nombre, { type: blob.type });
      } catch (e) { return archivo; }
    },
    // Sube un comprobante de pago a Cloudinary (ver api/firmar-comprobante.js).
    // Vale para cualquier usuario con sesion, tenga o no sitio propio.
    // Devuelve los datos de Cloudinary ({ secure_url, ... }).
    subirComprobante: async function (archivo) {
      if (!sb) throw new Error("Sin conexion");
      var sesion = await sb.auth.getSession();
      var token = sesion.data && sesion.data.session ? sesion.data.session.access_token : null;
      if (!token) throw new Error("Sin sesion");
      var tipoRes = archivo.type.indexOf("image/") === 0 ? "image" : "raw";
      if (tipoRes === "image" && TW.comprimirImagen) archivo = await TW.comprimirImagen(archivo, 1600);
      var r = await fetch("/api/firmar-comprobante", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ resource_type: tipoRes })
      });
      if (!r.ok) throw new Error("El servidor no firmó la subida");
      var firma = await r.json();
      var fd = new FormData();
      fd.append("file", archivo);
      fd.append("api_key", firma.api_key);
      fd.append("timestamp", firma.timestamp);
      fd.append("signature", firma.signature);
      fd.append("folder", firma.folder);
      var up = await fetch("https://api.cloudinary.com/v1_1/" + firma.cloud + "/" + tipoRes + "/upload", { method: "POST", body: fd });
      var datos = await up.json();
      if (!up.ok) throw new Error(datos.error ? datos.error.message : "La subida falló");
      return datos;
    },
    // ---- Metodos de pago ----------------------------------------------
    // Un metodo: { servicio, pais, tipo: "link"|"qr", url }. El pais es
    // un codigo de PAISES o "INT" (internacional). El sitio define su
    // pais general en sitios.config.pais. Los metodos viejos guardaban
    // ambito ("local"|"internacional") en vez de pais: normalizarMetodo
    // los convierte (local -> pais del sitio, internacional -> "INT").
    // Los generales viven en sitios.config.metodos_pago; cada producto,
    // curso o documento puede tener los suyos (columna metodos_pago) y
    // elegir con pagos_modo: "sitio" (default), "propios" o "ambos".
    PAISES: {
      AR: { nombre: "Argentina", servicios: ["Mercado Pago", "Ualá", "Brubank", "Naranja X", "Cuenta DNI", "BNA+", "Personal Pay", "Modo", "Banco Galicia", "Banco Macro", "Santander", "BBVA", "Transferencia / CBU"] },
      CL: { nombre: "Chile", servicios: ["Cuenta RUT / BancoEstado", "Mach", "Tenpo", "Mercado Pago", "Webpay / Transbank", "Banco de Chile", "Santander", "Khipu", "Transferencia bancaria"] },
      CO: { nombre: "Colombia", servicios: ["Nequi", "Daviplata", "Bancolombia", "PSE", "Mercado Pago", "Banco de Bogotá", "BBVA", "Transferencia bancaria"] },
      MX: { nombre: "México", servicios: ["SPEI / Transferencia", "Mercado Pago", "OXXO", "BBVA México", "Santander México", "Banco Azteca", "Clip", "Transferencia bancaria"] },
      PE: { nombre: "Perú", servicios: ["Yape", "Plin", "BCP", "Interbank", "BBVA Perú", "Mercado Pago", "Transferencia bancaria"] },
      UY: { nombre: "Uruguay", servicios: ["Mercado Pago", "Prex", "OCA", "Banco República (BROU)", "Santander", "Transferencia bancaria"] },
      ES: { nombre: "España", servicios: ["Bizum", "Transferencia SEPA", "BBVA", "Santander", "CaixaBank", "Revolut"] },
      VE: { nombre: "Venezuela", servicios: ["Pago Móvil", "Banco de Venezuela", "Banesco", "Mercantil", "Zelle", "Transferencia bancaria"] },
      BO: { nombre: "Bolivia", servicios: ["Banco Unión", "BCP Bolivia", "Tigo Money", "QR Simple", "Transferencia bancaria"] },
      PY: { nombre: "Paraguay", servicios: ["Banco Itaú", "Visión Banco", "Tigo Money", "Transferencia bancaria"] },
      EC: { nombre: "Ecuador", servicios: ["Banco Pichincha", "Banco Guayaquil", "Produbanco", "Transferencia bancaria"] },
      CR: { nombre: "Costa Rica", servicios: ["SINPE Móvil", "Banco Nacional", "Banco de Costa Rica", "Transferencia bancaria"] },
      INT: { nombre: "Internacional", servicios: ["PayPal", "Binance", "Wise", "Payoneer", "Skrill"] }
    },
    nombrePais: function (cod) {
      if (cod === "INT") return "Internacional";
      return TW.PAISES[cod] ? TW.PAISES[cod].nombre : (cod || "");
    },
    normalizarMetodo: function (m, paisSitio) {
      if (!m || !m.url) return null;
      var pais = m.pais || (m.ambito === "internacional" ? "INT" : (paisSitio || "AR"));
      return { servicio: m.servicio || "Otro", pais: pais, tipo: m.tipo === "qr" ? "qr" : "link", url: m.url };
    },
    metodosDeSitio: function (cfg) {
      cfg = cfg || {};
      var paisSitio = cfg.pais || "AR";
      if (Array.isArray(cfg.metodos_pago) && cfg.metodos_pago.length) {
        return cfg.metodos_pago.map(function (m) { return TW.normalizarMetodo(m, paisSitio); }).filter(Boolean);
      }
      // Legado: campos sueltos anteriores a metodos_pago.
      var out = [];
      if (cfg.pago_mp) out.push({ servicio: "Mercado Pago", ambito: "local", tipo: "link", url: cfg.pago_mp });
      if (cfg.pago_paypal) out.push({ servicio: "PayPal", ambito: "internacional", tipo: "link", url: cfg.pago_paypal });
      var qrs = Array.isArray(cfg.pagos_qr) ? cfg.pagos_qr : (cfg.pago_qr ? [{ servicio: "", url: cfg.pago_qr }] : []);
      qrs.forEach(function (q) {
        if (!q || !q.url) return;
        var inter = ["Binance", "PayPal", "Wise"].indexOf(q.servicio) >= 0;
        out.push({ servicio: q.servicio || "QR", ambito: inter ? "internacional" : "local", tipo: "qr", url: q.url });
      });
      return out.map(function (m) { return TW.normalizarMetodo(m, paisSitio); }).filter(Boolean);
    },
    metodosEfectivos: function (item, cfg) {
      cfg = cfg || {};
      var paisSitio = cfg.pais || "AR";
      var propios = item && Array.isArray(item.metodos_pago) ? item.metodos_pago.map(function (m) { return TW.normalizarMetodo(m, paisSitio); }).filter(Boolean) : [];
      var modo = (item && item.pagos_modo) || "sitio";
      if (modo === "propios") return propios;
      if (modo === "ambos") return TW.metodosDeSitio(cfg).concat(propios);
      return TW.metodosDeSitio(cfg);
    },
    // HTML de un grupo de metodos: botones para los links y figuras con
    // el nombre del servicio para los QR.
    htmlMetodosGrupo: function (metodos) {
      var links = metodos.filter(function (m) { return m.tipo !== "qr"; });
      var qrs = metodos.filter(function (m) { return m.tipo === "qr"; });
      return (links.length ? '<div class="s-pagos-btns">' + links.map(function (m) {
        return '<a class="btn" href="' + TW.esc(m.url) + '" target="_blank" rel="noopener">' + TW.esc(m.servicio || "Pagar") + "</a>";
      }).join("") + "</div>" : "") +
      (qrs.length ? '<div class="s-qrs">' + qrs.map(function (m) {
        return '<figure class="s-qr-item"><figcaption>' + TW.esc(m.servicio || "QR") + '</figcaption>' +
          '<img class="s-qr" src="' + TW.esc(m.url) + '" alt="Código QR de ' + TW.esc(m.servicio || "pago") + '"></figure>';
      }).join("") + "</div>" : "");
    },
    // HTML completo: agrupa por pais si hay mas de uno (primero el del
    // sitio, Internacional al final), con el nombre del pais como
    // encabezado de cada grupo.
    htmlMetodos: function (metodos, paisSitio) {
      if (!metodos || !metodos.length) return "";
      var orden = [];
      var grupos = {};
      metodos.forEach(function (m) {
        var p = m.pais || "INT";
        if (!grupos[p]) { grupos[p] = []; orden.push(p); }
        grupos[p].push(m);
      });
      if (orden.length <= 1) return TW.htmlMetodosGrupo(metodos);
      orden.sort(function (a, b) {
        var pa = a === (paisSitio || "AR") ? 0 : (a === "INT" ? 2 : 1);
        var pb = b === (paisSitio || "AR") ? 0 : (b === "INT" ? 2 : 1);
        return pa - pb;
      });
      return orden.map(function (p) {
        return '<p class="s-pagos-sub">' + TW.esc(TW.nombrePais(p)) + "</p>" + TW.htmlMetodosGrupo(grupos[p]);
      }).join("");
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
