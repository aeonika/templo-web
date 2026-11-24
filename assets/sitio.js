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
    TW.esc(sitio.nombre) + '</a><nav class="s-links">' +
    enlaces.map(function (e) { return '<a href="' + e[1] + '">' + e[0] + "</a>"; }).join("") +
    '<a href="panel.html">Ingresar</a></nav></div>';

  // ---------- footer
  var redes = sitio.redes || {};
  var redesHtml = Object.keys(redes).map(function (k) {
    return '<a href="' + TW.esc(redes[k]) + '" target="_blank" rel="noopener">' + TW.esc(k) + "</a>";
  }).join(" · ");
  footer.innerHTML = '<div class="contenedor"><p><strong>' + TW.esc(sitio.nombre) + "</strong></p>" +
    (sitio.footer_texto ? "<p>" + TW.esc(sitio.footer_texto) + "</p>" : "") +
    (redesHtml ? "<p>" + redesHtml + "</p>" : "") +
    '<p class="credito">Sitio creado con <a href="index.html">TemploWeb</a></p></div>';

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
