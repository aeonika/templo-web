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
      AR: { nombre: "Argentina", servicios: [
        { n: "Mercado Pago", t: ["link", "qr", "datos"], c: ["CVU", "Alias", "Titular"] },
        { n: "Ualá", t: ["qr", "datos"], c: ["CVU", "Alias", "Titular"] },
        { n: "Brubank", t: ["qr", "datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Naranja X", t: ["datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Cuenta DNI", t: ["qr", "datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "BNA+", t: ["qr", "datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Personal Pay", t: ["qr", "datos"], c: ["CVU", "Alias", "Titular"] },
        { n: "Modo", t: ["qr", "datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Banco Galicia", t: ["datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Banco Macro", t: ["datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Santander", t: ["datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "BBVA", t: ["datos"], c: ["CBU", "Alias", "Titular"] },
        { n: "Transferencia / CBU", t: ["datos"], c: ["CBU o CVU", "Alias", "Titular"] }
      ] },
      CL: { nombre: "Chile", servicios: [
        { n: "Cuenta RUT / BancoEstado", t: ["datos"], c: ["RUT", "N° de cuenta", "Titular"] },
        { n: "Mach", t: ["datos"], c: ["N° de cuenta", "RUT", "Titular"] },
        { n: "Tenpo", t: ["datos"], c: ["N° de cuenta", "RUT", "Titular"] },
        { n: "Mercado Pago", t: ["link", "qr"] },
        { n: "Webpay / Transbank", t: ["link"] },
        { n: "Banco de Chile", t: ["datos"], c: ["N° de cuenta", "RUT", "Titular"] },
        { n: "Santander", t: ["datos"], c: ["N° de cuenta", "RUT", "Titular"] },
        { n: "Khipu", t: ["link"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "RUT", "Titular"] }
      ] },
      CO: { nombre: "Colombia", servicios: [
        { n: "Nequi", t: ["qr", "datos"], c: ["Número Nequi (celular)", "Titular"] },
        { n: "Daviplata", t: ["datos"], c: ["Número Daviplata (celular)", "Titular"] },
        { n: "Bancolombia", t: ["qr", "datos"], c: ["N° de cuenta", "Titular"] },
        { n: "PSE", t: ["link"] },
        { n: "Mercado Pago", t: ["link", "qr"] },
        { n: "Banco de Bogotá", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "BBVA", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      MX: { nombre: "México", servicios: [
        { n: "SPEI / Transferencia", t: ["datos"], c: ["CLABE (18 dígitos)", "Banco", "Titular"] },
        { n: "Mercado Pago", t: ["link", "qr"] },
        { n: "OXXO", t: ["link"] },
        { n: "BBVA México", t: ["datos"], c: ["CLABE", "Titular"] },
        { n: "Santander México", t: ["datos"], c: ["CLABE", "Titular"] },
        { n: "Banco Azteca", t: ["datos"], c: ["CLABE", "Titular"] },
        { n: "Clip", t: ["link"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["CLABE", "Banco", "Titular"] }
      ] },
      PE: { nombre: "Perú", servicios: [
        { n: "Yape", t: ["qr", "datos"], c: ["Número Yape (celular)", "Titular"] },
        { n: "Plin", t: ["qr", "datos"], c: ["Número Plin (celular)", "Titular"] },
        { n: "BCP", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Interbank", t: ["datos"], c: ["N° de cuenta / CCI", "Titular"] },
        { n: "BBVA Perú", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Mercado Pago", t: ["link", "qr"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta / CCI", "Titular"] }
      ] },
      UY: { nombre: "Uruguay", servicios: [
        { n: "Mercado Pago", t: ["link", "qr"] },
        { n: "Prex", t: ["datos"], c: ["N° de cuenta Prex", "Titular"] },
        { n: "OCA", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Banco República (BROU)", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Santander", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      ES: { nombre: "España", servicios: [
        { n: "Bizum", t: ["datos"], c: ["Teléfono Bizum", "Titular"] },
        { n: "Transferencia SEPA", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "BBVA", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "Santander", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "CaixaBank", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "Revolut", t: ["link", "datos"], c: ["Revtag o teléfono", "Titular"] }
      ] },
      VE: { nombre: "Venezuela", servicios: [
        { n: "Pago Móvil", t: ["datos"], c: ["Teléfono", "Banco", "Cédula", "Titular"] },
        { n: "Banco de Venezuela", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Banesco", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Mercantil", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Zelle", t: ["datos"], c: ["Correo o teléfono Zelle", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      BO: { nombre: "Bolivia", servicios: [
        { n: "Banco Unión", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "BCP Bolivia", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Tigo Money", t: ["datos"], c: ["Número Tigo Money", "Titular"] },
        { n: "QR Simple", t: ["qr"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      PY: { nombre: "Paraguay", servicios: [
        { n: "Banco Itaú", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Visión Banco", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Tigo Money", t: ["datos"], c: ["Número Tigo Money", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      EC: { nombre: "Ecuador", servicios: [
        { n: "Banco Pichincha", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Banco Guayaquil", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Produbanco", t: ["datos"], c: ["N° de cuenta", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "N° de cuenta", "Titular"] }
      ] },
      CR: { nombre: "Costa Rica", servicios: [
        { n: "SINPE Móvil", t: ["datos"], c: ["Número SINPE (teléfono)", "Titular"] },
        { n: "Banco Nacional", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "Banco de Costa Rica", t: ["datos"], c: ["IBAN", "Titular"] },
        { n: "Transferencia bancaria", t: ["datos"], c: ["Banco", "IBAN", "Titular"] }
      ] },
      INT: { nombre: "Internacional", servicios: [
        { n: "PayPal", t: ["link", "datos"], c: ["Correo de PayPal"] },
        { n: "Binance", t: ["link", "qr", "datos"], c: ["Email o UID de Binance"] },
        { n: "Wise", t: ["link", "datos"], c: ["Correo de Wise"] },
        { n: "Payoneer", t: ["datos"], c: ["Correo de Payoneer"] },
        { n: "Skrill", t: ["datos"], c: ["Correo de Skrill"] }
      ] }
    },
    // Ficha de un servicio: que formas de cobro admite (t) y, si cobra
    // por datos, que campos pedir (c). Servicios fuera del catalogo
    // («Otro» o nombres libres) admiten las tres formas.
    servicioInfo: function (cod, nombre) {
      var p = TW.PAISES[cod];
      if (p) {
        for (var i = 0; i < p.servicios.length; i++) {
          if (p.servicios[i].n === nombre) return p.servicios[i];
        }
      }
      return { n: nombre, t: ["link", "qr", "datos"], c: ["Detalle de pago", "Titular"] };
    },
    nombrePais: function (cod) {
      if (cod === "INT") return "Internacional";
      return TW.PAISES[cod] ? TW.PAISES[cod].nombre : (cod || "");
    },
    normalizarMetodo: function (m, paisSitio) {
      if (!m) return null;
      var pais = m.pais || (m.ambito === "internacional" ? "INT" : (paisSitio || "AR"));
      var tipo = m.tipo === "qr" ? "qr" : (m.tipo === "datos" ? "datos" : "link");
      if (tipo === "datos") {
        var datos = Array.isArray(m.datos) ? m.datos.filter(function (d) { return d && d.valor; }).map(function (d) { return { etiqueta: d.etiqueta || "Dato", valor: String(d.valor) }; }) : [];
        if (!datos.length) return null;
        return { servicio: m.servicio || "Otro", pais: pais, tipo: "datos", url: "", datos: datos };
      }
      if (!m.url) return null;
      return { servicio: m.servicio || "Otro", pais: pais, tipo: tipo, url: m.url };
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
    // Dominio de cada servicio para traer su icono (favicon). Si el
    // servicio no esta en el mapa, se muestra la inicial como icono.
    LOGOS_METODO: { "Mercado Pago": "mercadopago.com.ar", "Cuenta DNI": "bancoprovincia.com.ar", "BNA+": "bna.com.ar", "Ualá": "uala.com.ar", "Brubank": "brubank.com", "Naranja X": "naranjax.com", "Personal Pay": "personalpay.com.ar", "Banco Galicia": "galicia.com.ar", "Banco Macro": "macro.com.ar", "Santander": "santander.com.ar", "BBVA": "bbva.com.ar", "Modo": "modo.com.ar", "Binance": "binance.com", "PayPal": "paypal.com", "Wise": "wise.com", "Payoneer": "payoneer.com", "Skrill": "skrill.com", "Cuenta RUT / BancoEstado": "bancoestado.cl", "Mach": "somosmach.cl", "Tenpo": "tenpo.cl", "Webpay / Transbank": "transbank.cl", "Banco de Chile": "bancochile.cl", "Khipu": "khipu.com", "Nequi": "nequi.com.co", "Daviplata": "daviplata.com", "Bancolombia": "bancolombia.com", "PSE": "pse.com.co", "Banco de Bogotá": "bancodebogota.com", "OXXO": "oxxo.com", "BBVA México": "bbva.mx", "Santander México": "santander.com.mx", "Banco Azteca": "bancoazteca.com.mx", "Clip": "clip.mx", "Yape": "yape.com.pe", "Plin": "plin.pe", "BCP": "viabcp.com", "Interbank": "interbank.pe", "BBVA Perú": "bbva.pe", "Prex": "prexcard.com", "OCA": "oca.com.uy", "Banco República (BROU)": "brou.com.uy", "Bizum": "bizum.es", "CaixaBank": "caixabank.es", "Revolut": "revolut.com", "Banco de Venezuela": "banvenez.com", "Banesco": "banesco.com", "Mercantil": "mercantilbanco.com", "Zelle": "zellepay.com", "Banco Unión": "bancounion.com.bo", "Tigo Money": "tigo.com", "Banco Itaú": "itau.com.py", "Visión Banco": "visionbanco.com", "Banco Pichincha": "pichincha.com", "Banco Guayaquil": "bancoguayaquil.com", "Produbanco": "produbanco.com.ec", "Banco Nacional": "bncr.fi.cr", "Banco de Costa Rica": "bancobcr.com" },
    logoMetodoHtml: function (servicio) {
      var dom = TW.LOGOS_METODO[servicio || ""];
      return '<span class="s-pago-ico"><span class="s-pago-letra">' + TW.esc((servicio || "?").trim().charAt(0).toUpperCase() || "?") + "</span>" +
        (dom ? '<img src="https://www.google.com/s2/favicons?domain=' + dom + '&sz=128" alt="" loading="lazy" onerror="this.remove()">' : "") + "</span>";
    },
    // HTML de un grupo de metodos: botones para los links y figuras con
    // el nombre del servicio para los QR. Cada metodo lleva su icono.
    htmlMetodosGrupo: function (metodos) {
      var links = metodos.filter(function (m) { return m.tipo !== "qr" && m.tipo !== "datos"; });
      var qrs = metodos.filter(function (m) { return m.tipo === "qr"; });
      var conDatos = metodos.filter(function (m) { return m.tipo === "datos"; });
      return (links.length ? '<div class="s-pagos-btns">' + links.map(function (m) {
        return '<a class="btn s-pago-btn" href="' + TW.esc(m.url) + '" target="_blank" rel="noopener">' + TW.logoMetodoHtml(m.servicio) + "<span>" + TW.esc(m.servicio || "Pagar") + "</span></a>";
      }).join("") + "</div>" : "") +
      (qrs.length ? '<div class="s-qrs">' + qrs.map(function (m) {
        return '<figure class="s-qr-item"><figcaption>' + TW.logoMetodoHtml(m.servicio) + "<span>" + TW.esc(m.servicio || "QR") + '</span></figcaption>' +
          '<img class="s-qr" src="' + TW.esc(m.url) + '" alt="Código QR de ' + TW.esc(m.servicio || "pago") + '"></figure>';
      }).join("") + "</div>" : "") +
      (conDatos.length ? '<div class="s-datos-lista">' + conDatos.map(function (m) {
        return '<div class="s-datos"><p class="s-datos-t">' + TW.logoMetodoHtml(m.servicio) + "<span>" + TW.esc(m.servicio || "Transferencia") + "</span></p>" +
          (m.datos || []).map(function (d) {
            return '<p class="s-datos-fila"><span>' + TW.esc(d.etiqueta) + ":</span> <strong>" + TW.esc(d.valor) + "</strong></p>";
          }).join("") + "</div>";
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
    // Flujo de pago en MODAL: los metodos NO se muestran al entrar a
    // la pantalla. El visitante toca «Pagar» y se abre un modal al
    // centro con los paises disponibles (o Internacional); elige el
    // suyo y recien ahi ve los metodos de ese pais, cada uno con su
    // icono, junto con las instrucciones del item.
    htmlPagosInteractivo: function (metodos, paisSitio, instrucciones) {
      metodos = metodos || [];
      if (!metodos.length && !instrucciones) return "";
      TW._pagos = TW._pagos || {};
      TW._pgN = (TW._pgN || 0) + 1;
      var clave = "pg" + TW._pgN;
      TW._pagos[clave] = metodos;
      var paises = [];
      metodos.forEach(function (m) { var p = m.pais || "INT"; if (paises.indexOf(p) === -1) paises.push(p); });
      paises.sort(function (a, b) {
        var pa = a === (paisSitio || "AR") ? 0 : (a === "INT" ? 2 : 1);
        var pb = b === (paisSitio || "AR") ? 0 : (b === "INT" ? 2 : 1);
        return pa - pb;
      });
      return '<div class="s-pagos pg" data-pg="' + clave + '">' +
        '<button class="btn btn-acento pg-abrir" type="button">' + (metodos.length ? "Pagar" : "Cómo pagar") + "</button>" +
        '<div class="pg-modal-fondo" hidden><div class="pg-modal" role="dialog" aria-modal="true" aria-label="Métodos de pago">' +
        '<div class="pg-modal-cab"><p class="s-pagos-t">Cómo pagar</p>' +
        '<button class="pg-cerrar" type="button" aria-label="Cerrar">✕</button></div>' +
        (paises.length > 1 ? '<p class="pg-modal-sub">Elegí desde dónde pagás:</p><div class="pg-paises">' +
          paises.map(function (p) { return '<button class="pg-pais" type="button" data-pais="' + TW.esc(p) + '">' + TW.esc(TW.nombrePais(p)) + "</button>"; }).join("") + "</div>"
          : (paises.length === 1 ? '<p class="pg-modal-sub">Pagás desde ' + TW.esc(TW.nombrePais(paises[0])) + ":</p>" : "")) +
        '<div class="pg-metodos"></div>' +
        (instrucciones ? '<p class="s-pagos-nota">' + TW.esc(instrucciones) + "</p>" : "") +
        "</div></div></div>";
    },
    conectarPagosInteractivo: function (contenedor, paisSitio) {
      if (!contenedor) return;
      var abrir = contenedor.querySelector(".pg-abrir");
      var fondo = contenedor.querySelector(".pg-modal-fondo");
      if (!abrir || !fondo) return;
      var metodos = (TW._pagos || {})[contenedor.dataset.pg] || [];
      var destino = fondo.querySelector(".pg-metodos");
      var botones = fondo.querySelectorAll(".pg-pais");
      function elegir(p) {
        botones.forEach(function (b) { b.classList.toggle("activo", b.dataset.pais === p); });
        if (destino) destino.innerHTML = TW.htmlMetodosGrupo(metodos.filter(function (m) { return (m.pais || "INT") === p; }));
      }
      function cerrar() { fondo.hidden = true; document.body.style.overflow = ""; }
      abrir.addEventListener("click", function () {
        fondo.hidden = false;
        document.body.style.overflow = "hidden";
        if (destino && !destino.innerHTML && metodos.length) {
          var def = (paisSitio && metodos.some(function (m) { return (m.pais || "INT") === paisSitio; })) ? paisSitio : (botones.length ? botones[0].dataset.pais : (metodos[0].pais || "INT"));
          elegir(def);
        }
      });
      var btnCerrar = fondo.querySelector(".pg-cerrar");
      if (btnCerrar) btnCerrar.addEventListener("click", cerrar);
      fondo.addEventListener("click", function (ev) { if (ev.target === fondo) cerrar(); });
      document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !fondo.hidden) cerrar(); });
      botones.forEach(function (b) { b.addEventListener("click", function () { elegir(b.dataset.pais); }); });
    },
    // Texto plano sin marcas de formato: para las tarjetas del indice,
    // donde la descripcion se muestra como resumen de una linea.
    // Acepta HTML (editor visual) o Markdown (contenido viejo).
    textoPlano: function (texto) {
      var t = String(texto || "");
      if (/<\/?[a-z][^>]*>/i.test(t)) {
        var d = document.createElement("div");
        d.innerHTML = t;
        t = d.textContent || "";
      }
      return t
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/^#{2,3}\s+/gm, "")
        .replace(/^\s*-\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim();
    },
    // Texto con formato para las pantallas publicas: si el contenido
    // es HTML (del editor visual del panel) se sanitiza con una lista
    // blanca de etiquetas; si es texto viejo en Markdown, se convierte
    // con TW.md().
    textoRico: function (texto) {
      if (!texto) return "";
      if (!/<\/?[a-z][^>]*>/i.test(texto)) return TW.md(texto);
      var PERMITIDAS = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, UL: 1, OL: 1, LI: 1, H2: 1, H3: 1, A: 1, DIV: 1, SPAN: 1, BLOCKQUOTE: 1 };
      var PELIGROSAS = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, IMG: 1, VIDEO: 1, AUDIO: 1, LINK: 1, META: 1 };
      var raiz = document.createElement("div");
      raiz.innerHTML = String(texto);
      function limpiar(nodo) {
        Array.prototype.slice.call(nodo.childNodes).forEach(function (h) {
          if (h.nodeType === 3) return;
          if (h.nodeType !== 1) { h.remove(); return; }
          if (PELIGROSAS[h.tagName]) { h.remove(); return; }
          if (!PERMITIDAS[h.tagName]) {
            limpiar(h);
            while (h.firstChild) nodo.insertBefore(h.firstChild, h);
            h.remove();
            return;
          }
          var href = h.tagName === "A" ? (h.getAttribute("href") || "") : "";
          Array.prototype.slice.call(h.attributes || []).forEach(function (at) { h.removeAttribute(at.name); });
          if (h.tagName === "A") {
            if (/^https?:\/\//i.test(href)) { h.setAttribute("href", href); h.setAttribute("target", "_blank"); h.setAttribute("rel", "noopener"); }
            else { h.removeAttribute("href"); }
          }
          limpiar(h);
        });
      }
      limpiar(raiz);
      return raiz.innerHTML;
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
