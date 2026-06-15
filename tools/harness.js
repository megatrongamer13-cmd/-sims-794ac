#!/usr/bin/env node
/*
 * harness.js — runner de teste do motor SIMS (sims-794ac)
 *
 * Executa o MOTOR REAL do index.html, sem duplicar a logica. Le o arquivo ao vivo,
 * extrai o conteudo do <script>, monta um shim minimo de DOM e chama identificar().
 *
 * Uso:
 *   node tools/harness.js "DESCRICAO DA FALHA"   -> imprime o codigo principal (ex.: P22) ou NENHUM
 *   node tools/harness.js                        -> roda todos os casos de tools/cases.json
 *                                                   (exit code 0 = tudo PASS, 1 = houve FAIL)
 *
 * Node puro (fs/path/vm). Sem dependencias, sem npm install. Roda em Git Bash e PowerShell.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const HTML = path.join(ROOT, "index.html");

// 1) Extrai o <script> do index.html (unico bloco) ------------------------------
const html = fs.readFileSync(HTML, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!m) {
  console.error("ERRO: bloco <script> nao encontrado em " + HTML);
  process.exit(2);
}
// Remove o disparo da UI da tabela (window.onload=init) para nao tocar o DOM no load.
const code = m[1].replace(/window\.onload\s*=\s*init\s*;?/, "");

// 2) Shim minimo de DOM: so o que identificar() usa ----------------------------
function makeEl() {
  return {
    value: "", innerHTML: "", textContent: "", style: {},
    setAttribute() {}, appendChild() {}, querySelectorAll() { return []; }
  };
}
const els = { "ia-input": makeEl(), "ia-result": makeEl() };
const sandbox = {
  document: {
    getElementById(id) { return els[id] || (els[id] = makeEl()); },
    querySelectorAll() { return []; },
    createElement() { return makeEl(); }
  },
  window: {},
  alert() {},
  console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "index.html#script" });

if (typeof sandbox.identificar !== "function") {
  console.error("ERRO: identificar() nao foi definido pelo script do index.html");
  process.exit(2);
}

// 3) Classifica uma descricao -> codigo principal ('NENHUM' se nao houver) ------
function classify(desc) {
  els["ia-input"].value = String(desc == null ? "" : desc);
  els["ia-result"].innerHTML = "";
  sandbox.identificar();
  const out = els["ia-result"].innerHTML || "";
  const mp = out.match(/PRINCIPAL:\s*([A-Z]\d+)/); // ex.: "CODIGO PRINCIPAL: P22 — ..."
  return mp ? mp[1] : "NENHUM";
}

// 4) Modos ---------------------------------------------------------------------
const arg = process.argv[2];
if (typeof arg === "string" && arg.length) {
  console.log(classify(arg));
  process.exit(0);
}

// Sem argumento: roda a suite de regressao
const CASES = path.join(__dirname, "cases.json");
let cases;
try {
  cases = JSON.parse(fs.readFileSync(CASES, "utf8"));
} catch (e) {
  console.error("ERRO ao ler " + CASES + ": " + e.message);
  process.exit(2);
}

let pass = 0, fail = 0, xfail = 0, xpass = 0;
for (const c of cases) {
  const got = classify(c.descricao);
  const ok = got === c.esperado;
  if (c.xfail) {
    if (ok) { xpass++; console.log("XPASS  esperado=" + c.esperado + " obtido=" + got + "  | " + short(c.descricao)); }
    else { xfail++; console.log("xfail  esperado=" + c.esperado + " obtido=" + got + "  | " + short(c.descricao)); }
    continue;
  }
  if (ok) { pass++; }
  else { fail++; console.log("FAIL   esperado=" + c.esperado + " obtido=" + got + "  | " + c.descricao); }
}
console.log("\n" + pass + " PASS, " + fail + " FAIL" +
  (xfail ? ", " + xfail + " xfail" : "") + (xpass ? ", " + xpass + " XPASS (revisar)" : "") +
  "  (" + cases.length + " casos)");
process.exit(fail ? 1 : 0);

function short(s) { return s.length > 60 ? s.slice(0, 57) + "..." : s; }
