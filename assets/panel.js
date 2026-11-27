// TemploWeb · panel del maestro y del alumno.
// Auth con Supabase, CRUD generico por modulo y subida firmada a
// Cloudinary. La seguridad real la pone RLS: este panel solo puede
// tocar las filas del usuario conectado.
(function () {
  "use strict";
  var user = null;
  var sitio = null;
  var tabActual = "inicio";
  var SERVICIOS_QR = ["Mercado Pago", "Cuenta DNI", "BNA+", "Ualá", "Brubank", "Naranja X", "Personal Pay", "Banco Galicia", "Banco Macro", "Santander", "BBVA", "Binance", "PayPal", "Wise", "Otro"];
  function ambitoDeServicio(s) { return ["Binance", "PayPal", "Wise"].indexOf(s) >= 0 ? "internacional" : "local"; }
  // Editor de metodos de pago como TARJETAS con logo del servicio.
  // El estado vive en el elemento editor (el._metodos); «+ Agregar
  // metodo» y «Editar» abren un modal compartido para llenar la
  // tarjeta. Lo usan Medios de cobro del sitio y los formularios de
  // productos, cursos y documentos (metodos personalizados).
  var LOGOS_METODO = { "Mercado Pago": "mercadopago.com.ar", "Cuenta DNI": "bancoprovincia.com.ar", "BNA+": "bna.com.ar", "Ualá": "uala.com.ar", "Brubank": "brubank.com", "Naranja X": "naranjax.com", "Personal Pay": "personalpay.com.ar", "Banco Galicia": "galicia.com.ar", "Banco Macro": "macro.com.ar", "Santander": "santander.com.ar", "BBVA": "bbva.com.ar", "Modo": "modo.com.ar", "Binance": "binance.com", "PayPal": "paypal.com", "Wise": "wise.com", "Payoneer": "payoneer.com", "Skrill": "skrill.com", "Cuenta RUT / BancoEstado": "bancoestado.cl", "Mach": "somosmach.cl", "Tenpo": "tenpo.cl", "Webpay / Transbank": "transbank.cl", "Banco de Chile": "bancochile.cl", "Khipu": "khipu.com", "Nequi": "nequi.com.co", "Daviplata": "daviplata.com", "Bancolombia": "bancolombia.com", "PSE": "pse.com.co", "Banco de Bogotá": "bancodebogota.com", "OXXO": "oxxo.com", "BBVA México": "bbva.mx", "Santander México": "santander.com.mx", "Banco Azteca": "bancoazteca.com.mx", "Clip": "clip.mx", "Yape": "yape.com.pe", "Plin": "plin.pe", "BCP": "viabcp.com", "Interbank": "interbank.pe", "BBVA Perú": "bbva.pe", "Prex": "prexcard.com", "OCA": "oca.com.uy", "Banco República (BROU)": "brou.com.uy", "Bizum": "bizum.es", "CaixaBank": "caixabank.es", "Revolut": "revolut.com", "Banco de Venezuela": "banvenez.com", "Banesco": "banesco.com", "Mercantil": "mercantilbanco.com", "Zelle": "zellepay.com", "Banco Unión": "bancounion.com.bo", "Tigo Money": "tigo.com", "Banco Itaú": "itau.com.py", "Visión Banco": "visionbanco.com", "Banco Pichincha": "pichincha.com", "Banco Guayaquil": "bancoguayaquil.com", "Produbanco": "produbanco.com.ec", "Banco Nacional": "bncr.fi.cr", "Banco de Costa Rica": "bancobcr.com" };
  function logoMetodoHtml(servicio) {
    var dom = LOGOS_METODO[servicio];
    return "<span class='mt-logo'><span class='mt-logo-letra'>" + esc((servicio || "?").trim().charAt(0).toUpperCase() || "?") + "</span>" +
      (dom ? "<img src='https://www.google.com/s2/favicons?domain=" + dom + "&sz=128' alt='' loading='lazy' onerror='this.remove()'>" : "") + "</span>";
  }
  function tarjetaMetodoHtml(m, i) {
    var tipoTxt = m.tipo === "qr" ? "Código QR" : (m.tipo === "datos" ? "Datos para transferir" : "Link de pago");
    var resumen = m.tipo === "datos" ? (m.datos || []).map(function (d) { return d.etiqueta + ": " + d.valor; }).join(" · ") : (m.url || "");
    return "<div class='mt-card'>" + logoMetodoHtml(m.servicio) +
      "<div class='mt-card-info'><strong>" + esc(m.servicio || "Método") + "</strong>" +
      "<span class='mt-card-meta'>" + esc(TW.nombrePais(m.pais || "INT")) + " · " + tipoTxt + "</span>" +
      "<span class='mt-card-url'>" + esc(resumen) + "</span></div>" +
      (m.tipo === "qr" && m.url ? "<img class='mt-card-qr' src='" + esc(m.url) + "' alt=''>" : "") +
      "<div class='mt-card-acciones'><button type='button' class='btn btn-fantasma btn-chico' data-mt-edit='" + i + "'>Editar</button>" +
      "<button type='button' class='btn btn-fantasma btn-chico' data-mt-del='" + i + "'>Quitar</button></div></div>";
  }
  function crearEditorMetodos(el, iniciales) {
    if (!el) return;
    el._metodos = (iniciales || []).map(function (m) { return TW.normalizarMetodo(m, paisDelSitio()); }).filter(Boolean);
    el._pintar = function () {
      var caja = el.querySelector(".mt-cards");
      if (caja) caja.innerHTML = el._metodos.length ? el._metodos.map(tarjetaMetodoHtml).join("") : "<p class='p-nota'>Todavía no hay métodos cargados.</p>";
    };
    el._pintar();
    if (!el._conectado) {
      el._conectado = true;
      el.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-mt-add]")) { abrirModalMetodo(el, -1); return; }
        var ed = ev.target.closest("[data-mt-edit]");
        if (ed) { abrirModalMetodo(el, Number(ed.getAttribute("data-mt-edit"))); return; }
        var del = ev.target.closest("[data-mt-del]");
        if (del) { el._metodos.splice(Number(del.getAttribute("data-mt-del")), 1); el._pintar(); }
      });
    }
  }
  function leerMetodosDe(el) {
    if (!el || !el._metodos) return [];
    return el._metodos.map(function (m) {
      var o = { servicio: m.servicio, pais: m.pais, tipo: m.tipo, url: m.url || "" };
      if (m.tipo === "datos") o.datos = m.datos;
      return o;
    });
  }
  // Modal compartido para crear y editar una tarjeta de metodo.
  // Paso 1: el pais (los servicios que se ofrecen son los de ese
  // pais). Paso 2: el servicio de ese pais (u «Otro» con nombre
  // libre). Paso 3: link de pago o codigo QR.
  var mtModalEstado = null;
  function paisDelSitio() { return (sitio && sitio.config && sitio.config.pais) || "AR"; }
  function serviciosDePais(cod) {
    var p = TW.PAISES[cod];
    return (p ? p.servicios.map(function (s) { return s.n; }) : []).concat(["Otro"]);
  }
  function asegurarModalMetodo() {
    var modal = document.getElementById("mt-modal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend",
      "<div class='mt-modal-fondo' id='mt-modal' hidden><div class='mt-modal' role='dialog' aria-modal='true'>" +
      "<h3 id='mtm-titulo'>Método de pago</h3>" +
      "<label>1 · País del método <select id='mtm-pais'></select></label>" +
      "<p class='mtm-paso'>2 · Servicio</p><div class='mt-chips' id='mtm-chips'></div>" +
      "<label id='mtm-otro-wrap' hidden>Nombre del servicio <input type='text' id='mtm-otro' placeholder='Ej.: Banco Nación'></label>" +
      "<p class='mtm-paso'>3 · ¿Cómo cobra?</p><div class='mt-toggle' id='mtm-tipo'></div>" +
      "<div id='mtm-link-wrap'><label>Link de pago <input type='text' id='mtm-url' placeholder='https://…'></label></div>" +
      "<div id='mtm-datos-wrap' class='mt-datos' hidden></div>" +
      "<div id='mtm-qr-wrap' hidden><div class='c-fondo-fila'><img class='c-mini' id='mtm-qr-prev' alt='' hidden>" +
      "<label class='btn btn-fantasma c-subir'>Subir imagen del QR<input type='file' id='mtm-qr-file' accept='image/*' hidden></label></div>" +
      "<label>o pegá la URL del QR <input type='text' id='mtm-url-qr' placeholder='https://…'></label><p class='c-ayuda' id='mtm-qr-estado'></p></div>" +
      "<p class='p-error' id='mtm-error'></p>" +
      "<div class='p-acciones'><button type='button' class='btn btn-primario' id='mtm-guardar'>Guardar método</button>" +
      "<button type='button' class='btn btn-fantasma' id='mtm-cancelar'>Cancelar</button></div>" +
      "</div></div>");
    modal = document.getElementById("mt-modal");
    document.querySelector("#mtm-pais").addEventListener("change", function () {
      if (!mtModalEstado) return;
      mtModalEstado.pais = this.value;
      var servs = serviciosDePais(mtModalEstado.pais);
      if (servs.indexOf(mtModalEstado.servicio) < 0) { mtModalEstado.servicio = servs[0]; mtModalEstado.valores = {}; }
      pintarModalMetodo();
    });
    document.querySelector("#mtm-chips").addEventListener("click", function (ev) {
      var chip = ev.target.closest("[data-serv]");
      if (!chip || !mtModalEstado) return;
      var nuevoServ = chip.getAttribute("data-serv");
      if (nuevoServ !== mtModalEstado.servicio) { mtModalEstado.servicio = nuevoServ; mtModalEstado.valores = {}; }
      pintarModalMetodo();
    });
    document.querySelector("#mtm-datos-wrap").addEventListener("input", function (ev) {
      var inp = ev.target.closest("[data-campo]");
      if (inp && mtModalEstado) mtModalEstado.valores[inp.getAttribute("data-campo")] = inp.value;
    });
    document.querySelector("#mtm-tipo").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-tipo]");
      if (!b || !mtModalEstado) return;
      mtModalEstado.tipo = b.getAttribute("data-tipo");
      pintarModalMetodo();
    });
    document.querySelector("#mtm-url-qr").addEventListener("input", function () {
      var prev = document.querySelector("#mtm-qr-prev");
      prev.src = this.value;
      prev.hidden = !this.value;
    });
    document.querySelector("#mtm-qr-file").addEventListener("change", function () {
      var arch = this.files[0];
      if (!arch) return;
      var est = document.querySelector("#mtm-qr-estado");
      est.textContent = "Subiendo el QR…";
      subirCloudinary(arch, false, { max: 800 }).then(function (datos) {
        document.querySelector("#mtm-url-qr").value = datos.secure_url;
        var prev = document.querySelector("#mtm-qr-prev");
        prev.src = datos.secure_url;
        prev.hidden = false;
        est.textContent = "QR subido.";
      }).catch(function (e2) { est.textContent = "No se pudo subir: " + e2.message; });
    });
    document.querySelector("#mtm-guardar").addEventListener("click", function () {
      var st = mtModalEstado;
      if (!st) return;
      var servicio = st.servicio === "Otro" ? document.querySelector("#mtm-otro").value.trim() : st.servicio;
      var err = document.querySelector("#mtm-error");
      if (!servicio) { err.textContent = "Escribí el nombre del servicio."; return; }
      var nuevo;
      if (st.tipo === "datos") {
        var info = TW.servicioInfo(st.pais, servicio);
        var datos = info.c.map(function (et) { return { etiqueta: et, valor: (st.valores[et] || "").trim() }; }).filter(function (d) { return d.valor; });
        if (!datos.length) { err.textContent = "Completá al menos el primer dato (el CBU, el número o el correo, según el servicio)."; return; }
        nuevo = { servicio: servicio, pais: st.pais, tipo: "datos", url: "", datos: datos };
      } else {
        var url = (st.tipo === "qr" ? document.querySelector("#mtm-url-qr").value : document.querySelector("#mtm-url").value).trim();
        if (!url) { err.textContent = st.tipo === "qr" ? "Subí la imagen del QR o pegá su URL." : "Pegá el link de pago."; return; }
        nuevo = { servicio: servicio, pais: st.pais, tipo: st.tipo, url: url };
      }
      if (st.indice < 0) {
        if (st.editor._metodos.length >= 10) { err.textContent = "Máximo 10 métodos por editor."; return; }
        st.editor._metodos.push(nuevo);
      } else {
        st.editor._metodos[st.indice] = nuevo;
      }
      st.editor._pintar();
      cerrarModalMetodo();
    });
    document.querySelector("#mtm-cancelar").addEventListener("click", cerrarModalMetodo);
    modal.addEventListener("click", function (ev) { if (ev.target === modal) cerrarModalMetodo(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") cerrarModalMetodo(); });
    return modal;
  }
  function pintarModalMetodo() {
    var st = mtModalEstado;
    if (!st) return;
    document.querySelector("#mtm-titulo").textContent = st.indice < 0 ? "Agregar método de pago" : "Editar método de pago";
    var ps = paisDelSitio();
    document.querySelector("#mtm-pais").innerHTML = Object.keys(TW.PAISES).map(function (cod) {
      return "<option value='" + cod + "'" + (st.pais === cod ? " selected" : "") + ">" + esc(TW.PAISES[cod].nombre) + (cod === ps ? " (tu sitio)" : "") + "</option>";
    }).join("");
    document.querySelector("#mtm-chips").innerHTML = serviciosDePais(st.pais).map(function (s) {
      return "<button type='button' class='mt-chip" + (st.servicio === s ? " sel" : "") + "' data-serv='" + esc(s) + "'>" + logoMetodoHtml(s) + "<span>" + esc(s) + "</span></button>";
    }).join("");
    document.querySelector("#mtm-otro-wrap").hidden = st.servicio !== "Otro";
    // Las formas de cobro dependen del servicio: un CBU pide datos,
    // Mercado Pago admite link, QR o datos, Webpay solo link, etc.
    var info = TW.servicioInfo(st.pais, st.servicio);
    if (info.t.indexOf(st.tipo) < 0) st.tipo = info.t[0];
    var etiquetas = { link: "Link de pago", qr: "Código QR", datos: "Datos para transferir" };
    document.querySelector("#mtm-tipo").innerHTML = info.t.map(function (t) {
      return "<button type='button' data-tipo='" + t + "'" + (st.tipo === t ? " class='sel'" : "") + ">" + etiquetas[t] + "</button>";
    }).join("");
    document.querySelector("#mtm-link-wrap").hidden = st.tipo !== "link";
    document.querySelector("#mtm-qr-wrap").hidden = st.tipo !== "qr";
    var wrapDatos = document.querySelector("#mtm-datos-wrap");
    wrapDatos.hidden = st.tipo !== "datos";
    if (st.tipo === "datos") {
      wrapDatos.innerHTML = info.c.map(function (et) {
        return "<label>" + esc(et) + " <input type='text' data-campo='" + esc(et) + "' value='" + esc(st.valores[et] || "") + "'></label>";
      }).join("") + "<p class='c-ayuda'>Estos datos se muestran tal cual en tu página para que el cliente te transfiera.</p>";
    }
    var prev = document.querySelector("#mtm-qr-prev");
    var urlQr = document.querySelector("#mtm-url-qr").value;
    prev.src = urlQr || "";
    prev.hidden = !urlQr;
    document.querySelector("#mtm-error").textContent = "";
  }
  function abrirModalMetodo(editor, indice) {
    asegurarModalMetodo();
    var base = indice >= 0 ? editor._metodos[indice] : null;
    var pais = base ? (base.pais || paisDelSitio()) : paisDelSitio();
    var servs = serviciosDePais(pais);
    var serv = base ? base.servicio : servs[0];
    var esConocido = servs.indexOf(serv) >= 0;
    var valores = {};
    if (base && base.tipo === "datos" && Array.isArray(base.datos)) {
      base.datos.forEach(function (d) { valores[d.etiqueta] = d.valor; });
    }
    mtModalEstado = {
      editor: editor,
      indice: indice,
      pais: pais,
      servicio: esConocido ? serv : "Otro",
      tipo: base ? base.tipo : "link",
      valores: valores
    };
    document.querySelector("#mtm-otro").value = esConocido ? "" : serv;
    document.querySelector("#mtm-url").value = base && base.tipo === "link" ? base.url : "";
    document.querySelector("#mtm-url-qr").value = base && base.tipo === "qr" ? base.url : "";
    document.querySelector("#mtm-qr-estado").textContent = "";
    pintarModalMetodo();
    document.getElementById("mt-modal").hidden = false;
  }
  function cerrarModalMetodo() {
    var m = document.getElementById("mt-modal");
    if (m) m.hidden = true;
    mtModalEstado = null;
  }
  function filaGaleriaHtml(url) {
    return "<div class='g-fila'><img class='c-mini g-mini' alt='' src='" + esc(url || "") + "'" + (url ? "" : " hidden") + ">" +
      "<label class='btn btn-fantasma c-subir'>Subir imagen<input type='file' class='g-file' accept='image/*' hidden></label>" +
      "<input type='text' class='g-url' value='" + esc(url || "") + "' placeholder='https://… (o subí la imagen)'>" +
      "<button type='button' class='btn btn-fantasma g-quitar'>Quitar</button></div>";
  }
  function leerFilasGaleria(contenedor) {
    var out = [];
    if (!contenedor) return out;
    contenedor.querySelectorAll(".g-fila").forEach(function (fila) {
      var u = fila.querySelector(".g-url").value.trim();
      if (u) out.push(u);
    });
    return out;
  }
  function conectarGaleria(contenedor, botonAgregar, maximo) {
    if (botonAgregar) botonAgregar.addEventListener("click", function () {
      if (contenedor.querySelectorAll(".g-fila").length >= (maximo || 8)) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = filaGaleriaHtml("");
      contenedor.appendChild(tmp.firstChild);
    });
    contenedor.addEventListener("click", function (ev) {
      if (ev.target.classList.contains("g-quitar")) ev.target.closest(".g-fila").remove();
    });
    contenedor.addEventListener("change", function (ev) {
      var inp = ev.target.closest(".g-file");
      if (!inp || !inp.files || !inp.files[0]) return;
      var fila = inp.closest(".g-fila");
      subirCloudinary(inp.files[0], false, { max: 1600 }).then(function (datos) {
        fila.querySelector(".g-url").value = datos.secure_url;
        var mini = fila.querySelector(".g-mini");
        if (mini) { mini.src = datos.secure_url; mini.hidden = false; }
      });
    });
    contenedor.addEventListener("input", function (ev) {
      if (ev.target.classList.contains("g-url")) {
        var mini = ev.target.closest(".g-fila").querySelector(".g-mini");
        if (mini) { mini.src = ev.target.value; mini.hidden = !ev.target.value; }
      }
    });
  }
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

  // ============================================================ ingreso desde un sitio
  // Registro contextual: quien llega desde un sitio (?s=slug) se une a
  // ese sitio al autenticarse y vuelve a el, en vez de caer en el panel
  // generico. Si el registro exige confirmar el email, el sitio queda
  // pendiente en este navegador y la union se completa al primer ingreso.
  var slugUrl = new URLSearchParams(location.search).get("s") || "";
  var ctxSitio = null;
  async function cargarCtxSitio() {
    if (!slugUrl) return;
    var r = await TW.sb.from("sitios").select("id, slug, nombre, logo_url, dueno_id").eq("slug", slugUrl).maybeSingle();
    if (!r.data) return;
    ctxSitio = r.data;
    var caja = $("#auth-sitio");
    if (caja) {
      caja.hidden = false;
      $("#auth-sitio-titulo").textContent = ctxSitio.nombre;
      var lg = $("#auth-sitio-logo");
      if (lg && ctxSitio.logo_url) { lg.src = ctxSitio.logo_url; lg.hidden = false; }
    }
    var btnReg = document.querySelector("#form-registro button[type='submit']");
    if (btnReg) btnReg.textContent = "Crear mi cuenta y unirme";
    var nota = document.querySelector("#tarjeta-registro .p-nota");
    if (nota) nota.textContent = "Al crear tu cuenta quedás unido a " + ctxSitio.nombre + " automáticamente.";
  }
  async function unirseYVolver(userId) {
    var slug = slugUrl || localStorage.getItem("tw_ctx_sitio") || "";
    if (!slug) return false;
    var r = await TW.sb.from("sitios").select("id, slug, dueno_id").eq("slug", slug).maybeSingle();
    localStorage.removeItem("tw_ctx_sitio");
    if (!r.data) return false;
    if (r.data.dueno_id !== userId) {
      await TW.sb.from("miembros").upsert(
        { sitio_id: r.data.id, usuario_id: userId, origen: "registro" },
        { onConflict: "sitio_id,usuario_id", ignoreDuplicates: true });
    }
    location.replace("/sitio/" + encodeURIComponent(r.data.slug));
    return true;
  }
  cargarCtxSitio();

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
      if (await unirseYVolver(user.id)) return;
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
      refrescarBadgePagos();
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
      if (ctxSitio) localStorage.setItem("tw_ctx_sitio", ctxSitio.slug);
      ev.target.innerHTML = '<p class="p-ok">Cuenta creada. Revisá tu email para confirmarla' +
        (ctxSitio ? ": cuando ingreses, quedás unido a " + esc(ctxSitio.nombre) + " automáticamente." : " y después ingresá.") + "</p>";
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
      "<div id='d-pagos-aviso'></div>" +
      "<div class='p-bloque d-anim' style='--i:8'><h3>Actividad reciente</h3><div id='d-actividad'><p class='p-vacio'>Cargando…</p></div></div>" +
      "</div>";
    cont.querySelectorAll("[data-ir]").forEach(function (b) {
      b.addEventListener("click", function () { b.blur(); irA(b.getAttribute("data-ir")); });
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
    var rcp = await TW.sb.from("comprobantes").select("creado, estado, perfiles:alumno_id(nombre)").eq("sitio_id", sitio.id).order("creado", { ascending: false }).limit(3);
    (rcp.data || []).forEach(function (c) {
      eventos.push({ cuando: c.creado, tipo: "Comprobante", texto: ((c.perfiles && c.perfiles.nombre) || "Un alumno") + " envió un comprobante (" + c.estado + ")" });
    });
    var rpend = await TW.sb.from("comprobantes").select("id", { count: "exact", head: true }).eq("sitio_id", sitio.id).eq("estado", "pendiente");
    var aviso = document.getElementById("d-pagos-aviso");
    if (aviso && (rpend.count || 0) > 0) {
      aviso.innerHTML = "<button type='button' class='p-aviso-pagos d-anim' style='--i:7' id='d-ir-pagos'>Tenés " + rpend.count + " comprobante" + (rpend.count === 1 ? "" : "s") + " de pago esperando revisión. Tocá para verlos.</button>";
      document.getElementById("d-ir-pagos").addEventListener("click", function () { irA("pagos"); });
    }
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
    if (tab === "pagos") return vistaComprobantes(cont);
    if (tab === "qr") return vistaQR(cont);
  }

  // Contador de comprobantes pendientes en el botón del menú.
  async function refrescarBadgePagos() {
    var badge = document.getElementById("p-badge-pagos");
    if (!badge) return;
    if (!sitio) { badge.hidden = true; return; }
    var r = await TW.sb.from("comprobantes").select("id", { count: "exact", head: true })
      .eq("sitio_id", sitio.id).eq("estado", "pendiente");
    var n = r.count || 0;
    badge.hidden = !n;
    badge.textContent = n;
  }

  // ============================================================ comprobantes
  async function vistaComprobantes(cont) {
    cont.innerHTML = "<div class='p-encab'><div><h2>Comprobantes de pago</h2>" +
      "<p class='p-bajada'>Los comprobantes que te envían tus alumnos desde el aula y desde los documentos. Al aprobar uno de un curso o un documento, el acceso se activa solo.</p></div></div>" +
      "<div id='cp-lista'><p class='p-vacio'>Cargando…</p></div>";
    var lista = document.getElementById("cp-lista");
    var r = await TW.sb.from("comprobantes")
      .select("*, perfiles:alumno_id ( nombre ), cursos:curso_id ( titulo ), documentos:documento_id ( titulo ), productos:producto_id ( nombre )")
      .eq("sitio_id", sitio.id).order("creado", { ascending: false }).limit(100);
    if (r.error) { lista.innerHTML = "<p class='p-error'>No se pudieron cargar: " + esc(r.error.message) + "</p>"; return; }
    var filas = r.data || [];
    if (!filas.length) {
      lista.innerHTML = "<p class='p-vacio'>Todavía no te enviaron comprobantes. Cuando un alumno pague y suba el suyo desde el aula, aparece acá.</p>";
      return;
    }
    var orden = { pendiente: 0, aprobado: 1, rechazado: 2 };
    filas.sort(function (a, b) { return (orden[a.estado] - orden[b.estado]) || (a.creado < b.creado ? 1 : -1); });
    lista.innerHTML = "<div class='p-bloque'><div class='p-lista'>" + filas.map(function (c) {
      var que = c.cursos ? "Curso: " + c.cursos.titulo : (c.documentos ? "Documento: " + c.documentos.titulo : (c.productos ? "Producto: " + c.productos.nombre : "Pago"));
      var pill = c.estado === "pendiente" ? "<span class='p-pill p-pill-pend'>Pendiente</span>"
        : c.estado === "aprobado" ? "<span class='p-pill p-pill-ok'>Aprobado</span>" : "<span class='p-pill p-pill-mal'>Rechazado</span>";
      return "<div class='p-fila-lista'><div class='crece'><strong>" + esc(c.perfiles ? c.perfiles.nombre : "Alumno") + "</strong> " + pill +
        "<div class='detalle'>" + esc(que + " — " + new Date(c.creado).toLocaleDateString("es")) + (c.nota ? " — «" + esc(c.nota) + "»" : "") + "</div></div>" +
        "<a class='btn btn-fantasma' href='" + esc(c.archivo_url) + "' target='_blank' rel='noopener'>Ver</a>" +
        (c.estado === "pendiente" ? "<button class='btn btn-primario' data-cp-aprobar='" + c.id + "'>Aprobar</button><button class='btn btn-fantasma' data-cp-rechazar='" + c.id + "'>Rechazar</button>" : "") +
        "<button class='btn btn-fantasma' data-cp-quitar='" + c.id + "'>Quitar</button></div>";
    }).join("") + "</div></div>";
    lista.querySelectorAll("[data-cp-aprobar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        b.disabled = true; b.textContent = "Aprobando…";
        var c = filas.find(function (x) { return x.id === b.dataset.cpAprobar; });
        if (c.curso_id) {
          var rs = await TW.sb.from("suscripciones").select("id").eq("alumno_id", c.alumno_id).eq("curso_id", c.curso_id).maybeSingle();
          if (rs.data) {
            await TW.sb.from("suscripciones").update({ estado: "activa" }).eq("id", rs.data.id);
            await TW.sb.from("miembros").upsert({ sitio_id: sitio.id, usuario_id: c.alumno_id, origen: "suscripcion" }, { onConflict: "sitio_id,usuario_id", ignoreDuplicates: true });
          } else {
            await TW.sb.from("suscripciones").insert({ sitio_id: sitio.id, alumno_id: c.alumno_id, curso_id: c.curso_id, estado: "activa" });
          }
        }
        if (c.documento_id) {
          await TW.sb.from("accesos_documentos").insert({ sitio_id: sitio.id, alumno_id: c.alumno_id, documento_id: c.documento_id, estado: "activa" });
        }
        await TW.sb.from("comprobantes").update({ estado: "aprobado" }).eq("id", c.id);
        vistaComprobantes(cont); refrescarBadgePagos();
      });
    });
    lista.querySelectorAll("[data-cp-rechazar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        await TW.sb.from("comprobantes").update({ estado: "rechazado" }).eq("id", b.dataset.cpRechazar);
        vistaComprobantes(cont); refrescarBadgePagos();
      });
    });
    lista.querySelectorAll("[data-cp-quitar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        await TW.sb.from("comprobantes").delete().eq("id", b.dataset.cpQuitar);
        vistaComprobantes(cont); refrescarBadgePagos();
      });
    });
  }

  // ============================================================ codigos QR
  // Generador con la libreria qrcode-generator (CDN, carga perezosa):
  // el QR se dibuja en un canvas desde el destino, sin guardar imagenes;
  // en la base quedan solo el nombre y el destino (tabla qrs).
  var libQRPedida = null;
  function cargarLibQR() {
    if (window.qrcode) return Promise.resolve();
    if (!libQRPedida) {
      libQRPedida = new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return libQRPedida;
  }
  function dibujarQR(canvas, texto, px) {
    var qr = window.qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    var n = qr.getModuleCount();
    var escala = Math.max(1, Math.floor(px / (n + 8)));
    var lado = (n + 8) * escala;
    canvas.width = lado; canvas.height = lado;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, lado, lado);
    ctx.fillStyle = "#000000";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + 4) * escala, (r + 4) * escala, escala, escala);
    }
  }
  async function vistaQR(cont) {
    var urlSitio = location.origin + "/sitio/" + sitio.slug;
    var urlWa = sitio.whatsapp ? "https://wa.me/" + String(sitio.whatsapp).replace(/\D/g, "") : "";
    cont.innerHTML = "<div class='p-encab'><div><h2>Códigos QR</h2>" +
      "<p class='p-bajada'>Generá códigos QR para tu sitio o para cualquier link, guardalos con nombre y descargalos para imprimir o compartir. También podés mandar uno directo a tus medios de cobro.</p></div></div>" +
      "<div class='p-bloque'><h3>Nuevo QR</h3>" +
      "<div class='p-dos'><label>Nombre <input type='text' id='qr-nombre' placeholder='Ej.: QR del local'></label>" +
      "<label>Destino (link) <input type='text' id='qr-destino' value='" + esc(urlSitio) + "'></label></div>" +
      "<div class='qr-atajos'><span>Atajos:</span><button type='button' class='btn btn-fantasma btn-chico' data-qr-atajo='" + esc(urlSitio) + "'>Mi sitio</button>" +
      (urlWa ? "<button type='button' class='btn btn-fantasma btn-chico' data-qr-atajo='" + esc(urlWa) + "'>Mi WhatsApp</button>" : "") +
      ((sitio.config && sitio.config.pago_mp) ? "<button type='button' class='btn btn-fantasma btn-chico' data-qr-atajo='" + esc(sitio.config.pago_mp) + "'>Mi link de Mercado Pago</button>" : "") +
      "</div>" +
      "<div class='qr-previa-zona'><canvas id='qr-previa' width='200' height='200'></canvas><p class='p-ayuda' id='qr-estado'>Vista previa en vivo: se actualiza cuando escribís el destino.</p></div>" +
      "<button class='btn btn-primario' id='qr-guardar' type='button'>Guardar QR</button></div>" +
      "<div class='p-bloque'><h3>Guardados</h3><div id='qr-lista'><p class='p-vacio'>Cargando…</p></div></div>";
    try { await cargarLibQR(); }
    catch (e) { document.getElementById("qr-estado").textContent = "No se pudo cargar el generador de QR. Revisá tu conexión."; return; }
    var previa = document.getElementById("qr-previa"), dest = document.getElementById("qr-destino");
    function pintarPrevia() {
      var t = dest.value.trim();
      if (!t) return;
      try { dibujarQR(previa, t, 264); }
      catch (e2) { document.getElementById("qr-estado").textContent = "Ese destino es demasiado largo para un QR."; }
    }
    dest.addEventListener("input", pintarPrevia);
    pintarPrevia();
    cont.querySelectorAll("[data-qr-atajo]").forEach(function (b) {
      b.addEventListener("click", function () { dest.value = b.dataset.qrAtajo; pintarPrevia(); });
    });
    document.getElementById("qr-guardar").addEventListener("click", async function () {
      var nombre = document.getElementById("qr-nombre").value.trim();
      var destino = dest.value.trim();
      var est = document.getElementById("qr-estado");
      if (!nombre) { est.textContent = "Ponele un nombre al QR."; return; }
      if (!destino) { est.textContent = "Falta el destino."; return; }
      var r = await TW.sb.from("qrs").insert({ sitio_id: sitio.id, nombre: nombre, destino: destino });
      est.textContent = r.error ? "No se pudo guardar: " + r.error.message : "Guardado. Ya está en tu lista.";
      if (!r.error) { document.getElementById("qr-nombre").value = ""; cargarListaQR(); }
    });
    cargarListaQR();
  }
  async function cargarListaQR() {
    var zona = document.getElementById("qr-lista");
    if (!zona) return;
    var r = await TW.sb.from("qrs").select("*").eq("sitio_id", sitio.id).order("creado", { ascending: false });
    var filas = r.data || [];
    if (!filas.length) { zona.innerHTML = "<p class='p-vacio'>Todavía no guardaste ningún QR.</p>"; return; }
    zona.innerHTML = "<div class='p-lista'>" + filas.map(function (q) {
      return "<div class='p-fila-lista'><canvas class='qr-mini' data-qr-txt='" + esc(q.destino) + "' width='72' height='72'></canvas>" +
        "<div class='crece'><strong>" + esc(q.nombre) + "</strong><div class='detalle'>" + esc(q.destino) + "</div></div>" +
        "<button class='btn btn-fantasma' data-qr-bajar='" + q.id + "'>Descargar</button>" +
        "<span class='qr-cobrar'><select data-qr-serv='" + q.id + "'>" + SERVICIOS_QR.map(function (s) { return "<option value='" + s + "'>" + s + "</option>"; }).join("") + "</select>" +
        "<button class='btn btn-fantasma' data-qr-cobrar='" + q.id + "'>Usar para cobrar</button></span>" +
        "<button class='btn btn-fantasma' data-qr-quitar='" + q.id + "'>Quitar</button></div>";
    }).join("") + "</div><p class='p-ayuda' id='qr-lista-estado'></p>";
    zona.querySelectorAll("canvas.qr-mini").forEach(function (cv) {
      try { dibujarQR(cv, cv.dataset.qrTxt, 144); } catch (e) {}
    });
    zona.querySelectorAll("[data-qr-bajar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var q = filas.find(function (x) { return x.id === b.dataset.qrBajar; });
        var cv = document.createElement("canvas");
        dibujarQR(cv, q.destino, 1024);
        var a = document.createElement("a");
        a.href = cv.toDataURL("image/png");
        a.download = (q.nombre || "qr").replace(/[^\wáéíóúñ -]+/gi, "").trim().replace(/\s+/g, "-").toLowerCase() + ".png";
        a.click();
      });
    });
    zona.querySelectorAll("[data-qr-cobrar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var q = filas.find(function (x) { return x.id === b.dataset.qrCobrar; });
        var serv = zona.querySelector("[data-qr-serv='" + q.id + "']").value;
        var est = document.getElementById("qr-lista-estado");
        b.disabled = true;
        est.textContent = "Subiendo el QR a tus medios de cobro…";
        try {
          var cv = document.createElement("canvas");
          dibujarQR(cv, q.destino, 1024);
          var blob = await new Promise(function (res) { cv.toBlob(res, "image/png"); });
          var archivo = new File([blob], "qr-cobro.png", { type: "image/png" });
          var datos = await subirCloudinary(archivo, false, { max: 1024 });
          var lista = TW.metodosDeSitio(sitio.config);
          lista.push({ servicio: serv, pais: TW.PAISES.INT.servicios.indexOf(serv) >= 0 ? "INT" : ((sitio.config && sitio.config.pais) || "AR"), tipo: "qr", url: datos.secure_url });
          var cfg = Object.assign({}, sitio.config || {}, { metodos_pago: lista, pago_mp: null, pago_paypal: null, pago_qr: null, pagos_qr: null });
          var r = await TW.sb.from("sitios").update({ config: cfg }).eq("id", sitio.id).select().maybeSingle();
          if (r.error) throw new Error(r.error.message);
          sitio = r.data;
          est.textContent = "Listo: «" + q.nombre + "» quedó como QR de " + serv + " en tus medios de cobro (lo ves en Mi sitio).";
        } catch (e) { est.textContent = "No se pudo: " + e.message; b.disabled = false; }
      });
    });
    zona.querySelectorAll("[data-qr-quitar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        await TW.sb.from("qrs").delete().eq("id", b.dataset.qrQuitar);
        cargarListaQR();
      });
    });
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
      titulo: "Productos y servicios", tabla: "productos", orden: "orden", nuevoTexto: "Nuevo producto",
      bajada: "Físicos, digitales o servicios. El botón de compra usa tu link de pago; sin link, el visitante consulta por WhatsApp. Las categorías que uses quedan guardadas para reutilizarlas; con stock, el sitio avisa «últimas unidades» y «agotado» solo; la oferta flash muestra cuenta regresiva en tu sitio.",
      campos: [
        { k: "nombre", et: "Nombre", tipo: "text" },
        { k: "tipo", et: "Tipo", tipo: "select", opciones: [["fisico", "Físico"], ["digital", "Digital"], ["servicio", "Servicio"]] },
        { k: "categoria", et: "Categoría", tipo: "categoria" },
        { k: "descripcion", et: "Descripción", tipo: "textarea", md: true },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", grande: true, max: 1200, ayuda: "Tamaño sugerido: 1200 × 1200 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "precio", et: "Precio (vacío = a consultar)", tipo: "number" },
        { k: "precio_oferta", et: "Precio de oferta (opcional)", tipo: "number" },
        { k: "flash", et: "Oferta flash", tipo: "switch", virtual: true, clase: "es-flash", desc: "La oferta muestra cuenta regresiva en tu sitio hasta la fecha de fin que elijas." },
        { k: "oferta_hasta", et: "La oferta flash termina", tipo: "fecha" },
        { k: "stock", et: "Stock total (vacío = sin control de stock)", tipo: "number" },
        { k: "variantes", et: "Talles y stock por talle", tipo: "talles2" },
        { k: "destacado", et: "Destacado en la vidriera", tipo: "switch", clase: "es-destacado", desc: "El producto aparece en la sección de destacados de tu sitio." },
        { k: "link_pago", et: "Link de pago (Mercado Pago, Stripe…)", tipo: "text" },
        { k: "galeria", et: "Más imágenes (galería de la pantalla de detalle)", tipo: "galeria", max: 2, ayuda: "La imagen principal + hasta 2 más: máximo 3 imágenes por producto. En los servicios se muestra solo la imagen principal." },
        { k: "pagos_modo", et: "Métodos de pago de este ítem", tipo: "select", opciones: [["sitio", "Los del sitio (generales)"], ["propios", "Personalizados (solo los de este ítem)"], ["ambos", "Los del sitio + personalizados"]], def: "sitio" },
        { k: "metodos_pago", et: "Métodos personalizados", tipo: "metodos" },
        { k: "instrucciones_pago", et: "Instrucciones de pago (opcional)", tipo: "textarea", md: true },
        { k: "orden", et: "Orden", tipo: "number" },
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
      titulo: "Artículos", tabla: "articulos", orden: "creado", nuevoTexto: "Nuevo artículo",
      bajada: "Tu blog. El cuerpo acepta Markdown simple: **negrita**, *itálica*, [enlaces](url) y listas con guión.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "slug", et: "Dirección (slug)", tipo: "text" },
        { k: "extracto", et: "Extracto", tipo: "textarea", md: true },
        { k: "cuerpo", et: "Cuerpo", tipo: "textarea-grande", md: true },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return x.publicado ? "Publicado" : "Borrador"; }
    },
    promociones: {
      titulo: "Promociones", tabla: "promociones", orden: "orden", nuevoTexto: "Nueva promoción",
      bajada: "Avisos y publicidad de tu sitio: lanzamientos, descuentos, eventos.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea", md: true },
        { k: "imagen_url", et: "Imagen", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "link", et: "Enlace", tipo: "text" },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "activa", et: "Activa", tipo: "check", def: true }
      ],
      resumen: function (x) { return x.activa ? "Activa" : "Apagada"; }
    },
    documentos: {
      titulo: "Documentos", tabla: "documentos", orden: "creado", nuevoTexto: "Nuevo documento",
      bajada: "Tu repositorio. Precio 0 = gratis, con URL pública. Con precio, subí el archivo como privado y se entrega solo a quien tenga acceso, con enlace temporal.",
      archivo: { campoUrl: "url_publica", campoId: "cloudinary_id", privadoSegunPrecio: true },
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea", md: true },
        { k: "imagen_url", et: "Imagen de portada", tipo: "imagen", max: 1200, ayuda: "Se muestra grande en el detalle del documento y como miniatura en la lista." },
        { k: "precio", et: "Precio (0 = gratis)", tipo: "number", def: 0 },
        { k: "link_pago", et: "Link de pago", tipo: "text" },
        { k: "pagos_modo", et: "Métodos de pago de este documento", tipo: "select", opciones: [["sitio", "Los del sitio (generales)"], ["propios", "Personalizados (solo los de este documento)"], ["ambos", "Los del sitio + personalizados"]], def: "sitio" },
        { k: "metodos_pago", et: "Métodos personalizados", tipo: "metodos" },
        { k: "instrucciones_pago", et: "Instrucciones de pago (opcional)", tipo: "textarea", md: true },
        { k: "url_publica", et: "URL pública (solo documentos gratis)", tipo: "text" },
        { k: "cloudinary_id", et: "ID de Cloudinary (documentos pagos)", tipo: "text" },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return Number(x.precio) === 0 ? "Gratis" : TW.precio(x.precio, x.moneda); }
    },
    cursos: {
      titulo: "Cursos y talleres", tabla: "cursos", orden: "creado", nuevoTexto: "Nuevo curso",
      bajada: "Cada curso tiene sus lecciones: elegí «Lecciones» en un curso para cargarlas.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "descripcion", et: "Descripción", tipo: "textarea", md: true },
        { k: "imagen_url", et: "Imagen de portada", tipo: "imagen", max: 1600, ayuda: "Tamaño sugerido: 1600 × 900 px. Subila y se comprime sola (buena calidad, poco peso)." },
        { k: "precio", et: "Precio (vacío = gratis)", tipo: "number" },
        { k: "link_pago", et: "Link de pago de la suscripción", tipo: "text" },
        { k: "pagos_modo", et: "Métodos de pago de este curso", tipo: "select", opciones: [["sitio", "Los del sitio (generales)"], ["propios", "Personalizados (solo los de este curso)"], ["ambos", "Los del sitio + personalizados"]], def: "sitio" },
        { k: "metodos_pago", et: "Métodos personalizados", tipo: "metodos" },
        { k: "instrucciones_pago", et: "Instrucciones de pago (opcional)", tipo: "textarea", md: true },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return (x.precio != null ? TW.precio(x.precio, x.moneda) : "Gratis") + (x.publicado ? "" : " · borrador"); }
    },
    lecciones: {
      titulo: "Lecciones", tabla: "lecciones", orden: "orden", nuevoTexto: "Nueva lección",
      bajada: "Video, audio, documento o texto. Las vistas previas se ven sin suscripción. El resto: subí el archivo como privado (queda el ID de Cloudinary) y solo lo abren los alumnos activos, con enlace temporal.",
      archivo: { campoUrl: "url_publica", campoId: "cloudinary_id", privadoSegunCheck: "no" },
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "tipo", et: "Tipo", tipo: "select", opciones: [["video", "Video"], ["audio", "Audio"], ["documento", "Documento"], ["texto", "Texto"]] },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "url_publica", et: "URL pública (lecciones gratis o preview)", tipo: "text" },
        { k: "cloudinary_id", et: "ID de Cloudinary (lecciones pagas)", tipo: "text" },
        { k: "cuerpo", et: "Texto de la lección (solo tipo texto)", tipo: "textarea-grande", md: true },
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
      if (c.md) {
        var htmlIni = /<\/?[a-z][^>]*>/i.test(String(v)) ? String(v) : TW.md(String(v));
        return '<div class="c-campo">' + c.et +
          '<div class="ql-mount' + (c.tipo === "textarea-grande" ? " grande" : "") + '" data-rico-campo="' + c.k + '">' + htmlIni + "</div>" +
          '<span class="c-ayuda">Escribí y seleccioná el texto para darle formato con los botones de arriba: se ve tal como va a quedar.</span></div>';
      }
      return "<label>" + c.et + '<textarea name="' + c.k + '"' + (c.tipo === "textarea-grande" ? ' class="grande"' : "") + ">" + esc(v) + "</textarea></label>";
    }
    if (c.tipo === "fecha") {
      var fv = v ? String(v).slice(0, 16) : "";
      return "<label>" + c.et + '<input type="datetime-local" name="' + c.k + '" value="' + esc(fv) + '"></label>';
    }
    if (c.tipo === "switch") {
      return '<div class="c-switch-fila' + (c.clase ? " " + c.clase : "") + '"><div class="c-switch-info"><span class="c-switch-et">' + c.et + "</span>" +
        (c.desc ? '<span class="c-switch-desc">' + c.desc + "</span>" : "") + "</div>" +
        '<input type="checkbox" class="mod-switch" name="' + c.k + '"' + (v ? " checked" : "") + "></div>";
    }
    if (c.tipo === "categoria") {
      return '<div class="c-campo">' + c.et +
        '<input type="text" name="' + c.k + '" value="' + esc(v) + '" list="dl-categorias" placeholder="Elegí una o escribí una nueva" autocomplete="off">' +
        '<datalist id="dl-categorias"></datalist>' +
        '<span class="c-ayuda">Al guardar, la categoría queda fija para los próximos productos.</span>' +
        '<span class="c-cats" id="cr-cats"></span></div>';
    }
    if (c.tipo === "imagen") {
      return '<div class="c-campo">' + c.et +
        '<span class="c-img' + (c.grande ? " c-img-grande" : "") + '"><img class="c-mini c-img-prev" src="' + esc(v) + '" alt=""' + (v ? "" : " hidden") + ">" +
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
    if (c.tipo === "talles2") {
      return '<div class="c-campo">' + c.et +
        '<div class="t-editor" data-talles><input type="hidden" name="' + c.k + '" value="[]">' +
        '<div class="t-filas"></div>' +
        '<div class="t-plantillas" data-t-plantillas></div>' +
        '<div class="t-custom"><input type="text" data-t-nuevo placeholder="Talle especial: 4XL, Único, A medida…">' +
        '<button type="button" class="btn btn-fantasma btn-chico" data-t-add>Agregar</button></div>' +
        '<span class="c-ayuda">Tocá los talles de la plantilla para sumarlos y cargá el stock de cada uno. Si no cargás talles, manda el stock total.</span>' +
        "</div></div>";
    }
    if (c.tipo === "metodos") {
      return '<div class="c-campo">' + c.et +
        '<div class="mt-editor" data-metodos><div class="mt-cards"></div>' +
        '<button type="button" class="btn btn-fantasma btn-chico" data-mt-add>+ Agregar método</button>' +
        '<span class="c-ayuda">Se usan solo si en «Métodos de pago» elegís «Personalizados» o «Del sitio + personalizados». Cada método: un país, un servicio de ese país, como link o como QR.</span></div></div>';
    }
    if (c.tipo === "galeria") {
      return '<div class="c-campo">' + c.et +
        '<div class="g-editor" data-galeria data-g-max="' + (c.max || 8) + '"><div class="g-filas"></div>' +
        '<button type="button" class="btn btn-fantasma btn-chico" data-g-add>+ Agregar imagen</button>' +
        '<span class="c-ayuda">' + (c.ayuda || "Imágenes extra que se ven en la pantalla de detalle, además de la principal.") + '</span></div></div>';
    }
    return "<label>" + c.et + '<input type="' + (c.tipo === "number" ? "number" : "text") + '" name="' + c.k + '" value="' + esc(v) + '"' + (c.tipo === "number" ? ' step="any" min="0"' : "") + "></label>";
  }
  function leerCampos(form, campos) {
    var f = new FormData(form);
    var obj = {};
    campos.forEach(function (c) {
      if (c.virtual) return;
      if (c.tipo === "check" || c.tipo === "switch") obj[c.k] = form.querySelector('[name="' + c.k + '"]').checked;
      else if (c.tipo === "number") { var n = f.get(c.k); obj[c.k] = n === "" || n === null ? null : Number(n); }
      else if (c.tipo === "fecha") { var fv = (f.get(c.k) || "").toString().trim(); obj[c.k] = fv ? new Date(fv).toISOString() : null; }
      else if (c.tipo === "talles") {
        var txt = (f.get(c.k) || "").toString().trim();
        obj[c.k] = txt ? txt.split(",").map(function (par) {
          var p = par.split(":");
          return { t: (p[0] || "").trim(), s: parseInt(p[1], 10) || 0 };
        }).filter(function (x) { return x.t; }) : [];
      }
      else if (c.tipo === "talles2") {
        try { obj[c.k] = JSON.parse((f.get(c.k) || "[]").toString()); }
        catch (e3) { obj[c.k] = []; }
      }
      else if (c.tipo === "metodos") {
        var em = form.querySelector("[data-metodos]");
        obj[c.k] = em ? leerMetodosDe(em) : [];
      }
      else if (c.tipo === "galeria") {
        var eg = form.querySelector("[data-galeria] .g-filas");
        obj[c.k] = eg ? leerFilasGaleria(eg) : [];
      }
      else if (c.md) {
        var ed = form.querySelector('[data-rico-campo="' + c.k + '"]');
        obj[c.k] = ed ? (ed._quill ? htmlDeQuill(ed._quill) : ed.innerHTML.trim()) : "";
      }
      else obj[c.k] = (f.get(c.k) || "").toString().trim();
    });
    return obj;
  }

  // Iconos de relleno para las tarjetas sin imagen (trazo, heredan color).
  var ICONOS_MODULO = {
    productos: "<path d='M21 8l-9-5-9 5v8l9 5 9-5V8z'/><path d='M3 8l9 5 9-5'/><path d='M12 13v8'/>",
    articulos: "<path d='M6 3h9l4 4v14H6z'/><path d='M15 3v4h4'/><path d='M9 12h6M9 16h6'/>",
    promociones: "<path d='M19 5L5 19'/><circle cx='7' cy='7' r='3'/><circle cx='17' cy='17' r='3'/>",
    documentos: "<path d='M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z'/>",
    cursos: "<circle cx='12' cy='12' r='9'/><path d='M10 8.5l6 3.5-6 3.5z'/>",
    lecciones: "<path d='M4 6h16M4 12h16M4 18h10'/>",
    audio: "<path d='M9 18V6l10-2v11'/><circle cx='6.5' cy='18' r='2.5'/><circle cx='16.5' cy='15' r='2.5'/>"
  };
  function iconoDe(cfg, x) {
    if (cfg.tabla === "lecciones") {
      if (x.tipo === "video") return ICONOS_MODULO.cursos;
      if (x.tipo === "audio") return ICONOS_MODULO.audio;
      if (x.tipo === "documento") return ICONOS_MODULO.articulos;
      return ICONOS_MODULO.lecciones;
    }
    return ICONOS_MODULO[cfg.tabla] || ICONOS_MODULO.articulos;
  }
  function insigniasDe(cfg, x) {
    var izq = "", der = "";
    if (typeof x.publicado === "boolean") izq = "<span class='p-insignia " + (x.publicado ? "es-ok" : "es-off") + "'>" + (x.publicado ? "Publicado" : "Borrador") + "</span>";
    else if (typeof x.activa === "boolean") izq = "<span class='p-insignia " + (x.activa ? "es-ok" : "es-off") + "'>" + (x.activa ? "Activa" : "Apagada") + "</span>";
    if (cfg.tabla === "productos") {
      var st = Array.isArray(x.variantes) && x.variantes.length
        ? x.variantes.reduce(function (a, v) { return a + (Number(v.s) || 0); }, 0)
        : (x.stock === null || x.stock === undefined ? null : Number(x.stock));
      if (x.precio_oferta != null && x.precio != null && Number(x.precio_oferta) < Number(x.precio)) der = "<span class='p-insignia es-oferta'>Oferta</span>";
      else if (st !== null && st <= 0) der = "<span class='p-insignia es-alerta'>Sin stock</span>";
    }
    return (izq ? "<span class='p-insignias izq'>" + izq + "</span>" : "") + (der ? "<span class='p-insignias der'>" + der + "</span>" : "");
  }

  // Convierte un textarea comun en editor visual, sincronizando el
  // HTML de vuelta al textarea (para formularios que leen FormData).
  // Editor visual de formato: Quill (CDN, carga perezosa). Reemplaza
  // al editor casero con execCommand, cuyos formatos quedaban
  // «trabados» al saltar de linea y cuyo «quitar formato» fallaba.
  // Quill maneja bien los saltos, los estados de la barra y la
  // limpieza de formato, y entrega HTML limpio.
  var libQuillPedida = null;
  function cargarQuill() {
    if (window.Quill) return Promise.resolve();
    if (!libQuillPedida) {
      libQuillPedida = new Promise(function (res, rej) {
        var l = document.createElement("link");
        l.rel = "stylesheet";
        l.href = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
        document.head.appendChild(l);
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return libQuillPedida;
  }
  var OPCIONES_QUILL = {
    theme: "snow",
    placeholder: "Escribí acá…",
    modules: { toolbar: [["bold", "italic", "underline"], [{ header: 3 }], [{ list: "bullet" }], ["link", "clean", "pleca"]] }
  };
  // Pleca ornamental: divisor con linea en degradado y rombo central,
  // como los ornamentos del diseño Premium. Es un embed de bloque de
  // Quill que se guarda como <div class="s-pleca"> y las pantallas
  // publicas lo dibujan con CSS (TW.textoRico conserva esa clase).
  function registrarPleca() {
    if (window.__plecaLista || !window.Quill) return;
    window.__plecaLista = true;
    var BlockEmbed = window.Quill.import("blots/block/embed");
    class PlecaBlot extends BlockEmbed {
      static create(value) {
        var node = super.create();
        node.setAttribute("data-estilo", value || "linea");
        return node;
      }
      static value(node) { return node.getAttribute("data-estilo") || "linea"; }
    }
    PlecaBlot.blotName = "pleca";
    PlecaBlot.tagName = "div";
    PlecaBlot.className = "s-pleca";
    window.Quill.register(PlecaBlot);
  }
  function conectarPleca(q) {
    var tb = q.getModule("toolbar");
    if (!tb) return;
    tb.container.classList.add("barra-rico");
    tb.addHandler("pleca", function () {
      var rango = q.getSelection(true);
      var idx = rango ? rango.index : q.getLength();
      abrirSelectorPlecas(q, idx);
    });
    var b = tb.container.querySelector(".ql-pleca");
    if (b) b.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><rect x="2.2" y="2.2" width="5.6" height="5.6" transform="rotate(45 5 5)" fill="currentColor"/></svg> Pleca';
  }
  // Selector visual de plecas: modal con los estilos dibujados tal
  // como se van a ver; al tocar uno se inserta en el cursor.
  function abrirSelectorPlecas(q, idx) {
    var ESTILOS = [["barrita", "Barrita (la de las tarjetas)"], ["linea", "Línea con rombo"], ["simple", "Línea simple"], ["doble", "Doble filete"], ["puntos", "Puntos"], ["rombo", "Rombo solo"], ["pastilla", "Pastilla"]];
    var fondo = document.createElement("div");
    fondo.className = "mt-modal-fondo";
    fondo.innerHTML = '<div class="mt-modal"><div class="mt-modal-cab"><h3>Elegí una pleca</h3><button type="button" class="mt-x" aria-label="Cerrar">✕</button></div><div class="pl-lista">' +
      ESTILOS.map(function (e) { return '<button type="button" class="pl-op" data-estilo="' + e[0] + '"><span class="s-pleca" data-estilo="' + e[0] + '"></span><span class="pl-nombre">' + e[1] + "</span></button>"; }).join("") +
      "</div></div>";
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); }
    fondo.addEventListener("click", function (ev) { if (ev.target === fondo || ev.target.closest(".mt-x")) cerrar(); });
    fondo.querySelectorAll(".pl-op").forEach(function (b) {
      b.addEventListener("click", function () {
        q.insertEmbed(idx, "pleca", b.getAttribute("data-estilo"), "user");
        q.setSelection(idx + 1, 0, "silent");
        cerrar();
      });
    });
  }
  function htmlDeQuill(q) {
    var h = q && q.root ? q.root.innerHTML.trim() : "";
    return h === "<p><br></p>" ? "" : h;
  }
  function iniciarQuillEn(contenedor) {
    if (!contenedor) return;
    var montes = contenedor.querySelectorAll("[data-rico-campo]:not([data-q-listo])");
    if (!montes.length) return;
    cargarQuill().then(function () {
      registrarPleca();
      montes.forEach(function (el) {
        el.setAttribute("data-q-listo", "1");
        el._quill = new window.Quill(el, OPCIONES_QUILL);
        conectarPleca(el._quill);
      });
    }).catch(function () { /* sin red: el contenido queda visible sin editor */ });
  }
  // Convierte un textarea comun en editor visual, sincronizando el
  // HTML de vuelta al textarea (para formularios que leen FormData).
  function mejorarConRico(ta) {
    if (!ta || ta.dataset.ricoOk) return;
    ta.dataset.ricoOk = "1";
    var v = ta.value || "";
    var htmlIni = /<\/?[a-z][^>]*>/i.test(v) ? v : TW.md(v);
    var monte = document.createElement("div");
    monte.className = "ql-mount grande";
    monte.innerHTML = htmlIni;
    ta.parentNode.insertBefore(monte, ta);
    ta.hidden = true;
    cargarQuill().then(function () {
      registrarPleca();
      var q = new window.Quill(monte, OPCIONES_QUILL);
      conectarPleca(q);
      q.on("text-change", function () { ta.value = htmlDeQuill(q); });
    }).catch(function () { ta.hidden = false; });
  }
  function crud(cont, cfg, fijo) {
    var editando = null;
    var formVisible = false;
    var catsCache = null;
    cont.innerHTML = "<h2>" + cfg.titulo + "</h2><p class='bajada'>" + cfg.bajada + "</p>" +
      "<div class='p-cab-lista'><button class='btn btn-primario' id='cr-nuevo' type='button'>+ " + (cfg.nuevoTexto || "Nuevo") + "</button></div>" +
      "<div class='p-bloque' id='cr-form' hidden></div><div class='p-bloque'><h3>Publicados y borradores<span class='p-orden-aviso' id='cr-aviso'></span></h3><div id='cr-lista' class='p-cards'></div></div>";
    async function cargarCats() {
      var s = new Set();
      var r1 = await TW.sb.from("categorias").select("nombre").eq("sitio_id", sitio.id).order("nombre");
      (r1.data || []).forEach(function (c) { if (c.nombre) s.add(c.nombre); });
      var r2 = await TW.sb.from("productos").select("categoria").eq("sitio_id", sitio.id);
      (r2.data || []).forEach(function (p) { if (p.categoria) s.add(p.categoria); });
      catsCache = Array.from(s).sort(function (a, b) { return a.localeCompare(b, "es"); });
      return catsCache;
    }
    async function prepararCats(caja) {
      var dl = caja.querySelector("#dl-categorias");
      var zona = caja.querySelector("#cr-cats");
      if (!dl && !zona) return;
      var cats = await cargarCats();
      if (dl) dl.innerHTML = cats.map(function (c) { return "<option value='" + esc(c) + "'></option>"; }).join("");
      if (zona) {
        zona.innerHTML = cats.map(function (c) {
          return "<span class='c-chip c-chip-cat'>" + esc(c) + "<button type='button' class='c-chip-x' data-borrar-cat='" + esc(c) + "' aria-label='Quitar categoría'>×</button></span>";
        }).join("");
        zona.querySelectorAll("[data-borrar-cat]").forEach(function (b) {
          b.addEventListener("click", async function () {
            if (!confirm("¿Quitar la categoría «" + b.dataset.borrarCat + "» de la lista? Los productos que la usan la conservan.")) return;
            await TW.sb.from("categorias").delete().eq("sitio_id", sitio.id).eq("nombre", b.dataset.borrarCat);
            prepararCats(caja);
          });
        });
      }
    }
    async function asegurarCategoria(nombre) {
      if (!nombre) return;
      if (catsCache && catsCache.indexOf(nombre) >= 0) return;
      await TW.sb.from("categorias").insert({ sitio_id: sitio.id, nombre: nombre });
    }
    function prepararMetodos(caja, iniciales) {
      var editor = caja.querySelector("[data-metodos]");
      if (editor) crearEditorMetodos(editor, iniciales);
    }
    function prepararGaleria(caja, iniciales) {
      var editor = caja.querySelector("[data-galeria]");
      if (!editor) return;
      var filas = editor.querySelector(".g-filas");
      (iniciales || []).forEach(function (u) {
        var t = document.createElement("div");
        t.innerHTML = filaGaleriaHtml(u);
        filas.appendChild(t.firstChild);
      });
      conectarGaleria(filas, editor.querySelector("[data-g-add]"), Number(editor.dataset.gMax || 8));
    }
    function prepararTalles(caja, iniciales) {
      var editor = caja.querySelector("[data-talles]");
      if (!editor) return;
      var filas = editor.querySelector(".t-filas");
      var hidden = editor.querySelector('[name="variantes"]');
      var plantillas = editor.querySelector("[data-t-plantillas]");
      function sync() {
        var arr = [];
        filas.querySelectorAll(".t-fila").forEach(function (f) {
          arr.push({ t: f.dataset.talle, s: parseInt(f.querySelector(".t-stock").value, 10) || 0 });
        });
        hidden.value = JSON.stringify(arr);
        plantillas.querySelectorAll(".t-chip").forEach(function (ch) {
          ch.classList.toggle("ya", arr.some(function (a) { return a.t === ch.dataset.talle; }));
        });
      }
      function agregar(talle, stock, enfocar) {
        talle = (talle || "").trim();
        if (!talle) return;
        var existe = null;
        filas.querySelectorAll(".t-fila").forEach(function (f) { if (f.dataset.talle === talle) existe = f; });
        if (existe) { if (enfocar) existe.querySelector(".t-stock").focus(); return; }
        var div = document.createElement("div");
        div.className = "t-fila";
        div.dataset.talle = talle;
        div.innerHTML = "<span class='t-nombre'>" + esc(talle) + "</span>" +
          "<label class='t-stock-et'>Stock <input type='number' class='t-stock' min='0' step='1' value='" + (stock === "" || stock === null || stock === undefined ? "" : stock) + "'></label>" +
          "<button type='button' class='c-chip-x t-x' aria-label='Quitar talle'>×</button>";
        div.querySelector(".t-stock").addEventListener("input", sync);
        div.querySelector(".t-x").addEventListener("click", function () { div.remove(); sync(); });
        filas.appendChild(div);
        sync();
        if (enfocar) div.querySelector(".t-stock").focus();
      }
      var grupos = [
        ["Letras", ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]],
        ["Números", ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48"]]
      ];
      plantillas.innerHTML = grupos.map(function (g) {
        return "<span class='t-grupo-et'>" + g[0] + "</span>" + g[1].map(function (t) {
          return "<button type='button' class='t-chip' data-talle='" + t + "'>" + t + "</button>";
        }).join("");
      }).join("");
      plantillas.querySelectorAll(".t-chip").forEach(function (ch) {
        ch.addEventListener("click", function () { agregar(ch.dataset.talle, "", true); });
      });
      var btnAdd = editor.querySelector("[data-t-add]");
      var inpNuevo = editor.querySelector("[data-t-nuevo]");
      btnAdd.addEventListener("click", function () { agregar(inpNuevo.value, "", true); inpNuevo.value = ""; inpNuevo.focus(); });
      inpNuevo.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); btnAdd.click(); } });
      (iniciales || []).forEach(function (v) { agregar(v.t, v.s, false); });
      sync();
    }
    async function pintarLista() {
      var q = TW.sb.from(cfg.tabla).select("*").eq("sitio_id", sitio.id);
      if (fijo) Object.keys(fijo).forEach(function (k) { q = q.eq(k, fijo[k]); });
      var r = await q.order(cfg.orden || "creado");
      var lista = $("#cr-lista");
      var filas = r.data || [];
      lista.innerHTML = filas.length ? filas.map(function (x) {
        var media = x.imagen_url
          ? "<img src='" + esc(x.imagen_url) + "' alt='' loading='lazy'>"
          : "<span class='p-card-ph'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + iconoDe(cfg, x) + "</svg></span>";
        return "<article class='p-card clicable' data-editar='" + x.id + "' data-id='" + x.id + "' title='Clic para ver y editar'>" +
          "<div class='p-card-media" + (cfg.tabla === "productos" ? " proporcion-cuadrada" : "") + "'>" + media + insigniasDe(cfg, x) + "</div>" +
          "<div class='p-card-cuerpo'><h4 class='p-card-titulo'>" + esc(x.titulo || x.nombre || "(sin título)") + "</h4>" +
          "<p class='p-card-detalle'>" + esc(cfg.resumen(x)) + "</p></div>" +
          "<div class='p-card-acciones'>" +
          (cfg.orden === "orden" ? "<span class='p-grip' title='Arrastrar para ordenar' aria-hidden='true'><svg viewBox='0 0 24 24' fill='currentColor'><circle cx='9' cy='6' r='1.8'/><circle cx='15' cy='6' r='1.8'/><circle cx='9' cy='12' r='1.8'/><circle cx='15' cy='12' r='1.8'/><circle cx='9' cy='18' r='1.8'/><circle cx='15' cy='18' r='1.8'/></svg></span>" : "") +
          (cfg.extraBoton ? '<button class="btn btn-fantasma btn-chico" data-extra="' + x.id + '">' + cfg.extraBoton + "</button>" : "") +
          '<button class="btn btn-fantasma btn-chico" data-editar="' + x.id + '">Editar</button>' +
          '<button class="btn btn-peligro btn-chico" data-borrar="' + x.id + '">Borrar</button></div></article>';
      }).join("") : '<p class="p-vacio">Todavía no cargaste nada acá.</p>';
      if (cfg.orden === "orden") activarOrden(lista);
    }
    function activarOrden(lista) {
      var arrastrado = null;
      lista.querySelectorAll(".p-card").forEach(function (card) {
        card.draggable = true;
        card.addEventListener("dragstart", function (ev) {
          arrastrado = card;
          card.classList.add("arrastrando");
          ev.dataTransfer.effectAllowed = "move";
          try { ev.dataTransfer.setData("text/plain", card.dataset.id); } catch (e) {}
        });
        card.addEventListener("dragend", function () {
          card.classList.remove("arrastrando");
          lista.querySelectorAll(".p-card").forEach(function (c) { c.classList.remove("sobre-antes", "sobre-despues"); });
          arrastrado = null;
        });
        card.addEventListener("dragover", function (ev) {
          if (!arrastrado || arrastrado === card) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          var r = card.getBoundingClientRect();
          var progreso = (ev.clientX - r.left) / r.width + (ev.clientY - r.top) / r.height;
          card.classList.toggle("sobre-despues", progreso > 1);
          card.classList.toggle("sobre-antes", progreso <= 1);
        });
        card.addEventListener("dragleave", function () { card.classList.remove("sobre-antes", "sobre-despues"); });
        card.addEventListener("drop", async function (ev) {
          ev.preventDefault();
          if (!arrastrado || arrastrado === card) return;
          var r = card.getBoundingClientRect();
          var progreso = (ev.clientX - r.left) / r.width + (ev.clientY - r.top) / r.height;
          lista.insertBefore(arrastrado, progreso > 1 ? card.nextSibling : card);
          card.classList.remove("sobre-antes", "sobre-despues");
          await guardarOrden(lista);
        });
      });
    }
    async function guardarOrden(lista) {
      var aviso = $("#cr-aviso");
      var cards = Array.from(lista.querySelectorAll(".p-card"));
      try {
        for (var i = 0; i < cards.length; i++) {
          var r = await TW.sb.from(cfg.tabla).update({ orden: i + 1 }).eq("id", cards[i].dataset.id);
          if (r.error) throw new Error(r.error.message);
        }
        if (aviso) { aviso.textContent = "Orden guardado"; setTimeout(function () { aviso.textContent = ""; }, 2500); }
      } catch (e) {
        if (aviso) aviso.textContent = "No se pudo guardar el orden";
        pintarLista();
      }
    }
    function pintarForm() {
      var caja = $("#cr-form");
      if (!formVisible) { caja.hidden = true; caja.innerHTML = ""; return; }
      caja.hidden = false;
      caja.innerHTML = "<h3>" + (editando ? "Editar" : (cfg.nuevoTexto || "Nuevo")) + "</h3><form id='cr-f'>" +
        cfg.campos.map(function (c) {
          return campoHtml(c, c.k === "flash" ? !!(editando && editando.oferta_hasta) : (editando ? editando[c.k] : undefined));
        }).join("") +
        (cfg.archivo ? '<label>Subir archivo a Cloudinary <input type="file" id="cr-archivo"></label>' +
          '<p class="p-nota" id="cr-subida-nota">Si el contenido es pago se sube como privado y se completa el ID; si es gratis, la URL pública.</p>' : "") +
        '<div class="p-acciones"><button class="btn btn-primario" type="submit">Guardar</button>' +
        '<button class="btn btn-fantasma" type="button" id="cr-cancelar">Cancelar</button>' +
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
        var campoV = inpV ? inpV.closest(".c-campo") : null;
        if (campoV) campoV.style.display = "none";
      }
      // Los editores de metodos de pago y de galeria existen en
      // productos, cursos y documentos: se conectan para todo CRUD
      // (cada preparar* no hace nada si su editor no esta en el form).
      prepararMetodos(caja, editando && Array.isArray(editando.metodos_pago) ? editando.metodos_pago : []);
      prepararGaleria(caja, editando && Array.isArray(editando.galeria) ? editando.galeria : []);
      iniciarQuillEn(caja);
      if (cfg.tabla === "productos") {
        prepararCats(caja);
        prepararTalles(caja, editando && Array.isArray(editando.variantes) ? editando.variantes : []);
        // Los servicios muestran una sola imagen: sin galeria.
        var selTipo = caja.querySelector('[name="tipo"]');
        var edGal = caja.querySelector("[data-galeria]");
        var campoGal = edGal ? edGal.closest(".c-campo") : null;
        if (selTipo && campoGal) {
          var syncTipo = function () { campoGal.style.display = selTipo.value === "servicio" ? "none" : ""; };
          selTipo.addEventListener("change", syncTipo);
          syncTipo();
        }
        var swFlash = caja.querySelector('[name="flash"]');
        if (swFlash) {
          var syncFlash = function () {
            var lf = caja.querySelector('[name="oferta_hasta"]');
            if (lf && lf.closest("label")) lf.closest("label").style.display = swFlash.checked ? "" : "none";
          };
          swFlash.addEventListener("change", syncFlash);
          syncFlash();
        }
      }
      $("#cr-f").addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var obj = leerCampos(ev.target, cfg.campos);
        if (cfg.tabla === "productos") {
          var swF = ev.target.querySelector('[name="flash"]');
          if (swF && !swF.checked) obj.oferta_hasta = null;
        }
        obj.sitio_id = sitio.id;
        if (fijo) Object.assign(obj, fijo);
        var archivo = cfg.archivo ? $("#cr-archivo").files[0] : null;
        try {
          if (archivo) {
            $("#cr-subida-nota").textContent = "Subiendo a Cloudinary…";
            var privado = cfg.archivo.privadoSegunPrecio ? Number(obj.precio) > 0 : !obj.es_preview;
            var datos = await subirCloudinary(archivo, privado, { max: 1600 });
            if (privado) {
              var pid = datos.public_id || "";
              // En raw el public_id ya trae la extension; no duplicarla.
              obj[cfg.archivo.campoId] = datos.format && pid.slice(-(datos.format.length + 1)) !== "." + datos.format ? pid + "." + datos.format : pid;
            }
            else obj[cfg.archivo.campoUrl] = datos.secure_url;
          }
          var r = editando
            ? await TW.sb.from(cfg.tabla).update(obj).eq("id", editando.id)
            : await TW.sb.from(cfg.tabla).insert(obj);
          if (r.error) throw new Error(r.error.message);
          if (cfg.tabla === "productos") await asegurarCategoria(obj.categoria);
          editando = null;
          formVisible = false;
          pintarForm();
          pintarLista();
        } catch (e) {
          $("#cr-error").textContent = "No se pudo guardar: " + e.message;
        }
      });
      var btnC = $("#cr-cancelar");
      if (btnC) btnC.addEventListener("click", function () { editando = null; formVisible = false; pintarForm(); });
    }
    cont.addEventListener("click", async function (ev) {
      var bb = ev.target.closest("[data-borrar]");
      var bx = ev.target.closest("[data-extra]");
      var be = ev.target.closest("[data-editar]");
      if (bb && confirm("¿Borrar este elemento? No se puede deshacer.")) {
        await TW.sb.from(cfg.tabla).delete().eq("id", bb.dataset.borrar);
        if (editando && editando.id === bb.dataset.borrar) { editando = null; formVisible = false; pintarForm(); }
        pintarLista();
        return;
      }
      if (bx && cfg.alExtra) { cfg.alExtra(bx.dataset.extra); return; }
      if (be) {
        var r = await TW.sb.from(cfg.tabla).select("*").eq("id", be.dataset.editar).maybeSingle();
        if (!r.data) return;
        editando = r.data;
        formVisible = true;
        pintarForm();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    $("#cr-nuevo").addEventListener("click", function () {
      editando = null;
      formVisible = true;
      pintarForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    var iconosPanel = [["vela", "Vela"], ["luna", "Luna"], ["estrella", "Estrella"], ["carta", "Carta de tarot"], ["libro", "Libro"], ["cristal", "Cristal"], ["ojo", "Ojo"], ["llave", "Llave"], ["pocion", "Poción"], ["planta", "Planta"], ["camion", "Envíos"], ["paquete", "Paquete"], ["remera", "Ropa"], ["comida", "Comida"], ["tarjeta", "Tarjeta / pagos"], ["billete", "Efectivo"], ["reloj", "Horario"], ["pin", "Ubicación"], ["escudo", "Garantía"], ["etiqueta", "Ofertas"], ["regalo", "Regalo"], ["calendario", "Reservas / turnos"], ["check", "Check"], ["corazon", "Corazón"], ["casa", "Local"]];
    var rasgosSitio = Array.isArray(sitio.rasgos) ? sitio.rasgos : [];
    var configSitio = sitio.config || {};
    var rubrosDefs = [["general", "General"], ["ropa", "Indumentaria / ropa"], ["calzado", "Calzado"], ["comida", "Comida y bebidas"], ["servicios", "Servicios"], ["digital", "Productos digitales"]];
    var tallesDefs = [["letras", "En letras (XS, S, M, L, XL…)"], ["numeros", "En números (38, 40, 42…)"], ["ninguno", "Mi tienda no usa talles"]];
    // Los mismos dibujos SVG que usa el sitio publico (ICONOS en sitio.js).
    var ICONOS_RASGO = {
      vela: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.2 1.6 2 2.7 2 4a2 2 0 1 1-4 0c0-1.3.8-2.4 2-4z"/><path d="M7 21v-5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5"/><path d="M4.5 21h15"/></svg>',
      luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/></svg>',
      estrella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
      carta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 8.2l.9 1.9 2.1.3-1.5 1.5.35 2.1L12 13l-1.85 1-.35-2.1-1.5-1.5 2.1-.3z"/></svg>',
      libro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2z"/><path d="M12 6.5v13"/></svg>',
      cristal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10l3 5-8 11L4 9z"/><path d="M4 9h16"/><path d="M12 20L9.2 9 12 4l2.8 5z"/></svg>',
      ojo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
      llave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="14.5" r="4.5"/><path d="M11.3 11.2L20 2.5"/><path d="M16.8 5.7l2.7 2.7"/></svg>',
      pocion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3h4"/><path d="M11 3v5.2L6.6 15a3 3 0 0 0 2.7 4.5h5.4a3 3 0 0 0 2.7-4.5L13 8.2V3"/><path d="M8.2 15h7.6"/></svg>',
      planta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-7"/><path d="M12 14c0-3.8 2.8-5.8 6.5-5.8 0 3.8-2.3 6-6.5 5.8z"/><path d="M12 11.5c0-3.2-2.4-4.9-5.5-4.9 0 3.2 2 5.1 5.5 4.9z"/></svg>',
      camion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h12v10H2z"/><path d="M14 10h3.6L21 13.4V16h-7z"/><circle cx="6.5" cy="17.8" r="1.9"/><circle cx="16.8" cy="17.8" r="1.9"/><path d="M8.4 17.8h6.5"/></svg>',
      paquete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8L12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/><path d="M7.5 5.6l9 5"/></svg>',
      remera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 3.5L3 7l1.8 3.4L7 9v11.5h10V9l2.2 1.4L21 7l-5.2-3.5a3.9 3.9 0 0 1-7.6 0z"/></svg>',
      comida: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 2.8v6.4M4 2.8v3.6a2.5 2.5 0 0 0 5 0V2.8"/><path d="M6.5 9.2v12"/><path d="M17.5 2.8c-1.7 1.3-2.6 3.5-2.6 5.9 0 1.9 1 3.1 2.6 3.1v9.4"/><path d="M17.5 2.8v18.4" opacity="0"/></svg>',
      tarjeta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
      billete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M5.8 9.8h.01M18.2 14.2h.01"/></svg>',
      reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3 2"/></svg>',
      pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.2S5.4 15.9 5.4 10.2a6.6 6.6 0 0 1 13.2 0c0 5.7-6.6 11-6.6 11z"/><circle cx="12" cy="10.2" r="2.4"/></svg>',
      escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.8l7.2 2.8v5.6c0 4.8-3.4 7.9-7.2 9.8C8.2 19.1 4.8 16 4.8 11.2V5.6z"/><path d="M8.8 11.8l2.2 2.2 4.2-4.4"/></svg>',
      etiqueta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.6" cy="7.6" r="1.3"/></svg>',
      regalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8s-4.2.2-4.2-2A1.9 1.9 0 0 1 11.5 5C12.3 6 12 8 12 8zM12 8s4.2.2 4.2-2A1.9 1.9 0 0 0 12.5 5C11.7 6 12 8 12 8z"/></svg>',
      calendario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.6l5.2 5L20 6.8"/></svg>',
      corazon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.4C6.8 16.4 3.4 13.2 3.4 9.7A4.5 4.5 0 0 1 7.9 5.2c1.7 0 3.2.9 4.1 2.3a5.2 5.2 0 0 1 4.1-2.3 4.5 4.5 0 0 1 4.5 4.5c0 3.5-3.4 6.7-8.6 10.7z"/></svg>',
      casa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11L12 3.5 20.5 11"/><path d="M5.8 9.3V20.5h12.4V9.3"/><path d="M9.8 20.5v-5.6h4.4v5.6"/></svg>'
    };
    // Cada punto fuerte es una tarjeta: vista previa tal como se ve
    // en el sitio, texto y selector de iconos en grilla (sin listas
    // desplegables). El icono elegido vive en data-icono de la tarjeta.
    function tarjetaPunto(r) {
      var icono = r && ICONOS_RASGO[r.icono] ? r.icono : "estrella";
      var titulo = r ? (r.titulo || "") : "";
      var desc = r ? (r.descripcion || "") : "";
      return "<div class='pf-card' data-icono='" + icono + "'>" +
        "<div class='pf-vista'><span class='pf-vista-ico'>" + ICONOS_RASGO[icono] + "</span>" +
        "<span class='pf-vista-titulo'>" + (titulo ? esc(titulo) : "Tu punto fuerte") + "</span>" +
        "<span class='pf-vista-desc'>" + esc(desc) + "</span>" +
        "<button type='button' class='pf-quitar' title='Quitar' aria-label='Quitar'>✕</button></div>" +
        "<label>Título <input type='text' class='c-rasgo-titulo' value='" + esc(titulo) + "' placeholder='Envíos a todo el país'></label>" +
        "<label>Descripción (opcional) <input type='text' class='c-rasgo-desc' value='" + esc(desc) + "' placeholder='Salidas todos los días, llega en 24-48 h'></label>" +
        "<div class='pf-iconos'>" + iconosPanel.map(function (o) {
          return "<button type='button' class='pf-ico" + (o[0] === icono ? " activo" : "") + "' data-ico='" + o[0] + "' title='" + o[1] + "'>" + ICONOS_RASGO[o[0]] + "</button>";
        }).join("") + "</div></div>";
    }
    var metodosSitio = TW.metodosDeSitio(configSitio);
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
      "<label>Quién soy / quiénes somos <textarea name='quienes_somos' class='grande'>" + esc(sitio.quienes_somos) + "</textarea></label></div>" +
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
      "<div class='p-bloque'><h3>Medios de cobro</h3>" +
      "<p class='p-ayuda'>Los métodos generales de tu sitio: se usan en todos tus cursos, productos y documentos, salvo que un ítem tenga los suyos propios. Cada método puede ser un link de pago o un código QR, del país que elijas.</p>" +
      "<label>País de tu sitio <select name='pais'>" +
      Object.keys(TW.PAISES).filter(function (cod) { return cod !== "INT"; }).map(function (cod) { return "<option value='" + cod + "'" + ((configSitio.pais || "AR") === cod ? " selected" : "") + ">" + TW.PAISES[cod].nombre + "</option>"; }).join("") +
      "</select></label>" +
      "<p class='p-ayuda'>Es el país principal de tu página: al agregar un método, primero salen los servicios de ese país. Igual podés sumar métodos de otros países e internacionales.</p>" +
      "<div class='mt-editor' id='c-metodos'><div class='mt-cards'></div>" +
      "<button type='button' class='btn btn-fantasma' id='c-metodo-agregar' data-mt-add>+ Agregar método</button></div></div>" +
      "<div class='p-bloque'><h3>Módulos visibles</h3>" +
      modulosDefs.map(function (m) {
        return "<label class='mod-fila'><span class='mod-info'><span class='mod-nombre'>" + m[1] + "</span><span class='mod-desc'>" + m[2] + "</span></span>" +
          "<input type='checkbox' class='mod-switch' name='mod_" + m[0] + "'" + (mods[m[0]] !== false ? " checked" : "") + "></label>";
      }).join("") + "</div>" +
      "<div class='p-bloque'><h3>Puntos fuertes</h3><p class='p-ayuda'>Las tarjetas con icono que se ven en tu sitio, bajo tu presentación. Escribí el texto y tocá un icono para elegirlo: la vista previa muestra cómo va a quedar. Hasta 6.</p><div id='c-rasgos' class='pf-grid'>" +
      (rasgosSitio.length ? rasgosSitio.map(tarjetaPunto).join("") : tarjetaPunto(null)) +
      "</div><button type='button' class='btn btn-fantasma' id='c-rasgo-agregar'>+ Agregar punto fuerte</button></div>" +
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
    crearEditorMetodos($("#c-metodos"), metodosSitio);
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
      if (contRasgos.querySelectorAll(".pf-card").length >= 6) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = tarjetaPunto(null);
      contRasgos.appendChild(tmp.firstChild);
    });
    if (contRasgos) {
      contRasgos.addEventListener("click", function (ev) {
        var quitar = ev.target.closest(".pf-quitar");
        if (quitar) { quitar.closest(".pf-card").remove(); return; }
        var ico = ev.target.closest(".pf-ico");
        if (!ico) return;
        var card = ico.closest(".pf-card");
        card.dataset.icono = ico.dataset.ico;
        card.querySelectorAll(".pf-ico").forEach(function (b) { b.classList.toggle("activo", b === ico); });
        card.querySelector(".pf-vista-ico").innerHTML = ICONOS_RASGO[ico.dataset.ico] || "";
      });
      contRasgos.addEventListener("input", function (ev) {
        var card = ev.target.closest(".pf-card");
        if (!card) return;
        if (ev.target.classList.contains("c-rasgo-titulo")) {
          var vista = card.querySelector(".pf-vista-titulo");
          if (vista) vista.textContent = ev.target.value.trim() || "Tu punto fuerte";
        }
        if (ev.target.classList.contains("c-rasgo-desc")) {
          var vistaD = card.querySelector(".pf-vista-desc");
          if (vistaD) vistaD.textContent = ev.target.value;
        }
      });
    }
    mejorarConRico(document.querySelector("#f-sitio [name='quienes_somos']"));
    $("#f-sitio").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target);
      var nuevosMods = {};
      modulosDefs.forEach(function (m) { nuevosMods[m[0]] = !!f.get("mod_" + m[0]); });
      var rasgosNuevos = [];
      document.querySelectorAll(".pf-card").forEach(function (card) {
        var ti = card.querySelector(".c-rasgo-titulo").value.trim();
        if (!ti) return;
        var de = card.querySelector(".c-rasgo-desc").value.trim();
        var item = { icono: card.dataset.icono || "estrella", titulo: ti };
        if (de) item.descripcion = de;
        rasgosNuevos.push(item);
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
          stock_bajo: Number(f.get("stock_bajo")) || 0,
          pais: f.get("pais") || "AR",
          metodos_pago: leerMetodosDe(document.getElementById("c-metodos")),
          pago_mp: null,
          pago_paypal: null,
          pago_qr: null,
          pagos_qr: null
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
      "<div class='p-bloque'><h3>Tus publicaciones</h3><div id='feed-lista' class='p-posts'></div></div>";
    async function pintar() {
      var r = await TW.sb.from("publicaciones").select("*").eq("sitio_id", sitio.id).order("creada", { ascending: false }).limit(50);
      $("#feed-lista").innerHTML = (r.data || []).length ? r.data.map(function (p) {
        return "<article class='p-post" + (p.imagen_url ? "" : " sin-img") + "'>" +
          (p.imagen_url ? "<div class='p-post-media'><img src='" + esc(p.imagen_url) + "' alt='' loading='lazy'></div>" : "") +
          "<div class='p-post-cuerpo'><p class='p-post-texto'>" + esc(p.texto) + "</p>" +
          "<div class='p-post-meta'><span>" + (p.alcance === "publico" ? "Público" : "De curso") + "</span><span>" + new Date(p.creada).toLocaleDateString("es-AR") + "</span></div></div>" +
          '<button class="btn btn-peligro btn-chico" data-borrar-pub="' + p.id + '">Borrar</button></article>';
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
      "<form id='f-doc'><div class='p-dos'><label>Código del alumno <input type='text' name='alumno_id' required placeholder='Ej.: 745SAB' autocomplete='off'></label>" +
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
      var viaTexto = { manual: "se unió desde el sitio", registro: "se registró desde el sitio", suscripcion: "llegó por un curso", compra: "llegó por un documento" };
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
      var dato = String(f.get("alumno_id") || "").trim();
      var alumnoId = null;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dato)) {
        alumnoId = dato;
      } else {
        var limpio = dato.toUpperCase().replace(/[^A-Z0-9]/g, "");
        var rb = await TW.sb.from("perfiles").select("id").eq("codigo", limpio).maybeSingle();
        if (rb.data) alumnoId = rb.data.id;
      }
      if (!alumnoId) { $("#e-doc").textContent = "No se encontró ningún alumno con ese código. El alumno lo ve en su panel, en «Mi aprendizaje»."; return; }
      var r = await TW.sb.from("accesos_documentos").insert({
        alumno_id: alumnoId, documento_id: f.get("documento_id"), sitio_id: sitio.id, estado: "activa"
      });
      if (r.error) { $("#e-doc").textContent = "No se pudo: " + r.error.message; return; }
      ev.target.reset();
      pintar();
    });
    pintar();
  }

  // ============================================================ mi aprendizaje
  async function vistaAprendizaje(cont) {
    var rpCod = await TW.sb.from("perfiles").select("codigo").eq("id", user.id).maybeSingle();
    var miCodigo = (rpCod.data && rpCod.data.codigo) || "";
    cont.innerHTML = "<h2>Mi aprendizaje</h2><p class='bajada'>Tus cursos y documentos como alumno, en todos los sitios de la plataforma." +
      (miCodigo ? " Tu código de alumno es <strong>" + esc(miCodigo) + "</strong>: pasáselo al maestro si necesita darte un acceso a mano." : "") +
      "</p><div id='ap-lista'></div>";
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
