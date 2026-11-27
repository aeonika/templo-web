// TemploWeb · panel del maestro y del alumno.
// Auth con Supabase, CRUD generico por modulo y subida firmada a
// Cloudinary. La seguridad real la pone RLS: este panel solo puede
// tocar las filas del usuario conectado.
(function () {
  "use strict";
  var user = null;
  var sitio = null;
  var tabActual = "inicio";
  function $(s) { return document.querySelector(s); }
  function esc(s) { return TW.esc(s); }

  // Botones «o pegar una URL»: los campos de imagen muestran por defecto
  // solo el boton de subir; el campo para pegar una direccion queda
  // oculto hasta que el usuario lo pide con ese boton.
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-url-toggle]");
    if (!b) return;
    var id = b.getAttribute("data-url-toggle");
    var inp = id ? document.getElementById(id) : null;
    if (!inp) { var z = b.closest(".c-img, .c-imgbloque"); if (z) inp = z.querySelector("input[type='text']"); }
    if (inp) { inp.hidden = !inp.hidden; if (!inp.hidden) inp.focus(); }
  });

  // Ojito para mostrar u ocultar la contraseña (login y registro).
  document.querySelectorAll(".p-ojo").forEach(function (b) {
    b.addEventListener("click", function () {
      var inp = b.parentElement.querySelector("input");
      var ver = inp.type === "password";
      inp.type = ver ? "text" : "password";
      b.classList.toggle("viendo", ver);
      b.setAttribute("aria-pressed", ver ? "true" : "false");
      b.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
      inp.focus();
    });
  });

  // ============================================================ auth
  async function refrescar() {
    user = await TW.usuario();
    $("#p-cargando").hidden = true;
    if (window.TW && TW.finSplash) TW.finSplash();
    $("#btn-salir").hidden = !user;
    $("#p-burger").hidden = !user;
    TW.aplicarMarca();
    $("#p-usuario").textContent = user ? user.email : "";
    $("#vista-auth").hidden = !!user;
    $("#vista-panel").hidden = !user;
    if (user) {
      var r = await TW.sb.from("sitios").select("*").eq("dueno_id", user.id).maybeSingle();
      sitio = r.data || null;
      var vs = $("#p-ver-sitio");
      if (vs) { vs.hidden = !sitio; if (sitio) vs.href = "sitio/" + sitio.slug; }
      var dn = $("#p-drawer-nombre"), dp = $("#p-drawer-plan"), dl = $("#p-drawer-logo"), da = $("#p-drawer-avatar");
      if (dn) dn.textContent = sitio ? sitio.nombre : "Todavía no creaste tu sitio";
      if (dp) dp.textContent = sitio ? ("Plan " + (sitio.plan === "premium" ? "Premium" : "Gratis") + " · /sitio/" + sitio.slug) : "";
      if (dl && da) {
        var imgD = sitio && (sitio.avatar_url || sitio.logo_url);
        dl.hidden = !imgD; da.hidden = !!imgD;
        if (imgD) dl.src = imgD;
        else da.textContent = sitio ? (sitio.nombre || "?").trim().charAt(0).toUpperCase() : "?";
      }
      var rp = await TW.sb.from("perfiles").select("es_admin").eq("id", user.id).maybeSingle();
      var la = $("#link-admin");
      if (la) la.hidden = !(rp.data && rp.data.es_admin);
      if (rp.data && rp.data.es_admin) $("#p-usuario").textContent = (user.email || "") + " · Master";
      pintarTab(tabActual);
    }
  }

  $("#form-login").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var f = new FormData(ev.target);
    var r = await TW.sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
    $("#error-login").textContent = r.error ? "Email o contraseña incorrectos." : "";
    if (!r.error) refrescar();
  });
  $("#form-registro").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var f = new FormData(ev.target);
    var r = await TW.sb.auth.signUp({
      email: f.get("email"), password: f.get("password"),
      options: { data: { nombre: f.get("nombre") } }
    });
    if (r.error) { $("#error-registro").textContent = "No se pudo crear la cuenta: " + r.error.message; return; }
    if (!r.data.session) {
      $("#error-registro").textContent = "";
      ev.target.innerHTML = '<p class="p-ok">Cuenta creada. Revisá tu email para confirmarla y después ingresá.</p>';
      return;
    }
    refrescar();
  });
  $("#btn-salir").addEventListener("click", async function () {
    await TW.sb.auth.signOut();
    location.reload();
  });
  // Cajon de navegacion: el menu hamburguesa abre el panel lateral
  // con todas las secciones (en escritorio y en movil).
  var burgerNav = $("#p-burger"), drawer = $("#p-drawer"), drawerFondo = $("#p-drawer-fondo");
  function cerrarDrawer() {
    if (drawer) { drawer.classList.remove("abierto"); drawer.setAttribute("aria-hidden", "true"); }
    if (drawerFondo) drawerFondo.hidden = true;
    if (burgerNav) { burgerNav.classList.remove("abierta"); burgerNav.setAttribute("aria-expanded", "false"); }
    document.body.classList.remove("con-drawer");
  }
  function abrirDrawer() {
    if (drawer) { drawer.classList.add("abierto"); drawer.setAttribute("aria-hidden", "false"); }
    if (drawerFondo) drawerFondo.hidden = false;
    if (burgerNav) { burgerNav.classList.add("abierta"); burgerNav.setAttribute("aria-expanded", "true"); }
    document.body.classList.add("con-drawer");
  }
  if (burgerNav && drawer) {
    burgerNav.addEventListener("click", function () {
      if (drawer.classList.contains("abierto")) cerrarDrawer(); else abrirDrawer();
    });
    if (drawerFondo) drawerFondo.addEventListener("click", cerrarDrawer);
    var dx = $("#p-drawer-x");
    if (dx) dx.addEventListener("click", cerrarDrawer);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") cerrarDrawer(); });
    var pie = drawer.querySelector(".p-drawer-pie");
    if (pie) pie.addEventListener("click", function (ev) { if (ev.target.closest("a, button")) cerrarDrawer(); });
  }
  document.querySelectorAll("#p-tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      tabActual = b.dataset.tab;
      document.querySelectorAll("#p-tabs button").forEach(function (x) { x.classList.toggle("activa", x === b); });
      cerrarDrawer();
      pintarTab(tabActual);
    });
  });
  // ============================================================ inicio (dashboard)
  function irA(tab) {
    var b = document.querySelector('#p-tabs button[data-tab="' + tab + '"]');
    if (b) b.click();
  }
  function contar(tabla, extra) {
    var q = TW.sb.from(tabla).select("id", { count: "exact", head: true }).eq("sitio_id", sitio.id);
    if (extra) q = extra(q);
    return q.then(function (r) { return r.count || 0; }, function () { return 0; });
  }
  function animarNumero(el, valor) {
    if (!el) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !valor) { el.textContent = valor; return; }
    var t0 = null;
    function paso(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / 650);
      el.textContent = Math.round(valor * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
  async function vistaInicio(cont) {
    if (!sitio) {
      cont.innerHTML = "<div class='d-bienvenida d-anim'>" +
        "<h2>Bienvenido a tu panel</h2>" +
        "<p class='bajada'>Todavía no creaste tu sitio. Cuando lo crees, este panel se convierte en tu tablero: contenido, alumnos y actividad en un solo lugar.</p>" +
        "<div class='p-acciones'><button class='btn btn-primario' id='d-crear'>Crear mi sitio</button>" +
        "<button class='btn btn-fantasma' id='d-aprender'>Ver mi aprendizaje</button></div></div>";
      $("#d-crear").addEventListener("click", function () { irA("sitio"); });
      $("#d-aprender").addEventListener("click", function () { irA("aprendizaje"); });
      return;
    }
    var urlSitio = "sitio/" + sitio.slug;
    var urlAbs = new URL(urlSitio, location.href).href;
    var stats = [
      ["productos", "Productos"], ["cursos", "Cursos"], ["articulos", "Artículos"],
      ["documentos", "Documentos"], ["miembros", "Miembros"], ["suscripciones", "Suscripciones activas"]
    ];
    cont.innerHTML =
      "<div class='d-cab d-anim' style='--i:0'><div>" +
      "<h2>" + esc(sitio.nombre) + "</h2>" +
      "<p class='bajada'>Plan " + (sitio.plan === "premium" ? "Premium" : "Gratis") + " · Así va tu sitio hoy.</p></div>" +
      (sitio.avatar_url || sitio.logo_url ? "<img class='d-cab-img' src='" + esc(sitio.avatar_url || sitio.logo_url) + "' alt=''>" : "") +
      "</div>" +
      "<div class='d-stats'>" + stats.map(function (s, i) {
        return "<button type='button' class='d-stat d-anim' style='--i:" + (i + 1) + "' data-ir='" + (s[0] === "suscripciones" ? "alumnos" : s[0] === "miembros" ? "alumnos" : s[0]) + "'><span class='d-stat-num' id='d-n-" + s[0] + "'>…</span><span class='d-stat-et'>" + s[1] + "</span></button>";
      }).join("") + "</div>" +
      "<div class='d-cols'>" +
      "<div class='p-bloque d-anim' style='--i:7'><h3>Tu sitio</h3>" +
      "<p class='d-url'>" + esc(urlAbs) + "</p>" +
      "<div class='p-acciones'><a class='btn btn-primario' href='" + urlSitio + "' target='_blank' rel='noopener'>Abrir mi sitio</a>" +
      "<button class='btn btn-fantasma' id='d-copiar'>Copiar dirección</button>" +
      "<button class='btn btn-fantasma' id='d-editar'>Editar sitio</button></div>" +
      "<h3 class='d-sub'>Acciones rápidas</h3>" +
      "<div class='d-rapidas'>" +
      "<button class='btn btn-fantasma' data-ir='productos'>Nuevo producto</button>" +
      "<button class='btn btn-fantasma' data-ir='articulos'>Nuevo artículo</button>" +
      "<button class='btn btn-fantasma' data-ir='cursos'>Nuevo curso</button>" +
      "<button class='btn btn-fantasma' data-ir='feed'>Publicar una novedad</button>" +
      "</div></div>" +
      "<div class='p-bloque d-anim' style='--i:8'><h3>Actividad reciente</h3><div id='d-actividad'><p class='p-vacio'>Cargando…</p></div></div>" +
      "</div>";
    cont.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () { irA(b.getAttribute("data-ir")); });
    });
    $("#d-editar").addEventListener("click", function () { irA("sitio"); });
    $("#d-copiar").addEventListener("click", async function () {
      try { await navigator.clipboard.writeText(urlAbs); $("#d-copiar").textContent = "Copiado"; }
      catch (e) { $("#d-copiar").textContent = "No se pudo copiar"; }
    });
    var promesas = {
      productos: contar("productos"), cursos: contar("cursos"), articulos: contar("articulos"),
      documentos: contar("documentos"), miembros: contar("miembros")
    };
    promesas.suscripciones = (async function () {
      var rc = await TW.sb.from("cursos").select("id").eq("sitio_id", sitio.id);
      var ids = (rc.data || []).map(function (c) { return c.id; });
      if (!ids.length) return 0;
      var rs = await TW.sb.from("suscripciones").select("id", { count: "exact", head: true }).in("curso_id", ids).eq("estado", "activa");
      return rs.count || 0;
    })();
    Object.keys(promesas).forEach(function (k) {
      promesas[k].then(function (n) { animarNumero(document.getElementById("d-n-" + k), n); });
    });
    var eventos = [];
    var rf = await TW.sb.from("publicaciones").select("texto, creada").eq("sitio_id", sitio.id).order("creada", { ascending: false }).limit(3);
    (rf.data || []).forEach(function (f) { eventos.push({ cuando: f.creada, tipo: "Novedad", texto: f.texto }); });
    var rm = await TW.sb.from("miembros").select("creado, origen, perfiles(nombre)").eq("sitio_id", sitio.id).order("creado", { ascending: false }).limit(3);
    (rm.data || []).forEach(function (m) {
      eventos.push({ cuando: m.creado, tipo: "Miembro", texto: ((m.perfiles && m.perfiles.nombre) || "Alguien") + " se sumó a tu sitio" });
    });
    eventos.sort(function (a, b) { return new Date(b.cuando) - new Date(a.cuando); });
    var zona = document.getElementById("d-actividad");
    if (zona) {
      zona.innerHTML = eventos.length ? eventos.slice(0, 5).map(function (e) {
        return "<div class='p-fila-lista'><div class='crece'><span class='titulo'>" + esc(e.tipo) + "</span>" +
          "<div class='detalle'>" + new Date(e.cuando).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + " · " + esc(String(e.texto || "").slice(0, 90)) + "</div></div></div>";
      }).join("") : "<p class='p-vacio'>Todavía no hay actividad. Publicá una novedad o compartí tu sitio para empezar.</p>";
    }
  }

  function pintarTab(tab) {
    var cont = $("#p-contenido");
    cont.innerHTML = "";
    cont.classList.remove("entra");
    void cont.offsetWidth;
    cont.classList.add("entra");
    if (tab === "inicio") return vistaInicio(cont);
    if (tab === "sitio") return vistaSitio(cont);
    if (tab === "aprendizaje") return vistaAprendizaje(cont);
    if (!sitio) {
      cont.innerHTML = "<h2>Primero creá tu sitio</h2><p class='bajada'>Los módulos se activan cuando tu sitio existe. Andá a la pestaña Mi sitio.</p>";
      return;
    }
    if (tab === "productos") return crud(cont, CFG.productos);
    if (tab === "articulos") return crud(cont, CFG.articulos);
    if (tab === "promociones") return crud(cont, CFG.promociones);
    if (tab === "documentos") return crud(cont, CFG.documentos);
    if (tab === "cursos") return vistaCursos(cont);
    if (tab === "feed") return vistaFeed(cont);
    if (tab === "alumnos") return vistaAlumnos(cont);
  }

  // ============================================================ subida a Cloudinary
  // Pide la firma al servidor (api/firmar-subida.js) y sube directo.
  async function subirCloudinary(archivo, privado, opciones) {
    var sesion = await TW.sb.auth.getSession();
    var token = sesion.data.session.access_token;
    var tipoRes = archivo.type.indexOf("image/") === 0 ? "image"
      : (archivo.type.indexOf("video/") === 0 || archivo.type.indexOf("audio/") === 0) ? "video" : "raw";
    if (tipoRes === "image" && TW.comprimirImagen) {
      archivo = await TW.comprimirImagen(archivo, (opciones && opciones.max) || 1600);
    }
    var r = await fetch("/api/firmar-subida", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ privado: !!privado, resource_type: tipoRes })
    });
    if (!r.ok) throw new Error("El servidor no firmó la subida");
    var firma = await r.json();
    var fd = new FormData();
    fd.append("file", archivo);
    fd.append("api_key", firma.api_key);
    fd.append("timestamp", firma.timestamp);
    fd.append("signature", firma.signature);
    fd.append("folder", firma.folder);
    if (firma.type) fd.append("type", firma.type);
    var up = await fetch("https://api.cloudinary.com/v1_1/" + firma.cloud + "/" + tipoRes + "/upload", { method: "POST", body: fd });
    var datos = await up.json();
    if (!up.ok) throw new Error(datos.error ? datos.error.message : "La subida falló");
    return datos; // { public_id, secure_url, resource_type, ... }
  }

  // ============================================================ CRUD generico
  var CFG = {
    productos: {
      titulo: "Productos y servicios", tabla: "productos", orden: "orden",
      bajada: "Físicos, digitales o servicios. El botón de compra usa tu link de pago; sin link, el visitante consulta por WhatsApp. Con categoría, tu catálogo gana filtros; con stock, el sitio avisa «últimas unidades» y «agotado» solo; con precio de oferta y fecha de fin, la oferta es flash y muestra cuenta regresiva.",
      campos: [
        { k: "nombre", et: "Nombre", tipo: "text" },
        { k: "tipo", et: "Tipo", tipo: "select", opciones: [["fisico", "Físico"], ["digital", "Digital"], ["servicio", "Servicio"]] },
        { k: "categoria", et: "Categoría (ej: Vestidos, Calzado, Básicos)", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea" },
        { k: "precio", et: "Precio (vacío = a consultar)", tipo: "number" },
        { k: "precio_oferta", et: "Precio de oferta (opcional)", tipo: "number" },
        { k: "oferta_hasta", et: "La oferta termina (opcional: la vuelve oferta flash)", tipo: "fecha" },
        { k: "stock", et: "Stock total (vacío = sin control de stock)", tipo: "number" },
        { k: "variantes", et: "Talles con su stock (si cargás talles, el stock total sale de ellos)", tipo: "talles" },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", max: 1200, ayuda: "Tamaño sugerido: 1200 × 1200 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "link_pago", et: "Link de pago (Mercado Pago, Stripe…)", tipo: "text" },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "destacado", et: "Destacado en la vidriera", tipo: "check" },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) {
        var st = Array.isArray(x.variantes) && x.variantes.length
          ? x.variantes.reduce(function (a, v) { return a + (Number(v.s) || 0); }, 0)
          : (x.stock === null || x.stock === undefined ? null : Number(x.stock));
        return TW.precio(x.precio_oferta != null && x.precio != null && Number(x.precio_oferta) < Number(x.precio) ? x.precio_oferta : x.precio, x.moneda) +
          (x.precio_oferta != null && x.precio != null && Number(x.precio_oferta) < Number(x.precio) ? " · OFERTA" : "") +
          (x.categoria ? " · " + x.categoria : "") +
          (st !== null ? (st <= 0 ? " · SIN STOCK" : " · stock " + st) : "") +
          (x.destacado ? " · destacado" : "") + (x.publicado ? "" : " · borrador");
      }
    },
    articulos: {
      titulo: "Artículos", tabla: "articulos", orden: "creado",
      bajada: "Tu blog. El cuerpo acepta Markdown simple: **negrita**, *itálica*, [enlaces](url) y listas con guión.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "slug", et: "Dirección (slug)", tipo: "text" },
        { k: "extracto", et: "Extracto", tipo: "textarea" },
        { k: "cuerpo", et: "Cuerpo", tipo: "textarea-grande" },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return x.publicado ? "Publicado" : "Borrador"; }
    },
    promociones: {
      titulo: "Promociones", tabla: "promociones", orden: "orden",
      bajada: "Avisos y publicidad de tu sitio: lanzamientos, descuentos, eventos.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea" },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "link", et: "Enlace", tipo: "text" },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "activa", et: "Activa", tipo: "check", def: true }
      ],
      resumen: function (x) { return x.activa ? "Activa" : "Apagada"; }
    },
    documentos: {
      titulo: "Documentos", tabla: "documentos", orden: "creado",
      bajada: "Tu repositorio. Precio 0 = gratis, con URL pública. Con precio, subí el archivo como privado y se entrega solo a quien tenga acceso, con enlace temporal.",
      archivo: { campoUrl: "url_publica", campoId: "cloudinary_id", privadoSegunPrecio: true },
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea" },
        { k: "precio", et: "Precio (0 = gratis)", tipo: "number", def: 0 },
        { k: "link_pago", et: "Link de pago", tipo: "text" },
        { k: "url_publica", et: "URL pública (solo documentos gratis)", tipo: "text" },
        { k: "cloudinary_id", et: "ID de Cloudinary (documentos pagos)", tipo: "text" },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return Number(x.precio) === 0 ? "Gratis" : TW.precio(x.precio, x.moneda); }
    },
    cursos: {
      titulo: "Cursos y talleres", tabla: "cursos", orden: "creado",
      bajada: "Cada curso tiene sus lecciones: elegí «Lecciones» en un curso para cargarlas.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea" },
        { k: "imagen_url", et: "Imagen de portada", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "precio", et: "Precio (vacío = gratis)", tipo: "number" },
        { k: "link_pago", et: "Link de pago de la suscripción", tipo: "text" },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return (x.precio != null ? TW.precio(x.precio, x.moneda) : "Gratis") + (x.publicado ? "" : " · borrador"); }
    },
    lecciones: {
      titulo: "Lecciones", tabla: "lecciones", orden: "orden",
      bajada: "Video, audio, documento o texto. Las vistas previas se ven sin suscripción. El resto: subí el archivo como privado (queda el ID de Cloudinary) y solo lo abren los alumnos activos, con enlace temporal.",
      archivo: { campoUrl: "url_publica", campoId: "cloudinary_id", privadoSegunCheck: "no" },
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "tipo", et: "Tipo", tipo: "select", opciones: [["video", "Video"], ["audio", "Audio"], ["documento", "Documento"], ["texto", "Texto"]] },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "url_publica", et: "URL pública (lecciones gratis o preview)", tipo: "text" },
        { k: "cloudinary_id", et: "ID de Cloudinary (lecciones pagas)", tipo: "text" },
        { k: "cuerpo", et: "Texto de la lección (solo tipo texto)", tipo: "textarea-grande" },
        { k: "es_preview", et: "Es vista previa gratuita", tipo: "check" }
      ],
      resumen: function (x) { return x.tipo + (x.es_preview ? " · preview" : ""); }
    }
  };

  function campoHtml(c, valor) {
    var v = valor !== undefined && valor !== null ? valor : (c.def !== undefined ? c.def : "");
    if (c.tipo === "check") {
      return '<label class="check"><input type="checkbox" name="' + c.k + '"' + (v ? " checked" : "") + "> " + c.et + "</label>";
    }
    if (c.tipo === "select") {
      return "<label>" + c.et + '<select name="' + c.k + '">' + c.opciones.map(function (o) {
        return '<option value="' + o[0] + '"' + (String(v) === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select></label>";
    }
    if (c.tipo === "textarea" || c.tipo === "textarea-grande") {
      return "<label>" + c.et + '<textarea name="' + c.k + '"' + (c.tipo === "textarea-grande" ? ' class="grande"' : "") + ">" + esc(v) + "</textarea></label>";
    }
    if (c.tipo === "fecha") {
      var fv = v ? String(v).slice(0, 16) : "";
      return "<label>" + c.et + '<input type="datetime-local" name="' + c.k + '" value="' + esc(fv) + '"></label>';
    }
    if (c.tipo === "imagen") {
      return '<div class="c-campo">' + c.et +
        '<span class="c-img"><img class="c-mini c-img-prev" src="' + esc(v) + '" alt=""' + (v ? "" : " hidden") + ">" +
        '<label class="btn btn-fantasma c-subir">Subir imagen<input type="file" class="c-img-file" data-max="' + (c.max || 1600) + '" accept="image/*" hidden></label>' +
        '<button type="button" class="c-url-toggle" data-url-toggle="">o pegar una URL</button>' +
        '<input type="text" class="c-url-input" name="' + c.k + '" value="' + esc(v) + '" placeholder="https://…" hidden></span>' +
        (c.ayuda ? '<span class="c-ayuda">' + c.ayuda + "</span>" : "") +
        '<span class="c-ayuda c-img-estado"></span></div>';
    }
    if (c.tipo === "talles") {
      var tv = Array.isArray(v) ? v.map(function (x) { return x.t + ":" + x.s; }).join(", ") : "";
      return "<label>" + c.et + '<input type="text" name="' + c.k + '" value="' + esc(tv) + '" placeholder="S:5, M:3, L:0"></label>';
    }
    return "<label>" + c.et + '<input type="' + (c.tipo === "number" ? "number" : "text") + '" name="' + c.k + '" value="' + esc(v) + '"' + (c.tipo === "number" ? ' step="any" min="0"' : "") + "></label>";
  }
  function leerCampos(form, campos) {
    var f = new FormData(form);
    var obj = {};
    campos.forEach(function (c) {
      if (c.tipo === "check") obj[c.k] = form.querySelector('[name="' + c.k + '"]').checked;
      else if (c.tipo === "number") { var n = f.get(c.k); obj[c.k] = n === "" || n === null ? null : Number(n); }
      else if (c.tipo === "fecha") { var fv = (f.get(c.k) || "").toString().trim(); obj[c.k] = fv ? new Date(fv).toISOString() : null; }
      else if (c.tipo === "talles") {
        var txt = (f.get(c.k) || "").toString().trim();
        obj[c.k] = txt ? txt.split(",").map(function (par) {
          var p = par.split(":");
          return { t: (p[0] || "").trim(), s: parseInt(p[1], 10) || 0 };
        }).filter(function (x) { return x.t; }) : [];
      }
      else obj[c.k] = (f.get(c.k) || "").toString().trim();
    });
    return obj;
  }

  function crud(cont, cfg, fijo) {
    var editando = null;
    cont.innerHTML = "<h2>" + cfg.titulo + "</h2><p class='bajada'>" + cfg.bajada + "</p>" +
      "<div class='p-bloque' id='cr-form'></div><div class='p-bloque'><h3>Publicados y borradores</h3><div id='cr-lista'></div></div>";
    async function pintarLista() {
      var q = TW.sb.from(cfg.tabla).select("*").eq("sitio_id", sitio.id);
      if (fijo) Object.keys(fijo).forEach(function (k) { q = q.eq(k, fijo[k]); });
      var r = await q.order(cfg.orden || "creado");
      var lista = $("#cr-lista");
      var filas = r.data || [];
      lista.innerHTML = filas.length ? filas.map(function (x) {
        return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' +
          esc(x.titulo || x.nombre || "(sin título)") + '</span><div class="detalle">' + esc(cfg.resumen(x)) + "</div></div>" +
          (cfg.extraBoton ? '<button class="btn btn-fantasma btn-chico" data-extra="' + x.id + '">' + cfg.extraBoton + "</button>" : "") +
          '<button class="btn btn-fantasma btn-chico" data-editar="' + x.id + '">Editar</button>' +
          '<button class="btn btn-peligro btn-chico" data-borrar="' + x.id + '">Borrar</button></div>';
      }).join("") : '<p class="p-vacio">Todavía no cargaste nada acá.</p>';
    }
    function pintarForm() {
      var caja = $("#cr-form");
      caja.innerHTML = "<h3>" + (editando ? "Editar" : "Nuevo") + "</h3><form id='cr-f'>" +
        cfg.campos.map(function (c) { return campoHtml(c, editando ? editando[c.k] : undefined); }).join("") +
        (cfg.archivo ? '<label>Subir archivo a Cloudinary <input type="file" id="cr-archivo"></label>' +
          '<p class="p-nota" id="cr-subida-nota">Si el contenido es pago se sube como privado y se completa el ID; si es gratis, la URL pública.</p>' : "") +
        '<div class="p-acciones"><button class="btn btn-primario" type="submit">Guardar</button>' +
        (editando ? '<button class="btn btn-fantasma" type="button" id="cr-cancelar">Cancelar</button>' : "") +
        "</div><p class='p-error' id='cr-error'></p></form>";
      caja.querySelectorAll(".c-img-file").forEach(function (inp) {
        inp.addEventListener("change", function () {
          var arch = inp.files[0];
          if (!arch) return;
          var zona = inp.closest(".c-img");
          var txt = zona.querySelector('input[type="text"]');
          var prev = zona.querySelector(".c-img-prev");
          var est = inp.closest(".c-campo").querySelector(".c-img-estado");
          if (est) est.textContent = "Comprimiendo y subiendo…";
          subirCloudinary(arch, false, { max: Number(inp.dataset.max) || 1600 }).then(function (datos) {
            txt.value = datos.secure_url;
            if (prev) { prev.src = datos.secure_url; prev.hidden = false; }
            if (est) est.textContent = "Imagen subida y comprimida: se guarda con el formulario.";
          }).catch(function (e2) { if (est) est.textContent = "No se pudo subir: " + e2.message; });
        });
      });
      caja.querySelectorAll(".c-img input[type='text']").forEach(function (txt) {
        txt.addEventListener("input", function () {
          var prev = txt.closest(".c-img").querySelector(".c-img-prev");
          if (prev) { prev.src = txt.value; prev.hidden = !txt.value; }
        });
      });
      if (cfg.tabla === "productos" && sitio.config && sitio.config.talle_sistema === "ninguno") {
        var inpV = caja.querySelector('[name="variantes"]');
        if (inpV && inpV.closest("label")) inpV.closest("label").style.display = "none";
      }
      $("#cr-f").addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var obj = leerCampos(ev.target, cfg.campos);
        obj.sitio_id = sitio.id;
        if (fijo) Object.assign(obj, fijo);
        var archivo = cfg.archivo ? $("#cr-archivo").files[0] : null;
        try {
          if (archivo) {
            $("#cr-subida-nota").textContent = "Subiendo a Cloudinary…";
            var privado = cfg.archivo.privadoSegunPrecio ? Number(obj.precio) > 0 : !obj.es_preview;
            var datos = await subirCloudinary(archivo, privado, { max: 1600 });
            if (privado) obj[cfg.archivo.campoId] = datos.public_id + (datos.format ? "." + datos.format : "");
            else obj[cfg.archivo.campoUrl] = datos.secure_url;
          }
          var r = editando
            ? await TW.sb.from(cfg.tabla).update(obj).eq("id", editando.id)
            : await TW.sb.from(cfg.tabla).insert(obj);
          if (r.error) throw new Error(r.error.message);
          editando = null;
          pintarForm();
          pintarLista();
        } catch (e) {
          $("#cr-error").textContent = "No se pudo guardar: " + e.message;
        }
      });
      var btnC = $("#cr-cancelar");
      if (btnC) btnC.addEventListener("click", function () { editando = null; pintarForm(); });
    }
    cont.addEventListener("click", async function (ev) {
      var be = ev.target.closest("[data-editar]");
      var bb = ev.target.closest("[data-borrar]");
      var bx = ev.target.closest("[data-extra]");
      if (be) {
        var r = await TW.sb.from(cfg.tabla).select("*").eq("id", be.dataset.editar).maybeSingle();
        editando = r.data;
        pintarForm();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (bb && confirm("¿Borrar este elemento? No se puede deshacer.")) {
        await TW.sb.from(cfg.tabla).delete().eq("id", bb.dataset.borrar);
        pintarLista();
      }
      if (bx && cfg.alExtra) cfg.alExtra(bx.dataset.extra);
    });
    pintarForm();
    pintarLista();
  }

  // ============================================================ mi sitio
  function slugDesde(nombre) {
    return nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }
  function vistaSitio(cont) {
    if (!sitio) {
      cont.innerHTML = "<h2>Creá tu sitio</h2><p class='bajada'>Elegí el nombre y la dirección. Podés cambiar todo lo demás cuando quieras.</p>" +
        "<div class='p-bloque'><form id='f-crear'>" +
        "<label>Nombre del sitio <input type='text' name='nombre' required></label>" +
        "<label>Dirección (slug) <input type='text' name='slug' required pattern='[a-z0-9-]{3,40}'></label>" +
        "<p class='p-ayuda'>Elegila bien: es la dirección permanente de tu sitio. Cambiarla después es posible, pero tus enlaces viejos van a depender de una redirección.</p>" +
        "<label>Descripción corta <textarea name='descripcion'></textarea></label>" +
        "<button class='btn btn-primario' type='submit'>Crear mi sitio</button>" +
        "<p class='p-error' id='e-crear'></p></form></div>";
      var inpN = cont.querySelector("[name=nombre]");
      var inpS = cont.querySelector("[name=slug]");
      inpN.addEventListener("input", function () { inpS.value = slugDesde(inpN.value); });
      $("#f-crear").addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var f = new FormData(ev.target);
        var r = await TW.sb.from("sitios").insert({
          dueno_id: user.id, nombre: f.get("nombre"), slug: f.get("slug"), descripcion: f.get("descripcion") || ""
        }).select().maybeSingle();
        if (r.error) { $("#e-crear").textContent = "No se pudo crear: " + r.error.message; return; }
        sitio = r.data;
        vistaSitio(cont);
      });
      return;
    }
    var mods = sitio.modulos || {};
    var modulosDefs = [
      ["quienes", "Quién soy", "Tu presentación, tu foto y tu historia"],
      ["destacados", "Destacados", "La vidriera con lo que querés empujar primero"],
      ["productos", "Productos y servicios", "Tu catálogo con precios y tu link de cobro"],
      ["cursos", "Cursos", "Cursos y talleres en video y audio"],
      ["articulos", "Artículos", "Tu blog, sin depender de ninguna red social"],
      ["documentos", "Documentos", "Tu repositorio de archivos gratis y pagos"],
      ["promociones", "Promociones", "Avisos, lanzamientos y ofertas"],
      ["feed", "Feed de novedades", "Actualizaciones públicas y privadas por curso"]
    ];
    var disenosDefs = [
      ["clasica", "Clásica", "#030305", "#00e5ff", "El diseño original: directo y versátil, para cualquier rubro."],
      ["premium", "Premium", "#0d0906", "#c9a45c", "Títulos centrados, divisor ornamental y fotos con marco: el diseño de gala."]
    ];
    var paletasDefs = {
      clasica: [
        ["crepusculo", "Oscuro cyan", "#030305", "#00e5ff"],
        ["pergamino", "Papel y dorado", "#f6f1e7", "#9a6a1f"],
        ["bosque", "Verde sereno", "#0e1a14", "#7fc98f"],
        ["obsidiana", "Negro y dorado", "#0a0a0c", "#d9a441"],
        ["marfil", "Claro terracota", "#f7f2e9", "#8a3324"]
      ],
      premium: [
        ["dorado", "Dorado cálido", "#0d0906", "#c9a45c"],
        ["medianoche", "Negro cyan", "#030305", "#00e5ff"],
        ["violeta", "Violeta arcano", "#0d0a14", "#a78bfa"],
        ["esmeralda", "Verde esmeralda", "#0a120d", "#63b995"],
        ["terracota", "Claro terracota", "#f7f2e9", "#8a3324"]
      ]
    };
    var maquetaSitio = sitio.maqueta === "premium" ? "premium" : "clasica";
    var urlSitio = "sitio/" + sitio.slug;
    var urlAbsoluta = new URL(urlSitio, location.href).href;
    var iconosPanel = [["vela", "Vela"], ["luna", "Luna"], ["estrella", "Estrella"], ["carta", "Carta de tarot"], ["libro", "Libro"], ["cristal", "Cristal"], ["ojo", "Ojo"], ["llave", "Llave"], ["pocion", "Poción"], ["planta", "Planta"]];
    var rasgosSitio = Array.isArray(sitio.rasgos) ? sitio.rasgos : [];
    var configSitio = sitio.config || {};
    var rubrosDefs = [["general", "General"], ["ropa", "Indumentaria / ropa"], ["calzado", "Calzado"], ["comida", "Comida y bebidas"], ["servicios", "Servicios"], ["digital", "Productos digitales"]];
    var tallesDefs = [["letras", "En letras (XS, S, M, L, XL…)"], ["numeros", "En números (38, 40, 42…)"], ["ninguno", "Mi tienda no usa talles"]];
    function filaRasgo(r) {
      return "<div class='c-rasgo-fila'><label>Icono <select class='c-rasgo-icono'>" +
        iconosPanel.map(function (o) { return "<option value='" + o[0] + "'" + (r && r.icono === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
        "</select></label><label class='c-rasgo-texto'>Texto <input type='text' class='c-rasgo-titulo' value='" + esc(r ? (r.titulo || "") : "") + "' placeholder='Servicios de hechicería'></label>" +
        "<button type='button' class='btn btn-fantasma c-rasgo-quitar'>Quitar</button></div>";
    }
    cont.innerHTML =
      "<div class='p-bloque c-resumen'>" +
        "<div class='c-url'><span class='c-url-texto'>" + esc(urlAbsoluta) + "</span>" +
        "<button class='btn btn-fantasma btn-chico' type='button' id='c-copiar'>Copiar</button>" +
        "<a class='btn btn-fantasma btn-chico' href='" + urlSitio + "' target='_blank' rel='noopener'>Abrir</a>" +
        "<span class='c-plan" + (sitio.plan === "premium" ? " c-plan-premium" : "") + "'>Plan " + esc(sitio.plan) + "</span>" +
        (sitio.publicado ? "" : "<span class='c-plan'>Sin publicar</span>") + "</div>" +
        "<div class='c-stats' id='c-stats'><span class='c-chip'>Cargando tu contenido…</span></div>" +
      "</div>" +
      "<div class='p-bloque'><h3>Dirección de tu sitio</h3>" +
      "<p class='p-ayuda'>Tu dirección es <b>" + esc(urlAbsoluta) + "</b>. Cambiar la última parte es posible, pero tiene consecuencias: el botón de cambiar primero te muestra las advertencias.</p>" +
      "<div class='c-dir-fila'><input type='text' id='c-slug-nuevo' value='" + esc(sitio.slug) + "' pattern='[a-z0-9-]{3,40}' autocomplete='off'>" +
      "<button class='btn btn-fantasma' type='button' id='c-slug-revisar'>Cambiar dirección…</button></div>" +
      "<p class='p-error' id='e-slug'></p>" +
      "<div class='c-aviso' id='c-slug-aviso' hidden>" +
      "<p class='c-aviso-titulo'>Antes de cambiar tu dirección, tené en cuenta:</p>" +
      "<ul>" +
      "<li>Todos los enlaces con tu dirección actual que ya compartiste (WhatsApp, redes sociales, tarjetas, códigos QR) van a depender de una <b>redirección automática</b> a la nueva. Funciona, pero una dirección estable siempre rinde mejor que una redirección.</li>" +
      "<li>Si tu sitio ya aparece en <b>Google</b>, va a tener que volver a ubicarlo con la dirección nueva: podés perder posiciones.</li>" +
      "<li>Solo queda guardada <b>una</b> dirección anterior: si cambiás dos veces, la primera deja de redirigir.</li>" +
      "<li>La nueva dirección tiene que estar <b>libre</b>: si otro sitio ya la usa, no se puede.</li>" +
      "<li>Cambiala solo si hace falta: un error de tipeo o el cambio de nombre de tu negocio. Una dirección que no cambia es parte de tu marca.</li>" +
      "</ul>" +
      "<label class='check'><input type='checkbox' id='c-slug-entiendo'> Entiendo las consecuencias y quiero cambiar mi dirección</label>" +
      "<div class='p-acciones'><button class='btn btn-primario' type='button' id='c-slug-confirmar' disabled>Confirmar el cambio</button>" +
      "<button class='btn btn-fantasma' type='button' id='c-slug-cancelar'>Cancelar</button></div>" +
      "</div>" +
      "<p class='p-ok' id='ok-slug'></p></div>" +
      "<div class='constructor'>" +
      "<form id='f-sitio' class='c-form'>" +
      "<div class='p-bloque'><h3>Identidad</h3>" +
      "<label>Nombre <input type='text' name='nombre' value='" + esc(sitio.nombre) + "'></label>" +
      "<label>Descripción corta <textarea name='descripcion'>" + esc(sitio.descripcion) + "</textarea></label>" +
      "<label>Quién soy / quiénes somos (Markdown simple) <textarea name='quienes_somos' class='grande'>" + esc(sitio.quienes_somos) + "</textarea></label></div>" +
      "<div class='p-bloque'><h3>Apariencia</h3>" +
      "<p class='p-ayuda'>Hay dos diseños. Elegí el diseño y después el color dentro de ese diseño.</p>" +
      "<div class='temas'>" + disenosDefs.map(function (dd) {
        return "<label class='tema-card'><input type='radio' name='maqueta' value='" + dd[0] + "'" + (maquetaSitio === dd[0] ? " checked" : "") + ">" +
          "<span class='tema-prev' style='--tp-fondo:" + dd[2] + ";--tp-acento:" + dd[3] + "'><span class='tema-barra'></span><span class='tema-linea'></span><span class='tema-linea corta'></span></span>" +
          "<span class='tema-nombre'>Diseño " + dd[1] + "</span><span class='tema-desc'>" + dd[4] + "</span></label>";
      }).join("") + "</div>" +
      ["clasica", "premium"].map(function (mq) {
        return "<div class='paletas' id='paletas-" + mq + "'" + (maquetaSitio === mq ? "" : " hidden") + ">" +
          paletasDefs[mq].map(function (pd) {
            return "<label class='paleta'><input type='radio' name='tema' value='" + pd[0] + "'" + (sitio.tema === pd[0] ? " checked" : "") + ">" +
              "<span class='paleta-muestra' style='background:linear-gradient(90deg," + pd[2] + " 50%," + pd[3] + " 50%)'></span>" +
              "<span class='paleta-nombre'>" + pd[1] + "</span></label>";
          }).join("") + "</div>";
      }).join("") +
      "<div class='p-dos'><label>Color de acento (opcional) <span class='c-acento'><input type='text' name='acento' id='c-acento-texto' value='" + esc(sitio.acento || "") + "' placeholder='#00e5ff'><input type='color' id='c-acento-color' value='" + esc(sitio.acento || "#00e5ff") + "'></span></label>" +
      "<label>Texto del pie de página <input type='text' name='footer_texto' value='" + esc(sitio.footer_texto) + "'></label></div>" +
      "<div class='c-imgbloque'><span class='c-imgb-et'>Imagen de fondo (opcional)</span>" +
      "<div class='c-fondo-fila'><img class='c-mini c-fondo-mini' id='c-fondo-mini' alt='Fondo actual' src='" + esc(sitio.fondo_url || "") + "'" + (sitio.fondo_url ? "" : " hidden") + ">" +
      "<label class='btn btn-fantasma c-subir'>Subir imagen<input type='file' id='c-fondo-file' accept='image/*' hidden></label>" +
      "<button type='button' class='c-url-toggle' data-url-toggle='c-fondo-url'>o pegar una URL</button></div>" +
      "<input type='text' name='fondo_url' id='c-fondo-url' class='c-url-input' value='" + esc(sitio.fondo_url || "") + "' placeholder='https://…' hidden>" +
      "<span class='c-ayuda' id='c-fondo-estado'>Se muestra detrás de todo tu sitio, con un velo para que el texto se lea.</span></div>" +
      "<div class='c-imgbloque'><span class='c-imgb-et'>Logo</span>" +
      "<div class='c-fondo-fila'><img class='c-mini' id='c-logo-img' alt='' src='" + esc(sitio.logo_url || "") + "'" + (sitio.logo_url ? "" : " hidden") + ">" +
      "<label class='btn btn-fantasma c-subir'>Subir logo<input type='file' id='c-logo-file' accept='image/*' hidden></label>" +
      "<button type='button' class='c-url-toggle' data-url-toggle='c-logo'>o pegar una URL</button></div>" +
      "<input type='text' name='logo_url' id='c-logo' class='c-url-input' value='" + esc(sitio.logo_url || "") + "' placeholder='https://…' hidden>" +
      "<span class='c-ayuda' id='c-logo-estado'>Tu logo va en la barra de tu sitio y como icono de la pestaña. Se ajusta solo al alto de la barra: puede ser ancho, cuadrado o con fondo transparente, y no se recorta.</span></div>" +
      "<div class='c-imgbloque'><span class='c-imgb-et'>Portada</span>" +
      "<div class='c-fondo-fila'><img class='c-mini' id='c-foto-img' alt='' src='" + esc(sitio.foto_url || "") + "'" + (sitio.foto_url ? "" : " hidden") + ">" +
      "<label class='btn btn-fantasma c-subir'>Subir portada<input type='file' id='c-foto-file' accept='image/*' hidden></label>" +
      "<button type='button' class='c-url-toggle' data-url-toggle='c-foto'>o pegar una URL</button></div>" +
      "<input type='text' name='foto_url' id='c-foto' class='c-url-input' value='" + esc(sitio.foto_url || "") + "' placeholder='https://…' hidden>" +
      "<span class='c-ayuda' id='c-foto-estado'>Es la imagen principal de tu sitio: ocupa todo el encabezado. Tamaño sugerido: 1600 × 900 px. Al subirla se comprime sola, con buena calidad y poco peso.</span></div>" +
      "<div class='c-imgbloque'><span class='c-imgb-et'>Foto de perfil</span>" +
      "<div class='c-fondo-fila'><img class='c-mini c-perfil-mini' id='c-perfil-img' alt='' src='" + esc(sitio.avatar_url || "") + "'" + (sitio.avatar_url ? "" : " hidden") + ">" +
      "<label class='btn btn-fantasma c-subir'>Subir foto<input type='file' id='c-perfil-file' accept='image/*' hidden></label>" +
      "<button type='button' class='c-url-toggle' data-url-toggle='c-perfil'>o pegar una URL</button></div>" +
      "<input type='text' name='avatar_url' id='c-perfil' class='c-url-input' value='" + esc(sitio.avatar_url || "") + "' placeholder='https://…' hidden>" +
      "<span class='c-ayuda' id='c-perfil-estado'>Una foto tuya o de tu marca: se muestra en un círculo junto al nombre de tu sitio. Tamaño sugerido: 800 × 800 px.</span>" +
      "<label class='mod-fila'><span class='mod-info'><span class='mod-nombre'>Mostrar en el sitio</span><span class='mod-desc'>Prende o apaga el círculo con tu foto en la web, sin borrar la foto</span></span>" +
      "<input type='checkbox' class='mod-switch' name='avatar_visible'" + (configSitio.avatar_visible !== false ? " checked" : "") + "></label></div></div>" +
      "<div class='p-bloque'><h3>Contacto</h3>" +
      "<div class='p-dos'><label>WhatsApp (solo números, con código de país) <input type='text' name='whatsapp' value='" + esc(sitio.whatsapp || "") + "'></label>" +
      "<label>Email de contacto <input type='text' name='email' value='" + esc(sitio.email || "") + "'></label></div></div>" +
      "<div class='p-bloque'><h3>Tienda</h3>" +
      "<p class='p-ayuda'>El rubro y el sistema de talles ajustan tu catálogo: en cada producto podés cargar talles con su stock, categorías, precio de oferta y ofertas flash con cuenta regresiva.</p>" +
      "<div class='p-dos'><label>Rubro <select name='rubro'>" +
      rubrosDefs.map(function (r) { return "<option value='" + r[0] + "'" + (sitio.rubro === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") +
      "</select></label>" +
      "<label>Sistema de talles <select name='talle_sistema'>" +
      tallesDefs.map(function (t) { return "<option value='" + t[0] + "'" + ((configSitio.talle_sistema || "letras") === t[0] ? " selected" : "") + ">" + t[1] + "</option>"; }).join("") +
      "</select></label></div>" +
      "<label>Avisar «últimas unidades» cuando el stock sea de <input type='number' name='stock_bajo' min='0' step='1' value='" + esc(configSitio.stock_bajo !== undefined ? configSitio.stock_bajo : 3) + "'> o menos</label></div>" +
      "<div class='p-bloque'><h3>Módulos visibles</h3>" +
      modulosDefs.map(function (m) {
        return "<label class='mod-fila'><span class='mod-info'><span class='mod-nombre'>" + m[1] + "</span><span class='mod-desc'>" + m[2] + "</span></span>" +
          "<input type='checkbox' class='mod-switch' name='mod_" + m[0] + "'" + (mods[m[0]] !== false ? " checked" : "") + "></label>";
      }).join("") + "</div>" +
      "<div class='p-bloque'><h3>Rasgos con iconos</h3><p class='p-ayuda'>Las cajitas con icono bajo tu presentación, como las de las webs de referencia. Agregá o quitá las que quieras (hasta 6).</p><div id='c-rasgos'>" +
      (rasgosSitio.length ? rasgosSitio.map(filaRasgo).join("") : filaRasgo(null)) +
      "</div><button type='button' class='btn btn-fantasma' id='c-rasgo-agregar'>+ Agregar rasgo</button></div>" +
      "<div class='p-bloque'><label class='mod-fila'><span class='mod-info'><span class='mod-nombre'>Sitio publicado</span><span class='mod-desc'>Visible para tus visitantes; si lo apagás, solo vos lo ves al editar</span></span>" +
      "<input type='checkbox' class='mod-switch' name='publicado'" + (sitio.publicado ? " checked" : "") + "></label>" +
      "<button class='btn btn-primario btn-bloque' type='submit'>Guardar cambios</button>" +
      "<p class='p-ok' id='ok-sitio'></p><p class='p-error' id='e-sitio'></p></div>" +
      "</form>" +
      "<aside class='c-previa'><div class='c-marco'>" +
      "<div class='c-marco-barra'><span class='c-puntos'><i></i><i></i><i></i></span><span class='c-marco-url'>" + esc(urlSitio) + "</span>" +
      "<button class='btn btn-fantasma btn-chico' type='button' id='c-recargar'>Recargar</button></div>" +
      "<iframe id='c-iframe' src='" + urlSitio + "' title='Vista previa de tu sitio' loading='lazy'></iframe></div>" +
      "<p class='p-nota'>Vista previa de tu sitio: se actualiza sola cuando guardás.</p></aside>" +
      "</div>";
    // resumen de contenido
    (async function () {
      var tablas = [["productos", "productos"], ["cursos", "cursos"], ["articulos", "artículos"], ["documentos", "documentos"], ["publicaciones", "publicaciones"]];
      var partes = await Promise.all(tablas.map(async function (tb) {
        var r = await TW.sb.from(tb[0]).select("id", { count: "exact", head: true }).eq("sitio_id", sitio.id);
        return "<span class='c-chip'>" + (r.count || 0) + " " + tb[1] + "</span>";
      }));
      var caja = $("#c-stats");
      if (caja) caja.innerHTML = partes.join("");
    })();
    $("#c-copiar").addEventListener("click", async function () {
      try { await navigator.clipboard.writeText(new URL("sitio/" + sitio.slug, location.href).href); $("#c-copiar").textContent = "Copiado"; }
      catch (e) { $("#c-copiar").textContent = "Copiá la dirección de arriba"; }
      setTimeout(function () { var b = $("#c-copiar"); if (b) b.textContent = "Copiar"; }, 2000);
    });
    function recargarPrevia() {
      var ifr = $("#c-iframe");
      if (ifr) ifr.src = "sitio/" + sitio.slug + "?t=" + Date.now();
    }
    $("#c-recargar").addEventListener("click", recargarPrevia);
    // cambio de dirección (slug) con advertencias
    $("#c-slug-revisar").addEventListener("click", function () {
      var nuevo = $("#c-slug-nuevo").value.trim().toLowerCase();
      var e = $("#e-slug"); e.textContent = ""; $("#ok-slug").textContent = "";
      if (!/^[a-z0-9-]{3,40}$/.test(nuevo)) { e.textContent = "La dirección solo puede tener letras minúsculas, números y guiones, entre 3 y 40 caracteres."; return; }
      if (nuevo === sitio.slug) { e.textContent = "Esa ya es tu dirección actual: no hay nada que cambiar."; return; }
      $("#c-slug-aviso").hidden = false;
      $("#c-slug-entiendo").checked = false;
      $("#c-slug-confirmar").disabled = true;
    });
    $("#c-slug-entiendo").addEventListener("change", function (ev) { $("#c-slug-confirmar").disabled = !ev.target.checked; });
    $("#c-slug-cancelar").addEventListener("click", function () { $("#c-slug-aviso").hidden = true; $("#c-slug-nuevo").value = sitio.slug; $("#e-slug").textContent = ""; });
    $("#c-slug-confirmar").addEventListener("click", async function () {
      var nuevo = $("#c-slug-nuevo").value.trim().toLowerCase();
      var e = $("#e-slug"); e.textContent = "";
      var ocupado = await TW.sb.from("sitios").select("id").eq("slug", nuevo).maybeSingle();
      if (ocupado.data) { e.textContent = "La dirección «" + nuevo + "» ya la usa otro sitio. Elegí otra."; return; }
      var r = await TW.sb.from("sitios").update({ slug: nuevo, slug_anterior: sitio.slug }).eq("id", sitio.id).select().maybeSingle();
      if (r.error || !r.data) { e.textContent = "No se pudo cambiar: " + (r.error ? r.error.message : "error desconocido"); return; }
      var viejo = sitio.slug;
      sitio = r.data;
      var nuevaAbs = new URL("sitio/" + nuevo, location.href).href;
      cont.querySelector(".c-url-texto").textContent = nuevaAbs;
      var abrir = cont.querySelector(".c-url a");
      if (abrir) abrir.setAttribute("href", "sitio/" + nuevo);
      cont.querySelector(".c-marco-url").textContent = "sitio/" + nuevo;
      $("#c-iframe").src = "sitio/" + nuevo;
      $("#c-slug-aviso").hidden = true;
      $("#ok-slug").textContent = "Dirección cambiada: ahora tu sitio es " + nuevaAbs + ". La anterior (" + viejo + ") redirige sola a la nueva.";
    });
    cont.querySelectorAll("[name=maqueta]").forEach(function (r) {
      r.addEventListener("change", function () {
        var mq = r.value;
        ["clasica", "premium"].forEach(function (x) {
          var caja = $("#paletas-" + x);
          if (caja) caja.hidden = x !== mq;
        });
        var grupo = $("#paletas-" + mq);
        if (grupo && !grupo.querySelector("[name=tema]:checked")) {
          var primero = grupo.querySelector("[name=tema]");
          if (primero) primero.checked = true;
        }
      });
    });
    var acT = $("#c-acento-texto"), acC = $("#c-acento-color");
    if (acT && acC) acC.addEventListener("input", function () { acT.value = acC.value; });
    [["#c-logo", "#c-logo-img"], ["#c-foto", "#c-foto-img"], ["#c-perfil", "#c-perfil-img"]].forEach(function (par) {
      var inp = $(par[0]), img = $(par[1]);
      if (inp && img) inp.addEventListener("input", function () { img.src = inp.value; img.hidden = !inp.value; });
    });
    var lFile = $("#c-logo-file"), lUrl = $("#c-logo"), lEst = $("#c-logo-estado"), lImg = $("#c-logo-img");
    if (lFile) lFile.addEventListener("change", function () {
      var arch = lFile.files[0];
      if (!arch) return;
      if (lEst) lEst.textContent = "Subiendo el logo…";
      subirCloudinary(arch, false, { max: 512 }).then(function (datos) {
        lUrl.value = datos.secure_url;
        if (lImg) { lImg.src = datos.secure_url; lImg.hidden = false; }
        if (lEst) lEst.textContent = "Logo subido. Tocá «Guardar sitio» para aplicarlo.";
      }).catch(function (e2) { if (lEst) lEst.textContent = "No se pudo subir: " + e2.message; });
    });
    var foFile = $("#c-foto-file"), foUrl = $("#c-foto"), foEst = $("#c-foto-estado"), foImg = $("#c-foto-img");
    if (foFile) foFile.addEventListener("change", function () {
      var arch = foFile.files[0];
      if (!arch) return;
      if (foEst) foEst.textContent = "Comprimiendo y subiendo…";
      subirCloudinary(arch, false, { max: 1600 }).then(function (datos) {
        foUrl.value = datos.secure_url;
        if (foImg) { foImg.src = datos.secure_url; foImg.hidden = false; }
        if (foEst) foEst.textContent = "Foto subida y comprimida. Tocá «Guardar sitio» para aplicarla.";
      }).catch(function (e2) { if (foEst) foEst.textContent = "No se pudo subir: " + e2.message; });
    });
    var pfFile = $("#c-perfil-file"), pfUrl = $("#c-perfil"), pfEst = $("#c-perfil-estado"), pfImg = $("#c-perfil-img");
    if (pfFile) pfFile.addEventListener("change", function () {
      var arch = pfFile.files[0];
      if (!arch) return;
      if (pfEst) pfEst.textContent = "Comprimiendo y subiendo…";
      subirCloudinary(arch, false, { max: 800 }).then(function (datos) {
        pfUrl.value = datos.secure_url;
        if (pfImg) { pfImg.src = datos.secure_url; pfImg.hidden = false; }
        if (pfEst) pfEst.textContent = "Foto subida y comprimida. Tocá «Guardar sitio» para aplicarla.";
      }).catch(function (e2) { if (pfEst) pfEst.textContent = "No se pudo subir: " + e2.message; });
    });
    var fFile = $("#c-fondo-file"), fUrl = $("#c-fondo-url"), fMini = $("#c-fondo-mini"), fEst = $("#c-fondo-estado");
    if (fFile) fFile.addEventListener("change", function () {
      var arch = fFile.files[0];
      if (!arch) return;
      fEst.textContent = "Subiendo la imagen…";
      subirCloudinary(arch, false, { max: 1920 }).then(function (datos) {
        fUrl.value = datos.secure_url;
        if (fMini) { fMini.src = datos.secure_url; fMini.hidden = false; }
        fEst.textContent = "Imagen subida. Tocá «Guardar sitio» para aplicarla.";
      }).catch(function (e2) { fEst.textContent = "No se pudo subir: " + e2.message; });
    });
    if (fUrl && fMini) fUrl.addEventListener("input", function () { fMini.src = fUrl.value; fMini.hidden = !fUrl.value; });
    var contRasgos = $("#c-rasgos"), btnRasgo = $("#c-rasgo-agregar");
    if (btnRasgo && contRasgos) btnRasgo.addEventListener("click", function () {
      if (contRasgos.querySelectorAll(".c-rasgo-fila").length >= 6) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = filaRasgo(null);
      contRasgos.appendChild(tmp.firstChild);
    });
    if (contRasgos) contRasgos.addEventListener("click", function (ev) {
      if (ev.target.classList.contains("c-rasgo-quitar")) ev.target.closest(".c-rasgo-fila").remove();
    });
    $("#f-sitio").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target);
      var nuevosMods = {};
      modulosDefs.forEach(function (m) { nuevosMods[m[0]] = !!f.get("mod_" + m[0]); });
      var rasgosNuevos = [];
      document.querySelectorAll(".c-rasgo-fila").forEach(function (fila) {
        var ti = fila.querySelector(".c-rasgo-titulo").value.trim();
        if (ti) rasgosNuevos.push({ icono: fila.querySelector(".c-rasgo-icono").value, titulo: ti });
      });
      var r = await TW.sb.from("sitios").update({
        nombre: f.get("nombre"), descripcion: f.get("descripcion") || "",
        quienes_somos: f.get("quienes_somos") || "", logo_url: f.get("logo_url") || null,
        foto_url: f.get("foto_url") || null, avatar_url: f.get("avatar_url") || null, whatsapp: f.get("whatsapp") || null,
        email: f.get("email") || null, tema: f.get("tema"), maqueta: f.get("maqueta") || "clasica",
        acento: f.get("acento") || null, footer_texto: f.get("footer_texto") || "",
        fondo_url: f.get("fondo_url") || null,
        rasgos: rasgosNuevos,
        rubro: f.get("rubro") || "general",
        config: Object.assign({}, sitio.config || {}, {
          avatar_visible: !!f.get("avatar_visible"),
          talle_sistema: f.get("talle_sistema") || "letras",
          stock_bajo: Number(f.get("stock_bajo")) || 0
        }),
        modulos: nuevosMods, publicado: !!f.get("publicado")
      }).eq("id", sitio.id).select().maybeSingle();
      if (r.error) { $("#e-sitio").textContent = "No se pudo guardar: " + r.error.message; return; }
      sitio = r.data;
      $("#ok-sitio").textContent = "Guardado. La vista previa ya muestra los cambios.";
      recargarPrevia();
    });
  }

  // ============================================================ cursos y lecciones
  function vistaCursos(cont) {
    var cfg = Object.assign({}, CFG.cursos, {
      extraBoton: "Lecciones",
      alExtra: function (cursoId) {
        var cfgLec = Object.assign({}, CFG.lecciones, {});
        cont.innerHTML = "";
        var volver = document.createElement("p");
        volver.innerHTML = "<a href='#' id='v-volver'>← Volver a los cursos</a>";
        cont.appendChild(volver);
        var caja = document.createElement("div");
        cont.appendChild(caja);
        crud(caja, cfgLec, { curso_id: cursoId });
        $("#v-volver").addEventListener("click", function (ev) { ev.preventDefault(); vistaCursos(cont); });
      }
    });
    crud(cont, cfg);
  }

  // ============================================================ feed
  async function vistaFeed(cont) {
    var rc = await TW.sb.from("cursos").select("id, titulo").eq("sitio_id", sitio.id).order("creado");
    var cursos = rc.data || [];
    cont.innerHTML = "<h2>Feed de novedades</h2><p class='bajada'>Lo público aparece en tu sitio y en la portada de la plataforma. Lo de curso, solo en el aula de ese curso.</p>" +
      "<div class='p-bloque'><form id='f-feed'>" +
      "<label>Texto <textarea name='texto' required></textarea></label>" +
      "<div class='c-campo'>Imagen (opcional)" +
      "<span class='c-img'><label class='btn btn-fantasma c-subir'>Subir imagen<input type='file' id='feed-img-file' accept='image/*' hidden></label>" +
      "<button type='button' class='c-url-toggle' data-url-toggle=''>o pegar una URL</button>" +
      "<input type='text' name='imagen_url' class='c-url-input' placeholder='https://…' hidden></span>" +
      "<span class='c-ayuda' id='feed-img-estado'>Tamaño sugerido: 1600 × 900 px. Al subirla se comprime sola, con buena calidad y poco peso.</span></div>" +
      "<div class='p-dos'><label>Alcance <select name='alcance'><option value='publico'>Público</option><option value='curso'>Solo alumnos de un curso</option></select></label>" +
      "<label>Curso (si es de curso) <select name='curso_id'><option value=''>—</option>" +
      cursos.map(function (c) { return "<option value='" + c.id + "'>" + esc(c.titulo) + "</option>"; }).join("") +
      "</select></label></div>" +
      "<button class='btn btn-primario' type='submit'>Publicar</button><p class='p-error' id='e-feed'></p></form></div>" +
      "<div class='p-bloque'><h3>Tus publicaciones</h3><div id='feed-lista'></div></div>";
    async function pintar() {
      var r = await TW.sb.from("publicaciones").select("*").eq("sitio_id", sitio.id).order("creada", { ascending: false }).limit(50);
      $("#feed-lista").innerHTML = (r.data || []).length ? r.data.map(function (p) {
        return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' + esc(p.texto.slice(0, 90)) + '</span><div class="detalle">' +
          (p.alcance === "publico" ? "Público" : "De curso") + " · " + new Date(p.creada).toLocaleDateString("es-AR") + "</div></div>" +
          '<button class="btn btn-peligro btn-chico" data-borrar-pub="' + p.id + '">Borrar</button></div>';
      }).join("") : '<p class="p-vacio">Sin publicaciones todavía.</p>';
    }
    var fiF = $("#feed-img-file");
    if (fiF) fiF.addEventListener("change", function () {
      var arch = fiF.files[0];
      if (!arch) return;
      var est = $("#feed-img-estado");
      if (est) est.textContent = "Comprimiendo y subiendo…";
      subirCloudinary(arch, false, { max: 1600 }).then(function (datos) {
        document.querySelector("#f-feed [name='imagen_url']").value = datos.secure_url;
        if (est) est.textContent = "Imagen subida y comprimida: se publica con el texto.";
      }).catch(function (e2) { if (est) est.textContent = "No se pudo subir: " + e2.message; });
    });
    $("#f-feed").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target);
      var alcance = f.get("alcance");
      var obj = {
        sitio_id: sitio.id, texto: f.get("texto"), imagen_url: f.get("imagen_url") || null,
        alcance: alcance, curso_id: alcance === "curso" ? (f.get("curso_id") || null) : null
      };
      if (alcance === "curso" && !obj.curso_id) { $("#e-feed").textContent = "Elegí el curso."; return; }
      var r = await TW.sb.from("publicaciones").insert(obj);
      if (r.error) { $("#e-feed").textContent = r.error.message; return; }
      ev.target.reset();
      pintar();
    });
    cont.addEventListener("click", async function (ev) {
      var b = ev.target.closest("[data-borrar-pub]");
      if (b) { await TW.sb.from("publicaciones").delete().eq("id", b.dataset.borrarPub); pintar(); }
    });
    pintar();
  }

  // ============================================================ alumnos
  async function vistaAlumnos(cont) {
    cont.innerHTML = "<h2>Alumnos</h2><p class='bajada'>La gente de tu sitio: miembros, solicitudes y suscripciones a tus cursos. Cuando un alumno paga por tu link, activalo acá.</p>" +
      "<div class='p-bloque'><h3>Miembros del sitio</h3><p class='p-ayuda'>Las personas registradas en TU sitio solamente: se suman solas cuando se suscriben a un curso o compran un documento, o cuando tocan «Unirse al sitio» en tu página. No quedan conectadas con otros sitios. Quitar a alguien de esta lista no cancela sus suscripciones ni sus accesos.</p><div id='mi-lista'></div></div>" +
      "<div class='p-bloque'><h3>Suscripciones</h3><div id='al-lista'></div></div>" +
      "<div class='p-bloque'><h3>Acceso a documentos pagos</h3><div id='doc-lista'></div>" +
      "<form id='f-doc'><div class='p-dos'><label>ID del alumno (su usuario) <input type='text' name='alumno_id' required></label>" +
      "<label>Documento <select name='documento_id' id='doc-select'></select></label></div>" +
      "<button class='btn btn-primario' type='submit'>Dar acceso</button><p class='p-error' id='e-doc'></p></form></div>";
    var rDocs = await TW.sb.from("documentos").select("id, titulo").eq("sitio_id", sitio.id).gt("precio", 0);
    $("#doc-select").innerHTML = (rDocs.data || []).map(function (d) {
      return "<option value='" + d.id + "'>" + esc(d.titulo) + "</option>";
    }).join("") || "<option value=''>Sin documentos pagos</option>";
    async function pintar() {
      var rm = await TW.sb.from("miembros").select("*, perfiles(nombre)")
        .eq("sitio_id", sitio.id).order("creado", { ascending: false });
      var rAct = await TW.sb.from("suscripciones").select("alumno_id").eq("sitio_id", sitio.id).eq("estado", "activa");
      var cursosPorAlumno = {};
      (rAct.data || []).forEach(function (x) { cursosPorAlumno[x.alumno_id] = (cursosPorAlumno[x.alumno_id] || 0) + 1; });
      var viaTexto = { manual: "se unió desde el sitio", suscripcion: "llegó por un curso", compra: "llegó por un documento" };
      $("#mi-lista").innerHTML = (rm.data || []).length ? rm.data.map(function (m) {
        var n = cursosPorAlumno[m.usuario_id] || 0;
        return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' +
          esc((m.perfiles && m.perfiles.nombre) || m.usuario_id) + '</span><div class="detalle">' +
          "Miembro desde el " + new Date(m.creado).toLocaleDateString("es-AR") + " · " + (viaTexto[m.origen] || m.origen) +
          (n ? " · " + n + (n === 1 ? " curso activo" : " cursos activos") : "") + "</div></div>" +
          '<button class="btn btn-peligro btn-chico" data-miembro-quitar="' + m.usuario_id + '">Quitar</button></div>';
      }).join("") : '<p class="p-vacio">Todavía no hay miembros. Se suman cuando alguien se une, se suscribe a un curso o compra un documento.</p>';
      var r = await TW.sb.from("suscripciones").select("*, perfiles(nombre), cursos(titulo)")
        .eq("sitio_id", sitio.id).order("creada", { ascending: false });
      $("#al-lista").innerHTML = (r.data || []).length ? r.data.map(function (s) {
        return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' +
          esc((s.perfiles && s.perfiles.nombre) || s.alumno_id) + '</span><div class="detalle">' +
          esc((s.cursos && s.cursos.titulo) || "") + " · pidió el " + new Date(s.creada).toLocaleDateString("es-AR") + "</div></div>" +
          "<select data-estado='" + s.id + "'>" +
          ["pendiente", "activa", "vencida", "cancelada"].map(function (e) {
            return "<option value='" + e + "'" + (s.estado === e ? " selected" : "") + ">" + e + "</option>";
          }).join("") + "</select></div>";
      }).join("") : '<p class="p-vacio">Sin suscripciones todavía.</p>';
      var rd = await TW.sb.from("accesos_documentos").select("*, perfiles(nombre), documentos(titulo)")
        .eq("sitio_id", sitio.id).order("creada", { ascending: false });
      $("#doc-lista").innerHTML = (rd.data || []).length ? rd.data.map(function (a2) {
        return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' +
          esc((a2.perfiles && a2.perfiles.nombre) || a2.alumno_id) + '</span><div class="detalle">' +
          esc((a2.documentos && a2.documentos.titulo) || "") + "</div></div>" +
          '<button class="btn btn-peligro btn-chico" data-quitar="' + a2.id + '">Quitar acceso</button></div>';
      }).join("") : '<p class="p-vacio">Sin accesos otorgados.</p>';
    }
    cont.addEventListener("change", async function (ev) {
      var sel = ev.target.closest("[data-estado]");
      if (sel) await TW.sb.from("suscripciones").update({ estado: sel.value }).eq("id", sel.dataset.estado);
    });
    cont.addEventListener("click", async function (ev) {
      var b = ev.target.closest("[data-quitar]");
      if (b) { await TW.sb.from("accesos_documentos").delete().eq("id", b.dataset.quitar); pintar(); }
      var bm = ev.target.closest("[data-miembro-quitar]");
      if (bm) { await TW.sb.from("miembros").delete().eq("sitio_id", sitio.id).eq("usuario_id", bm.dataset.miembroQuitar); pintar(); }
    });
    $("#f-doc").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target);
      var r = await TW.sb.from("accesos_documentos").insert({
        alumno_id: f.get("alumno_id"), documento_id: f.get("documento_id"), sitio_id: sitio.id, estado: "activa"
      });
      if (r.error) { $("#e-doc").textContent = "No se pudo: " + r.error.message; return; }
      ev.target.reset();
      pintar();
    });
    pintar();
  }

  // ============================================================ mi aprendizaje
  async function vistaAprendizaje(cont) {
    cont.innerHTML = "<h2>Mi aprendizaje</h2><p class='bajada'>Tus cursos y documentos como alumno, en todos los sitios de la plataforma. Tu ID de usuario es <strong>" + user.id + "</strong>: pasáselo al maestro si necesita darte un acceso a mano.</p><div id='ap-lista'></div>";
    var r = await TW.sb.from("suscripciones").select("*, cursos(titulo), sitios(slug, nombre)")
      .eq("alumno_id", user.id).order("creada", { ascending: false });
    var rd = await TW.sb.from("accesos_documentos").select("*, documentos(titulo), sitios(slug, nombre)")
      .eq("alumno_id", user.id).eq("estado", "activa");
    var html = (r.data || []).map(function (s) {
      var sitioS = s.sitios || {};
      return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' + esc((s.cursos && s.cursos.titulo) || "Curso") +
        '</span><div class="detalle">' + esc(sitioS.nombre || "") + " · estado: " + esc(s.estado) + "</div></div>" +
        (s.estado === "activa" ? '<a class="btn btn-primario btn-chico" href="curso/' + encodeURIComponent(sitioS.slug || "") + "/" + s.curso_id + '">Ir al aula</a>' : "") + "</div>";
    }).join("");
    html += (rd.data || []).map(function (a2) {
      return '<div class="p-fila-lista"><div class="crece"><span class="titulo">' + esc((a2.documentos && a2.documentos.titulo) || "Documento") +
        '</span><div class="detalle">' + esc((a2.sitios && a2.sitios.nombre) || "") + "</div></div>" +
        '<button class="btn btn-primario btn-chico" data-abrir-doc="' + a2.documento_id + '">Abrir</button></div>';
    }).join("");
    $("#ap-lista").innerHTML = html || '<p class="p-vacio">Todavía no estás suscripto a ningún curso.</p>';
    cont.addEventListener("click", async function (ev) {
      var b = ev.target.closest("[data-abrir-doc]");
      if (!b) return;
      b.textContent = "Abriendo…";
      var url = await TW.urlFirmada({ documento_id: b.dataset.abrirDoc });
      if (url) window.open(url, "_blank");
      b.textContent = url ? "Abrir" : "Sin acceso";
    });
  }

  // ============================================================ arranque
  if (!window.TW || !TW.sb) {
    $("#p-cargando").textContent = "Falta configurar la plataforma: creá config.js desde config.ejemplo.js con los datos de tu proyecto Supabase.";
  } else {
    if (location.hash === "#registro") {
      $("#tarjeta-registro").scrollIntoView();
    }
    refrescar();
  }
})();
