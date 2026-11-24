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
    $("#a-usuario").textContent = user.email;
    $("#btn-salir").hidden = false;
    var r = await TW.sb.from("perfiles").select("es_admin").eq("id", user.id).maybeSingle();
    if (!r.data || !r.data.es_admin) { $("#a-denegado").hidden = false; return; }
    $("#a-panel").hidden = false;
    pintarTab(tabActual);
  }

  $("#btn-salir").addEventListener("click", async function () {
    await TW.sb.auth.signOut();
    location.href = "panel.html";
  });
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
    cont.innerHTML = "<h2>Resumen</h2><p class='bajada'>La plataforma de un vistazo.</p><div class='a-stats' id='a-stats'><p class='p-vacio'>Cargando…</p></div>";
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
