function uid() {
  return Math.random().toString(36).slice(2,10);
}

function escH(str) {
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function jsStr(str) {
  return JSON.stringify(String(str||''));
}

function safeId(str) {
  return String(str||'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
