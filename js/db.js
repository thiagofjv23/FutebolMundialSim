'use strict';

const DB = (() => {
  let _db = null;

  function abrirBanco() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('futebol_sim', 1);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('estado_mundo')) {
          db.createObjectStore('estado_mundo', { keyPath: 'chave' });
        }
        if (!db.objectStoreNames.contains('partidas')) {
          const s = db.createObjectStore('partidas', { keyPath: 'partida_id', autoIncrement: true });
          s.createIndex('ano', 'ano', { unique: false });
          s.createIndex('torneio_id', 'torneio_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('transferencias')) {
          const s = db.createObjectStore('transferencias', { keyPath: 'transferencia_id', autoIncrement: true });
          s.createIndex('ano', 'ano', { unique: false });
          s.createIndex('jogador_id', 'jogador_id', { unique: false });
        }
        if (!db.objectStoreNames.contains('cronicas')) {
          db.createObjectStore('cronicas', { keyPath: 'ano' });
        }
        if (!db.objectStoreNames.contains('eventos_log')) {
          const s = db.createObjectStore('eventos_log', { keyPath: 'evento_id' });
          s.createIndex('ano', 'ano', { unique: false });
        }
      };

      req.onsuccess = (e) => { _db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction(store, mode);
      const s = tx.objectStore(store);
      const req = fn(s);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function salvarEstado(chave, valor) {
    return _tx('estado_mundo', 'readwrite', s => s.put({ chave, valor: JSON.stringify(valor) }));
  }

  function carregarEstado(chave) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('estado_mundo', 'readonly');
      const req = tx.objectStore('estado_mundo').get(chave);
      req.onsuccess = (e) => {
        if (e.target.result) {
          try { resolve(JSON.parse(e.target.result.valor)); }
          catch { resolve(null); }
        } else {
          resolve(null);
        }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function salvarPartida(partida) {
    return _tx('partidas', 'readwrite', s => s.add(partida));
  }

  function salvarTransferencia(obj) {
    return _tx('transferencias', 'readwrite', s => s.add(obj));
  }

  function salvarCronica(ano, snapshot) {
    return _tx('cronicas', 'readwrite', s => s.put({ ano, ...snapshot }));
  }

  function carregarCronica(ano) {
    return _tx('cronicas', 'readonly', s => s.get(ano));
  }

  function registrarEvento(eventoId, ano) {
    return _tx('eventos_log', 'readwrite', s => s.put({ evento_id: eventoId, ano, ts: Date.now() }));
  }

  function limparPartidasAntigas(anoAtual) {
    return new Promise((resolve, reject) => {
      const tx = _db.transaction('partidas', 'readwrite');
      const idx = tx.objectStore('partidas').index('ano');
      const range = IDBKeyRange.upperBound(anoAtual - 3);
      const req = idx.openCursor(range);
      req.onsuccess = (e) => {
        const c = e.target.result;
        if (c) { c.delete(); c.continue(); } else { resolve(); }
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  return { abrirBanco, salvarEstado, carregarEstado, salvarPartida, salvarTransferencia, salvarCronica, carregarCronica, registrarEvento, limparPartidasAntigas };
})();
