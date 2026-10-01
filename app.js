// Магазин без сервера: база данных IndexedDB хранится прямо в браузере.
const ADMIN_PASSWORD = 'admin123'; // смените пароль! (защита простая, только от случайного входа)
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let products = [], cart = {}, editId = null, photo = '', view = 'shop';
try { cart = JSON.parse(localStorage.getItem('cart') || '{}'); } catch (e) {}

/* ---------- База данных (IndexedDB) ---------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('shopdb', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('products', {keyPath: 'id', autoIncrement: true}); r.result.createObjectStore('meta'); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function tx(store, mode, fn) {
  const d = await dbp;
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
  });
}
const dbAll = () => tx('products', 'readonly', s => s.getAll());
const dbPut = p => tx('products', 'readwrite', s => s.put(p));
const dbDel = id => tx('products', 'readwrite', s => s.delete(id));
async function seed() { // один раз добавляем примеры
  if (await tx('meta', 'readonly', s => s.get('seeded'))) return;
  if ((await dbAll()).length === 0)
    for (const [name, price, category, stock, emoji] of [['Кофе в зёрнах', 690, 'Кофе', 10, '☕'], ['Чайник', 2490, 'Дом', 5, '🫖'], ['Наушники', 3990, 'Электроника', 8, '🎧'], ['Рюкзак', 3200, 'Одежда', 4, '🎒']])
      await dbPut({name, price, category, stock, emoji, description: '', photo: ''});
  await tx('meta', 'readwrite', s => s.put(1, 'seeded'));
}
async function load() { products = await dbAll(); products.sort((a, b) => b.id - a.id); render(); }

/* ---------- Отображение ---------- */
const isAdmin = () => sessionStorage.getItem('admin') === '1';
const imgHtml = p => p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(p.emoji || '📦');
function render() {
  const q = $('q').value.toLowerCase();
  const list = products.filter(p => (p.name + ' ' + (p.category || '')).toLowerCase().includes(q));
  $('grid').innerHTML = list.map(p => `<div class="card"><div class="img">${imgHtml(p)}</div><div class="b"><div>${esc(p.name)}</div>
    <div class="mu">${esc(p.category)}</div><div class="mu">${esc(p.description)}</div><b>${p.price} ₽</b>
    <button data-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Нет в наличии' : 'В корзину'}</button></div></div>`).join('') || '<p class="mu">Товаров пока нет</p>';
  $('cnt').textContent = Object.values(cart).reduce((a, b) => a + b, 0);
  let t = 0;
  $('cartList').innerHTML = Object.keys(cart).map(id => {
    const p = products.find(x => x.id == id); if (!p) return ''; t += p.price * cart[id];
    return `<div class="li"><div class="n">${esc(p.name)}<div class="mu">${p.price} ₽ × ${cart[id]}</div></div><button class="g" data-m="${id}">−</button><button class="g" data-p="${id}">+</button></div>`;
  }).join('') || '<p class="mu">Корзина пуста</p>';
  $('tot').textContent = t;
  $('list').innerHTML = products.map(p => `<div class="li"><div class="img" style="width:40px;height:40px;font-size:24px;border-radius:6px">${imgHtml(p)}</div>
    <div class="n">${esc(p.name)}<div class="mu">${p.price} ₽ · остаток ${p.stock}</div></div><button class="g" data-e="${p.id}">✏️</button><button class="d" data-d="${p.id}">🗑</button></div>`).join('') || '<p class="mu">Пусто</p>';
  ['shop', 'cart', 'admin'].forEach(s => $(s).classList.toggle('hide', s !== view));
  $('login').classList.toggle('hide', isAdmin()); $('app').classList.toggle('hide', !isAdmin());
}
const go = v => { view = v; render(); scrollTo(0, 0); };
const cartSave = () => { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {} render(); };

/* ---------- События ---------- */
document.addEventListener('click', async e => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  const id = d.add || d.p;
  if (id) { const p = products.find(x => x.id == id); if ((cart[id] || 0) < p.stock) { cart[id] = (cart[id] || 0) + 1; cartSave(); } }
  if (d.m) { if (--cart[d.m] <= 0) delete cart[d.m]; cartSave(); }
  if (d.d && confirm('Удалить товар?')) { await dbDel(Number(d.d)); delete cart[d.d]; await load(); cartSave(); }
  if (d.e) { const p = products.find(x => x.id == d.e); editId = p.id; photo = p.photo || ''; $('fn').value = p.name; $('fp').value = p.price; $('fc').value = p.category || ''; $('fs').value = p.stock; $('fe').value = p.emoji || '📦'; $('fd').value = p.description || ''; $('fTitle').textContent = 'Редактировать товар'; scrollTo(0, 0); }
});
$('q').oninput = render;
$('bCart').onclick = () => go('cart');
$('bAdmin').onclick = () => go('admin');
$('bBack1').onclick = $('bBack2').onclick = $('bBack3').onclick = () => go('shop');
$('bLogin').onclick = () => { if ($('pw').value === ADMIN_PASSWORD) { sessionStorage.setItem('admin', '1'); $('pw').value = ''; render(); } else alert('Неверный пароль'); };
$('pw').addEventListener('keydown', e => { if (e.key === 'Enter') $('bLogin').click(); });
$('bLogout').onclick = () => { sessionStorage.removeItem('admin'); go('shop'); };
$('bOrder').onclick = async () => {
  const ids = Object.keys(cart); if (!ids.length) return alert('Корзина пуста');
  for (const id of ids) { const p = products.find(x => x.id == id); if (p) await dbPut({...p, stock: Math.max(0, p.stock - cart[id])}); }
  cart = {}; await load(); cartSave(); alert('Заказ оформлен (демо)'); go('shop');
};
function resetForm() { editId = null; photo = ''; ['fn', 'fp', 'fc', 'fd'].forEach(i => $(i).value = ''); $('fs').value = 10; $('fe').value = '📦'; $('ff').value = ''; $('fTitle').textContent = 'Добавить товар'; }
$('bReset').onclick = resetForm;
$('ff').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 500 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); photo = c.toDataURL('image/jpeg', .8); }; im.src = r.result; }; r.readAsDataURL(f); };
$('bSave').onclick = async () => {
  if (!$('fn').value.trim() || $('fp').value === '') return alert('Укажите название и цену');
  const p = {name: $('fn').value.trim(), price: +$('fp').value, category: $('fc').value, stock: +$('fs').value || 0, emoji: $('fe').value || '📦', description: $('fd').value, photo};
  if (editId) p.id = editId;
  try { await dbPut(p); resetForm(); await load(); } catch (err) { alert('Не удалось сохранить: ' + err); }
};
$('bExp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(products, null, 1)], {type: 'application/json'})); a.download = 'products.json'; a.click(); };
$('fi').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const arr = JSON.parse(await f.text()); if (!Array.isArray(arr)) throw 0; if (!confirm('Добавить ' + arr.length + ' товаров из файла?')) return;
    for (const p of arr) { delete p.id; await dbPut(p); } await load(); alert('Готово'); } catch (err) { alert('Неверный файл'); }
  e.target.value = '';
};
seed().then(load).catch(err => alert('Не удалось открыть базу данных браузера: ' + err));
