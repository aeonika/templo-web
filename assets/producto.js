// TemploWeb · pantalla de detalle de un producto o servicio.
// Galeria de imagenes, descripcion completa, precio, talles y stock,
// medios de pago efectivos (del sitio, propios o ambos) con las
// instrucciones de pago, y envio de comprobante para clientes.
(async function () {
  var main = document.getElementById("s-main");
  var params = new URLSearchParams(location.search);
  var slug = params.get("s");
  var prodId = params.get("p");
  if (!slug || !prodId) { var mRuta = location.pathname.match(/^\/producto\/([^/?#]+)\/([^/?#]+)/); if (mRuta) { slug = slug || decodeURIComponent(mRuta[1]); prodId = prodId || decodeURIComponent(mRuta[2]); } }
  function error(msg) { main.innerHTML = '<p class="s-error">' + TW.esc(msg) + "</p>"; if (window.__finSplash) window.__finSplash(); }
  if (!window.TW || !TW.sb) { error("La plataforma todavia no esta conectada."); return; }
  if (!slug || !prodId) { error("Falta indicar el producto."); return; }

  var rs = await TW.sb.from("sitios").select("*").eq("slug", slug).eq("publicado", true).maybeSingle();
  if (!rs.data) {
    var ra = await TW.sb.from("sitios").select("slug").eq("slug_anterior", slug).eq("publicado", true).maybeSingle();
    if (ra.data && ra.data.slug) { location.replace("/producto/" + encodeURIComponent(ra.data.slug) + "/" + encodeURIComponent(prodId)); return; }
    error("Este sitio no existe."); return;
  }
  var sitio = rs.data;
  document.documentElement.dataset.tema = sitio.tema || "crepusculo";
  document.documentElement.dataset.maqueta = sitio.maqueta ? (sitio.maqueta === "premium" ? "premium" : sitio.maqueta === "aurora" ? "aurora" : sitio.maqueta === "corporativa" ? "corporativa" : sitio.maqueta === "urbana" ? "urbana" : sitio.maqueta === "abismo" ? "abismo" : sitio.tema || "crepusculo") : (["dorado", "medianoche", "violeta", "esmeralda", "terracota"].indexOf(sitio.tema || "crepusculo") !== -1 ? "premium" : (sitio.tema || "crepusculo"));
  try { localStorage.setItem("tw_tema_" + sitio.slug, JSON.stringify({ tema: document.documentElement.dataset.tema, maqueta: document.documentElement.dataset.maqueta })); } catch (e) {}
  if (sitio.acento) {
    document.documentElement.style.setProperty("--acento", sitio.acento);
    var hexA = sitio.acento.replace("#", "");
    if (hexA.length === 3) hexA = hexA.split("").map(function (c) { return c + c; }).join("");
    var lumA = (0.2126 * parseInt(hexA.substr(0, 2), 16) + 0.7152 * parseInt(hexA.substr(2, 2), 16) + 0.0722 * parseInt(hexA.substr(4, 2), 16)) / 255;
    document.documentElement.style.setProperty("--acento-texto", lumA > 0.6 ? "#191407" : "#ffffff");
  }
  if (window.TW && TW.splashSitio) TW.splashSitio(sitio);
  document.getElementById("s-nav").innerHTML =
    '<div class="s-nav-in"><a class="s-marca" href="/sitio/' + encodeURIComponent(slug) + '">' +
    TW.esc(sitio.nombre) + '</a><nav class="s-links"><span class="s-sesion" id="s-sesion"><a href="/panel.html">Ingresar</a></span></nav></div>';
  TW.pintarSesionSitio(sitio);
  document.getElementById("s-footer").innerHTML =
    '<div class="contenedor"><p><strong>' + TW.esc(sitio.nombre) + '</strong></p>' + TW.pieContacto(sitio) +
    '<p class="credito">Sitio creado con <a href="/index.html">' + TW.esc((TW.marcaNombre && TW.marcaNombre()) || "esta plataforma") + '</a></p></div>';

  var rp = await TW.sb.from("productos").select("*").eq("id", prodId).eq("sitio_id", sitio.id).eq("publicado", true).maybeSingle();
  if (!rp.data) { error("Este producto no existe."); return; }
  var p = rp.data;
  document.title = p.nombre + " · " + sitio.nombre;

  var usuario = await TW.usuario();
  var wa = sitio.whatsapp ? "https://wa.me/" + String(sitio.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent("Hola, me interesa: " + p.nombre) : "";

  var tipo = { fisico: "Producto físico", digital: "Producto digital", servicio: "Servicio" }[p.tipo] || "";
  var ahora = Date.now();
  var finOferta = p.oferta_hasta ? new Date(p.oferta_hasta).getTime() : null;
  var enOferta = p.precio != null && p.precio_oferta != null && Number(p.precio_oferta) < Number(p.precio) && (!finOferta || finOferta > ahora);
  var precioHtml = "";
  if (p.precio != null) {
    if (enOferta) {
      var dto = Math.round((1 - Number(p.precio_oferta) / Number(p.precio)) * 100);
      precioHtml = '<p class="s-precio s-precio-grande"><span class="s-tachado">' + TW.precio(p.precio, p.moneda) + '</span> <span class="s-oferta">' + TW.precio(p.precio_oferta, p.moneda) + '</span> <span class="s-badge s-badge-oferta">−' + dto + "%</span></p>" +
        (finOferta ? '<p class="s-pagos-nota">Oferta flash hasta el ' + new Date(p.oferta_hasta).toLocaleDateString("es") + ".</p>" : "");
    } else {
      precioHtml = '<p class="s-precio s-precio-grande">' + TW.precio(p.precio, p.moneda) + "</p>";
    }
  }
  var st = null;
  if (Array.isArray(p.variantes) && p.variantes.length) st = p.variantes.reduce(function (a, v) { return a + (Number(v.s) || 0); }, 0);
  else if (p.stock !== null && p.stock !== undefined) st = Number(p.stock);
  var umbral = (sitio.config && Number(sitio.config.stock_bajo)) || 3;
  var agotado = st !== null && st <= 0;
  var stockHtml = "";
  if (agotado) stockHtml = '<p><span class="s-badge s-badge-agotado">Agotado</span></p>';
  else if (st !== null && st <= umbral) stockHtml = '<p><span class="s-badge s-badge-ultimas">¡Últimas ' + st + "!</span></p>";
  var tallesHtml = "";
  if (Array.isArray(p.variantes) && p.variantes.length) {
    tallesHtml = '<div class="s-talles" aria-label="Talles">' + p.variantes.map(function (v) {
      return '<span class="s-talle' + (Number(v.s) > 0 ? "" : " s-talle-sin") + '">' + TW.esc(v.t) + "</span>";
    }).join("") + "</div>";
  }

  // Servicios: una sola imagen. Productos: principal + galeria, con un
  // maximo de 3 imagenes en total.
  var imagenes = [];
  if (p.imagen_url) imagenes.push(p.imagen_url);
  if (p.tipo !== "servicio" && Array.isArray(p.galeria)) p.galeria.forEach(function (u) { if (u && imagenes.indexOf(u) < 0) imagenes.push(u); });
  imagenes = imagenes.slice(0, 3);
  var galeriaHtml = "";
  if (imagenes.length) {
    galeriaHtml = '<div class="s-detalle-media"><img class="s-detalle-img" id="dprod-img" src="' + TW.esc(TW.imgUrl(imagenes[0], 1100)) + '" alt="">' +
      (imagenes.length > 1 ? '<div class="s-galeria">' + imagenes.map(function (u, i) {
        return '<button type="button" class="s-galeria-btn' + (i === 0 ? " activa" : "") + '" data-dprod-src="' + TW.esc(TW.imgUrl(u, 1100)) + '"><img src="' + TW.esc(TW.imgUrl(u, 200)) + '" alt=""></button>';
      }).join("") + "</div>" : "") + "</div>";
  }

  var metodos = TW.metodosEfectivos(p, sitio.config);
  var pagosHtml = "";
  if (Number(p.precio) > 0) {
    pagosHtml = TW.htmlPagosInteractivo(metodos, sitio.config && sitio.config.pais, p.instrucciones_pago);
  }
  var comprobanteHtml = "";
  if (Number(p.precio) > 0) {
    if (usuario) {
      comprobanteHtml = '<div class="s-comp"><p class="s-pagos-t">¿Ya pagaste? Enviá tu comprobante:</p>' +
        '<div class="s-comp-fila"><input type="file" id="comp-file" accept="image/*,.pdf">' +
        '<input type="text" id="comp-nota" placeholder="Nota (opcional): servicio, monto…">' +
        '<button class="btn btn-acento" id="comp-enviar" type="button">Enviar comprobante</button></div>' +
        '<p class="s-comp-estado" id="comp-estado"></p></div>';
    } else {
      comprobanteHtml = '<p class="s-pagos-nota">Si ya pagaste, <a href="/panel.html?s=' + encodeURIComponent(slug) + '">ingresá a tu cuenta</a> para enviar el comprobante.</p>';
    }
  }
  var accionHtml = agotado
    ? '<span class="btn s-btn-agotado">Sin stock</span>'
    : (p.link_pago
      ? '<a class="btn btn-acento" href="' + TW.esc(p.link_pago) + '" target="_blank" rel="noopener">Comprar ahora</a>'
      : (wa ? '<a class="btn btn-acento" href="' + wa + '" target="_blank" rel="noopener">Consultar por WhatsApp</a>' : ""));

  main.innerHTML =
    '<section class="s-seccion"><div class="contenedor">' +
    '<p><a href="/sitio/' + encodeURIComponent(slug) + '#productos">← Todos los productos</a></p>' +
    '<div class="s-detalle">' + galeriaHtml +
    '<div class="s-detalle-info"><p class="s-tipo">' + tipo + "</p><h1>" + TW.esc(p.nombre) + "</h1>" +
    (p.descripcion ? '<div class="s-detalle-desc">' + TW.textoRico(p.descripcion) + "</div>" : "") +
    precioHtml + stockHtml + tallesHtml +
    '<div class="s-detalle-acciones">' + accionHtml + "</div>" +
    pagosHtml + comprobanteHtml +
    "</div></div></div></section>";
  TW.conectarPagosInteractivo(main.querySelector(".pg"), sitio.config && sitio.config.pais);
  if (window.__finSplash) window.__finSplash();

  var imgGrande = document.getElementById("dprod-img");
  main.querySelectorAll("[data-dprod-src]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (imgGrande) imgGrande.src = b.dataset.dprodSrc;
      main.querySelectorAll("[data-dprod-src]").forEach(function (x) { x.classList.toggle("activa", x === b); });
    });
  });

  var btnComp = document.getElementById("comp-enviar");
  if (btnComp) {
    btnComp.addEventListener("click", async function () {
      var est = document.getElementById("comp-estado");
      var arch = document.getElementById("comp-file").files[0];
      if (!arch) { est.textContent = "Elegí el archivo del comprobante (foto o PDF)."; return; }
      btnComp.disabled = true;
      est.textContent = "Subiendo el comprobante…";
      try {
        var datos = await TW.subirComprobante(arch);
        var r = await TW.sb.from("comprobantes").insert({
          sitio_id: sitio.id, alumno_id: usuario.id, producto_id: p.id,
          archivo_url: datos.secure_url,
          nota: document.getElementById("comp-nota").value.trim()
        });
        if (r.error) throw new Error(r.error.message);
        est.textContent = "Comprobante enviado. El vendedor lo revisa y te contacta.";
        btnComp.textContent = "Enviado";
      } catch (e) {
        est.textContent = "No se pudo enviar: " + e.message;
        btnComp.disabled = false;
      }
    });
  }
})();
