/* The Skull · v1.1 · pantallas (Inicio y Ronda). Habla con el motor de Google por internet (doPost de v11_api.gs). */
(function () {
  'use strict';
  var CFG = window.SKULL_CONFIG || {};
  var ABST = '(abstención)';
  var TOKEN = '', S = null, TAB = 'inicio', CUR = null, SEL = '', EDIT = false;
  var GAL = [];   // fotos del álbum que se están mostrando (galería)

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(t) { var e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { e.hidden = true; }, 2600); }
  function errMsg(e) { return (e && e.message ? e.message : String(e)).replace(/^(Exception|Error): /, ''); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    var p = [], i, j; for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { var q = [i]; for (j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[b.length];
  }
  /** 2E: la ganadora se resalta aunque la escritura cambie un poco («Pan» / «Pain»). */
  function igual(a, b) { a = norm(a); b = norm(b); return !!a && !!b && (a === b || (a.length > 4 && lev(a, b) <= 2)); }
  function hue(s) { var h = 0; String(s).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; }); return h; }

  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fecha(ymd) { var p = String(ymd || '').split('-').map(Number); return p.length === 3 && p[0] ? new Date(p[0], p[1] - 1, p[2]) : null; }
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function diasHasta(ymd) { var d = fecha(ymd); return d ? Math.round((d - hoy()) / 864e5) : null; }
  function fCorta(ymd) { var d = fecha(ymd); return d ? DIAS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) : ''; }
  function fLarga(ymd) { var d = fecha(ymd); return d ? DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] : ''; }

  function cover(r, lg) {
    var h = hue(r.banda || r.homenaje || '?');
    var st = '--c1:hsl(' + h + ',24%,27%);--c2:hsl(' + h + ',18%,9%)';
    var src = r.portada || (r.mbid ? 'https://coverartarchive.org/release-group/' + r.mbid + '/front-250' : '');
    var img = src ? '<img alt="" loading="lazy" src="' + esc(src) + '" onerror="this.parentNode.classList.remove(\'pic\');this.remove()">' : '';
    return '<div class="cover' + (lg ? ' lg' : '') + (src ? ' pic' : '') + '" style="' + st + '"><small>#</small><b>' + esc(r.numero || '—') + '</b>' + img +
      '<span class="nb">#' + esc(r.numero || '') + '</span></div>';
  }
  function quien(r) {
    if (r.tipo === 'cumpleaños') return '🎂 Cumpleaños de ' + r.proponente;
    if (r.tipo === 'póstuma') return '✝️ En homenaje a ' + (r.homenaje || '…');
    return r.proponente ? 'Propuesta de ' + r.proponente : '';
  }
  function origen(r) { return [r.pais, r.anio].filter(Boolean).join(' · '); }
  function waLink(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }
  function copiar(text, ta) {
    var ok = function () { toast('Copiado'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, plan);
    else plan();
    function plan() { if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Selecciona el texto y cópialo'); } } }
  }
  function cajaMensaje(text, titulo) {
    if (S && S.me && S.me.sinWhatsapp) return '';   // 9G: sin botones de WhatsApp para quien no está en el grupo
    var id = 'm' + Math.random().toString(36).slice(2, 8);
    setTimeout(function () { var b = $(id + 'c'); if (b) b.onclick = function () { copiar(text, $(id)); }; }, 0);
    return '<div class="sec"><span class="k">' + esc(titulo || 'Mensaje para WhatsApp') + '</span>' +
      '<textarea id="' + id + '" readonly style="min-height:120px">' + esc(text) + '</textarea>' +
      '<div class="row"><button class="btn ghost" id="' + id + 'c">Copiar</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + waLink(text) + '">Abrir WhatsApp</a></div></div>';
  }

  /* ---------- conexión con el motor ---------- */
  var LECTURAS = ['api_state', 'api_round', 'api_historial', 'api_playlist', 'api_delCuaderno', 'api_portadas', 'api_stats11', 'api_me', 'api_buscarBanda',
    'api_buscarDisco', 'api_discografia', 'api_edicion', 'api_miembros', 'api_ajustes', 'api_mensajes', 'api_mensaje11', 'api_log', 'api_inbox', 'api_roundEditInfo'];
  function api(fn) {
    var args = [TOKEN].concat(Array.prototype.slice.call(arguments, 1));
    if (typeof window.SKULL_DEMO === 'function') return Promise.resolve().then(function () { return window.SKULL_DEMO(fn, args); });
    if (!CFG.MOTOR) return Promise.reject(new Error('La app todavía no está conectada.'));
    var lectura = LECTURAS.indexOf(fn) >= 0;
    function pedir() {
      return fetch(CFG.MOTOR, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .catch(function (e) { var x = new Error(lectura ? 'No hay conexión con la app en este momento. Inténtalo de nuevo.' : 'La app no respondió. Espera unos segundos y vuelve a intentarlo.'); x.red = true; throw x; });
    }
    // Fallos de conexión (no errores de la app): las pantallas que solo leen se reintentan solas una vez.
    // Las acciones (votar, proponer, cerrar…) nunca se repiten solas, para que nada se mande dos veces.
    // También se reintenta una lectura cuando el motor contesta con un fallo pasajero (Discogs ocupado, Google saturado).
    var PASAJERO = /Discogs no responde|lock|bloqueo|Service .*(failed|timed out|invoked too many|unavailable)|try again|Exceeded maximum|Address unavailable/i;
    function espera() { return new Promise(function (ok) { setTimeout(ok, 1500); }); }
    // Si tarda, se avisa: la app sigue trabajando (no es que no haya conexión)
    var lento = setTimeout(function () { toast('Esto está tardando más de lo normal… un momento'); }, 7000);
    var lento2 = setTimeout(function () { toast('Sigue trabajando… no cierres la app'); }, 16000);
    var p = pedir();
    if (lectura) p = p.catch(function () { return espera().then(pedir); })
      .then(function (o) { return (!o.ok && PASAJERO.test(String(o.error || ''))) ? espera().then(pedir) : o; });
    var fin = function () { clearTimeout(lento); clearTimeout(lento2); };
    return p.then(function (o) { fin(); if (!o.ok) throw new Error(o.error || 'Algo salió mal'); return o.data; }, function (e) { fin(); throw e; });
  }
  function leerToken() {
    var t = new URLSearchParams(location.search).get('t') || '';
    try { if (t) localStorage.setItem('skull_t', t); else t = localStorage.getItem('skull_t') || ''; } catch (e) {}
    // El ?t= se queda en la dirección a propósito: así «Añadir a pantalla de inicio» (iPhone y Android) guarda el enlace personal completo.
    // (El icono de la pantalla de inicio tiene su propio almacén, separado de Safari: sin el ?t= abriría sin enlace.)
    return t;
  }

  /* ---------- arranque y pestañas ---------- */
  function tabs() {
    var t = [['inicio', 'Inicio'], ['historial', 'Historial'], ['numeros', 'Números'], ['yo', 'Yo']];
    if (S.me.esAdmin) t.push(['panel', 'Panel']);   // 6F: barra de 5 para los admins
    var n = $('tabs'); n.style.setProperty('--n', t.length);
    n.innerHTML = t.map(function (x) { return '<button data-tab="' + x[0] + '"' + (x[0] === TAB ? ' class="on"' : '') + '><i></i>' + x[1] + '</button>'; }).join('');
    n.hidden = false;
    n.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { TAB = b.getAttribute('data-tab'); n.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); render(); };
    });
  }
  function cargar(silencioso) {
    if (!TOKEN) { $('view').innerHTML = sinEnlace(); return Promise.resolve(); }
    return api('api_state').then(function (st) {
      S = st; if (!silencioso || !$('tabs').innerHTML) tabs(); if (!silencioso || TAB === 'inicio') render();
    }).catch(function (e) {
      if (silencioso) return;
      if (e && e.red) {   // fallo de conexión: no es problema del enlace
        $('view').innerHTML = '<div class="hero"></div><div class="err">' + esc(errMsg(e)) + '</div><button class="btn" id="reint">Reintentar</button>';
        $('reint').onclick = function () { $('view').innerHTML = '<div class="hero"></div><div class="spin"></div>'; cargar(); };
        return;
      }
      $('view').innerHTML = '<div style="height:20px"></div><div class="err">' + esc(errMsg(e)) + '</div>' + sinEnlace();
    });
  }
  function sinEnlace() {
    setTimeout(enlazarPegado, 0);
    return '<div class="hero"></div><div class="note"><b>Esta app se abre con tu enlace personal.</b><br>Búscalo en el mensaje privado que te mandó Chiquito por WhatsApp y ábrelo desde ahí. Si lo perdiste, pídele uno nuevo.' +
      '<div style="margin-top:12px"><b>¿Ya tienes el enlace?</b> Cópialo del mensaje y pégalo aquí:</div>' +
      '<div class="row" style="flex-wrap:nowrap;margin-top:6px"><input type="text" id="pegaEnlace" placeholder="https://…?t=…" style="flex:1" autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="btn small" id="usaEnlace">Entrar</button></div><div class="muted" id="pegaMsg" style="margin-top:6px;font-size:13px"></div></div>';
  }
  /* Enlace pegado a mano (cuando la app se abre sin ?t=, por ejemplo desde el icono de la pantalla de inicio). */
  function enlazarPegado() {
    var b = $('usaEnlace'), i = $('pegaEnlace'); if (!b || !i) return;
    function usar() {
      var txt = (i.value || '').trim(), m = txt.match(/[?&#]t=([A-Za-z0-9_-]+)/) || (/^[A-Za-z0-9_-]{8,}$/.test(txt) ? [0, txt] : null);
      if (!m) { $('pegaMsg').textContent = 'Eso no parece un enlace de The Skull. Pega el enlace completo del mensaje de Chiquito.'; return; }
      try { localStorage.setItem('skull_t', m[1]); } catch (e) {}
      location.replace(location.pathname + '?t=' + m[1]);
    }
    b.onclick = usar; i.onkeydown = function (e) { if (e.key === 'Enter') usar(); };
  }
  function render() {
    if (!S) return;
    var v = $('view');
    if (TAB === 'inicio') { v.innerHTML = vistaInicio(); enlazarInicio(); }
    else if (TAB === 'historial') { v.onclick = null; cargarHist(); }
    else if (TAB === 'numeros') vistaNumeros();
    else if (TAB === 'yo') vistaYo();
    else if (TAB === 'panel' && S.me.esAdmin) vistaPanel();
    else v.innerHTML = '<div class="hero"></div><div class="soon"><h2>' + esc({ historial: 'Historial', numeros: 'Números', yo: 'Yo', panel: 'Panel' }[TAB]) + '</h2><p>Esta pantalla llega en la próxima entrega.</p></div>';
    window.scrollTo(0, 0);
  }

  /* ---------- Inicio ---------- */
  function estadoChip(r) {
    if (r.estado === 'whatsapp' && !(r.canciones >= 2)) return '<span class="chip grey">WhatsApp</span>';
    if (r.estado === 'desempate') return '<span class="chip gold">Empate</span>';
    if (r.miVoto === ABST) return '<span class="chip grey">Te abstuviste</span>';
    if (r.miVoto) return '<span class="chip done">Votaste</span>';
    return '<span class="chip go">Votar</span>';
  }
  function limite(r) {
    if (r.estado === 'whatsapp') return '<span class="lim">' + (r.canciones >= 2 ? 'Se vota en el chat y aquí' : 'Se está votando en el chat') + '</span>';
    if (!r.fecha_limite) return '';
    var d = diasHasta(r.fecha_limite);
    if (d === null) return '';
    if (d <= 0) return '<span class="lim hot">Se cierra hoy</span>';
    if (d === 1) return '<span class="lim hot">Se cierra mañana</span>';
    return '<span class="lim">Se cierra a más tardar el ' + esc(fCorta(r.fecha_limite)) + '</span>';
  }
  function tarjeta(r) {
    var pct = r.total ? Math.round(r.votaron * 100 / r.total) : 0;
    var h = '<button class="card' + (!r.miVoto && r.estado === 'abierta' ? ' mine' : '') + '" data-r="' + esc(r.id) + '">' + cover(r) + '<div class="ci">' +
      '<span class="t1">' + esc(r.banda) + ' · ' + esc(r.disco) + '</span>' +
      '<span class="m">' + esc([quien(r), origen(r)].filter(Boolean).join(' · ')) + '</span>' +
      '<div class="meter' + (pct >= 70 ? ' ok' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<span class="m">' + r.votaron + ' de ' + r.total + ' votaron</span>' + limite(r);
    var nf = r.faltan ? r.faltan.length : (r.total - r.votaron);
    if (nf > 0 && r.estado !== 'desempate') h += '<span class="faltan">Faltan ' + nf + (S.me.esAdmin && r.faltan && r.faltan.length ? ': <b>' + esc(r.faltan.join(', ')) + '</b>' : '') + '</span>';
    if (S.me.esAdmin && (r.todosVotaron || r.listaParaCerrar)) h += '<span class="lim" style="color:var(--gold)">' + (r.todosVotaron ? 'Todos votaron · ¿cerrar?' : 'Lista para cerrar') + '</span>';
    return h + '</div>' + estadoChip(r) + '</button>';
  }
  function vistaInicio() {
    var h = '<div class="hero"><span class="who">' + esc(S.me.nombre) + '</span></div>';
    var pendientes = S.abiertas.filter(function (r) { return r.estado === 'abierta' && !r.miVoto; }).length;
    h += '<div class="hello">Hola, ' + esc(S.me.nombre) + '<span>' +
      (pendientes ? (pendientes === 1 ? 'Tienes una propuesta por votar.' : 'Tienes ' + pendientes + ' propuestas por votar.') : (S.abiertas.length ? 'Estás al día con tus votos. 🤘' : 'No hay nada votándose ahora mismo.')) + '</span></div>';
    S.desempates.forEach(function (r) {
      h += '<div class="warn"><span><b>Empate en la #' + esc(r.numero) + ' ' + esc(r.banda) + '.</b> ' + esc(r.desempate) + '</span>' +
        '<button class="btn small" data-r="' + esc(r.id) + '">Elegir la ganadora</button></div>';
    });
    if (S.puedo.normal) h += '<button class="btn" data-prop="normal">Te toca proponer, ' + esc(S.me.nombre) + '</button>';
    if (S.puedo.cumple) h += '<button class="btn goldb" data-prop="cumpleaños">🎂 Hacer tu propuesta de cumpleaños</button>';
    if (S.puedo.extra) h += '<button class="btn ghost" data-prop="extra">Pedir un turno extra</button>';

    var abiertas = S.abiertas.filter(function (r) { return r.estado !== 'desempate'; });
    var falta = function (r) { return r.estado === 'abierta' && !r.miVoto ? 0 : 1; };
    abiertas.sort(function (a, b) { return falta(a) - falta(b) || (parseInt(b.numero, 10) || 0) - (parseInt(a.numero, 10) || 0); });
    if (abiertas.length) {
      h += '<span class="k sec-t">Votando ahora · ' + abiertas.length + '</span>';
      abiertas.forEach(function (r) { h += tarjeta(r); });
    } else if (S.ultima) {   // 1C
      var u = S.ultima;
      h += '<span class="k sec-t">Lo último que se cerró</span><button class="last" data-r="' + esc(u.id) + '">' + (u.portada ? '<img class="lastimg" alt="" src="' + esc(u.portada) + '" onerror="this.remove()">' : '') +
        '<span class="m muted" style="font-size:13px"><span class="num">#' + esc(u.numero) + '</span> · ' + esc(u.banda) + ' – ' + esc(u.disco) + '</span>' +
        '<span class="win">' + esc(u.ganadora) + '</span><span class="muted" style="font-size:13px">' + esc([quien(u), origen(u)].filter(Boolean).join(' · ')) + '</span></button>';
    }
    // 1D: sin «Abiertas: N normales…» (eso va al Panel)
    h += '<div class="note"><dl class="facts"><dt>Próximo en proponer</dt><dd>' + esc(S.siguiente || '—') + '</dd>' +
      (S.colaCumples.length ? '<dt>Cola de cumpleaños</dt><dd>' + esc(S.colaCumples.join(', ')) + '</dd>' : '') + '</dl></div>';
    if (abiertas.length && S.ultima) {
      var w = S.ultima;
      h += '<button class="note" data-r="' + esc(w.id) + '" style="text-align:left;cursor:pointer;border-style:solid">Lo último que se cerró: <span class="num">#' + esc(w.numero) + '</span> ' + esc(w.banda) +
        ' → <b style="color:var(--gold)">' + esc(w.ganadora) + '</b></button>';
    }
    h += '<span class="k sec-t">Del cuaderno</span><div id="dc"><div class="cuaderno"><span class="muted">Abriendo el cuaderno…</span></div></div>';   // 1E
    var conFotos = S.abiertas.some(function (r) { return r.portada; }) || (S.ultima && S.ultima.portada);
    if (conFotos) h += '<a class="dgs" style="align-self:center" target="_blank" rel="noopener" href="https://www.discogs.com">Portadas: Data provided by Discogs.</a>';   // condición de Discogs
    h += '<p class="foot">' + esc(S.grupo || 'The Skull') + ' · v' + esc(S.version || '1.1') + '</p>';
    return h;
  }
  function enlazarInicio() {
    var v = $('view');
    v.onclick = function (e) {
      var t = e.target.closest('[data-r]'); if (t) { abrirRonda(t.getAttribute('data-r')); return; }
      var p = e.target.closest('[data-prop]'); if (p) abrirProponer(p.getAttribute('data-prop'));
    };
    delCuaderno();
  }
  function delCuaderno() {
    api('api_delCuaderno').then(function (r) {
      var box = $('dc'); if (!box || !r) return;
      box.innerHTML = '<div class="cuaderno" data-r="' + esc(r.id) + '">' + (r.portada ? '<img class="cimg" alt="" src="' + esc(r.portada) + '" onerror="this.remove()">' : '') + '<div class="k">#' + esc(r.numero) + (r.rotacion ? ' · Ronda ' + esc(r.rotacion) : '') + '</div>' +
        '<div class="hand">' + esc(r.banda) + ' – ' + esc(r.disco) + (r.anio ? ' <span class="muted" style="font-family:var(--f-body);font-size:14px">(' + esc(r.anio) + ')</span>' : '') + '</div>' +
        '<div class="w">⇒ ' + esc(r.ganadora) + '</div><div class="muted" style="font-size:13px">' + esc(quien(r)) + '</div>' +
        '<button class="again" id="dcOtra">Otra del cuaderno</button></div>';
      $('dcOtra').onclick = function (e) { e.stopPropagation(); delCuaderno(); };
    }).catch(function () { var box = $('dc'); if (box) box.innerHTML = ''; });
  }

  /* ---------- Ronda: votar y resultado ---------- */
  function abrirHoja(html) { $('sheetIn').onclick = null; $('sheetIn').innerHTML = html; $('sheet').hidden = false; $('sheet').scrollTop = 0; document.body.style.overflow = 'hidden'; }
  function cerrarHoja() { $('sheet').hidden = true; document.body.style.overflow = ''; }
  function topHoja(r) { return '<div class="top"><button class="back" id="back">‹ Volver</button><span class="k" style="margin-left:auto">' + (r && r.rotacion ? 'Ronda ' + esc(r.rotacion) : '') + '</span></div>'; }
  function abrirRonda(id) {
    abrirHoja(topHoja() + '<div class="spin"></div>'); $('back').onclick = cerrarHoja;
    api('api_round', id).then(function (r) { CUR = r; EDIT = false; SEL = r.miVoto && r.miVoto !== ABST ? r.miVoto : ''; dibujarRonda(); })
      .catch(function (e) { abrirHoja(topHoja() + '<div class="err">' + esc(errMsg(e)) + '</div>'); $('back').onclick = cerrarHoja; });
  }
  /** Conteo: de la lista de canciones; si la ronda vino del chat (sin lista), de los votos. */
  function conteo(r) {
    var arr;
    if (r.canciones && r.canciones.some(function (s) { return s.votos > 0; })) arr = r.canciones.map(function (s) { return { titulo: s.titulo, votos: s.votos || 0 }; });
    else { var c = {}; (r.votos || []).forEach(function (v) { if (v.cancion && v.cancion !== ABST) c[v.cancion] = (c[v.cancion] || 0) + 1; }); arr = Object.keys(c).map(function (k) { return { titulo: k, votos: c[k] }; }); }
    return arr.filter(function (s) { return s.votos > 0; }).sort(function (a, b) { return b.votos - a.votos; });
  }
  function barras(r, arr) {
    if (!arr.length) return '';
    var max = arr[0].votos;
    return '<div class="sec">' + arr.map(function (s) {
      var win = r.ganadora && igual(s.titulo, r.ganadora);
      return '<div class="res' + (win ? ' win' : '') + '"><div class="top">' + (win ? '<b>' + esc(s.titulo) + '</b>' : '<span>' + esc(s.titulo) + '</span>') +
        '<span style="font-family:var(--f-mono)">' + s.votos + '</span></div><div class="bar2"><i style="width:' + Math.round(s.votos * 100 / max) + '%"></i></div></div>';
    }).join('') + '</div>';
  }
  /** 2A: todos los miembros en el orden del grupo; «Falta» mientras está abierta, «Abstención» al cerrar. 2D: «×2» en el voto del proponente. */
  function quienVoto(r) {
    var lista = r.lista || [];
    if (!lista.length) return '';
    var abierta = r.estado === 'abierta' || r.estado === 'whatsapp';
    var votaron = lista.filter(function (x) { return x.estado === 'voto'; }).length;
    var h = '<details class="note"' + (abierta ? ' open' : '') + '><summary><b>Quién votó</b> · ' + votaron + ' de ' + lista.length + '</summary><div class="list who-l" style="margin-top:6px">';
    lista.forEach(function (x) {
      var sg;
      if (x.estado === 'voto') sg = '<span class="sg' + (r.ganadora && igual(x.cancion, r.ganadora) ? ' w' : '') + '">' + esc(x.cancion) + '</span>';
      else if (x.estado === 'abstencion') sg = '<span class="sg a">Abstención</span>';
      else sg = abierta ? '<span class="sg f">Falta</span>' : '<span class="sg a">Abstención</span>';
      h += '<div class="li"><span class="nm">' + esc(x.miembro) + (x.doble ? ' <span class="chip x2" title="Voto doble del proponente">×2</span>' : '') +
        (x.tardio ? ' <span class="chip grey">tardío</span>' : '') + '</span>' + sg + (x.comentario ? '<span class="cm">«' + esc(x.comentario) + '»</span>' : '') + '</div>';
    });
    return h + '</div></details>';
  }
  /** Orden del disco: A1, A2, B1… o 1, 2, 3…; las canciones sin posición (votadas que no están en la edición) van al final. */
  function ordenDisco(cs) {
    var clave = function (p) {
      var m = /^([A-Z]*)(?:-?)(\d*)(?:[.-](\d+))?/.exec(String(p || '').toUpperCase().replace(/^CD/, ''));
      if (!p || !m) return [2, '', 0, 0];
      return [0, m[1], Number(m[2]) || 0, Number(m[3]) || 0];
    };
    return cs.map(function (c, i) { return { c: c, k: clave(c.pos), i: i }; }).sort(function (a, b) {
      for (var j = 0; j < 4; j++) { if (a.k[j] < b.k[j]) return -1; if (a.k[j] > b.k[j]) return 1; }
      return a.i - b.i;
    }).map(function (x) { return x.c; });
  }
  function dibujarRonda(extra) {
    var r = CUR, h = topHoja(r);
    if (r.canciones && r.canciones.length) r.canciones = ordenDisco(r.canciones);
    var abierta = r.estado === 'abierta' || (r.estado === 'whatsapp' && !!r.votaEnApp);   // las abiertas en WhatsApp también se votan aquí
    // 2C: número en la cabecera
    var imgs = r.imagenes || [];
    if (imgs.length) {
      h += galHtml(imgs, r.numero, 'Portada de ' + r.disco);
      h += '<a class="dgs" target="_blank" rel="noopener" href="' + esc(r.discogs_url || 'https://www.discogs.com') + '">Data provided by Discogs.</a>';
    }
    h += '<div class="rhead">' + (imgs.length ? '' : cover(r, true)) + '<div class="ci"><span class="b">' + esc(r.banda) + '</span><span class="t">' + esc(r.disco || ('Homenaje a ' + r.homenaje)) + '</span>' +
      '<span class="m">' + esc(origen(r)) + '</span>' +
      (r.estilos ? '<span class="estilos">' + String(r.estilos).split(/\s*,\s*/).slice(0, 3).map(function (e) { return '<span>' + esc(e) + '</span>'; }).join('') + '</span>' : '') +
      (r.tipo === 'cumpleaños' ? '<span class="tag cumple">' + esc(quien(r)) + '</span>' : r.tipo === 'póstuma' ? '<span class="tag postuma">' + esc(quien(r)) + '</span>' : '<span class="m">' + esc(quien(r)) + '</span>') +
      '</div></div>';
    var q = encodeURIComponent(r.banda + ' ' + r.disco);
    h += '<div class="row">' + (r.spotify ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(r.spotify) + '">Spotify</a>' : '<a class="btn ghost" target="_blank" rel="noopener" href="https://open.spotify.com/search/' + q + '">Spotify</a>') +
      (r.youtube ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(r.youtube) + '">YouTube</a>' : '<a class="btn ghost" target="_blank" rel="noopener" href="https://music.youtube.com/search?q=' + q + '">YouTube</a>') + '</div>';
    if (r.presentacion) h += '<details class="note"><summary><b>Presentación de ' + esc(r.proponente) + '</b></summary><div class="pres" style="margin-top:8px">' + esc(r.presentacion) + '</div></details>';
    if (r.edicion) h += '<div class="note">Edición: ' + esc(r.edicion) + '</div>';

    var arr = conteo(r), totalVotos = (r.lista || []).filter(function (x) { return x.estado === 'voto'; }).length;
    if (abierta || r.estado === 'whatsapp') {
      var lim = r.fecha_limite ? 'Se cierra a más tardar el ' + fLarga(r.fecha_limite) : (r.estado === 'whatsapp' ? (r.votaEnApp ? 'Se vota en el chat y aquí' : 'Se está votando en WhatsApp') : '');
      h += '<div class="status"><span class="muted">' + esc(lim) + '</span><span class="num" style="color:var(--bone)">' + totalVotos + ' de ' + (r.lista || []).length + '</span></div>';
    }
    if (extra) h += extra;

    var puede = r.puedoVotar && (abierta ? (!r.miVoto || r.cambiarVoto) : !r.miVoto);
    var tieneLista = r.canciones && r.canciones.length;
    var mostrarLista = puede && tieneLista && (!r.miVoto || EDIT);
    if (puede && tieneLista && r.miVoto && !EDIT) {
      h += '<div class="note" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span>' +
        (r.miVoto === ABST ? 'Te abstuviste en esta.' : 'Tu voto: <b>' + esc(r.miVoto) + '</b>') + '</span>' +
        '<button class="btn small ghost" id="cv">' + (r.miVoto === ABST ? 'Votar' : 'Cambiar') + '</button></div>';
    }
    if (mostrarLista) {
      var ver = S.votosVisibles || r.miVoto;
      var titulo = abierta ? (r.miVoto && r.miVoto !== ABST ? 'Tu voto · puedes cambiarlo' : 'Elige tu canción') : 'Voto tardío';
      h += '<span class="k sec-t">' + titulo + '</span><div class="list" id="tl">';
      r.canciones.forEach(function (s, i) {
        h += '<div class="track' + (s.titulo === SEL ? ' sel' : '') + '" data-i="' + i + '"><span class="n">' + esc(s.pos || i + 1) + '</span><span>' + esc(s.titulo) + '</span>' +
          '<span class="c">' + (ver && s.votos ? s.votos : '') + '</span><span class="r"></span></div>';
      });
      h += '</div><label class="f">Comentario (opcional)<textarea id="com" placeholder="Lo que te pareció el disco">' + esc(r.miComentario || '') + '</textarea></label>' +
        '<button class="btn" id="vb" ' + (SEL && SEL !== r.miVoto ? '' : 'disabled') + '>' + (SEL ? (SEL === r.miVoto ? 'Ya votaste por ' : 'Votar por ') + esc(SEL) : 'Elige una canción') + '</button>' +
        (r.miVoto === ABST ? '' : '<button class="btn ghost" id="ab">Me abstengo</button>');   // 2B
    } else if (r.estado === 'whatsapp') {
      h += '<div class="note">Esta propuesta se está votando en el chat. Chiquito registra el resultado en la app al cerrarla.</div>';
    }
    if (r.miVoto && !(puede && tieneLista)) h += '<div class="note">' + (r.miVoto === ABST ? 'Te abstuviste en esta.' : 'Tu voto: <b>' + esc(r.miVoto) + '</b>') + '</div>';

    if (r.estado === 'cerrada' && r.ganadora) {
      var top = arr.filter(function (s) { return igual(s.titulo, r.ganadora); })[0];
      h += '<div class="winner"><span class="k" style="color:var(--gold)">Ganó</span><span class="s">' + esc(r.ganadora) + '</span>' +
        (top ? '<span class="muted" style="font-size:14px">con ' + top.votos + ' de ' + totalVotos + ' votos</span>' : '') + '</div>';
      if (r.desempate) h += '<div class="note"><b>Cómo se decidió:</b> ' + esc(r.desempate) + '</div>';
      h += barras(r, arr);
    } else if (r.estado === 'desempate') {
      h += '<div class="winner"><span class="k" style="color:var(--gold)">Empate</span><span class="muted" style="font-size:14px">' + esc(r.desempate) + '</span></div>';
      if ((r.soyProponente || r.esAdmin) && r.empatadas && r.empatadas.length) {
        h += '<span class="k sec-t">' + (r.soyProponente ? 'Te toca elegir la ganadora' : 'Elegir la ganadora (lo decide ' + esc(r.proponente) + ')') + '</span><div class="list">' +
          r.empatadas.map(function (t) { return '<button class="btn ghost" data-emp="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
      }
      h += barras(r, arr);
    } else if (arr.length && !mostrarLista && (S.votosVisibles || r.miVoto)) {
      h += '<span class="k sec-t">Votos hasta ahora</span>' + barras(r, arr);
    }
    h += quienVoto(r);
    if (r.fuente && !/^App/.test(r.fuente)) h += '<p class="muted" style="font-size:12.5px;margin:0">Fuente: ' + esc(r.fuente) + '</p>';
    abrirHoja(h);
    $('back').onclick = cerrarHoja;

    var tl = $('tl');
    if (tl) tl.onclick = function (e) {
      var t = e.target.closest('.track'); if (!t) return;
      SEL = CUR.canciones[Number(t.getAttribute('data-i'))].titulo;
      tl.querySelectorAll('.track').forEach(function (x) { x.classList.toggle('sel', x === t); });
      var b = $('vb'); b.disabled = SEL === CUR.miVoto; b.textContent = (SEL === CUR.miVoto ? 'Ya votaste por ' : 'Votar por ') + SEL;
    };
    var vb = $('vb'); if (vb) vb.onclick = function () { votar(SEL, vb); };
    galWire();
    var ab = $('ab'); if (ab) ab.onclick = function () { votar(ABST, ab); };
    var cv = $('cv'); if (cv) cv.onclick = function () { EDIT = true; dibujarRonda(); };
    $('sheetIn').querySelectorAll('[data-emp]').forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute('data-emp');
        confirmar(b, function () {
          ocupado(b, 'Guardando…');
          api('api_chooseWinner', CUR.id, t).then(function (x) {
            abrirHoja('<div class="top"><button class="back" id="back">‹ Volver</button><span class="k" style="margin-left:auto">Ganó ' + esc(t) + '</span></div>' +
              cajaMensaje(x.mensaje, 'Resultados para el grupo') + (x.resumen ? cajaMensaje(x.resumen, 'Resumen de la ronda') : ''));
            $('back').onclick = cerrarHoja; cargar(true);
          }).catch(function (e) { toast(errMsg(e)); libre(b); });
        });
      };
    });
  }
  /**
   * Galería de fotos del álbum (pantalla de la propuesta y Proponer). Cada foto es un botón (en el iPhone un toque
   * sobre una imagen suelta no siempre llega); una foto que no carga se intenta una vez más y, si falla, se quita.
   */
  function galHtml(imgs, numero, alt) {
    GAL = imgs || [];
    if (!GAL.length) return '';
    var h = '<div class="big"><button type="button" class="gt" data-g="0" aria-label="Ver las fotos"><img alt="' + esc(alt || '') + '" src="' + esc(GAL[0].uri) + '"></button>' +
      (numero ? '<span class="nb">#' + esc(numero) + '</span>' : '') + (GAL.length > 1 ? '<span class="nf">' + GAL.length + ' fotos</span>' : '') + '</div>';
    if (GAL.length > 1) h += '<div class="gal">' + GAL.map(function (x, i) {
      return '<button type="button" class="gt" data-g="' + i + '" aria-label="Foto ' + (i + 1) + '"><img alt="" src="' + esc(x.uri150 || x.uri) + '"></button>'; }).join('') + '</div>';
    return h;
  }
  function galWire() {
    $('sheetIn').querySelectorAll('.gt[data-g]').forEach(function (b) {
      b.onclick = function (e) { e.preventDefault(); verFoto(Number(b.getAttribute('data-g'))); };
      var im = b.querySelector('img');
      if (im) im.onerror = function () {
        if (!im.getAttribute('data-re')) { im.setAttribute('data-re', '1'); var u = im.src; setTimeout(function () { im.src = u; }, 900); return; }
        if (b.parentNode && b.parentNode.classList.contains('gal')) b.remove();
      };
    });
  }
  /** La foto a pantalla completa: tocar la foto o › pasa a la siguiente, ‹ vuelve, deslizar también; la ✕ cierra. */
  function verFoto(i) {
    var imgs = GAL || []; if (!imgs.length) return;
    var viejo = document.querySelector('.lightbox'); if (viejo) viejo.remove();
    var d = document.createElement('div'); d.className = 'lightbox';
    var varias = imgs.length > 1;
    d.innerHTML = '<button type="button" class="x" aria-label="Cerrar">✕</button>' +
      (varias ? '<button type="button" class="nav prev" aria-label="Anterior">‹</button><button type="button" class="nav next" aria-label="Siguiente">›</button>' : '') +
      '<img alt=""><span class="k cnt"></span>';
    var im = d.querySelector('img'), cnt = d.querySelector('.cnt'), reintento = false;
    function pinta() { reintento = false; cnt.textContent = (i + 1) + ' de ' + imgs.length; im.style.opacity = '.35'; im.src = imgs[i].uri || imgs[i].uri150; }
    function mueve(n) { if (!varias) return; i = (i + n + imgs.length) % imgs.length; pinta(); }
    im.onload = function () { im.style.opacity = '1'; };
    im.onerror = function () {
      if (!reintento) { reintento = true; var u = imgs[i].uri150 || imgs[i].uri; setTimeout(function () { im.src = u; }, 700); return; }
      cnt.textContent = (i + 1) + ' de ' + imgs.length + ' · esta foto no cargó';
    };
    d.onclick = function (e) {
      if (e.target.closest('.x') || e.target === d) { d.remove(); return; }
      if (e.target.closest('.prev')) { mueve(-1); return; }
      if (e.target.closest('.next') || e.target === im) { varias ? mueve(1) : d.remove(); }
    };
    var x0 = null;
    d.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    d.addEventListener('touchend', function (e) {
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) { mueve(dx < 0 ? 1 : -1); e.preventDefault(); }
    });
    pinta(); document.body.appendChild(d);
  }
  function votar(cancion, boton) {
    var txt = boton.textContent; boton.disabled = true; boton.textContent = 'Guardando…';
    api('api_vote', CUR.id, cancion, ($('com') || {}).value || '').then(function (r) {
      CUR = r; EDIT = false; SEL = cancion === ABST ? '' : cancion;
      toast(cancion === ABST ? 'Listo: te abstuviste' : 'Voto guardado');
      dibujarRonda(cancion === ABST || !r.compartir ? '' : cajaMensaje(r.compartir, 'Comparte tu voto en el grupo'));
      cargar(true);
    }).catch(function (e) { toast(errMsg(e)); boton.disabled = false; boton.textContent = txt; });
  }

  /* ---------- Proponer (3A–3E): banda → discografía → edición → proponer ---------- */
  var P = null;
  function reglasDiscos() {   // 3A: lo que vale y lo que no, sacado del texto de Reglas (editable en Ajustes)
    var txt = String(S.reglas || ''), out = [];
    ['Discos válidos', 'Edición', 'Repetidos'].forEach(function (t) {
      var m = new RegExp('\\*' + t + ':\\*\\s*([^\\n]+)').exec(txt); if (m) out.push('<b>' + t + ':</b> ' + esc(m[1]));
    });
    return out.length ? '<details class="note"><summary><b>Qué discos valen</b></summary><div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">' + out.join('<br>') + '</div></details>' : '';
  }
  function topProp(titulo, atras) { return '<div class="top"><button class="back" id="back">‹ ' + (atras ? 'Atrás' : 'Cancelar') + '</button><span class="k" style="margin-left:auto">' + esc(titulo) + '</span></div>'; }
  function tituloTipo() { if (P.por) return (P.tipo === 'cumpleaños' ? '🎂 ' : '') + 'En nombre de ' + P.por; return P.tipo === 'cumpleaños' ? '🎂 Propuesta de cumpleaños' : (P.tipo === 'extra' ? 'Turno extra' : 'Tu propuesta'); }
  function abrirProponer(tipo, por) { P = { tipo: tipo, modo: 'banda', q: '', por: por || '' }; pasoBuscar(); }
  function pasoBuscar(res) {
    var h = topProp(tituloTipo()) + '<h2>¿Qué banda?</h2>' + reglasDiscos() +
      '<form id="fb" class="row" style="flex-wrap:nowrap"><input type="text" id="qb" placeholder="' + (P.modo === 'banda' ? 'Nombre de la banda' : 'Nombre del disco') + '" value="' + esc(P.q) + '" autocomplete="off" style="flex:1">' +
      '<button class="btn small" type="submit">Buscar</button></form>' +
      '<button class="linkb" id="modo">' + (P.modo === 'banda' ? 'Buscar por nombre de disco' : 'Buscar por banda') + '</button>';
    if (res) {
      var lista = P.modo === 'banda' ? res.bandas : res.discos;
      if (!lista.length) h += '<div class="note">' + esc(res.nota || 'No encontré nada con ese nombre. Prueba a escribirlo de otra forma.') + '</div>';
      h += '<div class="list">' + lista.map(function (x, i) {
        var img = x.imagen ? '<img class="th" alt="" loading="lazy" src="' + esc(x.imagen) + '">' : '<span class="th"></span>';
        if (P.modo === 'banda') return '<button class="pick" data-i="' + i + '">' + img + '<span class="a"><b>' + esc(x.nombre) + '</b>' +
          (x.pista ? '<span>' + esc(x.pista) + '</span>' : (x.nombreDiscogs && x.nombreDiscogs !== x.nombre ? '<span>' + esc(x.nombreDiscogs) + '</span>' : '')) +
          (x.propuestos ? '<span class="gold">' + x.propuestos + (x.propuestos === 1 ? ' disco ya propuesto' : ' discos ya propuestos') + '</span>' : '') + '</span></button>';
        return '<button class="pick" data-i="' + i + '"' + (x.ya ? ' disabled' : '') + '>' + img + '<span class="a"><b>' + esc(x.titulo) + '</b><span>' + esc(x.banda) + (x.anio ? ' · ' + esc(x.anio) : '') + '</span>' +
          (x.ya ? '<span class="no">' + esc(x.ya.texto) + '</span>' : x.tributo ? '<span class="gold">¿Tributo?</span>' : '') + '</span></button>';
      }).join('') + '</div>';
      if (res.fuente === 'Discogs') h += '<span class="dgs">Data provided by Discogs.</span>';
    }
    h += '<button class="linkb" id="manual">No lo encuentro: escribirlo a mano</button>';
    abrirHoja(h);
    $('back').onclick = cerrarHoja;
    $('modo').onclick = function () { P.modo = P.modo === 'banda' ? 'disco' : 'banda'; pasoBuscar(); };
    $('manual').onclick = pasoManual;
    $('fb').onsubmit = function (e) {
      e.preventDefault(); P.q = $('qb').value.trim(); if (P.q.length < 2) return;
      var b = e.target.querySelector('button'); b.disabled = true; b.textContent = 'Buscando…';
      api(P.modo === 'banda' ? 'api_buscarBanda' : 'api_buscarDisco', P.q).then(function (r) { P.res = r; pasoBuscar(r); })
        .catch(function (er) { toast(errMsg(er)); b.disabled = false; b.textContent = 'Buscar'; });
    };
    $('sheetIn').querySelectorAll('.pick').forEach(function (b) {
      b.onclick = function () {
        var x = (P.modo === 'banda' ? res.bandas : res.discos)[Number(b.getAttribute('data-i'))];
        if (P.modo === 'banda') cargarDiscografia(x.id);
        else { P.artista = { nombre: x.banda, codigo: '' }; cargarEdicion(x); }
      };
    });
    if (!res) setTimeout(function () { var q = $('qb'); if (q) q.focus(); }, 50);
  }
  function cargarDiscografia(id) {
    abrirHoja(topProp(tituloTipo(), true) + '<div class="spin"></div>'); $('back').onclick = function () { pasoBuscar(P.res); };
    api('api_discografia', id).then(function (d) { P.disco = d; P.artista = d.artista; pasoDiscos(); })
      .catch(function (e) { toast(errMsg(e)); pasoBuscar(P.res); });
  }
  function pasoDiscos() {
    var d = P.disco, a = d.artista;
    var h = topProp(tituloTipo(), true) + '<div class="rhead">' + (a.imagen ? '<img class="th lg" alt="" src="' + esc(a.imagen) + '">' : '') +
      '<div class="ci"><span class="t">' + esc(a.nombre) + '</span><span class="m">' + esc(a.pais || 'País sin confirmar') + '</span>' +
      '<span class="m"><a target="_blank" rel="noopener" href="' + esc(a.metalArchives) + '">Metal Archives</a>' + (a.discogs ? ' · <a target="_blank" rel="noopener" href="' + esc(a.discogs) + '">Discogs</a>' : '') + '</span></div></div>';
    if (d.historial && d.historial.n) {   // 3D
      h += '<details class="note"><summary><b>' + esc(d.historial.texto) + '</b></summary><div class="list who-l hl2" style="margin-top:6px">' +
        d.historial.rondas.map(function (r) { return '<div class="li"><span class="nm"><span class="num">#' + esc(r.numero) + '</span> ' + esc(r.disco) + '</span><span class="sg w">' + esc(r.ganadora || (r.estado !== 'cerrada' ? 'se está votando' : '')) + '</span></div>'; }).join('') + '</div></details>';
    }
    if (d.tambien && d.tambien.length) {   // otras bandas y nombres del mismo artista
      h += '<div class="note"><b>También con:</b><div class="row" style="margin-top:8px">' + d.tambien.map(function (t) {
        return '<button class="fchip sm" data-art="' + esc(t.id) + '">' + esc(t.nombre) + (t.propuestos ? ' · ' + t.propuestos : '') + '</button>'; }).join('') + '</div></div>';
    }
    var colabs = d.discos.filter(function (x) { return x.valido && !x.ya && x.colab; });
    var validos = d.discos.filter(function (x) { return x.valido && !x.ya && !x.colab; }), yaP = d.discos.filter(function (x) { return x.ya; }),
      otros = d.discos.filter(function (x) { return !x.valido && !x.ya; });
    var TIPOS = { estudio: '', sin_confirmar: 'por confirmar', recopilatorio: 'recopilatorio', en_vivo: 'en vivo', 'en vivo': 'en vivo', ep: 'EP', sencillo: 'sencillo' };
    var tipoTxt = function (t) { return TIPOS[t] !== undefined ? TIPOS[t] : String(t || '').replace(/_/g, ' '); };
    var fila = function (x, i) {
      var nota = x.ya ? '<span class="no">' + esc(x.ya.texto) + '</span>' : (!x.valido ? '<span class="muted">No vale: ' + esc(tipoTxt(x.tipo)) + '</span>' : (x.tributo ? '<span class="gold">¿Tributo? Lo revisa Chiquito</span>' : (x.confirmar ? '<span class="gold">Revisa que sea de estudio</span>' : '')));
      return '<button class="pick" data-id="' + esc(x.id) + '"' + (x.ya || !x.valido ? ' disabled' : '') + '>' + (x.imagen ? '<img class="th" alt="" loading="lazy" src="' + esc(x.imagen) + '">' : '<span class="th"></span>') +
        '<span class="a"><b>' + esc(x.titulo) + '</b><span>' + esc([x.colab ? x.banda : '', x.anio, tipoTxt(x.tipo)].filter(Boolean).join(' · ')) + '</span>' + nota + '</span></button>';
    };
    h += '<span class="k sec-t">Para proponer · ' + validos.length + '</span>' + (validos.length ? '<div class="list">' + validos.map(fila).join('') + '</div>' : '<div class="note">De esta banda ya no quedan discos de estudio sin proponer.</div>');
    if (colabs.length) h += '<details class="note"><summary>Colaboraciones · ' + colabs.length + '</summary><div class="list" style="margin-top:6px">' + colabs.map(fila).join('') + '</div></details>';
    // Lo ya propuesto con sus otras bandas y nombres (en Discogs van aparte): que se vea aquí también
    var rel = [];
    (d.tambien || []).forEach(function (t) { (t.rondas || []).forEach(function (r) { rel.push({ r: r, con: t.nombre }); }); });
    var filaRel = function (x) {
      return '<div class="pick" style="cursor:default"><span class="th"></span><span class="a"><b>' + esc(x.r.disco) + '</b><span>con ' + esc(x.con) + '</span>' +
        '<span class="no">Ya propuesto' + (x.r.numero ? ' en la #' + esc(x.r.numero) : '') + (x.r.ganadora ? ' · ganó «' + esc(x.r.ganadora) + '»' : (x.r.estado !== 'cerrada' ? ' · se está votando' : '')) + '</span></span></div>';
    };
    if (yaP.length || rel.length) h += '<details class="note"' + (rel.length ? ' open' : '') + '><summary>Ya propuestos · ' + (yaP.length + rel.length) + '</summary><div class="list" style="margin-top:6px">' + yaP.map(fila).join('') + rel.map(filaRel).join('') + '</div></details>';
    if (otros.length) h += '<details class="note"><summary>Otros que no valen · ' + otros.length + '</summary><div class="list" style="margin-top:6px">' + otros.map(fila).join('') + '</div></details>';
    if (d.fuente === 'Discogs') h += '<a class="dgs" target="_blank" rel="noopener" href="' + esc(a.discogs || 'https://www.discogs.com') + '">Data provided by Discogs.</a>';
    h += '<button class="linkb" id="manual">No está el disco: escribirlo a mano</button>';
    abrirHoja(h);
    $('back').onclick = function () { pasoBuscar(P.res); };
    $('manual').onclick = function () { pasoManual({ banda: a.nombre }); };
    $('sheetIn').querySelectorAll('[data-art]').forEach(function (b) { b.onclick = function () { cargarDiscografia(b.getAttribute('data-art')); }; });
    $('sheetIn').querySelectorAll('.pick[data-id]').forEach(function (b) {
      b.onclick = function () { cargarEdicion(d.discos.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]); };
    });
  }
  function cargarEdicion(x, edicionId) {
    P.album = x;
    abrirHoja(topProp(tituloTipo(), true) + '<div class="spin"></div><p class="muted" style="text-align:center">Buscando la primera edición original…</p>');
    $('back').onclick = function () { P.disco ? pasoDiscos() : pasoBuscar(P.res); };
    api('api_edicion', x.id, (P.artista && P.artista.codigo) || '', edicionId ? { edicion: edicionId } : {}).then(function (e) { P.ed = e; pasoEdicion(); })
      .catch(function (er) { toast(errMsg(er)); P.disco ? pasoDiscos() : pasoBuscar(P.res); });
  }
  function pasoEdicion() {
    var e = P.ed, x = P.album;
    if (!e.encontrada) { pasoManual({ banda: e.banda || (P.artista && P.artista.nombre), disco: e.disco || x.titulo, anio: e.anio || x.anio, nota: e.nota }); return; }
    var img = e.portada || x.imagen || '';
    var h = topProp(tituloTipo(), true);
    var fotosEd = (e.fotos && e.fotos.length) ? e.fotos : (img ? [{ uri: img, uri150: img }] : []);
    h += galHtml(fotosEd, '', 'Portada de ' + (e.disco || ''));
    h += '<div class="ci"><span class="b">' + esc(e.banda) + '</span><span class="t" style="font-family:var(--f-head);font-weight:800;font-size:28px;text-transform:uppercase;line-height:1.05">' + esc(e.disco) + '</span>' +
      '<span class="m">' + esc([P.artista && P.artista.pais, e.anio].filter(Boolean).join(' · ')) + '</span></div>';
    h += '<div class="note"><b>Edición:</b> ' + esc(e.descripcion || '') + (e.alternativas && e.alternativas.length ? '<br><button class="linkb" id="alts" style="margin-top:6px">¿No es esta edición? Ver otras (' + e.alternativas.length + ')</button>' : '') + '</div>';
    (e.avisos || []).forEach(function (a) { h += '<div class="warn"><span>' + esc(a) + '</span></div>'; });
    h += '<div id="altl" hidden class="list"></div>';
    h += '<span class="k sec-t">Canciones · ' + e.canciones.length + '</span><div class="list">' + e.canciones.map(function (c, i) {
      return '<div class="track" style="cursor:default"><span class="n">' + esc(c.pos || i + 1) + '</span><span>' + esc(c.titulo) + '</span><span class="c">' + esc(c.duracion || '') + '</span></div>';
    }).join('') + '</div>';
    if (e.fuente === 'Discogs') h += '<a class="dgs" target="_blank" rel="noopener" href="' + esc((e.enlaces && e.enlaces.discogs) || 'https://www.discogs.com') + '">Data provided by Discogs.</a>';
    h += '<label class="f">Presentación (opcional)<textarea id="pres" placeholder="Cuéntales al grupo por qué este disco">' + esc(P.pres || '') + '</textarea></label>' +
      '<label class="f">Enlace de Spotify o YouTube (opcional)<input type="text" id="lnk" placeholder="Pega aquí el enlace" value="' + esc(P.lnk || '') + '"></label>' +
      '<button class="btn" id="go">Proponer «' + esc(e.disco) + '»</button>';
    abrirHoja(h);
    galWire();
    $('back').onclick = function () { P.disco ? pasoDiscos() : pasoBuscar(P.res); };
    var alts = $('alts');
    if (alts) alts.onclick = function () {
      var l = $('altl'); l.hidden = !l.hidden;
      l.innerHTML = e.alternativas.map(function (a) { return '<button class="pick" data-e="' + a.id + '"><span class="a"><b>' + esc([a.pais, a.fecha].filter(Boolean).join(' · ')) + '</b><span>' + esc([a.formato, a.sello].filter(Boolean).join(' · ')) + '</span></span></button>'; }).join('');
      l.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { guardarTextos(); cargarEdicion(P.album, Number(b.getAttribute('data-e'))); }; });
    };
    $('go').onclick = function () {
      guardarTextos();
      var l = P.lnk || '';
      enviar({ banda: e.banda, disco: e.disco, anio: e.anio, pais: P.artista && P.artista.pais, pais_banda: P.artista && P.artista.pais,
        canciones: e.canciones, discogs_master: e.discogs_master || '', discogs_release: e.discogs_release || '', mbid_grupo: x.mbid || '',
        edicion: e.descripcion || '', sello: e.sello || '', avisos: (e.avisos || []).concat(x.tributo ? ['¿Tributo? (lo marcó Discogs)'] : []),
        spotify: /spotify/.test(l) ? l : '', youtube: /youtu/.test(l) ? l : '' }, $('go'));
    };
  }
  function guardarTextos() { if ($('pres')) P.pres = $('pres').value; if ($('lnk')) P.lnk = $('lnk').value.trim(); }
  function pasoManual(pre) {   // 3E: último recurso; Chiquito lo revisa
    pre = pre || {};
    var h = topProp(tituloTipo(), true) + '<h2>Escribirlo a mano</h2><div class="note">Úsalo solo si la búsqueda no lo encuentra. Chiquito lo revisa antes de cerrarlo.' + (pre.nota ? '<br>' + esc(pre.nota) : '') + '</div>' +
      '<label class="f">Banda<input type="text" id="mb" value="' + esc(pre.banda || '') + '"></label>' +
      '<label class="f">Disco<input type="text" id="md" value="' + esc(pre.disco || '') + '"></label>' +
      '<div class="row"><label class="f" style="flex:1">Año<input type="text" id="ma" inputmode="numeric" value="' + esc(pre.anio || '') + '"></label><label class="f" style="flex:2">País de la banda<input type="text" id="mp" value="' + esc((P.artista && P.artista.pais) || '') + '"></label></div>' +
      '<label class="f">Canciones (una por línea, en orden)<textarea id="mc" style="min-height:180px"></textarea></label>' +
      '<label class="f">Presentación (opcional)<textarea id="pres">' + esc(P.pres || '') + '</textarea></label>' +
      '<button class="btn" id="go">Proponer</button>';
    abrirHoja(h);
    $('back').onclick = function () { P.disco ? pasoDiscos() : pasoBuscar(P.res); };
    $('go').onclick = function () {
      guardarTextos();
      enviar({ manual: true, banda: $('mb').value.trim(), disco: $('md').value.trim(), anio: $('ma').value.trim(), pais: $('mp').value.trim(),
        canciones: $('mc').value.split('\n').map(function (t) { return { titulo: t.trim() }; }).filter(function (c) { return c.titulo; }) }, $('go'));
    };
  }
  function enviar(d, boton) {
    d.tipo = P.tipo === 'cumpleaños' ? 'cumpleaños' : 'normal';
    d.presentacion = P.pres || '';
    if (P.por) d.por = P.por;
    var txt = boton.textContent; boton.disabled = true; boton.textContent = 'Guardando…';
    api('api_propose', d).then(function (r) {
      var h = topProp('Listo') + '<div class="winner"><span class="k" style="color:var(--gold)">Propuesta abierta</span><span class="s">' + esc(d.disco) + '</span><span class="muted">' + esc(d.banda) + ' · ya se puede votar en la app</span></div>' +
        cajaMensaje(r.mensaje, 'Anúncialo en el grupo') + (r.arranca ? cajaMensaje(r.arranca, 'Y esta empieza una ronda nueva') : '') +
        '<button class="btn ghost" id="verla">Ver la propuesta</button>';
      abrirHoja(h); $('back').onclick = cerrarHoja; $('verla').onclick = function () { abrirRonda(r.id); };
      cargar(true);
    }).catch(function (e) { toast(errMsg(e)); boton.disabled = false; boton.textContent = txt; });
  }

  /* ---------- Historial (4A–4F) ---------- */
  var H = { vista: 'numero', filtro: '', valor: '', q: '', items: [], total: 0, filtros: null, playlist: false, letra: '' };
  function vistaHistorial() {
    var v = $('view');
    var chips = [['numero', 'Por número'], ['az', 'A–Z'], ['playlist', 'Playlist A–Z']].map(function (c) {
      var on = c[0] === 'playlist' ? H.playlist : (!H.playlist && H.vista === c[0]);
      return '<button class="fchip' + (on ? ' on' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    var f = H.filtros, filtros = '';
    if (f && !H.playlist) {
      filtros = '<div class="chips">' + [['', 'Todas'], ['cumpleaños', '🎂 Cumpleaños · ' + f.cumpleanos], ['póstuma', '✝️ Póstumas · ' + f.postumas], ['abiertas', 'Abiertas']].map(function (c) {
        return '<button class="fchip sm' + (H.filtro === c[0] ? ' on' : '') + '" data-f="' + c[0] + '">' + c[1] + '</button>';
      }).join('') + '<select id="fdec" class="fsel"><option value="">Década</option>' + f.decadas.map(function (d) { return '<option value="' + d.decada + '"' + (H.filtro === 'decada' && H.valor == d.decada ? ' selected' : '') + '>' + esc(d.etiqueta) + ' · ' + d.rondas + '</option>'; }).join('') + '</select>' +
        '<select id="fmie" class="fsel"><option value="">Miembro</option>' + f.miembros.map(function (m) { return '<option' + (H.filtro === 'miembro' && H.valor === m.nombre ? ' selected' : '') + '>' + esc(m.nombre) + '</option>'; }).join('') + '</select></div>';
    }
    v.innerHTML = '<div class="pagehead"><h2>Historial</h2>' + (H.total && !H.playlist ? '<span class="k">' + H.total + ' rondas</span>' : '') + '</div>' +
      (H.playlist ? '' : '<form id="hs"><input type="search" id="hq" placeholder="Buscar: #627, banda, disco, canción, miembro, año" value="' + esc(H.q) + '"></form>') +
      '<div class="chips">' + chips + '</div>' + filtros + '<div id="hl"><div class="spin"></div></div>';
    v.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { var x = b.getAttribute('data-v'); if (x === 'playlist') { H.playlist = true; } else { H.playlist = false; H.vista = x; } cargarHist(); }; });
    v.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { H.filtro = b.getAttribute('data-f'); H.valor = ''; cargarHist(); }; });
    var fd = $('fdec'); if (fd) fd.onchange = function () { H.filtro = fd.value ? 'decada' : ''; H.valor = fd.value; cargarHist(); };
    var fm = $('fmie'); if (fm) fm.onchange = function () { H.filtro = fm.value ? 'miembro' : ''; H.valor = fm.value; cargarHist(); };
    var hs = $('hs'); if (hs) hs.onsubmit = function (e) { e.preventDefault(); H.q = $('hq').value.trim(); $('hq').blur(); cargarHist(); };
    v.onclick = function (e) { var t = e.target.closest('[data-r]'); if (t) abrirRonda(t.getAttribute('data-r')); };
  }
  function cargarHist(mas) {
    if (!mas) { H.items = []; vistaHistorial(); }
    if (H.playlist) return cargarPlaylist();
    api('api_historial', { vista: H.vista, filtro: H.filtro, valor: H.valor, q: H.q, desde: H.items.length, n: 40 }).then(function (r) {
      if (r.filtros) { var redibujar = !H.filtros; H.filtros = r.filtros; if (redibujar) { H.total = r.total; vistaHistorial(); } }
      H.total = r.total; var antes = H.items.length; H.items = H.items.concat(r.items);
      pintarHist(antes);
    }).catch(function (e) { $('hl').innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }
  function filaHist(x) {
    var h = '';
    if (x.encabezado) h += '<div class="hhead">' + esc(x.encabezado) + '</div>';
    var tipo = x.tipo === 'cumpleaños' ? '🎂 ' : (x.tipo === 'póstuma' ? '✝️ ' : '');
    return h + '<button class="hrow" data-r="' + esc(x.id) + '">' + cover(x) + '<span class="a"><span class="t1"><span class="num">#' + esc(x.numero || '—') + '</span> ' + tipo + esc(x.banda) + ' – ' + esc(x.disco) + (x.anio ? ' <span class="muted">(' + esc(x.anio) + ')</span>' : '') + '</span>' +
      '<span class="w">' + (x.abierta ? '<span class="chip go" style="font-size:9.5px">votándose</span>' : esc(x.ganadora || '—')) + '</span>' +
      (x.coincidencia && x.coincidencia !== 'banda' && x.coincidencia !== 'disco' ? '<span class="muted" style="font-size:12px">por ' + esc(x.coincidencia) + '</span>' : '') + '</span></button>';
  }
  function pintarHist(antes) {
    var box = $('hl'); if (!box) return;
    if (!H.items.length) { box.innerHTML = '<div class="note">No encontré nada' + (H.q ? ' con «' + esc(H.q) + '»' : '') + '.</div>'; return; }
    if (!antes) box.innerHTML = '<div class="list" id="hll"></div>';
    var mas = $('hmas'); if (mas) mas.remove();
    $('hll').insertAdjacentHTML('beforeend', H.items.slice(antes).map(filaHist).join(''));
    if (H.items.length < H.total) {
      box.insertAdjacentHTML('beforeend', '<button class="btn ghost" id="hmas">Ver más (' + (H.total - H.items.length) + ')</button>');
      $('hmas').onclick = function () { this.disabled = true; this.textContent = 'Cargando…'; cargarHist(true); };
      if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); var b = $('hmas'); if (b && !b.disabled) b.click(); } }); io.observe($('hmas')); }
    }
    portadasHist(H.items.slice(antes).map(function (x) { return x.id; }));
  }
  /** Portadas de 8 en 8 (límite de Discogs), a medida que se cargan las filas. */
  function portadasHist(ids) {
    if (!ids.length) return;
    var lote = ids.slice(0, 8);
    api('api_portadas', lote).then(function (m) {
      Object.keys(m).forEach(function (id) {
        var row = document.querySelector('.hrow[data-r="' + id + '"] .cover'); if (!row || row.classList.contains('pic')) return;
        row.classList.add('pic'); row.insertAdjacentHTML('beforeend', '<img alt="" loading="lazy" src="' + esc(m[id].portada) + '" onerror="this.parentNode.classList.remove(\'pic\');this.remove()">');
      });
      if (Object.keys(m).length && !$('hdgs')) { var l = $('hl'); if (l) l.insertAdjacentHTML('afterend', '<a class="dgs" id="hdgs" style="align-self:center" target="_blank" rel="noopener" href="https://www.discogs.com">Portadas: Data provided by Discogs.</a>'); }
      portadasHist(ids.slice(8));
    }).catch(function () {});
  }
  function cargarPlaylist() {   // 4E
    api('api_playlist', { letra: H.letra || 'A' }).then(function (p) {
      H.letra = p.letra || 'A';
      var h = '<div class="letters">' + p.letras.map(function (l) { return '<button class="fchip sm' + (l === H.letra ? ' on' : '') + '" data-l="' + esc(l) + '">' + esc(l) + '</button>'; }).join('') + '</div>' +
        '<div class="row"><button class="btn ghost" id="pcopy">Copiar la ' + esc(H.letra) + ' para WhatsApp</button></div>' +
        '<div class="plist">' + p.bandas.map(function (b) {
          return '<div class="pb"><b>' + esc(b.banda) + '</b>' + b.discos.map(function (d) {
            return '<button class="pd" data-r="' + esc(d.id) + '"><span><span class="num">#' + esc(d.numero || '—') + '</span> ' + esc(d.disco) + (d.anio ? ' <span class="muted">(' + esc(d.anio) + ')</span>' : '') + '</span><span class="w">' + esc(d.ganadora) + '</span></button>';
          }).join('') + '</div>';
        }).join('') + '</div>' + '<textarea id="ptxt" readonly hidden>' + esc(p.texto) + '</textarea>';
      $('hl').innerHTML = h;
      $('hl').querySelectorAll('[data-l]').forEach(function (b) { b.onclick = function () { H.letra = b.getAttribute('data-l'); $('hl').innerHTML = '<div class="spin"></div>'; cargarPlaylist(); }; });
      $('pcopy').onclick = function () { copiar(p.texto, $('ptxt')); };
    }).catch(function (e) { $('hl').innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }

  /* ---------- Números (5A–5D) ---------- */
  function pct(n) { return (Math.round(Number(n) * 10) / 10).toString().replace('.', ',') + ' %'; }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ranking(titulo, que, lista, valor, extra) {
    if (!lista || !lista.length) return '';
    return '<div class="rank"><div class="rk-h"><b>' + titulo + '</b><span class="muted">' + que + '</span></div>' +
      lista.map(function (x, i) { return '<div class="rk"><span class="pos">' + (i + 1) + '</span><span class="nm">' + esc(x.nombre || (x.a + ' & ' + x.b)) + '</span><span class="v">' + valor(x) + '</span></div>' + (extra ? extra(x, i) : ''); }).join('') + '</div>';
  }
  function barrasSimple(arr, fmt) {
    var max = Math.max.apply(null, arr.map(function (x) { return x[1]; }).concat([1]));
    return '<div class="sec">' + arr.map(function (x) {
      return '<div class="sb"><span>' + esc(x[0]) + '</span><span class="bb"><i style="width:' + Math.round(x[1] * 100 / max) + '%"></i></span><span class="v">' + (fmt ? fmt(x[1]) : x[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function filaRonda(r, derecha) {
    return '<button class="hrow" data-r="' + esc(r.id) + '"><span class="num" style="min-width:44px">#' + esc(r.numero) + '</span><span class="a"><span class="t1">' + esc(r.banda) + ' – ' + esc(r.disco) + '</span><span class="w">' + esc(r.ganadora || '') + '</span></span>' + (derecha ? '<span class="muted" style="margin-left:auto;font-size:12.5px;text-align:right;white-space:nowrap">' + derecha + '</span>' : '') + '</button>';
  }
  var NUM = null;
  function vistaNumeros() {
    var v = $('view');
    v.innerHTML = '<div class="pagehead"><h2>Números</h2></div><div class="spin"></div>';
    v.onclick = function (e) { var t = e.target.closest('[data-r]'); if (t) abrirRonda(t.getAttribute('data-r')); };
    (NUM ? Promise.resolve(NUM) : api('api_stats11')).then(function (s) {
      NUM = s; var rc = s.records, pr = s.proponentes, rk = s.rankings;
      var h = '<div class="pagehead"><h2>Números</h2><span class="k">' + miles(s.rondas) + ' rondas</span></div>';
      h += '<div class="tiles"><div class="tile"><b>' + miles(s.rondas) + '</b><span class="muted">rondas cerradas</span></div><div class="tile"><b>' + miles(s.bandas) + '</b><span class="muted">bandas distintas</span></div>' +
        '<div class="tile"><b>' + rc.empates + '</b><span class="muted">empates · ' + rc.empatesDoble + ' los decidió el voto doble</span></div><div class="tile"><b>' + pct(rc.tituloGana) + '</b><span class="muted">de las veces gana la canción que da nombre al disco</span></div></div>';
      h += '<span class="k sec-t">Los que votan</span>';
      h += ranking('Participación', 'de las rondas en que estaba', rk.participacion, function (x) { return pct(x.participacion); });
      h += ranking('Ojo de ganador', 'votó por la que ganó', rk.ojo, function (x) { return pct(x.ojo); });
      h += ranking('Lobo solitario', 'votó una que nadie más votó', rk.lobo, function (x) { return pct(x.solo); });
      h += ranking('Racha', 'rondas seguidas votando', rk.racha, function (x) { return x.racha + (x.rachaActual === x.racha ? ' <span class="chip done" style="font-size:9px;padding:2px 6px">sigue</span>' : ''); });
      h += '<span class="k sec-t">Afinidad</span>';
      h += ranking('Almas gemelas', 'votan lo mismo', s.almas, function (x) { return pct(x.pct); });
      h += ranking('Polos opuestos', 'casi nunca coinciden', s.opuestos, function (x) { return pct(x.pct); });
      h += '<span class="k sec-t">Los que proponen</span>';
      h += ranking('El profeta', 'su propia canción gana', (pr.profeta || []).slice(0, 5), function (x) { return pct(x.profeta); });
      h += ranking('El que une', 'consenso en sus discos', (pr.une || []).slice(0, 5), function (x) { return pct(x.une); });
      h += ranking('El explorador', 'bandas nuevas para el grupo', (pr.explorador || []).slice(0, 5), function (x) { return pct(x.explorador); });
      h += ranking('El arqueólogo', 'año medio de sus discos', (pr.arqueologo || []).slice(0, 3), function (x) { return x.edad; });
      h += ranking('El moderno', 'año medio de sus discos', (pr.moderno || []).slice(0, 3), function (x) { return x.edad; });
      h += '<span class="k sec-t">Récords</span>';
      h += '<div class="rank"><div class="rk-h"><b>Las más unánimes</b></div><div class="list">' + rc.unanimes.slice(0, 5).map(function (r) { return filaRonda(r, r.ganadoraVotos + ' de ' + r.votos); }).join('') + '</div></div>';
      h += '<div class="rank"><div class="rk-h"><b>Las más divididas</b></div><div class="list">' + rc.divididas.slice(0, 5).map(function (r) { return filaRonda(r, r.distintas + ' canciones'); }).join('') + '</div></div>';
      h += '<div class="rank"><div class="rk-h"><b>Las bandas más propuestas</b></div>' + barrasSimple(rc.topBandas.slice(0, 10)) + '</div>';
      h += '<div class="rank"><div class="rk-h"><b>Por década</b><span class="muted">año del disco</span></div>' + barrasSimple(s.decadas.map(function (d) { return [d[0].replace(/^19|^20/, "'").replace('s', 's'), d[1]]; })) + '</div>';
      if (s.estilos && s.estilos.length) h += '<div class="rank"><div class="rk-h"><b>Por estilo</b><span class="muted">según Discogs (un disco puede tener varios)</span></div>' + barrasSimple(s.estilos) + '</div>';
      if (s.paises && s.paises.length) h += '<div class="rank"><div class="rk-h"><b>Por país</b><span class="muted">país de la banda</span></div>' + barrasSimple(s.paises) + '</div>';
      h += '<p class="foot">Las rondas del historial cuentan solo mientras cada uno estaba en el grupo.</p>';
      v.innerHTML = h;
    }).catch(function (e) { v.innerHTML = '<div class="pagehead"><h2>Números</h2></div><div class="err">' + esc(errMsg(e)) + '</div>'; });
  }

  /* ---------- Yo (6A–6G) ---------- */
  var MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function vistaYo(todos) {
    var v = $('view');
    v.innerHTML = '<div class="hero"><span class="who">' + esc(S.me.nombre) + '</span></div><div class="spin"></div>';
    v.onclick = function (e) {
      var t = e.target.closest('[data-r]'); if (t) { abrirRonda(t.getAttribute('data-r')); return; }
      var x = e.target.closest('[data-todo]'); if (x) { vistaYoTodos(x.getAttribute('data-todo')); return; }
      if (e.target.closest('#vreg')) verReglas();
    };
    api('api_me').then(function (me) {
      ME = me; var p = me.perfil || {}, m = p.miembro || {}, q = p.propuestas || {};
      var h = '<div class="hero"><span class="who">' + esc(me.nombre) + '</span></div>';
      // 6A · Tu perfil Skull
      h += '<div class="perfil"><span class="k" style="color:var(--gold)">Tu perfil Skull</span><div class="ptit">' + esc(me.nombre) + '</div>' +
        (p.titulo ? '<div class="badge">' + esc(p.titulo.titulo) + '</div><div class="muted" style="font-size:13.5px">' + esc(p.titulo.porque) + '</div>' : '') +
        '<div class="tiles" style="margin-top:12px">' +
        (m.rondas ? '<div class="tile"><b>' + pct(m.participacion) + '</b><span class="muted">' + (m.desde ? 'votaste en ' + m.votos + ' de ' + miles(m.rondas) + ' rondas desde la #' + esc(m.desde) : 'participación · ' + m.votos + ' de ' + miles(m.rondas)) + '</span></div>' : '') +
        (m.votos ? '<div class="tile"><b>' + pct(m.ojo) + '</b><span class="muted">ojo de ganador</span></div>' : '') +
        (m.racha ? (m.rachaActual ? '<div class="tile"><b>' + m.rachaActual + '</b><span class="muted">rondas seguidas ahora · récord ' + m.racha + '</span></div>' : '<div class="tile"><b>' + m.racha + '</b><span class="muted">tu mejor racha de rondas seguidas</span></div>') : '') +
        (p.alma ? '<div class="tile"><b style="font-size:24px">' + esc(p.alma.con) + '</b><span class="muted">tu alma gemela · ' + pct(p.alma.pct) + '</span></div>' : '') +
        (q.edad ? '<div class="tile"><b>' + q.edad + '</b><span class="muted">edad musical de tus propuestas</span></div>' : '') +
        (q.estilos && q.estilos.length ? '<div class="tile"><b style="font-size:22px;line-height:1.05">' + esc(q.estilos[0][0]) + '</b><span class="muted">tu estilo' + (q.estilos[1] ? ' · también ' + esc(q.estilos[1][0]) : '') + '</span></div>' : '') +
        (q.decadas && q.decadas.length ? '<div class="tile"><b>' + esc(q.decadas[0][0].replace(/^19|^20/, "'")) + '</b><span class="muted">tu década' + (q.paises && q.paises.length ? ' · ' + esc(q.paises[0][0]) : '') + '</span></div>' : '') +
        '</div></div>';
      // 6B · Tu turno
      var turno;
      if (me.libre) turno = 'No entras en la rotación: propones por tu cumpleaños y puedes pedir un turno extra sin mover el de nadie.';
      else if (me.turnosParaMi === 0) turno = '<b>Te toca proponer ahora.</b>';
      else if (me.turnosParaMi != null) turno = 'Te toca proponer en <b>' + me.turnosParaMi + (me.turnosParaMi === 1 ? ' turno' : ' turnos') + '</b> · ahora va ' + esc(me.siguiente) + '.';
      var cum = me.cumpleDia ? 'Tu cumpleaños: <b>' + esc(me.cumpleDia) + ' de ' + MES[Number(me.cumpleMes)] + '</b>.' : '';
      if (me.cumple) cum += ' Tienes tu propuesta de cumpleaños pendiente' + (me.cumple.vence ? ': vence el <b>' + esc(fLarga(me.cumple.vence)) + '</b>' : '') + '.';
      h += '<div class="note"><dl class="facts" style="grid-template-columns:1fr"><dd>' + (turno || '') + '</dd>' + (cum ? '<dd>' + cum + '</dd>' : '') + '</dl></div>';
      // 6C · Tus propuestas
      if (q.lista && q.lista.length) {
        var ganadas = q.lista.filter(function (x) { return x.suya; }).length;
        h += '<span class="k sec-t">Tus propuestas · ' + q.lista.length + ' · tu canción ganó ' + ganadas + '</span><div class="list">' +
          q.lista.slice().reverse().slice(0, 8).map(function (r) { return filaRonda(r, r.suya ? '✓ la tuya' : ''); }).join('') + '</div>' +
          (q.lista.length > 8 ? '<button class="btn ghost" data-todo="propuestas">Ver todas</button>' : '');
      }
      // 6D · Tus votos
      if (me.votos && me.votos.length) {
        var ok = me.votos.filter(function (x) { return x.gano; }).length;
        h += '<span class="k sec-t">Tus votos · ' + miles(me.totalVotos) + '</span><div class="list">' + me.votos.slice(0, 10).map(votoFila).join('') + '</div>' +
          '<button class="btn ghost" data-todo="votos">Ver todos</button>';
      }
      // 6E · Tu afinidad
      if (p.afinidad && p.afinidad.length) {
        h += '<span class="k sec-t">Tu afinidad · cuánto votan como tú</span>' + barrasSimple(p.afinidad.map(function (a) { return [a.con, a.pct]; }), function (n) { return Math.round(n) + '%'; });
      }
      h += '<button class="btn ghost" id="vreg">📜 Reglas de The Skull</button>';
      // 6G
      h += '<details class="note"><summary><b>Ponla en la pantalla de inicio</b></summary><div style="margin-top:8px">' +
        'Abre primero tu enlace personal (el de WhatsApp) y, desde esa misma página:<br><b>iPhone (Safari):</b> toca el botón de compartir (el cuadrado con la flecha) y elige «Añadir a pantalla de inicio».<br>' +
        '<b>Android (Chrome):</b> toca los tres puntos de arriba a la derecha y elige «Añadir a pantalla de inicio» o «Instalar app».</div></details>' +
        '<div class="note">Este es tu enlace personal: no lo compartas. Si lo pierdes, pídele uno nuevo a Chiquito.</div>' +
        '<p class="foot">' + esc(S.grupo || 'The Skull') + ' · v' + esc(S.version || '1.1') + '</p>';
      v.innerHTML = h;
    }).catch(function (e) { v.innerHTML = '<div class="hero"></div><div class="err">' + esc(errMsg(e)) + '</div>'; });
  }
  var ME = null;
  function votoFila(x) {
    return '<button class="hrow" data-r="' + esc(x.id) + '"><span class="num" style="min-width:44px">#' + esc(x.numero) + '</span><span class="a"><span class="t1">' + esc(x.banda) + ' – ' + esc(x.disco) + '</span><span class="' + (x.gano ? 'w' : 'muted') + '" style="font-size:14px">' + esc(x.cancion === ABST ? 'Abstención' : x.cancion) + '</span></span>' +
      '<span style="margin-left:auto;font-size:13px" class="' + (x.gano ? 'gold' : 'muted') + '">' + (x.abierta ? 'votándose' : (x.gano ? '✓ ganó' : '')) + '</span></button>';
  }
  /** Reglas para todos (solo lectura). *texto* = negrita, como en WhatsApp. */
  function verReglas() {
    var txt = String(S.reglas || '').trim();
    var html = txt ? txt.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '</p>'; }).join('') : '<p class="muted">Todavía no hay reglas escritas.</p>';
    abrirHoja('<div class="top"><button class="back" id="back">‹ Volver</button><span class="k" style="margin-left:auto">' + esc(S.grupo || 'The Skull') + '</span></div><h2>Reglas</h2><div class="reglas">' + html + '</div>' +
      (S.me.esAdmin ? '<p class="foot">Se cambian en Panel → Ajustes → Texto de las reglas.</p>' : '<p class="foot">Si algo no está claro, pregúntale a Chiquito.</p>'));
    $('back').onclick = cerrarHoja;
  }
  function vistaYoTodos(que) {
    var q = (ME.perfil && ME.perfil.propuestas) || {};
    var h = '<div class="top"><button class="back" id="back">‹ Volver</button><span class="k" style="margin-left:auto">' + (que === 'votos' ? 'Tus votos' : 'Tus propuestas') + '</span></div><div class="list">' +
      (que === 'votos' ? ME.votos.map(votoFila).join('') : q.lista.slice().reverse().map(function (r) { return filaRonda(r, r.suya ? '✓ la tuya' : ''); }).join('')) + '</div>' +
      (que === 'votos' && ME.totalVotos > ME.votos.length ? '<p class="foot">Se ven los últimos ' + ME.votos.length + ' de ' + miles(ME.totalVotos) + '. Los demás están en el Historial.</p>' : '');
    abrirHoja(h); $('back').onclick = cerrarHoja;
    $('sheetIn').onclick = function (e) { var t = e.target.closest('[data-r]'); if (t) abrirRonda(t.getAttribute('data-r')); };
  }

  /* ---------- Panel (7A–7I), solo admins ---------- */
  var PANEL = { abiertos: { hoy: true } };
  function seccion(id, titulo, extra) {
    return '<details class="psec" data-s="' + id + '"' + (PANEL.abiertos[id] ? ' open' : '') + '><summary><span>' + titulo + '</span>' + (extra || '') + '</summary><div class="pbody" id="ps_' + id + '">' +
      (id === 'hoy' ? '' : '<div class="spin" style="margin:20px auto"></div>') + '</div></details>';
  }
  function vistaPanel() {
    var v = $('view'), a = S.admin || {};
    v.innerHTML = '<div class="pagehead"><h2>Panel</h2><span class="k">' + esc(S.me.nombre) + (S.me.esTecnico ? ' · admin técnico' : ' · admin') + '</span></div>' +
      seccion('hoy', 'Hoy') + seccion('revisar', 'Por revisar', a.porRevisar ? '<span class="chip go">' + a.porRevisar + '</span>' : '') +
      seccion('turnos', 'Turnos y cumpleaños') + seccion('miembros', 'Miembros y enlaces') + seccion('datos', 'Datos') + seccion('ajustes', 'Ajustes') +
      '<p class="foot">' + esc(S.grupo || 'The Skull') + ' · v' + esc(S.version || '1.1') + '</p>';
    v.onclick = null;
    v.querySelectorAll('details.psec').forEach(function (d) {
      d.addEventListener('toggle', function () { var id = d.getAttribute('data-s'); PANEL.abiertos[id] = d.open; if (d.open && Date.now() - (d._t || 0) > 1500) { d._t = Date.now(); cargarSeccion(id); } });
      if (d.open) { d._t = Date.now(); cargarSeccion(d.getAttribute('data-s')); }
    });
  }
  function cargarSeccion(id) {
    var box = $('ps_' + id);
    var f = { hoy: panelHoy, revisar: panelRevisar, turnos: panelTurnos, miembros: panelMiembros, datos: panelDatos, ajustes: panelAjustes }[id];
    if (f) f(box);
  }
  /** Botón que pide un segundo toque para confirmar (sin ventanas del navegador). */
  function confirmar(b, fn) {
    if (b.getAttribute('data-ok')) { b.removeAttribute('data-ok'); fn(); return; }
    var t = b.textContent; b.setAttribute('data-ok', '1'); b.textContent = '¿Seguro? Toca otra vez'; b.classList.add('alerta');
    setTimeout(function () { if (b.getAttribute('data-ok')) { b.removeAttribute('data-ok'); b.textContent = t; b.classList.remove('alerta'); } }, 4000);
  }
  function ocupado(b, txt) { b.disabled = true; b.setAttribute('data-t', b.textContent); b.textContent = txt || 'Guardando…'; }
  function libre(b) { b.disabled = false; b.textContent = b.getAttribute('data-t') || b.textContent; }
  function hojaMensajes(titulo, partes) {
    abrirHoja('<div class="top"><button class="back" id="back">‹ Volver al Panel</button><span class="k" style="margin-left:auto">' + esc(titulo) + '</span></div>' +
      partes.filter(function (p) { return p && p[1]; }).map(function (p) { return cajaMensaje(p[1], p[0]); }).join(''));
    $('back').onclick = function () { cerrarHoja(); cargar(true).then(function () { if (TAB === 'panel') vistaPanel(); }); };
  }

  // Hoy: votaciones abiertas, empates, llamadas de atención
  function panelHoy(box) {
    var h = '';
    (S.admin.alertas || []).forEach(function (x) {
      h += '<div class="warn"><span><b>' + esc(x.miembro) + '</b> lleva ' + x.rondas + ' rondas sin votar.</span><button class="btn small ghost" data-llamada="' + esc(x.miembro) + '">Mensaje de llamada de atención</button></div>';
    });
    S.desempates.forEach(function (r) {
      h += '<div class="warn"><span><b>Empate en la #' + esc(r.numero) + ' ' + esc(r.banda) + '.</b> ' + esc(r.desempate) + '</span><button class="btn small" data-r="' + esc(r.id) + '">Elegir la ganadora</button></div>';
    });
    if (!S.abiertas.length) h += '<div class="note">No hay votaciones abiertas.</div>';
    S.abiertas.filter(function (r) { return r.estado !== 'desempate'; }).forEach(function (r) {
      var lista = r.todosVotaron ? '<span class="chip done">Todos votaron · ¿cerrar?</span>' : (r.listaParaCerrar ? '<span class="chip gold">Lista para cerrar</span>' : '');
      var lim = r.fecha_limite ? 'Se cierra sola el ' + fCorta(r.fecha_limite) + (r.prorroga ? ' (con prórroga)' : '') : (r.estado === 'whatsapp' ? (r.canciones >= 2 ? 'Se vota en el chat y en la app · ' : 'Se vota en WhatsApp · ') + r.diasAbierta + ' días abierta' : '');
      h += '<div class="pcard"><div class="pc-h"><span class="num">#' + esc(r.numero) + '</span> <b>' + esc(r.banda) + '</b> · ' + esc(r.disco) + ' ' + lista + '</div>' +
        '<div class="muted" style="font-size:13px">' + r.votaron + ' de ' + r.total + ' votaron' + (lim ? ' · ' + esc(lim) : '') + '</div>' +
        (r.faltan && r.faltan.length ? '<div class="faltan">Faltan: <b>' + esc(r.faltan.join(', ')) + '</b></div>' : '') +
        '<div class="row" style="margin-top:8px">' +
        (r.estado === 'whatsapp' ? (r.canciones >= 2 ? '<button class="btn small" data-cerrar="' + esc(r.id) + '">Cerrar votación</button>' : '') + '<button class="btn small' + (r.canciones >= 2 ? ' ghost' : '') + '" data-wa="' + esc(r.id) + '">Registrar resultado del chat</button>'
          : '<button class="btn small" data-cerrar="' + esc(r.id) + '">Cerrar votación</button>' + (r.prorroga ? '' : '<button class="btn small ghost" data-prorroga="' + esc(r.id) + '">+3 días</button>')) +
        '<button class="btn small ghost" data-recordar="' + esc(r.id) + '">Recordatorio</button><button class="btn small ghost" data-r="' + esc(r.id) + '">Ver</button></div>' +
        '<div class="wa-box" id="wa_' + esc(r.id) + '" hidden><label class="f">Pega aquí el resultado como lo escribes en el chat (una línea por canción: «Canción   número»)<textarea id="wat_' + esc(r.id) + '" style="min-height:150px"></textarea></label><button class="btn small" data-wago="' + esc(r.id) + '">Guardar y cerrar</button></div></div>';
    });
    box.innerHTML = h;
    box.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-r')) { abrirRonda(b.getAttribute('data-r')); return; }
      if (b.hasAttribute('data-cerrar')) return confirmar(b, function () {
        ocupado(b, 'Cerrando…');
        api('api_close', b.getAttribute('data-cerrar')).then(function (x) { hojaMensajes(x.desempate ? 'Cerrada con empate' : 'Votación cerrada', [[x.desempate ? 'Aviso de empate para el grupo' : 'Resultados para el grupo', x.mensaje], ['Resumen de la ronda', x.resumen]]); })
          .catch(function (er) { toast(errMsg(er)); libre(b); });
      });
      if (b.hasAttribute('data-prorroga')) return confirmar(b, function () {
        ocupado(b); api('api_extend', b.getAttribute('data-prorroga')).then(function () { toast('Tres días más'); cargar(true).then(function () { panelHoy(box); }); }).catch(function (er) { toast(errMsg(er)); libre(b); });
      });
      if (b.hasAttribute('data-recordar')) { ocupado(b, '…'); api('api_mensaje11', 'recordatorio', b.getAttribute('data-recordar')).then(function (m) { libre(b); hojaMensajes('Recordatorio', [['Recordatorio para el grupo', m]]); }).catch(function (er) { toast(errMsg(er)); libre(b); }); return; }
      if (b.hasAttribute('data-llamada')) { ocupado(b, '…'); api('api_mensaje11', 'llamada', '', b.getAttribute('data-llamada')).then(function (m) { libre(b); hojaMensajes('Llamada de atención', [['Mensaje amable', m]]); }).catch(function (er) { toast(errMsg(er)); libre(b); }); return; }
      if (b.hasAttribute('data-wa')) { var w = $('wa_' + b.getAttribute('data-wa')); w.hidden = !w.hidden; return; }
      if (b.hasAttribute('data-wago')) { var id = b.getAttribute('data-wago'); ocupado(b);
        api('api_registerWhatsapp', id, $('wat_' + id).value).then(function (x) { hojaMensajes('Resultado guardado', [['Resultados para el grupo', x && x.mensaje]]); }).catch(function (er) { toast(errMsg(er)); libre(b); }); }
    };
  }

  // Por revisar (7F)
  function panelRevisar(box) {
    api('api_inbox').then(function (ib) {
      var dl = '<datalist id="dlm">' + (ib.miembros || []).map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist>';
      var h = dl + (ib.preguntas.length ? '' : '<div class="note">No hay nada por revisar. 🤘</div>');
      ib.preguntas.forEach(function (q) {
        var accion = { homenaje: 'Escribe a quién homenajea', proponente: 'Quién la propuso', cumpleanos: 'De quién era el cumpleaños', voto: 'La canción correcta', ganadora: 'La ganadora correcta' }[q.accion];
        h += '<div class="pcard"><div class="k" style="color:var(--gold)">' + esc(q.tipo) + '</div>' + (q.ronda ? '<button class="linkb" data-r="' + esc(q.rid) + '">' + esc(q.ronda) + '</button>' : (q.banda ? '<b>' + esc(q.banda + (q.disco ? ' – ' + q.disco : '')) + '</b>' : '')) +
          '<div style="font-size:14px;margin:4px 0 8px">' + esc(q.detalle) + '</div>' +
          (accion ? '<div class="row" style="flex-wrap:nowrap"><input type="text" id="qa_' + q.fila + '" placeholder="' + esc(accion) + '"' + (/proponente|cumpleanos/.test(q.accion) ? ' list="dlm"' : '') + ' style="flex:1"><button class="btn small" data-aplicar="' + q.fila + '">Aplicar</button></div>'
            : '<div class="row" style="flex-wrap:nowrap"><input type="text" id="qa_' + q.fila + '" placeholder="Tu respuesta" style="flex:1"><button class="btn small ghost" data-texto="' + q.fila + '">Guardar</button></div>') + '</div>';
      });
      if (ib.avisos) h += '<div class="note"><b>' + ib.avisos + ' avisos de la importación</b> (lo que el cuaderno corrigió del chat y cosas así; solo para leer).<div class="row" style="margin-top:8px"><button class="btn small ghost" id="vav">Ver avisos</button><button class="btn small ghost" id="mav">Marcar todos como vistos</button></div><div id="lav"></div></div>';
      box.innerHTML = h;
      box.onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-r')) { abrirRonda(b.getAttribute('data-r')); return; }
        var fila = b.getAttribute('data-aplicar') || b.getAttribute('data-texto');
        if (fila) { var v = $('qa_' + fila).value.trim(); if (!v) { toast('Escribe la respuesta'); return; } ocupado(b);
          api('api_inboxAnswer', Number(fila), v, b.hasAttribute('data-aplicar')).then(function () { toast('Listo'); cargar(true).then(function () { panelRevisar(box); }); }).catch(function (er) { toast(errMsg(er)); libre(b); }); return; }
        if (b.id === 'vav') { ocupado(b, '…'); api('api_inbox', { avisos: true }).then(function (x) { libre(b); $('lav').innerHTML = '<div class="list who-l" style="margin-top:8px">' + (x.listaAvisos || []).slice(0, 200).map(function (a) { return '<div class="li"><span class="nm">' + esc(a.tipo) + '</span><span></span><span class="cm">' + esc(a.detalle) + '</span></div>'; }).join('') + '</div>'; }); return; }
        if (b.id === 'mav') return confirmar(b, function () { ocupado(b); api('api_inboxSeen').then(function () { toast('Avisos marcados como vistos'); cargar(true).then(function () { panelRevisar(box); }); }); });
      };
    }).catch(function (e) { box.innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }

  // Turnos y cumpleaños
  function panelTurnos(box) {
    var a = S.admin, rot = a.rotacion || [];
    var opts = function (lista) { return lista.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join(''); };
    var h = '<div class="note"><dl class="facts"><dt>Próximo en proponer</dt><dd><b>' + esc(S.siguiente || '—') + '</b></dd><dt>Último turno</dt><dd>' + esc(a.ultimoTurno || '—') + '</dd>' +
      (a.enPausa && a.enPausa.length ? '<dt>En pausa</dt><dd>' + esc(a.enPausa.join(', ')) + '</dd>' : '') + '</dl></div>' +
      '<div class="row"><button class="btn small ghost" id="tsk">Saltar a ' + esc(S.siguiente || '') + '</button></div>' +
      '<label class="f">Que el siguiente sea otro<div class="row" style="flex-wrap:nowrap"><select id="tnx" class="sel"><option value="">Elige…</option>' + opts(rot) + '</select><button class="btn small ghost" id="tnxb">Cambiar</button></div></label>' +
      '<details class="note"><summary>Orden de la rotación · ' + rot.length + '</summary><ol class="rotlist">' + rot.map(function (n) { return '<li' + (n === S.siguiente ? ' class="next"' : '') + '>' + esc(n) + '</li>'; }).join('') + '</ol></details>' +
      '<span class="k sec-t">Cola de cumpleaños</span><div class="chips">' + (S.colaCumples.length ? S.colaCumples.map(function (n) { return '<span class="fchip sm">' + esc(n) + ' <button class="x" data-quitar="' + esc(n) + '">×</button></span>'; }).join('') : '<span class="muted">Vacía</span>') + '</div>' +
      '<label class="f">Añadir a la cola<div class="row" style="flex-wrap:nowrap"><select id="cad" class="sel"><option value="">Elige…</option>' + opts(S.miembros) + '</select><button class="btn small ghost" id="cadb">Añadir</button></div></label>' +
      ((a.proximosCumples || []).length ? '<div class="muted" style="font-size:13px">Próximos cumpleaños: ' + a.proximosCumples.map(function (c) { return esc(c.miembro) + ' (' + (c.dias === 0 ? 'hoy' : 'en ' + c.dias + ' días') + ')'; }).join(', ') + '</div>' : '') +
      '<span class="k sec-t">Proponer</span><label class="f">Proponer en nombre de otro miembro<div class="row" style="flex-wrap:nowrap"><select id="ppor" class="sel"><option value="">Elige…</option>' + opts(S.miembros) + '</select><button class="btn small ghost" id="pporb">Proponer</button></div></label>' +
      '<button class="btn ghost" id="post">✝️ Empezar una propuesta póstuma</button>';
    box.innerHTML = h;
    var hecho = function (msg) { toast(msg); cargar(true).then(function () { panelTurnos(box); }); };
    $('tsk').onclick = function () { var b = this; confirmar(b, function () { ocupado(b); api('api_skipTurn').then(function () { hecho('Turno saltado'); }).catch(function (e) { toast(errMsg(e)); libre(b); }); }); };
    $('tnxb').onclick = function () { var n = $('tnx').value; if (!n) return; var b = this; ocupado(b); api('api_setNext', n).then(function () { hecho('Ahora le toca a ' + n); }).catch(function (e) { toast(errMsg(e)); libre(b); }); };
    $('cadb').onclick = function () { var n = $('cad').value; if (!n) return; var b = this; ocupado(b); api('api_cumpleAdd', n).then(function () { hecho(n + ' está en la cola'); }).catch(function (e) { toast(errMsg(e)); libre(b); }); };
    box.querySelectorAll('[data-quitar]').forEach(function (b) { b.onclick = function () { var n = b.getAttribute('data-quitar'); confirmar(b, function () { api('api_cumpleRemove', n).then(function () { hecho(n + ' salió de la cola'); }).catch(function (e) { toast(errMsg(e)); }); }); }; });
    $('pporb').onclick = function () { var n = $('ppor').value; if (!n) { toast('Elige a quién'); return; } abrirProponer('normal', n); };
    $('post').onclick = abrirPostuma;
  }
  // Póstuma: a quién se homenajea + discos candidatos (de la discografía) → el grupo vota el disco
  var PO = null;
  function abrirPostuma() {
    PO = { homenaje: '', candidatos: [] };
    var h = '<div class="top"><button class="back" id="back">‹ Cancelar</button><span class="k" style="margin-left:auto">Propuesta póstuma</span></div><h2>✝️ Póstuma</h2>' +
      '<label class="f">¿A quién se le hace el homenaje?<input type="text" id="poh" placeholder="Nombre del músico"></label>' +
      '<div class="note">Busca su banda y toca los discos que el grupo podrá elegir. Después todos votan el disco, y luego la canción.</div>' +
      '<form id="pof" class="row" style="flex-wrap:nowrap"><input type="text" id="poq" placeholder="Banda" style="flex:1"><button class="btn small">Buscar</button></form><div id="pol"></div>' +
      '<span class="k sec-t">Discos candidatos</span><div id="poc" class="chips"><span class="muted">Ninguno todavía</span></div><button class="btn" id="pogo">Empezar la póstuma</button>';
    abrirHoja(h); $('back').onclick = cerrarHoja;
    var pinta = function () { $('poc').innerHTML = PO.candidatos.length ? PO.candidatos.map(function (c, i) { return '<span class="fchip sm on">' + esc(c.banda + ' – ' + c.disco) + ' <button class="x" data-q="' + i + '">×</button></span>'; }).join('') : '<span class="muted">Ninguno todavía</span>';
      $('poc').querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { PO.candidatos.splice(Number(b.getAttribute('data-q')), 1); pinta(); }; }); };
    $('pof').onsubmit = function (e) {
      e.preventDefault(); var q = $('poq').value.trim(); if (q.length < 2) return;
      $('pol').innerHTML = '<div class="spin" style="margin:16px auto"></div>';
      api('api_buscarBanda', q).then(function (r) {
        $('pol').innerHTML = '<div class="list">' + r.bandas.slice(0, 6).map(function (x, i) { return '<button class="pick" data-b="' + esc(x.id) + '">' + (x.imagen ? '<img class="th" src="' + esc(x.imagen) + '">' : '<span class="th"></span>') + '<span class="a"><b>' + esc(x.nombre) + '</b></span></button>'; }).join('') + '</div>';
        $('pol').querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () {
          $('pol').innerHTML = '<div class="spin" style="margin:16px auto"></div>';
          api('api_discografia', b.getAttribute('data-b')).then(function (d) {
            var ds = d.discos.filter(function (x) { return x.valido; });
            $('pol').innerHTML = '<div class="list">' + ds.map(function (x, i) { return '<button class="pick" data-i="' + i + '"' + (x.ya ? ' disabled' : '') + '>' + (x.imagen ? '<img class="th" src="' + esc(x.imagen) + '">' : '<span class="th"></span>') + '<span class="a"><b>' + esc(x.titulo) + '</b><span>' + esc(x.anio) + (x.ya ? ' · ' + esc(x.ya.texto) : '') + '</span></span></button>'; }).join('') + '</div>';
            $('pol').querySelectorAll('[data-i]').forEach(function (bb) { bb.onclick = function () { var x = ds[Number(bb.getAttribute('data-i'))];
              if (!PO.candidatos.some(function (c) { return c.disco === x.titulo && c.banda === d.artista.nombre; })) PO.candidatos.push({ banda: d.artista.nombre, disco: x.titulo, anio: x.anio, mbid: x.mbid || '', id: x.id, codigo: d.artista.codigo || '' });
              pinta(); toast('Añadido'); }; });
          }).catch(function (er) { toast(errMsg(er)); });
        }; });
      }).catch(function (er) { toast(errMsg(er)); });
    };
    $('pogo').onclick = function () {
      var b = this, hom = $('poh').value.trim();
      if (!hom) { toast('Escribe a quién se homenajea'); return; } if (!PO.candidatos.length) { toast('Elige al menos un disco'); return; }
      ocupado(b, 'Empezando…');
      api('api_postumaStart', hom, PO.candidatos).then(function (x) { hojaMensajes('Póstuma', [['Para el grupo', x && (x.mensaje || x.mensajeVoto)]]); toast('Póstuma abierta'); })
        .catch(function (er) { toast(errMsg(er)); libre(b); });
    };
  }

  // Miembros y enlaces (7D)
  function panelMiembros(box) {
    api('api_miembros').then(function (ms) {
      var act = ms.filter(function (m) { return m.activo === 'SI'; }), ex = ms.filter(function (m) { return m.activo !== 'SI'; });
      var fila = function (m) {
        var tags = [m.rol === 'admin' ? 'admin' : m.rol === 'tecnico' ? 'admin técnico' : '', m.tipo === 'libre' ? 'libre' : '', m.en_pausa === 'SI' ? 'en pausa' : '', m.sin_whatsapp === 'SI' ? 'sin WhatsApp · enlace a ' + m.contacto : '', m.en_rotacion !== 'SI' && m.activo === 'SI' && m.tipo !== 'libre' ? 'fuera de la rotación' : ''].filter(String);
        return '<div class="mrow"><div><b>' + esc(m.nombre) + '</b>' + (m.cumple_dia ? ' <span class="muted" style="font-size:12.5px">🎂 ' + esc(m.cumple_dia) + '/' + esc(m.cumple_mes) + '</span>' : '') +
          (tags.length ? '<div class="muted" style="font-size:12px">' + esc(tags.join(' · ')) + '</div>' : '') + '</div><div class="row">' +
          (m.activo === 'SI' ? '<a class="btn small" target="_blank" rel="noopener" href="' + waLink(m.mensaje) + '">Enviar enlace</a><button class="btn small ghost" data-m="' + esc(m.nombre) + '">Más</button>'
            : '<button class="btn small ghost" data-m="' + esc(m.nombre) + '">Más</button>') + '</div></div>';
      };
      box.innerHTML = '<div class="list">' + act.map(fila).join('') + '</div>' +
        (ex.length ? '<details class="note"><summary>Ya no están en el grupo · ' + ex.length + '</summary><div class="list">' + ex.map(fila).join('') + '</div></details>' : '') +
        '<button class="btn ghost" id="madd">Añadir un miembro</button>' +
        '<div class="muted" style="font-size:12.5px">«Enviar enlace» abre WhatsApp con su enlace personal. Para Pablo el mensaje va a Elkin.</div>';
      box.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { editarMiembro(ms.filter(function (m) { return m.nombre === b.getAttribute('data-m'); })[0], box); }; });
      $('madd').onclick = function () { editarMiembro(null, box); };
    }).catch(function (e) { box.innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }
  function editarMiembro(m, box) {
    var nuevo = !m; m = m || { nombre: '', cumple_dia: '', cumple_mes: '', orden: '', en_rotacion: 'SI', activo: 'SI', tipo: 'normal', sin_whatsapp: '', contacto: '', notas: '' };
    var si = function (k, t) { return '<label class="f">' + t + '<select id="me_' + k + '" class="sel"><option' + (m[k] === 'SI' ? ' selected' : '') + '>SI</option><option' + (m[k] !== 'SI' ? ' selected' : '') + '>NO</option></select></label>'; };
    var h = '<div class="top"><button class="back" id="back">‹ Volver</button><span class="k" style="margin-left:auto">' + (nuevo ? 'Miembro nuevo' : esc(m.nombre)) + '</span></div>' +
      (nuevo ? '<label class="f">Nombre o apodo<input type="text" id="me_nombre"></label>' : '<h2>' + esc(m.nombre) + '</h2>') +
      '<div class="row"><label class="f" style="flex:1">Día del cumpleaños<input type="text" inputmode="numeric" id="me_cumple_dia" value="' + esc(m.cumple_dia) + '"></label><label class="f" style="flex:1">Mes<input type="text" inputmode="numeric" id="me_cumple_mes" value="' + esc(m.cumple_mes) + '"></label></div>' +
      (nuevo ? '' : '<label class="f">Puesto en el orden de la rotación<input type="text" inputmode="numeric" id="me_orden" value="' + esc(m.orden) + '"></label>') +
      '<div class="row">' + si('en_rotacion', 'En la rotación') + (nuevo ? '' : si('activo', 'En el grupo')) + si('sin_whatsapp', 'Sin WhatsApp') + '</div>' +
      '<label class="f">Si no tiene WhatsApp, a quién se le manda su enlace<input type="text" id="me_contacto" list="dlm2" value="' + esc(m.contacto) + '"></label><datalist id="dlm2">' + S.miembros.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<label class="f">Notas<input type="text" id="me_notas" value="' + esc(m.notas) + '"></label>' +
      '<button class="btn" id="mego">' + (nuevo ? 'Añadir y crear su enlace' : 'Guardar') + '</button>' +
      (nuevo ? '' : '<div class="row"><button class="btn small ghost" id="mepa">' + (m.en_pausa === 'SI' ? 'Quitar la pausa' : 'Poner en pausa') + '</button><button class="btn small ghost" id="mtok">Enlace nuevo (el viejo deja de servir)</button></div>');
    abrirHoja(h);
    var volver = function () { cerrarHoja(); panelMiembros(box); };
    $('back').onclick = volver;
    var val = function (k) { var e = $('me_' + k); return e ? e.value.trim() : undefined; };
    $('mego').onclick = function () {
      var b = this; ocupado(b);
      if (nuevo) {
        api('api_addMember', { nombre: val('nombre'), cumple_dia: val('cumple_dia'), cumple_mes: val('cumple_mes'), en_rotacion: val('en_rotacion'), sin_whatsapp: val('sin_whatsapp') === 'SI' ? 'SI' : '', contacto: val('contacto'), notas: val('notas') })
          .then(function (x) { hojaMensajes('Miembro nuevo', [['Su enlace personal', x.mensaje]]); }).catch(function (e) { toast(errMsg(e)); libre(b); });
        return;
      }
      var c = {}; ['cumple_dia', 'cumple_mes', 'orden', 'en_rotacion', 'activo', 'contacto', 'notas'].forEach(function (k) { var v = val(k); if (v !== undefined && v !== String(m[k] || '')) c[k] = v; });
      var sw = val('sin_whatsapp') === 'SI' ? 'SI' : ''; if (sw !== (m.sin_whatsapp || '')) c.sin_whatsapp = sw;
      if (!Object.keys(c).length) { volver(); return; }
      api('api_memberUpdate', m.nombre, c).then(function (st) { S = st; toast('Guardado'); volver(); }).catch(function (e) { toast(errMsg(e)); libre(b); });
    };
    if (!nuevo) {
      $('mepa').onclick = function () { var b = this; ocupado(b); api('api_setPause', m.nombre, m.en_pausa !== 'SI', '').then(function () { toast(m.en_pausa === 'SI' ? 'Volvió de la pausa' : 'En pausa'); volver(); }).catch(function (e) { toast(errMsg(e)); libre(b); }); };
      $('mtok').onclick = function () { var b = this; confirmar(b, function () { ocupado(b); api('api_newToken', m.nombre).then(function (x) { hojaMensajes('Enlace nuevo', [['Su enlace nuevo', x.mensaje]]); }).catch(function (e) { toast(errMsg(e)); libre(b); }); }); };
    }
  }

  // Datos: editar una ronda (7A), canciones, votos (7B), cancelar o reabrir (7C), registro (7G)
  function panelDatos(box) {
    box.innerHTML = '<form id="dbf" class="row" style="flex-wrap:nowrap"><input type="text" id="dbn" inputmode="numeric" placeholder="Número de la ronda, por ejemplo 627" style="flex:1"><button class="btn small">Editar</button></form>' +
      '<span class="k sec-t">Registro de actividad</span><div id="dblog"><div class="spin" style="margin:16px auto"></div></div>';
    $('dbf').onsubmit = function (e) { e.preventDefault(); var n = $('dbn').value.replace(/\D/g, ''); if (n) editarRonda('#' + n); };
    registro($('dblog'), 0);
  }
  function registro(el, desde) {
    api('api_log', { n: 20, desde: desde }).then(function (lg) {
      var h = lg.items.map(function (x) { return '<div class="li"><span class="nm">' + esc(x.quien) + ' · ' + esc(x.accion) + '</span><span class="sg a">' + esc(String(x.fecha).slice(5)) + '</span><span class="cm">' + esc(x.detalle) + '</span></div>'; }).join('');
      if (!desde) el.innerHTML = '<div class="list who-l" id="dbll"></div>';
      $('dbll').insertAdjacentHTML('beforeend', h);
      var mas = $('dblm'); if (mas) mas.remove();
      if (desde + lg.items.length < lg.total) { el.insertAdjacentHTML('beforeend', '<button class="btn small ghost" id="dblm">Ver más</button>'); $('dblm').onclick = function () { registro(el, desde + lg.items.length); }; }
    }).catch(function (e) { el.innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }
  function editarRonda(ref) {
    abrirHoja('<div class="top"><button class="back" id="back">‹ Volver al Panel</button></div><div class="spin"></div>'); $('back').onclick = cerrarHoja;
    api('api_roundEditInfo', ref).then(function (r) {
      var campo = function (k, t, tipo) { return '<label class="f">' + t + '<input type="text" id="re_' + k + '" value="' + esc(r[k] || '') + '"' + (tipo ? ' inputmode="' + tipo + '"' : '') + '></label>'; };
      var nn = function (x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); };
      var sel = function (k, t, ops) {
        var cur = String(r[k] || ''), hay = ops.some(function (o) { return nn(o) === nn(cur); });
        if (cur && !hay) ops = ops.concat([cur]);
        var elegido = false;
        return '<label class="f">' + t + '<select id="re_' + k + '" class="sel">' + ops.map(function (o) { var s = !elegido && nn(o) === nn(cur); if (s) elegido = true; return '<option value="' + esc(o) + '"' + (s ? ' selected' : '') + '>' + esc(o || '—') + '</option>'; }).join('') + '</select></label>'; };
      var cs = r.canciones || [];
      var h = '<div class="top"><button class="back" id="back">‹ Volver al Panel</button><span class="k" style="margin-left:auto">Editar ' + esc('#' + r.numero) + '</span></div>' +
        '<h2>#' + esc(r.numero) + ' · ' + esc(r.banda) + '</h2>' + (r.historica ? '<div class="note">Ronda del historial: los cambios quedan en el registro con tu nombre.</div>' : '') +
        campo('banda', 'Banda') + campo('disco', 'Disco') + '<div class="row">' + campo('anio', 'Año', 'numeric') + campo('pais', 'País') + '</div>' +
        sel('ganadora', 'Ganadora', [''].concat(cs.map(function (c) { return c.titulo; }))) +
        sel('proponente', 'Propuso', [''].concat(S.miembros).concat(['Decisión colectiva'])) + sel('tipo', 'Tipo', r.tipos || ['normal', 'cumpleaños', 'póstuma']) + campo('homenaje', 'Homenaje a (póstumas)') +
        '<div class="row">' + campo('numero', 'Número', 'numeric') + campo('rotacion', 'Ronda', 'numeric') + '</div>' + campo('desempate', 'Cómo se decidió (empates)') +
        '<button class="btn" id="rego">Guardar cambios</button>' +
        '<details class="note"><summary><b>Canciones · ' + cs.length + '</b></summary><div id="recs" style="margin-top:8px">' + cs.map(function (c, i) {
          return '<div class="row cs" style="flex-wrap:nowrap" data-antes="' + esc(c.titulo) + '"><input type="text" value="' + esc(c.titulo) + '" style="flex:1"><span class="muted" style="font-size:12px;align-self:center">' + (c.votos || 0) + '</span><button class="btn small ghost" data-up="' + i + '">↑</button></div>';
        }).join('') + '</div><div class="row" style="flex-wrap:nowrap;margin-top:6px"><input type="text" id="renew" placeholder="Añadir una canción" style="flex:1"><button class="btn small ghost" id="readdc">Añadir</button></div><button class="btn small" id="recsgo" style="margin-top:8px">Guardar canciones</button></details>' +
        '<details class="note"><summary><b>Corregir votos</b></summary><div class="row" style="flex-wrap:nowrap;margin-top:8px"><select id="vfm" class="sel" style="flex:1"><option value="">Miembro…</option>' + S.miembros.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select>' +
        '<select id="vfc" class="sel" style="flex:1"><option value="">Canción…</option>' + cs.map(function (c) { return '<option>' + esc(c.titulo) + '</option>'; }).join('') + '<option value="(abstención)">Abstención</option><option value="__quitar">Quitar su voto</option></select></div><button class="btn small" id="vfgo" style="margin-top:8px">Guardar voto</button></details>' +
        '<div class="row">' + (r.puedeCancelar ? '<button class="btn small ghost" id="recan">Cancelar esta propuesta</button>' : '') + (r.puedeReabrir ? '<button class="btn small ghost" id="reabr">Reabrir la votación</button>' : '') + '</div>';
      abrirHoja(h); $('back').onclick = cerrarHoja;
      var camposR = ['banda', 'disco', 'anio', 'pais', 'ganadora', 'proponente', 'tipo', 'homenaje', 'numero', 'rotacion', 'desempate'];
      $('rego').onclick = function () {
        var b = this, c = {}; camposR.forEach(function (k) { var v = $('re_' + k).value.trim(); if (v !== String(r[k] || '').trim()) c[k] = v; });
        if (!Object.keys(c).length) { toast('No hay cambios'); return; }
        ocupado(b); api('api_roundEdit', ref, c).then(function (x) { toast('Guardado'); if (x && x.avisos && x.avisos.length) toast(x.avisos.join(' ')); editarRonda('#' + ($('re_numero').value || r.numero)); }).catch(function (e) { toast(errMsg(e)); libre(b); });
      };
      var recs = $('recs');
      recs.onclick = function (e) { var b = e.target.closest('[data-up]'); if (!b) return; var row = b.closest('.cs'), prev = row.previousElementSibling; if (prev) recs.insertBefore(row, prev); };
      $('readdc').onclick = function () { var t = $('renew').value.trim(); if (!t) return; recs.insertAdjacentHTML('beforeend', '<div class="row cs" style="flex-wrap:nowrap" data-antes=""><input type="text" value="' + esc(t) + '" style="flex:1"><span class="muted" style="font-size:12px;align-self:center">nueva</span></div>'); $('renew').value = ''; };
      $('recsgo').onclick = function () {
        var b = this, lista = [].map.call(recs.querySelectorAll('.cs'), function (row) { return { titulo: row.querySelector('input').value.trim(), antes: row.getAttribute('data-antes') || '' }; }).filter(function (x) { return x.titulo; });
        ocupado(b); api('api_roundSongs', ref, lista).then(function () { toast('Canciones guardadas'); editarRonda(ref); }).catch(function (e) { toast(errMsg(e)); libre(b); });
      };
      $('vfgo').onclick = function () {
        var b = this, m = $('vfm').value, c = $('vfc').value; if (!m || !c) { toast('Elige miembro y canción'); return; }
        ocupado(b); api('api_voteFix', ref, m, c === '__quitar' ? '' : c).then(function (x) { toast('Voto guardado'); if (x && x.aviso) toast(x.aviso); editarRonda(ref); }).catch(function (e) { toast(errMsg(e)); libre(b); });
      };
      var can = $('recan'); if (can) can.onclick = function () { var b = this; confirmar(b, function () { ocupado(b); api('api_roundCancel', ref, '').then(function (x) { toast('Propuesta cancelada'); cerrarHoja(); cargar(true); }).catch(function (e) { toast(errMsg(e)); libre(b); }); }); };
      var reo = $('reabr'); if (reo) reo.onclick = function () { var b = this; confirmar(b, function () { ocupado(b); api('api_roundReopen', ref).then(function () { toast('Reabierta'); cerrarHoja(); cargar(true); }).catch(function (e) { toast(errMsg(e)); libre(b); }); }); };
    }).catch(function (e) { abrirHoja('<div class="top"><button class="back" id="back">‹ Volver al Panel</button></div><div class="err">' + esc(errMsg(e)) + '</div>'); $('back').onclick = cerrarHoja; });
  }

  // Ajustes (7E, 8F, 9D): mensajes, reglas y valores
  function panelAjustes(box) {
    box.innerHTML = '<details class="note"><summary><b>Mensajes de WhatsApp</b></summary><div id="ajm" style="margin-top:8px"><div class="spin" style="margin:16px auto"></div></div></details>' +
      '<details class="note"><summary><b>Texto de las reglas</b></summary><div style="margin-top:8px"><textarea id="ajr" style="min-height:320px">' + esc(S.reglas || '') + '</textarea><button class="btn small" id="ajrgo" style="margin-top:8px">Guardar reglas</button></div></details>' +
      '<details class="note"><summary><b>Valores de la app</b></summary><div id="ajv" style="margin-top:8px"><div class="spin" style="margin:16px auto"></div></div></details>';
    $('ajrgo').onclick = function () { var b = this; ocupado(b); api('api_setRules', $('ajr').value).then(function (x) { S.reglas = x.reglas; toast('Reglas guardadas'); libre(b); }).catch(function (e) { toast(errMsg(e)); libre(b); }); };
    api('api_mensajes').then(function (ms) {
      $('ajm').innerHTML = ms.map(function (m) {
        return '<div class="pcard"><b>' + esc(m.nombre) + '</b>' + (m.cambiado ? ' <span class="chip gold">cambiado</span>' : '') +
          '<textarea id="am_' + esc(m.tipo) + '" style="min-height:130px;margin-top:6px">' + esc(m.texto) + '</textarea>' +
          '<div class="muted" style="font-size:12px">Campos: ' + esc((m.campos || []).join(' ')) + '</div>' +
          '<details style="font-size:13px;margin-top:4px"><summary class="muted">Ejemplo</summary><div class="pres" style="font-size:13px">' + esc(m.ejemplo || '') + '</div></details>' +
          '<div class="row" style="margin-top:6px"><button class="btn small" data-ms="' + esc(m.tipo) + '">Guardar</button>' + (m.cambiado ? '<button class="btn small ghost" data-mr="' + esc(m.tipo) + '">Volver al original</button>' : '') + '</div></div>';
      }).join('');
      $('ajm').onclick = function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var t = b.getAttribute('data-ms') || b.getAttribute('data-mr'); if (!t) return;
        ocupado(b); api('api_mensajeSet', t, b.hasAttribute('data-ms') ? $('am_' + t).value : '').then(function () { toast('Guardado'); panelAjustes(box); }).catch(function (er) { toast(errMsg(er)); libre(b); });
      };
    }).catch(function (e) { $('ajm').innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
    api('api_ajustes').then(function (as) {
      $('ajv').innerHTML = as.map(function (a) {
        var inp = a.tipo === 'sino' || a.tipo === 'opcion' ? '<select id="av_' + a.clave + '" class="sel"' + (a.editable ? '' : ' disabled') + '>' + (a.opciones || ['SI', 'NO']).map(function (o) { return '<option' + (o === a.valor ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>'
          : '<input type="text" id="av_' + a.clave + '" value="' + esc(a.tipo === 'secreto' ? '' : a.tipo === 'fraccion' && a.valor !== '' ? Math.round(Number(a.valor) * 100) + ' %' : a.valor) + '" placeholder="' + esc(a.tipo === 'secreto' ? (a.valor || 'Sin poner') : '') + '"' + (a.editable ? '' : ' disabled') + (a.tipo === 'num' ? ' inputmode="numeric"' : '') + '>';
        return '<div class="aj"><label class="f">' + esc(a.titulo) + (a.editable ? '' : ' <span class="muted">(solo el admin técnico)</span>') + inp + '</label>' + (a.editable ? '<button class="btn small ghost" data-av="' + a.clave + '">Guardar</button>' : '') + '</div>';
      }).join('');
      $('ajv').onclick = function (e) {
        var b = e.target.closest('[data-av]'); if (!b) return; var k = b.getAttribute('data-av');
        ocupado(b); api('api_ajusteSet', k, $('av_' + k).value).then(function () { toast('Guardado'); libre(b); cargar(true); }).catch(function (er) { toast(errMsg(er)); libre(b); });
      };
    }).catch(function (e) { $('ajv').innerHTML = '<div class="err">' + esc(errMsg(e)) + '</div>'; });
  }

  /* ---------- inicio ---------- */
  /* Manifest generado con la dirección personal como start_url (Android/Chrome: «Instalar app» abre directo con el enlace).
   * En iPhone no se pone manifest: Safari guarda la dirección exacta de la página al añadirla a la pantalla de inicio. */
  function manifestPersonal() {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || !window.Blob || !window.URL || !URL.createObjectURL) return;
    var base = location.href.replace(/[^/]*$/, '');
    var m = { name: CFG.GRUPO || 'The Skull', short_name: CFG.GRUPO || 'The Skull', start_url: location.href, scope: base, display: 'standalone',
      background_color: '#0F0E11', theme_color: '#0F0E11', lang: 'es',
      icons: [{ src: base + 'img/icono_192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'img/icono_512.png', sizes: '512x512', type: 'image/png' }] };
    var link = document.createElement('link'); link.rel = 'manifest';
    link.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    document.head.appendChild(link);
  }
  function start() {
    TOKEN = leerToken();
    if (TOKEN) manifestPersonal();
    if (typeof window.SKULL_DEMO === 'function' && !TOKEN) TOKEN = 'demo';
    cargar(false).then(function () {
      var r = new URLSearchParams(location.search).get('r'); if (r && S) abrirRonda(r);
    });
  }
  window.SKULL_APP = { verReglas: verReglas,  abrirRonda: abrirRonda, abrirProponer: abrirProponer, tab: function (t) { TAB = t; tabs(); render(); }, render: render, get S() { return S; }, set S(v) { S = v; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
