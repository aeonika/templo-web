// TemploWeb · aula de un curso.
// Muestra el indice de lecciones y entrega el contenido segun el acceso:
// preview para todos, curso completo para alumnos con suscripcion activa
// y para el dueno. El material pago sale de Cloudinary con URL firmada
// de vencimiento corto (ver api/firmar.js).
(async function () {
  var main = document.getElementById("s-main");
  var params = new URLSearchParams(location.search);
  var slug = params.get("s");
  var cursoId = params.get("c");
  if (!slug || !cursoId) { var mRuta = location.pathname.match(/^\/curso\/([^/?#]+)\/([^/?#]+)/); if (mRuta) { slug = slug || decodeURIComponent(mRuta[1]); cursoId = cursoId || decodeURIComponent(mRuta[2]); } }
  function error(msg) { main.innerHTML = '<p class="s-error">' + TW.esc(msg) + "</p>"; if (window.__finSplash) window.__finSplash(); }
  if (!window.TW || !TW.sb) { error("La plataforma todavia no esta conectada."); return; }
  if (!slug || !cursoId) { error("Falta indicar el curso."); return; }

  var rs = await TW.sb.from("sitios").select("*").eq("slug", slug).eq("publicado", true).maybeSingle();
  if (!rs.data) {
    // El sitio pudo haber cambiado de dirección: la anterior redirige a la nueva.
    var ra = await TW.sb.from("sitios").select("slug").eq("slug_anterior", slug).eq("publicado", true).maybeSingle();
    if (ra.data && ra.data.slug) { location.replace("/curso/" + encodeURIComponent(ra.data.slug) + "/" + encodeURIComponent(cursoId)); return; }
    error("Este sitio no existe."); return;
  }
  var sitio = rs.data;
  document.documentElement.dataset.tema = sitio.tema || "crepusculo";
  document.documentElement.dataset.maqueta = sitio.maqueta ? (sitio.maqueta === "premium" ? "premium" : sitio.tema || "crepusculo") : (["dorado", "medianoche", "violeta", "esmeralda", "terracota"].indexOf(sitio.tema || "crepusculo") !== -1 ? "premium" : (sitio.tema || "crepusculo"));
  if (sitio.acento) document.documentElement.style.setProperty("--acento", sitio.acento);
  if (window.TW && TW.splashSitio) TW.splashSitio(sitio);
  document.getElementById("s-nav").innerHTML =
    '<div class="s-nav-in"><a class="s-marca" href="/sitio/' + encodeURIComponent(slug) + '">' +
    TW.esc(sitio.nombre) + '</a><nav class="s-links"><span class="s-sesion" id="s-sesion"><a href="/panel.html">Ingresar</a></span></nav></div>';
  TW.pintarSesionSitio(sitio);
  document.getElementById("s-footer").innerHTML =
    '<div class="contenedor"><p class="credito">Sitio creado con <a href="/index.html">TemploWeb</a></p></div>';

  var rc = await TW.sb.from("cursos").select("*").eq("id", cursoId).eq("sitio_id", sitio.id).eq("publicado", true).maybeSingle();
  if (!rc.data) { error("Este curso no existe."); return; }
  var curso = rc.data;
  document.title = curso.titulo + " · " + sitio.nombre;

  var usuario = await TW.usuario();
  var esDueno = usuario && usuario.id === sitio.dueno_id;
  var suscripcion = null;
  if (usuario && !esDueno) {
    var rsu = await TW.sb.from("suscripciones").select("*")
      .eq("alumno_id", usuario.id).eq("curso_id", curso.id).maybeSingle();
    suscripcion = rsu.data || null;
  }
  var accesoTotal = esDueno || (suscripcion && suscripcion.estado === "activa");

  var rl = await TW.sb.from("lecciones_indice").select("*").eq("curso_id", curso.id).order("orden");
  var lecciones = rl.data || [];

  // Medios de cobro del sitio (Panel > Mi sitio > Medios de cobro):
  // link de Mercado Pago, link de PayPal y QR cargado por el maestro.
  var cfgPagos = sitio.config || {};
  var mediosHtml = "";
  if (cfgPagos.pago_mp || cfgPagos.pago_paypal || cfgPagos.pago_qr) {
    mediosHtml = '<div class="s-pagos"><p class="s-pagos-t">Medios de pago:</p><div class="s-pagos-btns">' +
      (cfgPagos.pago_mp ? '<a class="btn" href="' + TW.esc(cfgPagos.pago_mp) + '" target="_blank" rel="noopener">Mercado Pago</a>' : "") +
      (cfgPagos.pago_paypal ? '<a class="btn" href="' + TW.esc(cfgPagos.pago_paypal) + '" target="_blank" rel="noopener">PayPal</a>' : "") +
      "</div>" +
      (cfgPagos.pago_qr ? '<img class="s-qr" src="' + TW.esc(cfgPagos.pago_qr) + '" alt="Código QR para pagar"><p class="s-pagos-nota">Escaneá el QR para pagar y después solicitá el acceso.</p>' : "") +
      "</div>";
  }
  var estadoHtml;
  if (esDueno) {
    estadoHtml = "<p>Estás viendo tu propio curso, con acceso completo.</p>";
  } else if (accesoTotal) {
    estadoHtml = "<p>Tenés acceso completo a este curso.</p>";
  } else if (suscripcion && suscripcion.estado === "pendiente") {
    estadoHtml = "<p>Tu solicitud de acceso está pendiente de aprobación del maestro.</p>" + mediosHtml;
  } else if (!usuario) {
    estadoHtml = "<p>Para suscribirte, primero ingresá o creá tu cuenta.</p>" +
      '<a class="btn btn-acento" href="/panel.html?s=' + encodeURIComponent(slug) + '">Ingresar</a>' +
      (curso.link_pago ? '<a class="btn" href="' + TW.esc(curso.link_pago) + '" target="_blank" rel="noopener">Pagar la suscripción</a>' : "");
  } else {
    estadoHtml = "<p>Todavía no estás suscripto a este curso.</p>" +
      (curso.link_pago ? '<a class="btn btn-acento" href="' + TW.esc(curso.link_pago) + '" target="_blank" rel="noopener">Pagar la suscripción</a>' : "") +
      '<button class="btn" id="btn-solicitar">Solicitar acceso</button>' + mediosHtml;
  }

  main.innerHTML =
    '<section class="aula-cabecera"><div class="contenedor">' +
    '<p><a href="/sitio/' + encodeURIComponent(slug) + '#cursos">← Todos los cursos</a></p>' +
    "<h1>" + TW.esc(curso.titulo) + "</h1>" +
    (curso.descripcion ? "<p>" + TW.esc(curso.descripcion) + "</p>" : "") +
    (curso.precio != null ? '<p class="s-precio">' + TW.precio(curso.precio, curso.moneda) + "</p>" : "") +
    '<div class="aula-estado">' + estadoHtml + "</div>" +
    '<div id="aula-player"></div>' +
    '<div class="aula-lecciones">' +
    lecciones.map(function (l, i) {
      var libre = l.es_preview || accesoTotal;
      return '<button class="aula-leccion" data-leccion="' + l.id + '">' +
        '<span class="num">' + (i + 1) + '</span><span>' + TW.esc(l.titulo) + "</span>" +
        (libre ? "" : '<span class="candado">🔒</span>') +
        '<span class="tipo">' + (l.es_preview ? "Vista previa · " : "") + l.tipo + "</span></button>";
    }).join("") +
    "</div>" +
    '<div id="aula-feed"></div>' +
    "</div></section>";

  var btnSol = document.getElementById("btn-solicitar");
  if (btnSol) {
    btnSol.addEventListener("click", async function () {
      btnSol.disabled = true;
      var r = await TW.sb.from("suscripciones").insert({
        alumno_id: usuario.id, curso_id: curso.id, sitio_id: sitio.id, estado: "pendiente"
      });
      btnSol.textContent = r.error ? "Ya pediste acceso" : "Solicitud enviada";
    });
  }

  // Feed privado del curso (RLS: solo lo leen alumnos y el dueno)
  var rf = await TW.sb.from("publicaciones").select("*")
    .eq("curso_id", curso.id).eq("alcance", "curso").order("creada", { ascending: false }).limit(20);
  if (rf.data && rf.data.length) {
    document.getElementById("aula-feed").innerHTML =
      '<section class="s-seccion"><h2>Novedades del curso</h2><div class="s-feed">' +
      rf.data.map(function (p) {
        return '<article class="s-feed-item"><p class="fecha">' +
          new Date(p.creada).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + "</p><p>" +
          TW.esc(p.texto) + "</p>" +
          (p.imagen_url ? '<img src="' + TW.esc(p.imagen_url) + '" alt="">' : "") + "</article>";
      }).join("") + "</div></section>";
  }

  // Reproductor
  var player = document.getElementById("aula-player");
  main.addEventListener("click", async function (ev) {
    var btn = ev.target.closest("[data-leccion]");
    if (!btn) return;
    var id = btn.dataset.leccion;
    var meta = lecciones.find(function (l) { return l.id === id; });
    var libre = meta.es_preview || accesoTotal;
    if (!libre) {
      player.innerHTML = '<p class="aula-aviso">Esta lección es para alumnos suscriptos.</p>';
      return;
    }
    player.innerHTML = '<p class="aula-aviso">Cargando la lección…</p>';
    var r = await TW.sb.from("lecciones").select("*").eq("id", id).maybeSingle();
    if (!r.data) { player.innerHTML = '<p class="aula-aviso">No se pudo cargar la lección.</p>'; return; }
    var lec = r.data;
    if (lec.tipo === "texto") {
      player.innerHTML = '<div class="aula-texto"><h3>' + TW.esc(lec.titulo) + "</h3>" + TW.md(lec.cuerpo) + "</div>";
      return;
    }
    var url = lec.url_publica || null;
    if (!url && lec.cloudinary_id) url = await TW.urlFirmada({ leccion_id: lec.id });
    if (!url) { player.innerHTML = '<p class="aula-aviso">El material de esta lección no está disponible.</p>'; return; }
    if (lec.tipo === "video") {
      player.innerHTML = '<div class="aula-player"><video controls playsinline src="' + TW.esc(url) + '"></video></div>';
    } else if (lec.tipo === "audio") {
      player.innerHTML = '<div class="aula-player"><audio controls src="' + TW.esc(url) + '"></audio></div>';
    } else {
      window.open(url, "_blank");
      player.innerHTML = '<p class="aula-aviso">El documento se abrió en otra pestaña.</p>';
    }
  });
  if (window.__finSplash) window.__finSplash();
})();
