// TemploWeb · pantalla de detalle de un documento.
// Descripcion completa, precio, entrega segun acceso (gratis o
// comprado), medios de pago efectivos con instrucciones y envio de
// comprobante. En el indice del sitio los pagos NO se muestran: todo
// vive en esta pantalla.
(async function () {
  var main = document.getElementById("s-main");
  var params = new URLSearchParams(location.search);
  var slug = params.get("s");
  var docId = params.get("d");
  if (!slug || !docId) { var mRuta = location.pathname.match(/^\/documento\/([^/?#]+)\/([^/?#]+)/); if (mRuta) { slug = slug || decodeURIComponent(mRuta[1]); docId = docId || decodeURIComponent(mRuta[2]); } }
  function error(msg) { main.innerHTML = '<p class="s-error">' + TW.esc(msg) + "</p>"; if (window.__finSplash) window.__finSplash(); }
  if (!window.TW || !TW.sb) { error("La plataforma todavia no esta conectada."); return; }
  if (!slug || !docId) { error("Falta indicar el documento."); return; }

  var rs = await TW.sb.from("sitios").select("*").eq("slug", slug).eq("publicado", true).maybeSingle();
  if (!rs.data) {
    var ra = await TW.sb.from("sitios").select("slug").eq("slug_anterior", slug).eq("publicado", true).maybeSingle();
    if (ra.data && ra.data.slug) { location.replace("/documento/" + encodeURIComponent(ra.data.slug) + "/" + encodeURIComponent(docId)); return; }
    error("Este sitio no existe."); return;
  }
  var sitio = rs.data;
  document.documentElement.dataset.tema = sitio.tema || "crepusculo";
  document.documentElement.dataset.maqueta = sitio.maqueta ? (sitio.maqueta === "premium" ? "premium" : sitio.tema || "crepusculo") : (["dorado", "medianoche", "violeta", "esmeralda", "terracota"].indexOf(sitio.tema || "crepusculo") !== -1 ? "premium" : (sitio.tema || "crepusculo"));
  try { localStorage.setItem("tw_tema_" + sitio.slug, JSON.stringify({ tema: document.documentElement.dataset.tema, maqueta: document.documentElement.dataset.maqueta })); } catch (e) {}
  if (sitio.acento) document.documentElement.style.setProperty("--acento", sitio.acento);
  if (window.TW && TW.splashSitio) TW.splashSitio(sitio);
  document.getElementById("s-nav").innerHTML =
    '<div class="s-nav-in"><a class="s-marca" href="/sitio/' + encodeURIComponent(slug) + '">' +
    TW.esc(sitio.nombre) + '</a><nav class="s-links"><span class="s-sesion" id="s-sesion"><a href="/panel.html">Ingresar</a></span></nav></div>';
  TW.pintarSesionSitio(sitio);
  document.getElementById("s-footer").innerHTML =
    '<div class="contenedor"><p class="credito">Sitio creado con <a href="/index.html">' + TW.esc((TW.marcaNombre && TW.marcaNombre()) || "esta plataforma") + '</a></p></div>';

  var rd = await TW.sb.from("documentos_indice").select("*").eq("id", docId).eq("sitio_id", sitio.id).maybeSingle();
  if (!rd.data) { error("Este documento no existe."); return; }
  var doc = rd.data;
  document.title = doc.titulo + " · " + sitio.nombre;

  var usuario = await TW.usuario();
  var esDueno = usuario && usuario.id === sitio.dueno_id;
  var acceso = !!esDueno;
  if (usuario && !esDueno) {
    var racc = await TW.sb.from("accesos_documentos").select("id").eq("alumno_id", usuario.id).eq("documento_id", doc.id).eq("estado", "activa").maybeSingle();
    acceso = !!racc.data;
  }
  var gratis = Number(doc.precio) === 0;
  var wa = sitio.whatsapp ? "https://wa.me/" + String(sitio.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent("Hola, me interesa el documento: " + doc.titulo) : "";

  var accionesHtml = "";
  if (gratis) {
    accionesHtml = '<button class="btn btn-acento" id="dd-leer" type="button">Leer / Descargar</button>';
  } else if (acceso) {
    accionesHtml = '<button class="btn btn-acento" id="dd-abrir" type="button">Abrir documento</button>';
  } else if (doc.link_pago) {
    accionesHtml = '<a class="btn btn-acento" href="' + TW.esc(doc.link_pago) + '" target="_blank" rel="noopener">Comprar ahora</a>' +
      (wa ? ' <a class="btn" href="' + wa + '" target="_blank" rel="noopener">Consultar por WhatsApp</a>' : "");
  } else if (wa) {
    accionesHtml = '<a class="btn btn-acento" href="' + wa + '" target="_blank" rel="noopener">Consultar por WhatsApp</a>';
  }

  var pagosHtml = "";
  var comprobanteHtml = "";
  if (!gratis && !acceso) {
    var metodos = TW.metodosEfectivos(doc, sitio.config);
    pagosHtml = TW.htmlPagosInteractivo(metodos, sitio.config && sitio.config.pais, doc.instrucciones_pago);
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

  var infoDoc =
    '<p class="s-tipo">Documento</p><h1>' + TW.esc(doc.titulo) + "</h1>" +
    (doc.descripcion ? '<div class="s-detalle-desc">' + TW.textoRico(doc.descripcion) + "</div>" : "") +
    '<p class="s-precio s-precio-grande">' + (gratis ? "Gratis" : TW.precio(doc.precio, doc.moneda)) + "</p>" +
    (acceso && !gratis ? '<p><span class="s-badge">Ya es tuyo</span></p>' : "") +
    '<div class="s-detalle-acciones">' + accionesHtml + "</div>" +
    pagosHtml + comprobanteHtml;
  main.innerHTML =
    '<section class="s-seccion"><div class="contenedor">' +
    '<p><a href="/sitio/' + encodeURIComponent(slug) + '#documentos">← Todos los documentos</a></p>' +
    (doc.imagen_url
      ? '<div class="s-detalle"><div class="s-detalle-media"><img class="s-detalle-img" src="' + TW.esc(doc.imagen_url) + '" alt=""></div><div class="s-detalle-info">' + infoDoc + "</div></div>"
      : infoDoc) +
    "</div></section>";
  TW.conectarPagosInteractivo(main.querySelector(".pg"), sitio.config && sitio.config.pais);
  if (window.__finSplash) window.__finSplash();

  var btnLeer = document.getElementById("dd-leer");
  if (btnLeer) {
    btnLeer.addEventListener("click", async function () {
      btnLeer.textContent = "Abriendo…";
      var r = await TW.sb.from("documentos").select("url_publica").eq("id", doc.id).maybeSingle();
      if (r.data && r.data.url_publica) { window.open(r.data.url_publica, "_blank"); btnLeer.textContent = "Leer / Descargar"; }
      else btnLeer.textContent = "El archivo todavía no está cargado";
    });
  }
  var btnAbrir = document.getElementById("dd-abrir");
  if (btnAbrir) {
    btnAbrir.addEventListener("click", async function () {
      btnAbrir.textContent = "Abriendo…";
      var url = await TW.urlFirmada({ documento_id: doc.id });
      if (url) { window.open(url, "_blank"); btnAbrir.textContent = "Abrir documento"; }
      else btnAbrir.textContent = "Sin acceso";
    });
  }
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
          sitio_id: sitio.id, alumno_id: usuario.id, documento_id: doc.id,
          archivo_url: datos.secure_url,
          nota: document.getElementById("comp-nota").value.trim()
        });
        if (r.error) throw new Error(r.error.message);
        est.textContent = "Comprobante enviado. El maestro lo revisa y te da el acceso.";
        btnComp.textContent = "Enviado";
      } catch (e) {
        est.textContent = "No se pudo enviar: " + e.message;
        btnComp.disabled = false;
      }
    });
  }
})();
