// TemploWeb · panel del maestro y del alumno.
// Auth con Supabase, CRUD generico por modulo y subida firmada a
// Cloudinary. La seguridad real la pone RLS: este panel solo puede
// tocar las filas del usuario conectado.
(function () {
  "use strict";
  var user = null;
  var sitio = null;
  var tabActual = "sitio";
  function $(s) { return document.querySelector(s); }
  function esc(s) { return TW.esc(s); }

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
    $("#btn-salir").hidden = !user;
    $("#p-usuario").textContent = user ? user.email : "";
    $("#vista-auth").hidden = !!user;
    $("#vista-panel").hidden = !user;
    if (user) {
      var r = await TW.sb.from("sitios").select("*").eq("dueno_id", user.id).maybeSingle();
      sitio = r.data || null;
      var rp = await TW.sb.from("perfiles").select("es_admin").eq("id", user.id).maybeSingle();
      var la = $("#link-admin");
      if (la) la.hidden = !(rp.data && rp.data.es_admin);
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
  document.querySelectorAll("#p-tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      tabActual = b.dataset.tab;
      document.querySelectorAll("#p-tabs button").forEach(function (x) { x.classList.toggle("activa", x === b); });
      pintarTab(tabActual);
    });
  });
  function pintarTab(tab) {
    var cont = $("#p-contenido");
    cont.innerHTML = "";
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
  async function subirCloudinary(archivo, privado) {
    var sesion = await TW.sb.auth.getSession();
    var token = sesion.data.session.access_token;
    var tipoRes = archivo.type.indexOf("image/") === 0 ? "image"
      : (archivo.type.indexOf("video/") === 0 || archivo.type.indexOf("audio/") === 0) ? "video" : "raw";
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
      bajada: "Físicos, digitales o servicios. El botón de compra usa tu link de pago; sin link, el visitante consulta por WhatsApp.",
      campos: [
        { k: "nombre", et: "Nombre", tipo: "text" },
        { k: "tipo", et: "Tipo", tipo: "select", opciones: [["fisico", "Físico"], ["digital", "Digital"], ["servicio", "Servicio"]] },
        { k: "descripcion", et: "Descripción", tipo: "textarea" },
        { k: "precio", et: "Precio (vacío = a consultar)", tipo: "number" },
        { k: "imagen_url", et: "URL de la imagen", tipo: "text" },
        { k: "link_pago", et: "Link de pago (Mercado Pago, Stripe…)", tipo: "text" },
        { k: "orden", et: "Orden", tipo: "number" },
        { k: "destacado", et: "Destacado en la vidriera", tipo: "check" },
        { k: "publicado", et: "Publicado", tipo: "check", def: true }
      ],
      resumen: function (x) { return TW.precio(x.precio, x.moneda) + (x.destacado ? " · destacado" : "") + (x.publicado ? "" : " · borrador"); }
    },
    articulos: {
      titulo: "Artículos", tabla: "articulos", orden: "creado",
      bajada: "Tu blog. El cuerpo acepta Markdown simple: **negrita**, *itálica*, [enlaces](url) y listas con guión.",
      campos: [
        { k: "titulo", et: "Título", tipo: "text" },
        { k: "slug", et: "Dirección (slug)", tipo: "text" },
        { k: "extracto", et: "Extracto", tipo: "textarea" },
        { k: "cuerpo", et: "Cuerpo", tipo: "textarea-grande" },
        { k: "imagen_url", et: "URL de la imagen", tipo: "text" },
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
        { k: "imagen_url", et: "URL de la imagen", tipo: "text" },
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
        { k: "imagen_url", et: "URL de la imagen", tipo: "text" },
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
    return "<label>" + c.et + '<input type="' + (c.tipo === "number" ? "number" : "text") + '" name="' + c.k + '" value="' + esc(v) + '"' + (c.tipo === "number" ? ' step="any" min="0"' : "") + "></label>";
  }
  function leerCampos(form, campos) {
    var f = new FormData(form);
    var obj = {};
    campos.forEach(function (c) {
      if (c.tipo === "check") obj[c.k] = form.querySelector('[name="' + c.k + '"]').checked;
      else if (c.tipo === "number") { var n = f.get(c.k); obj[c.k] = n === "" || n === null ? null : Number(n); }
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
            var datos = await subirCloudinary(archivo, privado);
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
    var temasDefs = [
      ["crepusculo", "Crepúsculo", "#030305", "#00e5ff", "Oscuro azul, neón cian"],
      ["pergamino", "Pergamino", "#f6f1e7", "#9a6a1f", "Claro cálido, editorial"],
      ["bosque", "Bosque", "#0e1a14", "#7fc98f", "Oscuro verde, sereno"],
      ["obsidiana", "Obsidiana", "#0a0a0c", "#d9a441", "Negro y dorado"],
      ["arcano", "Arcano", "#060404", "#d9a441", "Negro, dorado y símbolos"]
    ];
    var urlSitio = "sitio.html?s=" + sitio.slug;
    var urlAbsoluta = new URL(urlSitio, location.href).href;
    cont.innerHTML =
      "<div class='p-bloque c-resumen'>" +
        "<div class='c-url'><span class='c-url-texto'>" + esc(urlAbsoluta) + "</span>" +
        "<button class='btn btn-fantasma btn-chico' type='button' id='c-copiar'>Copiar</button>" +
        "<a class='btn btn-fantasma btn-chico' href='" + urlSitio + "' target='_blank' rel='noopener'>Abrir</a>" +
        "<span class='c-plan" + (sitio.plan === "premium" ? " c-plan-premium" : "") + "'>Plan " + esc(sitio.plan) + "</span>" +
        (sitio.publicado ? "" : "<span class='c-plan'>Sin publicar</span>") + "</div>" +
        "<div class='c-stats' id='c-stats'><span class='c-chip'>Cargando tu contenido…</span></div>" +
      "</div>" +
      "<div class='constructor'>" +
      "<form id='f-sitio' class='c-form'>" +
      "<div class='p-bloque'><h3>Identidad</h3>" +
      "<label>Nombre <input type='text' name='nombre' value='" + esc(sitio.nombre) + "'></label>" +
      "<label>Descripción corta <textarea name='descripcion'>" + esc(sitio.descripcion) + "</textarea></label>" +
      "<label>Quién soy / quiénes somos (Markdown simple) <textarea name='quienes_somos' class='grande'>" + esc(sitio.quienes_somos) + "</textarea></label></div>" +
      "<div class='p-bloque'><h3>Apariencia</h3>" +
      "<div class='temas'>" + temasDefs.map(function (td) {
        return "<label class='tema-card'><input type='radio' name='tema' value='" + td[0] + "'" + (sitio.tema === td[0] ? " checked" : "") + ">" +
          "<span class='tema-prev' style='--tp-fondo:" + td[2] + ";--tp-acento:" + td[3] + "'><span class='tema-barra'></span><span class='tema-linea'></span><span class='tema-linea corta'></span></span>" +
          "<span class='tema-nombre'>" + td[1] + "</span><span class='tema-desc'>" + td[4] + "</span></label>";
      }).join("") + "</div>" +
      "<div class='p-dos'><label>Color de acento (opcional) <span class='c-acento'><input type='text' name='acento' id='c-acento-texto' value='" + esc(sitio.acento || "") + "' placeholder='#00e5ff'><input type='color' id='c-acento-color' value='" + esc(sitio.acento || "#00e5ff") + "'></span></label>" +
      "<label>Texto del pie de página <input type='text' name='footer_texto' value='" + esc(sitio.footer_texto) + "'></label></div>" +
      "<div class='p-dos'><label>URL del logo <input type='text' name='logo_url' id='c-logo' value='" + esc(sitio.logo_url || "") + "'>" + (sitio.logo_url ? "<img class='c-mini' id='c-logo-img' src='" + esc(sitio.logo_url) + "' alt=''>" : "") + "</label>" +
      "<label>URL de tu foto <input type='text' name='foto_url' id='c-foto' value='" + esc(sitio.foto_url || "") + "'>" + (sitio.foto_url ? "<img class='c-mini' id='c-foto-img' src='" + esc(sitio.foto_url) + "' alt=''>" : "") + "</label></div></div>" +
      "<div class='p-bloque'><h3>Contacto</h3>" +
      "<div class='p-dos'><label>WhatsApp (solo números, con código de país) <input type='text' name='whatsapp' value='" + esc(sitio.whatsapp || "") + "'></label>" +
      "<label>Email de contacto <input type='text' name='email' value='" + esc(sitio.email || "") + "'></label></div></div>" +
      "<div class='p-bloque'><h3>Módulos visibles</h3>" +
      modulosDefs.map(function (m) {
        return "<label class='mod-fila'><span class='mod-info'><span class='mod-nombre'>" + m[1] + "</span><span class='mod-desc'>" + m[2] + "</span></span>" +
          "<input type='checkbox' class='mod-switch' name='mod_" + m[0] + "'" + (mods[m[0]] !== false ? " checked" : "") + "></label>";
      }).join("") + "</div>" +
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
      try { await navigator.clipboard.writeText(urlAbsoluta); $("#c-copiar").textContent = "Copiado"; }
      catch (e) { $("#c-copiar").textContent = "Copiá la dirección de arriba"; }
      setTimeout(function () { var b = $("#c-copiar"); if (b) b.textContent = "Copiar"; }, 2000);
    });
    function recargarPrevia() {
      var ifr = $("#c-iframe");
      if (ifr) ifr.src = urlSitio + "&t=" + Date.now();
    }
    $("#c-recargar").addEventListener("click", recargarPrevia);
    var acT = $("#c-acento-texto"), acC = $("#c-acento-color");
    if (acT && acC) acC.addEventListener("input", function () { acT.value = acC.value; });
    [["#c-logo", "#c-logo-img"], ["#c-foto", "#c-foto-img"]].forEach(function (par) {
      var inp = $(par[0]), img = $(par[1]);
      if (inp && img) inp.addEventListener("input", function () { img.src = inp.value; });
    });
    $("#f-sitio").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var f = new FormData(ev.target);
      var nuevosMods = {};
      modulosDefs.forEach(function (m) { nuevosMods[m[0]] = !!f.get("mod_" + m[0]); });
      var r = await TW.sb.from("sitios").update({
        nombre: f.get("nombre"), descripcion: f.get("descripcion") || "",
        quienes_somos: f.get("quienes_somos") || "", logo_url: f.get("logo_url") || null,
        foto_url: f.get("foto_url") || null, whatsapp: f.get("whatsapp") || null,
        email: f.get("email") || null, tema: f.get("tema"),
        acento: f.get("acento") || null, footer_texto: f.get("footer_texto") || "",
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
      "<label>URL de imagen (opcional) <input type='text' name='imagen_url'></label>" +
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
    cont.innerHTML = "<h2>Alumnos</h2><p class='bajada'>Solicitudes y suscripciones a tus cursos. Cuando un alumno paga por tu link, activalo acá.</p>" +
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
        (s.estado === "activa" ? '<a class="btn btn-primario btn-chico" href="curso.html?s=' + encodeURIComponent(sitioS.slug || "") + "&c=" + s.curso_id + '">Ir al aula</a>' : "") + "</div>";
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
