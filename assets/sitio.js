// TemploWeb · render del sitio publico de un maestro.
// Una sola plantilla para todos los tenants: lee el slug (?s= o /s/slug)
// y arma la pagina con los datos de Supabase.
(async function () {
  var main = document.getElementById("s-main");
  var nav = document.getElementById("s-nav");
  var footer = document.getElementById("s-footer");
  var params = new URLSearchParams(location.search);
  var slug = params.get("s");
  var artSlug = params.get("a");

  function error(msg) {
    main.innerHTML = '<p class="s-error">' + TW.esc(msg) + "</p>";
  }
  if (!window.TW || !TW.sb) { error("Este sitio todavia no esta conectado a la plataforma."); return; }
  if (!slug) { error("Falta indicar el sitio."); return; }

  var rs = await TW.sb.from("sitios").select("*").eq("slug", slug).eq("publicado", true).maybeSingle();
  if (rs.error || !rs.data) { error("Este sitio no existe o no esta publicado."); return; }
  var sitio = rs.data;
  var mod = sitio.modulos || {};
  document.title = sitio.nombre + " · TemploWeb";
  document.documentElement.dataset.tema = sitio.tema || "crepusculo";
  if (sitio.fondo_url) {
    var fondoHex = getComputedStyle(document.documentElement).getPropertyValue("--fondo").trim();
    if (!fondoHex || fondoHex.indexOf("var(") === 0) fondoHex = "#0a0c11";
    var veloA = (sitio.tema || "") === "premium" ? "58%" : "84%";
    var veloB = (sitio.tema || "") === "premium" ? "74%" : "90%";
    document.body.style.backgroundImage = "linear-gradient(color-mix(in srgb, " + fondoHex + " " + veloA + ", transparent), color-mix(in srgb, " + fondoHex + " " + veloB + ", transparent)), url(\"" + String(sitio.fondo_url).replace(/"/g, "") + "\")";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center top";
    document.body.style.backgroundAttachment = "fixed";
  }
  if (sitio.acento) document.documentElement.style.setProperty("--acento", sitio.acento);

  var base = "sitio.html?s=" + encodeURIComponent(slug);
  var wa = sitio.whatsapp ? "https://wa.me/" + String(sitio.whatsapp).replace(/[^0-9]/g, "") : null;

  // ---------- navegacion
  var enlaces = [];
  if (mod.quienes !== false) enlaces.push(["Quién soy", "#quienes"]);
  if (mod.destacados) enlaces.push(["Destacados", "#destacados"]);
  if (mod.productos !== false) enlaces.push(["Productos", "#productos"]);
  if (mod.cursos !== false) enlaces.push(["Cursos", "#cursos"]);
  if (mod.articulos !== false) enlaces.push(["Artículos", "#articulos"]);
  if (mod.documentos) enlaces.push(["Documentos", "#documentos"]);
  if (mod.feed) enlaces.push(["Novedades", "#novedades"]);
  nav.innerHTML = '<div class="s-nav-in"><a class="s-marca" href="' + base + '">' +
    (sitio.logo_url ? '<img src="' + TW.esc(sitio.logo_url) + '" alt="">' : "") +
    "<span>" + TW.esc(sitio.nombre) + '</span></a>' +
    '<button class="s-burger" id="s-burger" type="button" aria-label="Abrir el menú" aria-expanded="false"><span></span><span></span><span></span></button>' +
    (sitio.whatsapp ? '<a class="s-wa-movil" href="https://wa.me/' + String(sitio.whatsapp).replace(/[^0-9]/g, "") + '" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg></a>' : "") +
    '<nav class="s-links" id="s-links">' +
    enlaces.map(function (e) { return '<a href="' + e[1] + '">' + e[0] + "</a>"; }).join("") +
    (sitio.whatsapp ? '<a class="s-nav-cta" href="https://wa.me/' + String(sitio.whatsapp).replace(/[^0-9]/g, "") + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>WhatsApp</a>' : "") +
    '<a href="panel.html">Ingresar</a></nav></div>';
  var burger = document.getElementById("s-burger");
  if (burger) burger.addEventListener("click", function () {
    burger.setAttribute("aria-expanded", nav.classList.toggle("abierta") ? "true" : "false");
  });
  nav.querySelectorAll(".s-links a").forEach(function (a) {
    a.addEventListener("click", function () { nav.classList.remove("abierta"); if (burger) burger.setAttribute("aria-expanded", "false"); });
  });
  window.addEventListener("scroll", function () { nav.classList.toggle("con-sombra", window.scrollY > 8); }, { passive: true });

  // ---------- footer
  var redes = sitio.redes || {};
  var redesHtml = Object.keys(redes).map(function (k) {
    return '<a href="' + TW.esc(redes[k]) + '" target="_blank" rel="noopener">' + TW.esc(k) + "</a>";
  }).join(" · ");
  footer.innerHTML = '<div class="contenedor"><p><strong>' + TW.esc(sitio.nombre) + "</strong></p>" +
    (sitio.footer_texto ? "<p>" + TW.esc(sitio.footer_texto) + "</p>" : "") +
    (redesHtml ? "<p>" + redesHtml + "</p>" : "") +
    '<p class="credito">Sitio creado con <a href="index.html">TemploWeb</a></p></div>';
  if (wa) {
    var flot = document.createElement("a");
    flot.className = "s-wa-flotante";
    flot.href = wa;
    flot.target = "_blank";
    flot.rel = "noopener";
    flot.setAttribute("aria-label", "Escribir por WhatsApp");
    flot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z"/><path fill="currentColor" stroke="none" transform="translate(6.4 6.4) scale(0.48)" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
    document.body.appendChild(flot);
  }

  // ---------- vista de un articulo
  if (artSlug) {
    var ra = await TW.sb.from("articulos").select("*")
      .eq("sitio_id", sitio.id).eq("slug", artSlug).eq("publicado", true).maybeSingle();
    if (!ra.data) { error("Ese artículo no existe."); return; }
    var a = ra.data;
    document.title = a.titulo + " · " + sitio.nombre;
    main.innerHTML = '<section class="s-seccion"><div class="contenedor s-cuerpo-articulo">' +
      '<p><a href="' + base + '#articulos">← Volver</a></p>' +
      "<h1>" + TW.esc(a.titulo) + "</h1>" +
      '<p class="fecha">' + new Date(a.creado).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) + "</p>" +
      (a.imagen_url ? '<img class="s-foto" src="' + TW.esc(a.imagen_url) + '" alt="">' : "") +
      TW.md(a.cuerpo) + "</div></section>";
    return;
  }

  // ---------- portada del sitio
  var [rProd, rArt, rPromo, rCursos, rDocs, rFeed] = await Promise.all([
    TW.sb.from("productos").select("*").eq("sitio_id", sitio.id).eq("publicado", true).order("orden"),
    TW.sb.from("articulos").select("id, titulo, slug, extracto, imagen_url, creado").eq("sitio_id", sitio.id).eq("publicado", true).order("creado", { ascending: false }),
    TW.sb.from("promociones").select("*").eq("sitio_id", sitio.id).eq("activa", true).order("orden"),
    TW.sb.from("cursos").select("*").eq("sitio_id", sitio.id).eq("publicado", true).order("creado"),
    TW.sb.from("documentos_indice").select("*").eq("sitio_id", sitio.id).order("creado", { ascending: false }),
    TW.sb.from("publicaciones").select("*").eq("sitio_id", sitio.id).eq("alcance", "publico").order("creada", { ascending: false }).limit(20)
  ]);
  var productos = rProd.data || [];
  var destacados = productos.filter(function (p) { return p.destacado; });

  function tarjetaProducto(p) {
    var tipo = { fisico: "Producto físico", digital: "Producto digital", servicio: "Servicio" }[p.tipo] || "";
    var boton = p.link_pago
      ? '<a class="btn btn-acento" href="' + TW.esc(p.link_pago) + '" target="_blank" rel="noopener">Comprar</a>'
      : (wa ? '<a class="btn" href="' + wa + '" target="_blank" rel="noopener">Consultar</a>' : "");
    return '<article class="s-tarjeta">' +
      (p.imagen_url ? '<img src="' + TW.esc(p.imagen_url) + '" alt="">' : "") +
      '<div class="s-tarjeta-cuerpo"><p class="s-tipo">' + tipo + "</p><h3>" + TW.esc(p.nombre) + "</h3>" +
      "<p>" + TW.esc(p.descripcion) + "</p>" +
      (p.precio != null ? '<p class="s-precio">' + TW.precio(p.precio, p.moneda) + "</p>" : "") +
      boton + "</div></article>";
  }
  function seccion(id, titulo, bajada, contenido) {
    if (!contenido) return "";
    return '<section class="s-seccion" id="' + id + '"><div class="contenedor"><h2>' +
      titulo + "</h2>" + (bajada ? '<p class="bajada">' + bajada + "</p>" : "") + contenido + "</div></section>";
  }

  var ICONOS = {
    vela: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.2 1.6 2 2.7 2 4a2 2 0 1 1-4 0c0-1.3.8-2.4 2-4z"/><path d="M7 21v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5"/><path d="M4.5 21h15"/></svg>',
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></svg>',
    estrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    carta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 8.2l.9 1.9 2.1.3-1.5 1.5.35 2.1L12 13l-1.85 1-.35-2.1-1.5-1.5 2.1-.3z"/></svg>',
    libro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z"/><path d="M12 6.5v13"/></svg>',
    cristal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10l3 5-8 11L4 9z"/><path d="M4 9h16"/><path d="M12 20L9.2 9 12 4l2.8 5z"/></svg>',
    ojo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    llave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14.5" r="4.5"/><path d="M11.3 11.2L20 2.5"/><path d="M16.8 5.7l2.7 2.7"/></svg>',
    pocion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3h4"/><path d="M11 3v5.2L6.6 15a3 3 0 0 0 2.7 4.5h5.4a3 3 0 0 0 2.7-4.5L13 8.2V3"/><path d="M8.2 15h7.6"/></svg>',
    planta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7"/><path d="M12 14c0-3.8 2.8-5.8 6.5-5.8 0 3.8-2.3 6-6.5 5.8z"/><path d="M12 11.5c0-3.2-2.4-4.9-5.5-4.9 0 3.2 2 5.1 5.5 4.9z"/></svg>'
  };
  var rasgosSitio = Array.isArray(sitio.rasgos) ? sitio.rasgos : [];
  var html = "";

  // Quien soy: con foto, el hero es una portada a pantalla completa
  if (mod.quienes !== false) {
    var botonesContacto =
      '<div class="s-contacto">' +
      (wa ? '<a class="btn btn-acento" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : "") +
      (sitio.email ? '<a class="btn" href="mailto:' + TW.esc(sitio.email) + '">Email</a>' : "") +
      "</div>";
    if (sitio.foto_url) {
      html += '<section class="s-hero s-hero--portada" id="quienes">' +
        '<img class="s-portada-img" src="' + TW.esc(sitio.foto_url) + '" alt="">' +
        '<div class="contenedor s-hero-in"><div class="s-hero-texto">' +
        "<h1>" + TW.esc(sitio.nombre) + "</h1>" +
        "<p>" + TW.esc(sitio.descripcion) + "</p>" +
        botonesContacto +
        "</div></div></section>" +
        (sitio.quienes_somos ? '<div class="contenedor s-quienes"><div class="s-cuerpo-articulo">' + TW.md(sitio.quienes_somos) + "</div></div>" : "");
    } else {
      html += '<section class="s-hero" id="quienes"><div class="contenedor s-hero-in"><div>' +
        "<h1>" + TW.esc(sitio.nombre) + "</h1>" +
        "<p>" + TW.esc(sitio.descripcion) + "</p>" +
        (sitio.quienes_somos ? '<div class="s-cuerpo-articulo">' + TW.md(sitio.quienes_somos) + "</div>" : "") +
        botonesContacto +
        "</div></div></section>";
    }
  }

  // Rasgos con iconos, bajo la presentacion
  if (rasgosSitio.length) {
    html += '<div class="contenedor"><div class="s-rasgos">' + rasgosSitio.map(function (r) {
      return '<div class="s-rasgo"><span class="s-rasgo-ico">' + (ICONOS[r.icono] || ICONOS.estrella) + '</span><span class="s-rasgo-titulo">' + TW.esc(r.titulo || "") + "</span></div>";
    }).join("") + "</div></div>";
  }

  // Promociones
  if (mod.promociones && (rPromo.data || []).length) {
    html += seccion("promociones", "Promociones", "", '<div class="s-promos">' +
      rPromo.data.map(function (pr) {
        return '<div class="s-promo">' +
          (pr.imagen_url ? '<img src="' + TW.esc(pr.imagen_url) + '" alt="">' : "") +
          "<div><h3>" + TW.esc(pr.titulo) + "</h3><p>" + TW.esc(pr.descripcion) + "</p></div>" +
          (pr.link ? '<a class="btn btn-acento" href="' + TW.esc(pr.link) + '" target="_blank" rel="noopener">Ver</a>' : "") +
          "</div>";
      }).join("") + "</div>");
  }

  // Destacados
  if (mod.destacados && destacados.length) {
    html += seccion("destacados", "Destacados", "", '<div class="s-grilla">' + destacados.map(tarjetaProducto).join("") + "</div>");
  }

  // Productos y servicios
  if (mod.productos !== false && productos.length) {
    html += seccion("productos", "Productos y servicios", "", '<div class="s-grilla">' + productos.map(tarjetaProducto).join("") + "</div>");
  }

  // Cursos
  if (mod.cursos !== false && (rCursos.data || []).length) {
    html += seccion("cursos", "Cursos y talleres", "Clases en video y audio, para mirar a tu ritmo.", '<div class="s-grilla">' +
      rCursos.data.map(function (c) {
        return '<article class="s-tarjeta">' +
          (c.imagen_url ? '<img src="' + TW.esc(c.imagen_url) + '" alt="">' : "") +
          '<div class="s-tarjeta-cuerpo"><h3>' + TW.esc(c.titulo) + "</h3><p>" + TW.esc(c.descripcion) + "</p>" +
          (c.precio != null ? '<p class="s-precio">' + TW.precio(c.precio, c.moneda) + "</p>" : "") +
          '<a class="btn btn-acento" href="curso.html?s=' + encodeURIComponent(slug) + "&c=" + c.id + '">Ver el curso</a>' +
          "</div></article>";
      }).join("") + "</div>");
  }

  // Articulos
  if (mod.articulos !== false && (rArt.data || []).length) {
    html += seccion("articulos", "Artículos", "", '<div class="s-lista">' +
      rArt.data.map(function (a2) {
        return '<article class="s-articulo">' +
          (a2.imagen_url ? '<img class="s-articulo-img" src="' + TW.esc(a2.imagen_url) + '" alt="">' : "") +
          '<div class="s-articulo-cuerpo"><p class="fecha">' +
          new Date(a2.creado).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) + "</p>" +
          '<h3><a href="' + base + "&a=" + encodeURIComponent(a2.slug) + '">' + TW.esc(a2.titulo) + "</a></h3>" +
          "<p>" + TW.esc(a2.extracto) + "</p></div></article>";
      }).join("") + "</div>");
  }

  // Documentos (catalogo publico; el archivo se entrega segun acceso)
  var docs = rDocs.data || [];
  if (mod.documentos && docs.length) {
    var usuario = await TW.usuario();
    var misAccesos = {};
    if (usuario) {
      var racc = await TW.sb.from("accesos_documentos").select("documento_id").eq("alumno_id", usuario.id).eq("estado", "activa");
      (racc.data || []).forEach(function (x) { misAccesos[x.documento_id] = true; });
    }
    html += seccion("documentos", "Documentos", "Material de estudio del maestro.", '<div class="s-lista">' +
      docs.map(function (d) {
        var gratis = Number(d.precio) === 0;
        var accion;
        if (gratis) accion = '<button class="btn btn-acento" data-doc-gratis="' + d.id + '">Leer</button>';
        else if (misAccesos[d.id]) accion = '<button class="btn btn-acento" data-doc-abrir="' + d.id + '">Abrir</button>';
        else if (d.link_pago) accion = '<a class="btn btn-acento" href="' + TW.esc(d.link_pago) + '" target="_blank" rel="noopener">Comprar</a>';
        else accion = wa ? '<a class="btn" href="' + wa + '" target="_blank" rel="noopener">Consultar</a>' : "";
        return '<div class="s-doc"><div><h3>' + TW.esc(d.titulo) + "</h3><p>" + TW.esc(d.descripcion) + "</p></div>" +
          '<div class="lado"><span class="s-precio">' + TW.precio(d.precio, d.moneda) + "</span>" + accion + "</div></div>";
      }).join("") + "</div>");
  }

  // Feed publico del maestro
  if (mod.feed && (rFeed.data || []).length) {
    html += seccion("novedades", "Novedades", "", '<div class="s-feed">' +
      rFeed.data.map(function (p) {
        return '<article class="s-feed-item"><p class="fecha">' +
          new Date(p.creada).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) + "</p>" +
          "<p>" + TW.esc(p.texto) + "</p>" +
          (p.imagen_url ? '<img src="' + TW.esc(p.imagen_url) + '" alt="">' : "") + "</article>";
      }).join("") + "</div>");
  }

  main.innerHTML = html || '<p class="s-error">Este sitio todavia no publico contenido.</p>';
  if (["premium", "marfil"].indexOf(sitio.tema || "crepusculo") !== -1 && "IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var revelables = main.querySelectorAll(".s-tarjeta, .s-articulo, .s-doc, .s-feed-item");
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revelables.forEach(function (el, i) { el.classList.add("revelar"); el.style.transitionDelay = (i % 3) * 70 + "ms"; io.observe(el); });
    setTimeout(function () { revelables.forEach(function (el) { el.classList.add("visible"); }); }, 3000);
  }
  if ("IntersectionObserver" in window) {
    var porId = {};
    nav.querySelectorAll('.s-links a[href^="#"]').forEach(function (a) { porId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting && porId[e.target.id]) {
          Object.keys(porId).forEach(function (k) { porId[k].classList.remove("activo"); });
          porId[e.target.id].classList.add("activo");
        }
      });
    }, { rootMargin: "-38% 0px -55% 0px" });
    Object.keys(porId).forEach(function (id) { var sec = document.getElementById(id); if (sec) spy.observe(sec); });
  }

  // Acciones de documentos
  main.addEventListener("click", async function (ev) {
    var bg = ev.target.closest("[data-doc-gratis]");
    var ba = ev.target.closest("[data-doc-abrir]");
    if (bg) {
      var rd = await TW.sb.from("documentos").select("url_publica").eq("id", bg.dataset.docGratis).maybeSingle();
      if (rd.data && rd.data.url_publica) window.open(rd.data.url_publica, "_blank");
    }
    if (ba) {
      ba.textContent = "Abriendo…";
      var url = await TW.urlFirmada({ documento_id: ba.dataset.docAbrir });
      if (url) window.open(url, "_blank"); else ba.textContent = "Sin acceso";
    }
  });
})();
