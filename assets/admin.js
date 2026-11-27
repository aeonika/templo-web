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
    if (!user) { $("#a-denegado").hidden = false; return; }
    TW.aplicarMarca();
    $("#a-usuario").textContent = user.email;
    $("#btn-salir").hidden = false;
    $("#p-burger").hidden = false;
    var r = await TW.sb.from("perfiles").select("es_admin").eq("id", user.id).maybeSingle();
    if (!r.data || !r.data.es_admin) { $("#a-denegado").hidden = false; return; }
    $("#a-panel").hidden = false;
    pintarTab(tabActual);
  }

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
    if (tab === "sitios") return vistaSitios(cont);
    if (tab === "usuarios") return vistaUsuarios(cont);
    if (tab === "suscripciones") return vistaSuscripciones(cont);
  }

  // ============================================================ resumen
  async function vistaResumen(cont) {
    cont.innerHTML = "<h2>Resumen</h2><p class='bajada'>La plataforma de un vistazo.</p><div class='a-stats' id='a-stats'><p class='p-vacio'>Cargando…</p></div><div id='a-marca'></div><div id='a-portada'></div>";
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
    cargarPortada();
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
      "<input type='url' id='a-marca-logo' class='a-url' placeholder='Dirección del logo (https://…) o subilo →' value='" + esc(logo) + "'>" +
      "<label class='btn btn-fantasma'>Subir logo<input type='file' id='a-marca-file' accept='image/*' hidden></label>" +
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
      "<p class='bajada'>La imagen grande que se ve al entrar a TemploWeb. Pegá la dirección de una imagen o subí una nueva.</p>" +
      (actual ? "<img class='a-portada-img' src='" + esc(actual) + "' alt='Portada actual'>" : "") +
      "<div class='a-portada-form'>" +
      "<input type='url' id='a-portada-url' class='a-url' placeholder='https://…' value='" + esc(actual) + "'>" +
      "<label class='btn btn-fantasma'>Subir imagen<input type='file' id='a-portada-file' accept='image/*' hidden></label>" +
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
        "<div class='crece'><a class='titulo' href='sitio.html?s=" + esc(s.slug) + "' target='_blank' rel='noopener'>" + esc(s.nombre) + "</a>" +
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
        ? "<a href='sitio.html?s=" + esc(u.sitio_slug) + "' target='_blank' rel='noopener'>" + esc(u.sitio_nombre) + "</a> · plan " + esc(u.plan)
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
