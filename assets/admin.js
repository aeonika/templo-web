// TemploWeb · administración de la plataforma.
// Solo entra el perfil con es_admin = true; la seguridad real la pone
// RLS (políticas admin_total) y las funciones admin_* de Supabase.
(function () {
  "use strict";
  var user = null;
  var tabActual = "resumen";
  function $(s) { return document.querySelector(s); }
  function esc(s) { return TW.esc(s == null ? "" : String(s)); }
  function fecha(iso) { return iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—"; }
  var avisoTimer = null;
  function aviso(ok, msg) {
    var el = ok ? $("#a-ok") : $("#a-error");
    (ok ? $("#a-error") : $("#a-ok")).textContent = "";
    el.textContent = msg;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { el.textContent = ""; }, 3500);
  }

  async function iniciar() {
    user = await TW.usuario();
    $("#a-cargando").hidden = true;
    await TW.aplicarMarca();
    if (!user) { $("#a-denegado").hidden = false; if (window.TW && TW.finSplash) TW.finSplash(); return; }
    $("#a-usuario").textContent = user.email;
    $("#btn-salir").hidden = false;
    $("#p-burger").hidden = false;
    var r = await TW.sb.from("perfiles").select("es_admin").eq("id", user.id).maybeSingle();
    if (!r.data || !r.data.es_admin) { $("#a-denegado").hidden = false; if (window.TW && TW.finSplash) TW.finSplash(); return; }
    $("#a-panel").hidden = false;
    pintarTab(tabActual);
    if (window.TW && TW.finSplash) TW.finSplash();
  }

  // Botones «o pegar una URL»: por defecto manda el boton de subir.
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-url-toggle]");
    if (!b) return;
    var inp = document.getElementById(b.getAttribute("data-url-toggle"));
    if (inp) { inp.hidden = !inp.hidden; if (!inp.hidden) inp.focus(); }
  });

  $("#btn-salir").addEventListener("click", async function () {
    await TW.sb.auth.signOut();
    location.href = "panel.html";
  });
  // menú hamburguesa de la barra superior (móvil)
  var burgerNav = $("#p-burger"), menuNav = $("#p-nav-menu");
  function cerrarMenuNav() { if (menuNav) menuNav.classList.remove("abierto"); if (burgerNav) { burgerNav.classList.remove("abierta"); burgerNav.setAttribute("aria-expanded", "false"); } }
  if (burgerNav && menuNav) {
    burgerNav.addEventListener("click", function () {
      var abierto = menuNav.classList.toggle("abierto");
      burgerNav.classList.toggle("abierta", abierto);
      burgerNav.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
    menuNav.addEventListener("click", function (ev) { if (ev.target.closest("a, button")) cerrarMenuNav(); });
    document.addEventListener("click", function (ev) { if (!ev.target.closest(".p-nav")) cerrarMenuNav(); });
  }
  $("#a-tabs").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-tab]");
    if (b) pintarTab(b.dataset.tab);
  });

  function pintarTab(tab) {
    tabActual = tab;
    document.querySelectorAll("#a-tabs button").forEach(function (b) {
      b.classList.toggle("activa", b.dataset.tab === tab);
    });
    var cont = $("#a-contenido");
    if (tab === "resumen") return vistaResumen(cont);
    if (tab === "portada") return vistaPortada(cont);
    if (tab === "sitios") return vistaSitios(cont);
    if (tab === "usuarios") return vistaUsuarios(cont);
    if (tab === "suscripciones") return vistaSuscripciones(cont);
  }

  // ============================================================ resumen
  async function vistaResumen(cont) {
    cont.innerHTML = "<h2>Resumen</h2><p class='bajada'>La plataforma de un vistazo.</p><div class='a-stats' id='a-stats'><p class='p-vacio'>Cargando…</p></div><div id='a-marca'></div>";
    var r = await TW.sb.rpc("admin_estadisticas");
    if (r.error || !r.data) { $("#a-stats").innerHTML = "<p class='p-error'>No se pudieron cargar las estadísticas.</p>"; return; }
    var d = r.data;
    var stats = [
      ["Usuarios", d.usuarios], ["Sitios", d.sitios], ["Sitios Premium", d.sitios_premium],
      ["Productos", d.productos], ["Cursos", d.cursos], ["Artículos", d.articulos],
      ["Documentos", d.documentos], ["Suscripciones activas", d.suscripciones_activas],
      ["Suscripciones pendientes", d.suscripciones_pendientes], ["Publicaciones", d.publicaciones]
    ];
    $("#a-stats").innerHTML = stats.map(function (s) {
      return "<div class='a-stat" + (s[0] === "Sitios Premium" ? " a-stat-dorada" : "") + "'><p class='a-stat-num'>" + s[1] + "</p><p class='a-stat-nombre'>" + s[0] + "</p></div>";
    }).join("");
    cargarMarca();
  }

  // ============================================================ marca de la plataforma
  async function cargarMarca() {
    var caja = $("#a-marca");
    if (!caja) return;
    var r = await TW.sb.from("config_plataforma").select("clave, valor").in("clave", ["marca_nombre", "marca_logo_url"]);
    var datos = {};
    (r.data || []).forEach(function (x) { datos[x.clave] = x.valor; });
    var nombre = datos.marca_nombre || "";
    var logo = datos.marca_logo_url || "";
    caja.innerHTML = "<div class='a-portada'>" +
      "<h3>Marca de la plataforma</h3>" +
      "<p class='bajada'>El nombre y el logo que se ven en la página principal, el panel y la administración. El logo se ajusta solo al alto de la barra y también queda como icono de la pestaña; si no cargás logo, se usa el signo de siempre.</p>" +
      (logo ? "<img class='a-marca-img' src='" + esc(logo) + "' alt='Logo actual'>" : "") +
      "<div class='a-portada-form'>" +
      "<input type='text' id='a-marca-nombre' class='a-url' placeholder='Nombre de la plataforma' value='" + esc(nombre) + "'>" +
      "<input type='url' id='a-marca-logo' class='a-url' placeholder='https://…' value='" + esc(logo) + "' hidden>" +
      "<label class='btn btn-fantasma'>Subir logo<input type='file' id='a-marca-file' accept='image/*' hidden></label>" +
      "<button class='c-url-toggle' data-url-toggle='a-marca-logo' type='button'>o pegar una URL</button>" +
      "<button class='btn btn-primario' id='a-marca-guardar' type='button'>Guardar marca</button>" +
      ((nombre || logo) ? "<button class='btn btn-fantasma' id='a-marca-quitar' type='button'>Usar la original</button>" : "") +
      "</div></div>";
    $("#a-marca-file").addEventListener("change", async function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      try {
        aviso(true, "Subiendo logo…");
        var datos2 = await subirCloudinary(f, false, { max: 512 });
        $("#a-marca-logo").value = datos2.secure_url;
        aviso(true, "Logo subido. Tocá «Guardar marca» para aplicarlo.");
      } catch (e) { aviso(false, "No se pudo subir: " + e.message); }
    });
    $("#a-marca-guardar").addEventListener("click", async function () {
      var n = $("#a-marca-nombre").value.trim();
      var l = $("#a-marca-logo").value.trim();
      var r1 = await TW.sb.from("config_plataforma").upsert({ clave: "marca_nombre", valor: n }, { onConflict: "clave" });
      var r2 = await TW.sb.from("config_plataforma").upsert({ clave: "marca_logo_url", valor: l }, { onConflict: "clave" });
      if (r1.error || r2.error) aviso(false, "No se pudo guardar: " + (r1.error || r2.error).message);
      else { aviso(true, "Marca guardada. Se ve al recargar las páginas."); cargarMarca(); TW.aplicarMarca(); }
    });
    var quitar = $("#a-marca-quitar");
    if (quitar) quitar.addEventListener("click", async function () {
      await TW.sb.from("config_plataforma").upsert({ clave: "marca_nombre", valor: "" }, { onConflict: "clave" });
      var r3 = await TW.sb.from("config_plataforma").upsert({ clave: "marca_logo_url", valor: "" }, { onConflict: "clave" });
      if (r3.error) aviso(false, "No se pudo guardar: " + r3.error.message);
      else { aviso(true, "Listo: vuelve la marca original."); cargarMarca(); }
    });
  }

  // ============================================================ pestaña Portada: todo el index editable
  function vistaPortada(cont) {
    cont.innerHTML = "<h2>Página principal</h2><p class='bajada'>Todo lo que se ve en la portada de la plataforma, editable desde acá: imagen, textos de cada módulo, testimonios y el orden de las secciones.</p><div id='a-portada'></div><div id='a-contenido-form'></div><div id='a-testis'></div><div id='a-orden'></div>";
    cargarPortada();
    cargarContenido();
    cargarTestis();
    cargarOrden();
  }

  var DEF_CONTENIDO = {
    hero: { titulo: "Tu proyecto, en tu propio", acento: "sitio", bajada: "Tu tienda, tus cursos, tus servicios y tu blog en un solo lugar, sin saber programar.", boton: "Crear mi sitio gratis", link_novedades: "Ver sitios y novedades", link_ejemplo: "Ejemplo real: una tienda de ropa" },
    vidrio: { nombre: "Tienda Aurora", link: "templo-web.app/aurora", titulo: "Ofertas de la semana", linea: "Pedidos por WhatsApp · envíos en el día", filas: [["Combo desayuno artesanal", "$ 12.500"], ["Velas aromáticas de soja", "$ 6.900"], ["Curso de panadería en video", "Premium"]] },
    ejemplos_titulo: "Sitios de ejemplo, hechos con la plataforma",
    para_quien: { titulo: "Un sitio para cada proyecto", bajada: "La misma plataforma, tres formas de usarla. El aspecto premium y el panel simple son los mismos para todos.", tarjetas: [
      { t: "Tiendas y emprendimientos", x: "Tu catálogo con precios y fotos, promociones de la semana y contacto directo por WhatsApp para recibir pedidos." },
      { t: "Maestros y cursos", x: "Cursos en video con acceso por suscripción, documentos protegidos y un feed propio para tu comunidad." },
      { t: "Servicios y profesionales", x: "Tus servicios con precio, tu presentación y tus artículos, reunidos en un solo enlace para compartir." }] },
    herramientas: { titulo: "Todo lo que tu sitio incluye", bajada: "Cada módulo se enciende o se apaga desde tu panel. Empezás con lo que tenés y sumás cuando crece.", modulos: [
      { t: "Productos y servicios", x: "Físicos, digitales o sesiones: precio, foto y tu propio link de cobro." },
      { t: "Cursos y talleres", x: "Lecciones en video y audio con acceso solo para tus alumnos suscriptos." },
      { t: "Repositorio de documentos", x: "Tus PDFs y textos, gratis o pagos, entregados de forma segura." },
      { t: "Artículos y blog", x: "Escribí y publicá sin depender del algoritmo de una red social." },
      { t: "Promociones", x: "Avisos y ofertas de tu sitio, en el orden que vos elijas." },
      { t: "Feed de novedades", x: "Actualizaciones públicas para tus seguidores y privadas para cada curso." },
      { t: "Quién soy", x: "Tu presentación, tu foto y tus canales de contacto directos." },
      { t: "Vidriera de destacados", x: "Lo que quieras empujar primero, en una vista propia." }] },
    como: { titulo: "En marcha en tres pasos", pasos: [
      { t: "Registrate", x: "Creás tu cuenta y elegís la dirección de tu sitio. Sin instalar nada." },
      { t: "Cargá tu contenido", x: "Productos, cursos, servicios, artículos y documentos, desde un panel simple." },
      { t: "Compartí tu enlace", x: "Tus clientes y alumnos entran, compran, se suscriben y vuelven cuando quieran." }] },
    novedades: { titulo: "Novedades de la plataforma", bajada: "Lo último que publicaron los sitios de la plataforma." },
    testimonios_bajada: "Capturas y fotos de quienes ya venden con su propio sitio.",
    planes: { titulo: "Planes",
      gratis: { nombre: "Gratis", precio: "$ 0", items: ["Tu sitio con todos los módulos", "Productos, servicios y blog", "Cursos con lecciones públicas", "Documentos gratuitos", "Feed público de novedades"], boton: "Empezar gratis" },
      premium: { nombre: "Premium", precio: "Para vender en serio", items: ["Todo lo del plan gratis", "Video y audio protegidos: acceso solo con suscripción activa", "Enlaces de acceso que vencen en minutos, no para siempre", "Documentos pagos con entrega segura", "Feed privado para cada curso"], boton: "Crear mi sitio" } },
    cierre: { titulo: "Tu sitio te está esperando", boton: "Crear mi sitio gratis" },
    pie: { linea: "Una plataforma de Aeonika para negocios, maestros y profesionales.", creditos: "La imagen de portada de esta página se elige desde la administración de la plataforma." }
  };

  async function cargarContenido() {
    var caja = $("#a-contenido-form");
    if (!caja) return;
    var r = await TW.sb.from("config_plataforma").select("valor").eq("clave", "contenido").maybeSingle();
    var guardado = {};
    try { guardado = JSON.parse((r.data && r.data.valor) || "{}"); } catch (e) { guardado = {}; }
    function val(ruta) {
      var partes = ruta.split("."), nodos = [guardado, DEF_CONTENIDO], salida = "";
      for (var n = 0; n < 2; n++) {
        var nodo = nodos[n], ok = true;
        for (var i = 0; i < partes.length; i++) {
          if (nodo && typeof nodo === "object" && partes[i] in nodo) nodo = nodo[partes[i]];
          else { ok = false; break; }
        }
        if (ok && typeof nodo === "string") { salida = nodo; break; }
        if (ok && Array.isArray(nodo)) { salida = nodo.join("\n"); break; }
      }
      return salida;
    }
    function campo(ruta, etiqueta, area) {
      var v = esc(val(ruta));
      return "<label>" + etiqueta + (area
        ? "<textarea data-c='" + ruta + "' rows='3'>" + v + "</textarea>"
        : "<input type='text' data-c='" + ruta + "' value='" + v + "'>") + "</label>";
    }
    function grupo(titulo, abierto, campos) {
      return "<details class='a-grupo'" + (abierto ? " open" : "") + "><summary>" + titulo + "</summary><div class='a-campos'>" + campos + "</div></details>";
    }
    function tarjetas(rutaBase, cantidad, etiqueta) {
      var h = "";
      for (var i = 0; i < cantidad; i++) {
        h += campo(rutaBase + "." + i + ".t", etiqueta + " " + (i + 1) + " · título") +
             campo(rutaBase + "." + i + ".x", etiqueta + " " + (i + 1) + " · texto", true);
      }
      return h;
    }
    caja.innerHTML = "<div class='a-portada'><h3>Textos de la página principal</h3>" +
      "<p class='bajada'>Cada módulo de la portada, con sus textos. Lo que guardes acá reemplaza al texto de fábrica de esa parte.</p>" +
      grupo("Presentación (hero)", true,
        campo("hero.titulo", "Titular") + campo("hero.acento", "Palabra destacada del titular") +
        campo("hero.bajada", "Bajada", true) + campo("hero.boton", "Botón principal") +
        campo("hero.link_novedades", "Enlace «novedades»") + campo("hero.link_ejemplo", "Enlace del ejemplo")) +
      grupo("Tarjeta de ejemplo del hero", false,
        campo("vidrio.nombre", "Nombre del sitio de ejemplo") + campo("vidrio.link", "Dirección que se muestra") +
        campo("vidrio.titulo", "Título de la tarjeta") + campo("vidrio.linea", "Línea bajo el título") +
        campo("vidrio.filas.0.0", "Fila 1 · producto") + campo("vidrio.filas.0.1", "Fila 1 · precio") +
        campo("vidrio.filas.1.0", "Fila 2 · producto") + campo("vidrio.filas.1.1", "Fila 2 · precio") +
        campo("vidrio.filas.2.0", "Fila 3 · producto") + campo("vidrio.filas.2.1", "Fila 3 · precio (escribí Premium para la placa dorada)") +
        campo("vidrio.pie", "Pie de la tarjeta")) +
      grupo("Ejemplos y «Para quién»", false,
        campo("ejemplos_titulo", "Título de la barra de ejemplos") +
        campo("para_quien.titulo", "Título de la sección") + campo("para_quien.bajada", "Bajada", true) +
        tarjetas("para_quien.tarjetas", 3, "Público")) +
      grupo("Herramientas", false,
        campo("herramientas.titulo", "Título de la sección") + campo("herramientas.bajada", "Bajada", true) +
        tarjetas("herramientas.modulos", 8, "Módulo")) +
      grupo("Cómo funciona", false,
        campo("como.titulo", "Título de la sección") + tarjetas("como.pasos", 3, "Paso")) +
      grupo("Novedades y testimonios", false,
        campo("novedades.titulo", "Novedades · título") + campo("novedades.bajada", "Novedades · bajada", true) +
        campo("testimonios_bajada", "Testimonios · bajada", true)) +
      grupo("Planes", false,
        campo("planes.titulo", "Título de la sección") +
        campo("planes.gratis.nombre", "Plan gratis · nombre") + campo("planes.gratis.precio", "Plan gratis · precio") +
        campo("planes.gratis.items", "Plan gratis · beneficios (uno por línea)", true) + campo("planes.gratis.boton", "Plan gratis · botón") +
        campo("planes.premium.nombre", "Plan Premium · nombre") + campo("planes.premium.precio", "Plan Premium · precio") +
        campo("planes.premium.items", "Plan Premium · beneficios (uno por línea)", true) + campo("planes.premium.boton", "Plan Premium · botón")) +
      grupo("Cierre y pie de página", false,
        campo("cierre.titulo", "Cierre · título") + campo("cierre.boton", "Cierre · botón") +
        campo("pie.linea", "Pie · línea principal") + campo("pie.creditos", "Pie · línea secundaria")) +
      "<div class='a-portada-form' style='margin-top:16px'><button class='btn btn-primario' id='a-contenido-guardar' type='button'>Guardar textos</button></div></div>";
    $("#a-contenido-guardar").addEventListener("click", async function () {
      var C = {};
      caja.querySelectorAll("[data-c]").forEach(function (inp) {
        var partes = inp.getAttribute("data-c").split(".");
        var nodo = C;
        for (var i = 0; i < partes.length - 1; i++) {
          var k = partes[i];
          if (nodo[k] === undefined) nodo[k] = /^\d+$/.test(partes[i + 1]) ? [] : {};
          nodo = nodo[k];
        }
        var ultimo = partes[partes.length - 1];
        nodo[ultimo] = (ultimo === "items")
          ? inp.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean)
          : inp.value.trim();
      });
      var r2 = await TW.sb.from("config_plataforma").upsert({ clave: "contenido", valor: JSON.stringify(C) }, { onConflict: "clave" });
      if (r2.error) aviso(false, "No se pudo guardar: " + r2.error.message);
      else aviso(true, "Textos guardados. Se ven al recargar la página principal.");
    });
  }

  // ============================================================ portada de la plataforma
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
    return datos;
  }

  async function cargarPortada() {
    var caja = $("#a-portada");
    if (!caja) return;
    var r = await TW.sb.from("config_plataforma").select("valor").eq("clave", "portada_url").maybeSingle();
    var actual = (r.data && r.data.valor) || "";
    caja.innerHTML = "<div class='a-portada'>" +
      "<h3>Portada de la página principal</h3>" +
      "<p class='bajada'>La imagen grande que se ve al entrar a la página principal. Pegá la dirección de una imagen o subí una nueva.</p>" +
      (actual ? "<img class='a-portada-img' src='" + esc(actual) + "' alt='Portada actual'>" : "") +
      "<div class='a-portada-form'>" +
      "<input type='url' id='a-portada-url' class='a-url' placeholder='https://…' value='" + esc(actual) + "' hidden>" +
      "<label class='btn btn-fantasma'>Subir imagen<input type='file' id='a-portada-file' accept='image/*' hidden></label>" +
      "<button class='c-url-toggle' data-url-toggle='a-portada-url' type='button'>o pegar una URL</button>" +
      "<button class='btn btn-primario' id='a-portada-guardar' type='button'>Guardar portada</button>" +
      (actual ? "<button class='btn btn-fantasma' id='a-portada-quitar' type='button'>Usar la original</button>" : "") +
      "</div></div>";
    $("#a-portada-file").addEventListener("change", async function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      try {
        aviso(true, "Subiendo imagen…");
        var datos = await subirCloudinary(f, false, { max: 1920 });
        $("#a-portada-url").value = datos.secure_url;
        aviso(true, "Imagen subida. Tocá «Guardar portada» para aplicarla.");
      } catch (e) { aviso(false, "No se pudo subir: " + e.message); }
    });
    $("#a-portada-guardar").addEventListener("click", async function () {
      var url = $("#a-portada-url").value.trim();
      var r2 = await TW.sb.from("config_plataforma").upsert({ clave: "portada_url", valor: url }, { onConflict: "clave" });
      if (r2.error) aviso(false, "No se pudo guardar: " + r2.error.message);
      else { aviso(true, "Portada guardada. Se ve al recargar la página principal."); cargarPortada(); }
    });
    var quitar = $("#a-portada-quitar");
    if (quitar) quitar.addEventListener("click", async function () {
      var r3 = await TW.sb.from("config_plataforma").upsert({ clave: "portada_url", valor: "" }, { onConflict: "clave" });
      if (r3.error) aviso(false, "No se pudo guardar: " + r3.error.message);
      else { aviso(true, "Listo: vuelve la portada original."); cargarPortada(); }
    });
  }

  // ============================================================ testimonios de la portada
  async function cargarTestis() {
    var caja = $("#a-testis");
    if (!caja) return;
    var r = await TW.sb.from("config_plataforma").select("clave, valor").in("clave", ["testimonios_titulo", "testimonios"]);
    var cfg = {};
    (r.data || []).forEach(function (f) { cfg[f.clave] = f.valor; });
    var items = [];
    try { items = JSON.parse(cfg.testimonios || "[]"); } catch (e) { items = []; }
    if (!Array.isArray(items)) items = [];
    function filaT(t) {
      var url = t ? (t.imagen_url || "") : "";
      var texto = t ? (t.texto || "") : "";
      return "<div class='ts-card at-fila'>" +
        "<div class='ts-vista'>" + (url ? "<img class='ts-img' src='" + esc(url) + "' alt=''>" : "<span class='ts-vacio'>Sin foto</span>") +
        "<button type='button' class='pf-quitar at-quitar' title='Quitar' aria-label='Quitar'>✕</button></div>" +
        "<input type='hidden' class='ts-url' value='" + esc(url) + "'>" +
        "<label class='btn btn-fantasma'>Subir foto 9:16<input type='file' class='ts-file' accept='image/*' hidden></label>" +
        "<label class='ts-pie'><input type='checkbox' class='ts-pie-check'" + (!t || t.pie !== false ? " checked" : "") + "> Mostrar pie de foto</label>" +
        "<label>Pie de foto <input type='text' class='ts-texto' value='" + esc(texto) + "' placeholder='Nombre · “Su frase”'" + (t && t.pie === false ? " disabled" : "") + "></label></div>";
    }
    caja.innerHTML = "<div class='a-portada'><h3>Testimonios de la página principal</h3>" +
      "<p class='bajada'>El carrusel de fotos verticales (9:16) de la portada. Hasta 5 fotos; el nombre de la sección también se puede cambiar.</p>" +
      "<label>Nombre de la sección <input type='text' id='a-testis-titulo' value='" + esc(cfg.testimonios_titulo || "") + "' placeholder='Testimonios'></label>" +
      "<div id='a-testis-grid' class='ts-grid'>" + (items.length ? items.map(filaT).join("") : filaT(null)) + "</div>" +
      "<div class='a-portada-form'><button class='btn btn-fantasma' id='a-testis-agregar' type='button'>+ Agregar foto</button>" +
      "<button class='btn btn-primario' id='a-testis-guardar' type='button'>Guardar testimonios</button></div></div>";
    $("#a-testis-agregar").addEventListener("click", function () {
      var grid = $("#a-testis-grid");
      if (grid.querySelectorAll(".at-fila").length >= 5) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = filaT(null);
      grid.appendChild(tmp.firstChild);
    });
    caja.addEventListener("click", function (ev) {
      var q = ev.target.closest(".at-quitar");
      if (q) q.closest(".at-fila").remove();
    });
    caja.addEventListener("change", async function (ev) {
      if (ev.target.classList.contains("ts-pie-check")) {
        var cardP = ev.target.closest(".at-fila");
        var inpP = cardP && cardP.querySelector(".ts-texto");
        if (inpP) inpP.disabled = !ev.target.checked;
        return;
      }
      if (!ev.target.classList.contains("ts-file")) return;
      var f = ev.target.files[0];
      if (!f) return;
      var card = ev.target.closest(".at-fila");
      try {
        aviso(true, "Subiendo foto…");
        var datos = await subirCloudinary(f, false, { max: 1080 });
        card.querySelector(".ts-url").value = datos.secure_url;
        var vista = card.querySelector(".ts-vista");
        var img = vista.querySelector(".ts-img");
        if (!img) {
          img = document.createElement("img");
          img.className = "ts-img";
          img.alt = "";
          vista.insertBefore(img, vista.firstChild);
          var vacio = vista.querySelector(".ts-vacio");
          if (vacio) vacio.remove();
        }
        img.src = datos.secure_url;
        aviso(true, "Foto subida. Tocá «Guardar testimonios» para aplicarla.");
      } catch (e) { aviso(false, "No se pudo subir: " + e.message); }
    });
    $("#a-testis-guardar").addEventListener("click", async function () {
      var nuevos = [];
      caja.querySelectorAll(".at-fila").forEach(function (card) {
        var url = card.querySelector(".ts-url").value.trim();
        if (url) nuevos.push({ imagen_url: url, texto: card.querySelector(".ts-texto").value.trim(), pie: card.querySelector(".ts-pie-check").checked });
      });
      var titulo = $("#a-testis-titulo").value.trim();
      var r1 = await TW.sb.from("config_plataforma").upsert({ clave: "testimonios", valor: JSON.stringify(nuevos) }, { onConflict: "clave" });
      var r2 = await TW.sb.from("config_plataforma").upsert({ clave: "testimonios_titulo", valor: titulo }, { onConflict: "clave" });
      if (r1.error || r2.error) aviso(false, "No se pudo guardar: " + (r1.error || r2.error).message);
      else { aviso(true, "Testimonios guardados. Se ven al recargar la página principal."); cargarTestis(); }
    });
  }

  // ============================================================ orden de secciones de la portada
  async function cargarOrden() {
    var caja = $("#a-orden");
    if (!caja) return;
    var SECCIONES = [["para-quien", "Para quién"], ["herramientas", "Herramientas"], ["como", "Cómo funciona"], ["novedades", "Novedades"], ["testimonios", "Testimonios"], ["planes", "Planes"]];
    var r = await TW.sb.from("config_plataforma").select("valor").eq("clave", "orden_secciones").maybeSingle();
    var guardado = [];
    try { guardado = JSON.parse((r.data && r.data.valor) || "[]"); } catch (e) { guardado = []; }
    var filas = SECCIONES.map(function (s2, i) { return { s2: s2, i: i }; });
    filas.sort(function (a, b) {
      var pa = guardado.indexOf(a.s2[0]), pb = guardado.indexOf(b.s2[0]);
      if (pa < 0) pa = 100 + a.i;
      if (pb < 0) pb = 100 + b.i;
      return pa - pb;
    });
    caja.innerHTML = "<div class='a-portada'><h3>Orden de la página principal</h3>" +
      "<p class='bajada'>Arrastrá las secciones desde el agarre ⠿ para cambiar su ubicación en la portada. La presentación y el cierre quedan fijos.</p>" +
      "<div id='a-orden-lista'>" + filas.map(function (f) {
        return "<div class='a-orden-fila' data-orden-id='" + f.s2[0] + "'><span class='mod-grip' title='Arrastrá para ordenar'>⠿</span><span>" + f.s2[1] + "</span></div>";
      }).join("") + "</div>" +
      "<div class='a-portada-form'><button class='btn btn-primario' id='a-orden-guardar' type='button'>Guardar orden</button></div></div>";
    var lista = $("#a-orden-lista"), arrastrada = null;
    lista.addEventListener("mousedown", function (ev) {
      var fila = ev.target.closest(".a-orden-fila");
      if (fila && ev.target.closest(".mod-grip")) fila.draggable = true;
    });
    lista.addEventListener("dragstart", function (ev) {
      arrastrada = ev.target.closest(".a-orden-fila");
      if (arrastrada) arrastrada.classList.add("arrastrando");
    });
    lista.addEventListener("dragover", function (ev) {
      if (!arrastrada) return;
      ev.preventDefault();
      var destino = Array.prototype.slice.call(lista.querySelectorAll(".a-orden-fila")).find(function (f2) {
        var r2 = f2.getBoundingClientRect();
        return ev.clientY < r2.top + r2.height / 2;
      });
      if (destino) lista.insertBefore(arrastrada, destino);
      else lista.appendChild(arrastrada);
    });
    lista.addEventListener("dragend", function () {
      if (arrastrada) { arrastrada.classList.remove("arrastrando"); arrastrada.draggable = false; }
      arrastrada = null;
    });
    $("#a-orden-guardar").addEventListener("click", async function () {
      var orden = Array.prototype.map.call(lista.querySelectorAll(".a-orden-fila"), function (f2) { return f2.dataset.ordenId; });
      var r2 = await TW.sb.from("config_plataforma").upsert({ clave: "orden_secciones", valor: JSON.stringify(orden) }, { onConflict: "clave" });
      if (r2.error) aviso(false, "No se pudo guardar: " + r2.error.message);
      else aviso(true, "Orden guardado. Se ve al recargar la página principal.");
    });
  }

  // ============================================================ sitios
  async function vistaSitios(cont) {
    cont.innerHTML = "<h2>Sitios</h2><p class='bajada'>Todos los sitios de la plataforma: plan, publicación y tema.</p><div id='a-lista'><p class='p-vacio'>Cargando…</p></div>";
    var rs = await TW.sb.from("sitios").select("*").order("creado", { ascending: false });
    var rp = await TW.sb.from("perfiles").select("id, nombre");
    var duenos = {};
    (rp.data || []).forEach(function (p) { duenos[p.id] = p.nombre; });
    var lista = $("#a-lista");
    if (!rs.data || !rs.data.length) { lista.innerHTML = "<p class='p-vacio'>Todavía no hay sitios.</p>"; return; }
    lista.innerHTML = rs.data.map(function (s) {
      return "<div class='a-fila'>" +
        "<div class='crece'><a class='titulo' href='sitio/" + esc(s.slug) + "' target='_blank' rel='noopener'>" + esc(s.nombre) + "</a>" +
        "<div class='detalle'>/" + esc(s.slug) + " · de " + esc(duenos[s.dueno_id] || "—") + " · " + fecha(s.creado) + "</div></div>" +
        "<label class='a-campo'>Plan <select data-plan='" + s.id + "'>" +
        "<option value='gratis'" + (s.plan === "gratis" ? " selected" : "") + ">Gratis</option>" +
        "<option value='premium'" + (s.plan === "premium" ? " selected" : "") + ">Premium</option></select></label>" +
        "<label class='check'><input type='checkbox' data-publicado='" + s.id + "'" + (s.publicado ? " checked" : "") + "> Publicado</label>" +
        "</div>";
    }).join("");
    lista.addEventListener("change", async function (ev) {
      var sel = ev.target.closest("[data-plan]");
      var chk = ev.target.closest("[data-publicado]");
      var r;
      if (sel) r = await TW.sb.from("sitios").update({ plan: sel.value }).eq("id", sel.dataset.plan);
      else if (chk) r = await TW.sb.from("sitios").update({ publicado: chk.checked }).eq("id", chk.dataset.publicado);
      else return;
      if (r.error) aviso(false, "No se pudo guardar: " + r.error.message);
      else aviso(true, "Guardado.");
    });
  }

  // ============================================================ usuarios
  async function vistaUsuarios(cont) {
    cont.innerHTML = "<h2>Usuarios</h2><p class='bajada'>Cuentas registradas, su sitio y su rol.</p><div id='a-lista'><p class='p-vacio'>Cargando…</p></div>";
    var r = await TW.sb.rpc("admin_usuarios");
    var lista = $("#a-lista");
    if (r.error || !r.data) { lista.innerHTML = "<p class='p-error'>No se pudieron cargar los usuarios.</p>"; return; }
    if (!r.data.length) { lista.innerHTML = "<p class='p-vacio'>Todavía no hay usuarios.</p>"; return; }
    lista.innerHTML = r.data.map(function (u) {
      var sitio = u.sitio_slug
        ? "<a href='sitio/" + esc(u.sitio_slug) + "' target='_blank' rel='noopener'>" + esc(u.sitio_nombre) + "</a> · plan " + esc(u.plan)
        : "sin sitio";
      return "<div class='a-fila'>" +
        "<div class='crece'><span class='titulo'>" + esc(u.nombre || "(sin nombre)") + "</span>" +
        "<div class='detalle'>" + esc(u.email) + " · " + sitio + " · desde " + fecha(u.creado) + "</div></div>" +
        (u.plan === "premium" ? "<span class='a-badge'>Premium</span>" : "") +
        "<label class='check'><input type='checkbox' data-admin='" + u.id + "'" + (u.es_admin ? " checked" : "") + "> Admin</label>" +
        "</div>";
    }).join("");
    lista.addEventListener("change", async function (ev) {
      var chk = ev.target.closest("[data-admin]");
      if (!chk) return;
      if (chk.dataset.admin === user.id && !chk.checked) {
        if (!confirm("Vas a quitarte el rol de administrador a vos mismo. ¿Seguir?")) { chk.checked = true; return; }
      }
      var r2 = await TW.sb.from("perfiles").update({ es_admin: chk.checked }).eq("id", chk.dataset.admin);
      if (r2.error) { aviso(false, "No se pudo guardar: " + r2.error.message); chk.checked = !chk.checked; }
      else aviso(true, "Guardado.");
    });
  }

  // ============================================================ suscripciones
  async function vistaSuscripciones(cont) {
    cont.innerHTML = "<h2>Suscripciones</h2><p class='bajada'>Solicitudes y accesos a cursos de toda la plataforma.</p><div id='a-lista'><p class='p-vacio'>Cargando…</p></div>";
    var rs = await TW.sb.from("suscripciones").select("*").order("creada", { ascending: false }).limit(200);
    var rp = await TW.sb.from("perfiles").select("id, nombre");
    var rc = await TW.sb.from("cursos").select("id, titulo");
    var alumnos = {}, cursos = {};
    (rp.data || []).forEach(function (p) { alumnos[p.id] = p.nombre; });
    (rc.data || []).forEach(function (c) { cursos[c.id] = c.titulo; });
    var lista = $("#a-lista");
    if (!rs.data || !rs.data.length) { lista.innerHTML = "<p class='p-vacio'>Todavía no hay suscripciones.</p>"; return; }
    var estados = ["pendiente", "activa", "vencida", "cancelada"];
    lista.innerHTML = rs.data.map(function (s) {
      return "<div class='a-fila'>" +
        "<div class='crece'><span class='titulo'>" + esc(alumnos[s.alumno_id] || "—") + "</span>" +
        "<div class='detalle'>" + esc(cursos[s.curso_id] || "—") + " · " + fecha(s.creada) + (s.vence ? " · vence " + fecha(s.vence) : "") + "</div></div>" +
        "<label class='a-campo'>Estado <select data-estado='" + s.id + "'>" +
        estados.map(function (e) { return "<option value='" + e + "'" + (s.estado === e ? " selected" : "") + ">" + e + "</option>"; }).join("") +
        "</select></label></div>";
    }).join("");
    lista.addEventListener("change", async function (ev) {
      var sel = ev.target.closest("[data-estado]");
      if (!sel) return;
      var r = await TW.sb.from("suscripciones").update({ estado: sel.value }).eq("id", sel.dataset.estado);
      if (r.error) aviso(false, "No se pudo guardar: " + r.error.message);
      else aviso(true, "Guardado.");
    });
  }

  iniciar();
})();
