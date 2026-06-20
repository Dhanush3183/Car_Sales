import { app, db } from './firebase-config.js';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, increment } from 'firebase/firestore';

gsap.registerPlugin(ScrollTrigger);

let cars = [];
let compareList = [];
let autoScrollInterval = null;
let currentCar = null;
let currentCarImages = [];
let currentImageIndex = 0;

const formatINR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const filterBrand = document.getElementById('filter-brand');
const filterPrice = document.getElementById('filter-price');
const filterBody = document.getElementById('filter-body');
const filterFuel = document.getElementById('filter-fuel');
const filterGear = document.getElementById('filter-gear');
const searchInput = document.getElementById('search-input');

async function fetchSettings() {
  const snap = await getDoc(doc(db, 'settings', 'global'));
  if (snap.exists()) {
    const d = snap.data();
    document.getElementById('showroom-name-nav').textContent = d.name || 'Elite Motors';
    const fName = document.getElementById('showroom-name-footer');
    if (fName) fName.textContent = d.name || 'Elite Motors';
    const wName = document.getElementById('showroom-name-welcome');
    if (wName) wName.textContent = d.name || 'Elite Fleet';
    const cName = document.getElementById('showroom-name-copyright');
    if (cName) cName.textContent = d.name || 'Elite Motors';
    const cbName = document.getElementById('chatbot-name-title');
    if (cbName) cbName.textContent = (d.name || 'Elite Fleet') + ' AI';
    const fAddr = document.getElementById('showroom-address');
    if (fAddr) fAddr.textContent = d.address || '';
    const fPhone = document.getElementById('showroom-phone');
    if (fPhone) fPhone.textContent = d.phone || '';
    const fEmail = document.getElementById('showroom-email');
    if (fEmail) fEmail.textContent = d.email || '';
    const fMap = document.getElementById('showroom-map-link');
    if (fMap && d.mapUrl) fMap.href = d.mapUrl;
  }
}

async function fetchCars() {
  const snap = await getDocs(collection(db, 'cars'));
  cars = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(c => c.status === 'Available');
  
  const brands = [...new Set(cars.map(c => c.make))].sort();
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.toLowerCase();
    opt.textContent = b;
    filterBrand.appendChild(opt);
  });
  
  renderCars(cars);
}

function renderCars(list) {
  const grid = document.getElementById('cars-grid');
  const count = document.getElementById('results-count');
  const empty = document.getElementById('empty-state');
  
  grid.innerHTML = '';
  count.textContent = `Showing ${list.length} premium vehicles`;
  
  if (list.length === 0) {
    grid.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  
  grid.classList.remove('hidden');
  empty.classList.add('hidden');
  
  list.forEach(car => {
    const price = car.onRoadPrice || car.price || 0;
    const img = car.images?.[0] || 'https://placehold.co/600x400';
    const card = document.createElement('div');
    card.className = 'glass-card rounded-3xl overflow-hidden cursor-pointer flex flex-col group relative bg-slate-900/40 backdrop-blur-md border border-slate-800/80 hover:border-blue-500/30 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(59,130,246,0.15)]';
    card.onclick = (e) => {
      if(!e.target.closest('.compare-btn')) openFullCarView(car);
    };
    
    card.innerHTML = `
      <div class="h-56 overflow-hidden relative bg-slate-950">
        <img src="${img}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
        <div class="absolute top-4 right-4 px-3 py-1.5 text-[10px] font-extrabold rounded-full shadow-md tracking-wider uppercase ${car.status==='Available'?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20':'bg-red-500/10 text-red-400 border border-red-500/20'}">${car.status}</div>
      </div>
      <div class="p-6 flex flex-col flex-1">
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${car.year} • ${car.body || 'Sedan'}</span>
        <h3 class="text-xl font-bold text-white group-hover:text-blue-400 transition-colors mt-1" style="font-family: 'Outfit', sans-serif;">${car.make} ${car.model}</h3>
        <p class="text-2xl font-extrabold text-blue-400 mt-2" style="font-family: 'Outfit', sans-serif;">${formatINR.format(price)}</p>
        
        <div class="grid grid-cols-3 gap-2 mt-4 mb-5 border-t border-slate-800/85 pt-4">
          <div class="flex flex-col items-center p-2 bg-slate-950/40 border border-slate-800/60 rounded-xl">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Fuel</span>
            <span class="text-xs font-bold text-slate-300 mt-0.5">${car.fuel || 'N/A'}</span>
          </div>
          <div class="flex flex-col items-center p-2 bg-slate-950/40 border border-slate-800/60 rounded-xl">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Gear</span>
            <span class="text-xs font-bold text-slate-300 mt-0.5">${car.gearType || 'Auto'}</span>
          </div>
          <div class="flex flex-col items-center p-2 bg-slate-950/40 border border-slate-800/60 rounded-xl">
            <span class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Speed</span>
            <span class="text-xs font-bold text-slate-300 mt-0.5">${car.topSpeed ? car.topSpeed + ' km/h' : 'N/A'}</span>
          </div>
        </div>

        <div class="mt-auto pt-4 border-t border-slate-800/60 flex justify-between items-center">
          <span class="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors">
            View Details 
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
          </span>
          <button class="compare-btn p-2.5 bg-slate-950/40 hover:bg-blue-950/30 border border-slate-800 hover:border-blue-500/30 rounded-full text-slate-500 hover:text-blue-400 outline-none transition-all shadow-md" data-id="${car.id}">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  document.querySelectorAll('.compare-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCompare(cars.find(c => c.id === e.currentTarget.getAttribute('data-id')));
    });
  });
  
  refreshCompareButtons();
}

function refreshCompareButtons() {
  document.querySelectorAll('.compare-btn').forEach(btn => {
    const carId = btn.getAttribute('data-id');
    const isAdded = compareList.some(c => c.id === carId);
    if (isAdded) {
      btn.classList.remove('bg-slate-950/40', 'text-slate-550', 'border-slate-800');
      btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600', 'hover:bg-blue-700');
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
    } else {
      btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'hover:bg-blue-700');
      btn.classList.add('bg-slate-950/40', 'text-slate-550', 'border-slate-800');
      btn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
    }
  });
}

function applyFilters() {
  const b = filterBrand.value;
  const p = filterPrice.value;
  const bo = filterBody.value;
  const f = filterFuel.value;
  const g = filterGear.value;
  const s = searchInput.value.toLowerCase();
  
  renderCars(cars.filter(c => {
    let m = true;
    if (b && c.make.toLowerCase() !== b) m = false;
    if (bo && c.body.toLowerCase() !== bo) m = false;
    if (f && c.fuel && c.fuel.toLowerCase() !== f) m = false;
    if (g && c.gearType && c.gearType.toLowerCase() !== g) m = false;
    if (s && !(c.make.toLowerCase().includes(s) || c.model.toLowerCase().includes(s))) m = false;
    
    const pr = c.onRoadPrice || c.price || 0;
    if (p === 'low' && pr >= 2000000) m = false;
    if (p === 'mid' && (pr < 2000000 || pr > 5000000)) m = false;
    if (p === 'high' && pr <= 5000000) m = false;
    
    return m;
  }));
}

[filterBrand, filterPrice, filterBody, filterFuel, filterGear, searchInput].forEach(el => el.addEventListener('input', applyFilters));
document.getElementById('clear-filters-btn').addEventListener('click', () => {
  [filterBrand, filterPrice, filterBody, filterFuel, filterGear, searchInput].forEach(e => e.value = '');
  applyFilters();
});

const fsView = document.getElementById('full-car-view');
let scrollTriggers = [];

function openFullCarView(car) {
  if (car.id) {
    updateDoc(doc(db, 'cars', car.id), {
      views: increment(1)
    }).catch(e => console.error('Failed to increment view count', e));
  }
  
  currentCar = car;
  
  document.getElementById('fs-car-title').textContent = `${car.make} ${car.model}`;
  document.getElementById('fs-hero-title').textContent = `${car.make} ${car.model}`;
  
  let exShowroom = 0, rto = 0, ins = 0, tcs = 0, onRoadPrice = 0;
  let rtoPct = car.rtoPercent !== undefined ? car.rtoPercent : 10;
  let insPct = car.insPercent !== undefined ? car.insPercent : 5;
  let tcsPct = car.tcsPercent !== undefined ? car.tcsPercent : 1;
  
  if (car.basePrice) {
    exShowroom = car.basePrice;
    tcs = car.basePrice * (tcsPct / 100);
    rto = car.basePrice * (rtoPct / 100);
    ins = car.basePrice * (insPct / 100);
    onRoadPrice = exShowroom + tcs + rto + ins;
  } else {
    onRoadPrice = car.onRoadPrice || car.price || 0;
    exShowroom = onRoadPrice / (1 + (rtoPct/100) + (insPct/100) + (tcsPct/100));
    rto = exShowroom * (rtoPct / 100);
    ins = exShowroom * (insPct / 100);
    tcs = exShowroom * (tcsPct / 100);
  }
  
  const pbRtoLabel = document.getElementById('pb-rto-label');
  if (pbRtoLabel) pbRtoLabel.textContent = `RTO (${rtoPct}%)`;
  
  const pbInsLabel = document.getElementById('pb-ins-label');
  if (pbInsLabel) pbInsLabel.textContent = `Insurance (${insPct}%)`;
  
  const pbTcsLabel = document.getElementById('pb-tcs-label');
  if (pbTcsLabel) pbTcsLabel.textContent = `Handling & TCS (${tcsPct}%)`;
  
  document.getElementById('fs-hero-price').textContent = formatINR.format(Math.round(onRoadPrice));
  document.getElementById('pb-ex').textContent = formatINR.format(Math.round(exShowroom));
  document.getElementById('pb-rto').textContent = formatINR.format(Math.round(rto));
  document.getElementById('pb-ins').textContent = formatINR.format(Math.round(ins));
  document.getElementById('pb-tcs').textContent = formatINR.format(Math.round(tcs));
  document.getElementById('pb-total').textContent = formatINR.format(Math.round(exShowroom + rto + ins + tcs));
  document.getElementById('fs-status').textContent = car.status;
  document.getElementById('fs-status').className = `inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${car.status==='Available'?'bg-emerald-500 text-white':'bg-red-500 text-white'}`;
  
  const hy = document.getElementById('fs-hero-year');
  if(hy) hy.textContent = car.year || 'N/A';
  const hb = document.getElementById('fs-hero-body');
  if(hb) hb.textContent = car.body || 'N/A';
  
  currentCarImages = car.images?.length > 0 ? car.images : ['https://placehold.co/1200x800'];
  currentImageIndex = 0;
  updateFsImage();
  startAutoScroll();

  document.getElementById('sp-drive').textContent = car.drive || 'FWD';
  document.getElementById('sp-engine').textContent = car.engineType || 'N/A';
  document.getElementById('sp-cc').textContent = car.cc ? `${car.cc} CC` : '-';
  document.getElementById('sp-torque').textContent = car.torque ? `${car.torque} Nm` : 'N/A';
  document.getElementById('sp-speed').textContent = car.topSpeed ? `Top Speed: ${car.topSpeed} km/h` : 'Top Speed: N/A';
  document.getElementById('sp-gear').textContent = car.gearType || 'Auto';
  document.getElementById('sp-gears').textContent = car.gears ? `${car.gears} Gears` : '-';

  document.getElementById('sp-adas-lvl').textContent = `L${car.adas || 0}`;
  const adasLevels = ["No Automation","Driver Assistance","Partial Automation","Conditional Automation","High Automation","Full Automation"];
  document.getElementById('sp-adas-desc').textContent = adasLevels[car.adas || 0];
  document.getElementById('sp-abs').textContent = `ABS: ${car.abs ? 'Yes' : 'No'}`;
  document.getElementById('sp-hill').textContent = `Hill Assist: ${car.hillAssist ? 'Yes' : 'No'}`;

  const ed = document.getElementById('fuel-display-grid');
  ed.innerHTML = '';
  if (car.fuel === 'Electric') {
    ed.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-emerald-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full filter blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
        <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3">Battery Capacity</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.battery||0} <span class="text-xs text-slate-400 font-medium font-sans">kWh</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 rounded-full w-[80%] animate-pulse"></div>
        </div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-blue-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-blue-500/10 rounded-full filter blur-xl group-hover:bg-blue-500/20 transition-all"></div>
        <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-3">Estimated Range</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.range||0} <span class="text-xs text-slate-400 font-medium font-sans">km</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full w-[90%] animate-pulse"></div>
        </div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-cyan-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-cyan-500/10 rounded-full filter blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
        <p class="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-3">Charging Duration</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.chargeTime||0} <span class="text-xs text-slate-400 font-medium font-sans">hrs</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-cyan-500 rounded-full w-[40%]"></div>
        </div>
      </div>`;
  } else {
    const isCng = car.fuel === 'CNG';
    ed.innerHTML = `
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-blue-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-blue-500/10 rounded-full filter blur-xl group-hover:bg-blue-500/20 transition-all"></div>
        <p class="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-3">Tank Capacity</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.fuelCapacity||0} <span class="text-xs text-slate-400 font-medium font-sans">${isCng?'Kg':'L'}</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full w-[70%]"></div>
        </div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-emerald-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full filter blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
        <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3">Certified Mileage</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.mileage||0} <span class="text-xs text-slate-400 font-medium font-sans">${isCng?'km/kg':'km/L'}</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 rounded-full w-[85%]"></div>
        </div>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl st-elem relative overflow-hidden text-white group hover:border-indigo-500/30 transition-all duration-300">
        <div class="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-500/10 rounded-full filter blur-xl group-hover:bg-indigo-500/20 transition-all"></div>
        <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-3">Total Range</p>
        <p class="text-3xl font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${car.range||0} <span class="text-xs text-slate-400 font-medium font-sans">km</span></p>
        <div class="mt-4 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-indigo-500 rounded-full w-[80%]"></div>
        </div>
      </div>`;
  }

  document.getElementById('sp-dim').textContent = `${car.dimLength||0} x ${car.dimWidth||0} x ${car.dimHeight||0} cm`;
  document.getElementById('sp-clearance').textContent = `${car.clearance||0} cm`;
  document.getElementById('sp-seats').textContent = car.seats||0;
  document.getElementById('sp-boot').textContent = `${car.bootCapacity||0} L`;

  const clrDiv = document.getElementById('sp-colors');
  clrDiv.innerHTML = '';

  if (car.colors && car.colors.length > 0) {
    car.colors.forEach(c => {
      clrDiv.innerHTML += `
        <div class="group relative flex flex-col items-center">
          <div class="w-10 h-10 rounded-full border shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md" style="background-color:${c.hex}"></div>
          <span class="absolute top-12 whitespace-nowrap bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow">${c.name}</span>
        </div>`;
    });
  } else {
    clrDiv.innerHTML = '<span class="text-slate-400 text-sm">Standard Manufacturer Colors</span>';
  }

  const extUl = document.getElementById('sp-extras');
  extUl.innerHTML = '';
  if (car.extras && car.extras.length > 0) car.extras.forEach(e => extUl.innerHTML += `<li>${e}</li>`);
  else extUl.innerHTML = '<li>None</li>';

  const pOnRoad = car.onRoadPrice || car.price || 0;
  document.getElementById('emi-principal').value = pOnRoad;
  document.getElementById('emi-rate').value = 8.5;
  document.getElementById('emi-time').value = 60;
  calcEMI();

  fsView.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  fsView.scrollTop = 0;

  initScrollTriggers();
  gsap.fromTo('#fs-header', {y:'-100%'}, {y:0, duration:0.5});
  gsap.fromTo('#fs-hero-title', {y:50, opacity:0}, {y:0, opacity:1, duration:0.7, delay:0.2});
}

function initScrollTriggers() {
  scrollTriggers.forEach(t => t.kill());
  scrollTriggers = [];
  document.querySelectorAll('.st-section').forEach(sec => {
    const elems = sec.querySelectorAll('.st-elem');
    if(elems.length === 0) return;
    gsap.set(elems, { y: 50, opacity: 0 });
    const trigger = ScrollTrigger.create({
      trigger: sec, scroller: fsView, start: "top 80%",
      onEnter: () => gsap.to(elems, { y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "power2.out", overwrite: "auto" })
    });
    scrollTriggers.push(trigger);
  });
}

document.getElementById('close-fs-view').addEventListener('click', () => {
  stopAutoScroll();
  scrollTriggers.forEach(t => t.kill());
  fsView.classList.add('hidden');
  document.body.style.overflow = '';
});

function updateFsImage() {
  const img = document.getElementById('fs-main-image');
  img.style.opacity = 0;
  setTimeout(() => { img.src = currentCarImages[currentImageIndex]; img.style.opacity = 1; }, 300);
}
document.getElementById('fs-prev-img').onclick = () => { currentImageIndex = (currentImageIndex - 1 + currentCarImages.length) % currentCarImages.length; updateFsImage(); resetAutoScroll(); };
document.getElementById('fs-next-img').onclick = () => { nextImage(); resetAutoScroll(); };
function nextImage() { currentImageIndex = (currentImageIndex + 1) % currentCarImages.length; updateFsImage(); }
function startAutoScroll() { stopAutoScroll(); if (currentCarImages.length > 1) autoScrollInterval = setInterval(nextImage, 5000); }
function stopAutoScroll() { if (autoScrollInterval) clearInterval(autoScrollInterval); }
function resetAutoScroll() { startAutoScroll(); }

function calcEMI() {
  const principal = parseFloat(document.getElementById('emi-principal').value) || 0;
  const rate = parseFloat(document.getElementById('emi-rate').value) || 0;
  const time = parseFloat(document.getElementById('emi-time').value) || 0;
  const r = rate / 12 / 100;
  if (principal <= 0 || time <= 0) {
    document.getElementById('emi-monthly-result').textContent = '₹0';
    document.getElementById('emi-total-interest').textContent = '₹0';
    document.getElementById('emi-total-payment').textContent = '₹0';
    return;
  }
  let emi = (r === 0) ? principal / time : (principal * r * Math.pow(1 + r, time)) / (Math.pow(1 + r, time) - 1);
  const totalPayment = emi * time;
  const totalInterest = totalPayment - principal;
  document.getElementById('emi-monthly-result').textContent = formatINR.format(emi);
  document.getElementById('emi-total-interest').textContent = formatINR.format(totalInterest);
  document.getElementById('emi-total-payment').textContent = formatINR.format(totalPayment);
}
['emi-principal', 'emi-rate', 'emi-time'].forEach(id => document.getElementById(id).addEventListener('input', calcEMI));

// SMART COMPARE DOCK
const compareDock = document.getElementById('compare-dock');
const compareSlots = document.getElementById('compare-slots');
const btnOpenCompare = document.getElementById('open-compare');
const compareModal = document.getElementById('compare-modal');
const compareTableContainer = document.getElementById('compare-table-container');

function toggleCompare(car) {
  const idx = compareList.findIndex(c => c.id === car.id);
  if (idx >= 0) compareList.splice(idx, 1);
  else {
    if (compareList.length >= 3) return alert("You can compare up to 3 vehicles.");
    compareList.push(car);
  }
  updateCompareDock();
  refreshCompareButtons();
}

function updateCompareDock() {
  compareSlots.innerHTML = '';
  if (compareList.length > 0) {
    compareDock.classList.remove('translate-y-full');
    btnOpenCompare.disabled = compareList.length < 2;
  } else {
    compareDock.classList.add('translate-y-full');
  }
  compareList.forEach(c => {
    const d = document.createElement('div');
    d.className = 'flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 shrink-0 shadow-md';
    d.innerHTML = `
      <img src="${c.images?.[0]||'https://placehold.co/100'}" class="w-10 h-10 rounded-lg object-cover border border-slate-800">
      <span class="text-sm font-bold text-slate-200 truncate max-w-[120px]">${c.make} ${c.model}</span>
      <button class="ml-2 text-slate-500 hover:text-red-400 transition-colors" onclick="window.rmComp('${c.id}')">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>`;
    compareSlots.appendChild(d);
  });
}

window.rmComp = (id) => { 
  compareList = compareList.filter(c => c.id !== id); 
  updateCompareDock(); 
  refreshCompareButtons();
};
document.getElementById('clear-compare').onclick = () => { 
  compareList = []; 
  updateCompareDock(); 
  refreshCompareButtons();
};

btnOpenCompare.addEventListener('click', () => {
  renderSmartCompareTable();
  compareModal.classList.remove('hidden');
});
document.getElementById('close-compare-modal').onclick = () => compareModal.classList.add('hidden');

function renderSmartCompareTable() {
  const getBest = (key, lowerIsBetter = false) => {
    const valid = compareList.filter(c => c[key] !== undefined && c[key] !== null && c[key] !== 0 && c[key] !== '');
    if(valid.length < 2) return null;
    let bestVal = valid[0][key];
    let allSame = true;
    valid.forEach(c => {
      if (c[key] !== valid[0][key]) allSame = false;
      if (lowerIsBetter ? c[key] < bestVal : c[key] > bestVal) bestVal = c[key];
    });
    if (allSame) return null;
    return bestVal;
  };

  const bPrice = getBest('onRoadPrice', true);
  const bCC = getBest('cc');
  const bSpeed = getBest('topSpeed');
  const bTorque = getBest('torque');
  const bRange = getBest('range');
  const bClearance = getBest('clearance');
  const bBoot = getBest('bootCapacity');
  const bAdas = getBest('adas');

  let head = `<th class="p-5 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider text-xs w-1/4 sticky-col sticky-col-header">Feature</th>`;
  let rYear = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Year</td>`;
  let rPrice = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">On-Road Price</td>`;
  let rBody = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Body Style</td>`;
  let rSeats = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Seating Capacity</td>`;
  let rFuelType = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Fuel Type</td>`;
  let rFuelCap = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Fuel/Battery Capacity</td>`;
  let rDrive = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Drive System</td>`;
  let rGears = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Transmission gears</td>`;
  let rEngType = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Engine Type</td>`;
  let rCC = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Displacement (CC)</td>`;
  let rSpeed = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Top Speed</td>`;
  let rTorque = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Torque</td>`;
  let rRange = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Range</td>`;
  let rUtil = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">Clearance & Boot</td>`;
  let rAdas = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">ADAS Level</td>`;
  let rAbs = `<td class="p-5 bg-slate-950/40 font-bold text-slate-400 text-sm sticky-col sticky-col-even">ABS</td>`;
  let rHill = `<td class="p-5 bg-slate-900/60 font-bold text-slate-400 text-sm sticky-col sticky-col-odd">Hill Assist</td>`;

  compareList.forEach(c => {
    head += `<th class="p-5 bg-slate-950/80 text-center border-l border-slate-800/60 min-w-[160px] md:min-w-[200px]"><img src="${c.images?.[0]||'https://placehold.co/400'}" class="w-full h-28 object-cover rounded-xl shadow-md mb-3 max-w-[200px] mx-auto border border-slate-800"><span class="text-base font-extrabold text-white" style="font-family: 'Outfit', sans-serif;">${c.make} ${c.model}</span></th>`;
    
    rYear += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.year || '-'}</td>`;
    
    const p = c.onRoadPrice || c.price || 0;
    rPrice += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-extrabold text-blue-400 text-base">${formatINR.format(p)}${bPrice!==null && p===bPrice ? '<div class="glow-dot"></div>' : ''}</td>`;
    
    rBody += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.body || '-'}</td>`;
    rSeats += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.seats || '-'} Seater</td>`;
    rFuelType += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.fuel || '-'}</td>`;
    
    let fCap = '-';
    if(c.fuel === 'Electric') fCap = (c.battery||0) + ' kWh';
    else if(c.fuel === 'CNG') fCap = (c.fuelCapacity||0) + ' Kg';
    else if(c.fuelCapacity) fCap = c.fuelCapacity + ' L';
    rFuelCap += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${fCap}</td>`;
    
    rDrive += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.drive || '-'}</td>`;
    rGears += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.gearType||'-'} ${c.gears ? '('+c.gears+' speed)' : ''}</td>`;
    rEngType += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.engineType || '-'}</td>`;
    
    rCC += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.cc ? c.cc+' CC' : '-'}${bCC!==null && c.cc===bCC ? '<div class="glow-dot"></div>' : ''}</td>`;
    rSpeed += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.topSpeed ? c.topSpeed+' km/h' : '-'}${bSpeed!==null && c.topSpeed===bSpeed ? '<div class="glow-dot"></div>' : ''}</td>`;
    rTorque += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.torque ? c.torque+' Nm' : '-'}${bTorque!==null && c.torque===bTorque ? '<div class="glow-dot"></div>' : ''}</td>`;
    rRange += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.range ? c.range+' km' : '-'}${bRange!==null && c.range===bRange ? '<div class="glow-dot"></div>' : ''}</td>`;
    
    rUtil += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">Clearance: ${c.clearance||'-'} cm <br> Boot: ${c.bootCapacity||'-'} L</td>`;
    
    rAdas += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">L${c.adas || 0} ADAS ${bAdas!==null && c.adas===bAdas ? '<div class="glow-dot"></div>' : ''}</td>`;
    rAbs += `<td class="p-5 bg-slate-950/40 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.abs ? '<span class="text-emerald-400 font-extrabold text-lg">✓</span>' : '<span class="text-red-500 font-extrabold text-lg">✗</span>'}</td>`;
    rHill += `<td class="p-5 bg-slate-900/60 border-l border-slate-800/60 text-center font-semibold text-slate-300">${c.hillAssist ? '<span class="text-emerald-400 font-extrabold text-lg">✓</span>' : '<span class="text-red-500 font-extrabold text-lg">✗</span>'}</td>`;
  });

  compareTableContainer.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead><tr class="border-b border-slate-200">${head}</tr></thead>
      <tbody class="divide-y divide-slate-100">
        <tr>${rYear}</tr>
        <tr>${rPrice}</tr>
        <tr>${rBody}</tr>
        <tr>${rSeats}</tr>
        <tr>${rFuelType}</tr>
        <tr>${rFuelCap}</tr>
        <tr>${rDrive}</tr>
        <tr>${rGears}</tr>
        <tr>${rEngType}</tr>
        <tr>${rCC}</tr>
        <tr>${rSpeed}</tr>
        <tr>${rTorque}</tr>
        <tr>${rRange}</tr>
        <tr>${rUtil}</tr>
        <tr>${rAdas}</tr>
        <tr>${rAbs}</tr>
        <tr>${rHill}</tr>
      </tbody>
    </table>
  `;
}

// Test Drive Booking
const tdModal = document.getElementById('test-drive-modal');
const tdForm = document.getElementById('td-form');
document.getElementById('btn-fs-test-drive').onclick = () => {
  tdForm.reset();
  document.getElementById('td-success').classList.add('hidden');
  document.getElementById('td-submit-btn').classList.remove('hidden');
  document.getElementById('td-car-id').value = currentCar.id;
  document.getElementById('td-car-name').textContent = `Booking: ${currentCar.make} ${currentCar.model}`;
  tdModal.classList.remove('hidden');
  setTimeout(()=>document.getElementById('td-content').classList.remove('opacity-0', 'scale-95'), 10);
};
document.getElementById('close-td-modal').onclick = () => tdModal.classList.add('hidden');

tdForm.onsubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('td-submit-btn');
  btn.textContent = 'Submitting...'; btn.disabled = true;
  await addDoc(collection(db, 'test_drives'), {
    carId: document.getElementById('td-car-id').value,
    carMake: currentCar.make, carModel: currentCar.model,
    name: document.getElementById('td-name').value,
    phone: document.getElementById('td-phone').value,
    email: document.getElementById('td-email').value,
    preferredDate: document.getElementById('td-date').value,
    createdAt: new Date().toISOString(), status: 'Pending'
  });
  document.getElementById('td-success').classList.remove('hidden');
  btn.classList.add('hidden'); btn.textContent = 'Submit'; btn.disabled = false;
  setTimeout(() => tdModal.classList.add('hidden'), 2000);
};

// Year display in footer
const curYr = document.getElementById('current-year');
if(curYr) curYr.textContent = new Date().getFullYear();

// Nav scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.classList.add('py-2', 'shadow-lg');
  } else {
    nav.classList.remove('shadow-lg');
    nav.classList.add('py-2');
  }
});

/* INTERACTIVE COMPARE GUIDE SANDBOX LOGIC */
const guideModal = document.getElementById('compare-guide-modal');
const guideContent = document.getElementById('guide-content');
const btnNavCompare = document.getElementById('nav-compare-btn');
const btnCloseGuide = document.getElementById('close-guide-modal');

let sandboxCompareList = [];

btnNavCompare.addEventListener('click', (e) => {
  e.preventDefault();
  resetSandbox();
  guideModal.classList.remove('hidden');
  setTimeout(() => {
    guideContent.classList.remove('opacity-0', 'scale-95');
  }, 50);
});

btnCloseGuide.addEventListener('click', closeGuide);
document.getElementById('guide-backdrop').addEventListener('click', closeGuide);

function closeGuide() {
  guideContent.classList.add('opacity-0', 'scale-95');
  setTimeout(() => {
    guideModal.classList.add('hidden');
  }, 300);
}

// Sandbox elements
const btnMockValkyrie = document.getElementById('btn-mock-valkyrie');
const btnMockApex = document.getElementById('btn-mock-apex');
const sandboxDockSlots = document.getElementById('sandbox-dock-slots');
const btnSandboxCompare = document.getElementById('btn-sandbox-compare');
const sandboxResultsPanel = document.getElementById('sandbox-results-panel');
const sandboxFleet = document.getElementById('sandbox-fleet');
const sandboxDockContainer = document.getElementById('sandbox-dock-container');
const guideStatusText = document.getElementById('guide-status-text');
const btnSandboxReset = document.getElementById('btn-sandbox-reset');

btnMockValkyrie.addEventListener('click', () => handleSandboxAdd('valkyrie', btnMockValkyrie));
btnMockApex.addEventListener('click', () => handleSandboxAdd('apex', btnMockApex));
let sandboxChartInstance = null;
btnSandboxCompare.addEventListener('click', () => {
  sandboxResultsPanel.classList.remove('hidden');
  sandboxFleet.classList.add('hidden');
  sandboxDockContainer.classList.add('hidden');
  guideStatusText.innerHTML = "✨ Look at the table! The glowing green dots automatically analyze and highlight the best specs. (Lower is better for price, higher is better for performance!). You can close the guide now and try it with real cars!";
  gsap.fromTo(sandboxResultsPanel, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 });
  
  if (window.Chart) {
    const ctx = document.getElementById('sandbox-radar-chart')?.getContext('2d');
    if (ctx) {
      if (sandboxChartInstance) sandboxChartInstance.destroy();
      sandboxChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['Top Speed', 'Acceleration', 'Handling', 'Efficiency', 'Tech', 'Comfort'],
          datasets: [
            {
              label: 'Valkyrie EV',
              data: [85, 95, 80, 100, 95, 85],
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderColor: 'rgba(59, 130, 246, 1)',
              pointBackgroundColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 2
            },
            {
              label: 'Apex V8 Sport',
              data: [95, 85, 95, 60, 80, 90],
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderColor: 'rgba(239, 68, 68, 1)',
              pointBackgroundColor: 'rgba(239, 68, 68, 1)',
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { r: { beginAtZero: true, max: 100, ticks: { display: false } } },
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  }
});
btnSandboxReset.addEventListener('click', resetSandbox);

function handleSandboxAdd(carType, buttonElement) {
  if (sandboxCompareList.includes(carType)) return;
  
  sandboxCompareList.push(carType);
  
  // Animation flying particle
  const btnRect = buttonElement.getBoundingClientRect();
  const destElement = document.getElementById('sandbox-dock-slots');
  const destRect = destElement.getBoundingClientRect();
  
  const particle = document.createElement('div');
  particle.className = 'compare-particle';
  particle.style.left = `${btnRect.left + btnRect.width / 2}px`;
  particle.style.top = `${btnRect.top + btnRect.height / 2}px`;
  document.body.appendChild(particle);
  
  // Style button as active
  buttonElement.classList.remove('bg-slate-100', 'text-slate-500');
  buttonElement.classList.add('bg-blue-600', 'text-white');
  buttonElement.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
  
  gsap.to(particle, {
    left: destRect.left + (sandboxCompareList.length * 40),
    top: destRect.top + 10,
    scale: 0.5,
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
    onComplete: () => {
      particle.remove();
      renderSandboxSlots();
    }
  });
}

function renderSandboxSlots() {
  sandboxDockSlots.innerHTML = '';
  sandboxCompareList.forEach(car => {
    const isVal = car === 'valkyrie';
    const badge = document.createElement('div');
    badge.className = 'flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 animate-pulse';
    badge.innerHTML = `<span>${isVal ? '⚡' : '🔥'}</span><span class="text-[10px]">${isVal ? 'Valkyrie' : 'Apex'}</span>`;
    sandboxDockSlots.appendChild(badge);
  });
  
  if (sandboxCompareList.length === 2) {
    btnSandboxCompare.disabled = false;
    btnSandboxCompare.classList.remove('opacity-40', 'cursor-not-allowed');
    btnSandboxCompare.classList.add('bg-blue-600', 'hover:bg-blue-700');
    guideStatusText.innerHTML = "🎉 Awesome! You've queued 2 cars. Now click the blue **Smart Compare** button in the sandbox dock to compare them!";
  } else {
    guideStatusText.innerHTML = "👍 Car added! Now click the compare button on the second card to queue it too.";
  }
}

function resetSandbox() {
  sandboxCompareList = [];
  sandboxDockSlots.innerHTML = '<span class="text-[11px] text-slate-400 font-medium">Compare slots empty</span>';
  
  [btnMockValkyrie, btnMockApex].forEach(btn => {
    btn.classList.add('bg-slate-100', 'text-slate-500');
    btn.classList.remove('bg-blue-600', 'text-white');
    btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;
  });
  
  btnSandboxCompare.disabled = true;
  btnSandboxCompare.classList.add('opacity-40', 'cursor-not-allowed');
  btnSandboxCompare.classList.remove('bg-blue-600', 'hover:bg-blue-700');
  
  sandboxResultsPanel.classList.add('hidden');
  sandboxFleet.classList.remove('hidden');
  sandboxDockContainer.classList.remove('hidden');
  guideStatusText.innerHTML = "👉 TRY THE SANDBOX: Click the '+' compare icons on the cards on the right to start!";
}

fetchSettings();
fetchCars();

// --- PDF Brochure Logic ---
const getBase64ImageFromUrl = async (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    if (url.startsWith('data:')) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    
    // Add cache-buster to bypass cached non-CORS responses from browser cache
    const cacheBusterUrl = url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
    img.src = cacheBusterUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataURL);
      } catch (err) {
        console.error("Canvas toDataURL conversion failed: ", err);
        resolve(null);
      }
    };
    img.onerror = (err) => {
      console.error("Image load failed: ", err);
      resolve(null);
    };
  });
};

document.getElementById('btn-fs-download-brochure')?.addEventListener('click', async () => {
  if (!currentCar) return;
  const btn = document.getElementById('btn-fs-download-brochure');
  const originalHTML = btn.innerHTML;
  
  // Show loading indicator
  btn.disabled = true;
  btn.innerHTML = `
    <span class="loader border-2 border-slate-600 border-t-blue-500 w-4 h-4 rounded-full inline-block animate-spin mr-2"></span>
    Generating...
  `;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // A4 size: 210mm x 297mm
    
    // Fetch showroom details from DOM
    const showroomName = document.getElementById('showroom-name-nav')?.textContent || 'Elite Motors';
    const showroomAddress = document.getElementById('showroom-address')?.textContent || 'Showroom Address';
    const showroomPhone = document.getElementById('showroom-phone')?.textContent || 'Showroom Phone';
    const showroomEmail = document.getElementById('showroom-email')?.textContent || 'Showroom Email';

    // 1. Header Band (Deep Obsidian Slate)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 45, 'F');
    
    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(showroomName.toUpperCase(), 20, 22);
    
    doc.setTextColor(156, 163, 175); // slate-400
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("PREMIUM AUTOMOTIVE EXPERIENCE", 20, 30);
    
    // Gold Accent Line
    doc.setFillColor(234, 179, 8); // amber-500
    doc.rect(0, 45, 210, 1.5, 'F');
    
    // 2. Title & Price Layout
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(`${currentCar.make} ${currentCar.model}`, 20, 62);
    
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Year Model: ${currentCar.year || 'N/A'}    |    Body Style: ${currentCar.body || 'N/A'}`, 20, 70);
    
    // Price Badge Box (Right-aligned)
    doc.setFillColor(240, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254); // blue-200
    doc.setLineWidth(0.5);
    doc.roundedRect(135, 52, 55, 18, 3, 3, 'FD');
    
    doc.setTextColor(29, 78, 216); // blue-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const priceVal = currentCar.onRoadPrice || currentCar.price || 0;
    const formattedPrice = 'Rs. ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(priceVal);
    doc.text(formattedPrice, 138, 65);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("ESTIMATED ON-ROAD PRICE", 138, 58);
    
    // 3. Hero Image Section
    const imgX = 20;
    const imgY = 78;
    const imgW = 170;
    const imgH = 95;
    
    // Placeholder Box
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(imgX, imgY, imgW, imgH, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.roundedRect(imgX, imgY, imgW, imgH, 4, 4, 'D');

    // Attempt to load and draw car image
    if (currentCar.images && currentCar.images.length > 0 && currentCar.images[0]) {
      const base64Data = await getBase64ImageFromUrl(currentCar.images[0]);
      if (base64Data) {
        try {
          doc.addImage(base64Data, 'JPEG', imgX, imgY, imgW, imgH);
        } catch (imgErr) {
          console.error("Failed adding image to brochure PDF: ", imgErr);
        }
      }
    }
    
    // Draw placeholder overlay text (rendered behind/underneath loaded image)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Premium Showcase Selection", 83, imgY + 48);

    // 4. Specifications Table
    const tableY = 185;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("TECHNICAL SPECIFICATIONS", 20, tableY - 4);
    
    // Row definition: [Label 1, Val 1, Label 2, Val 2]
    const specRows = [
      ["Engine Type", currentCar.engineType || 'N/A', "Length / Width", `${currentCar.dimLength || 'N/A'} x ${currentCar.dimWidth || 'N/A'} cm`],
      ["Transmission", currentCar.gearType || 'N/A', "Height", `${currentCar.dimHeight || 'N/A'} cm`],
      ["Drivetrain", currentCar.drive || 'N/A', "Seating Capacity", `${currentCar.seats ? currentCar.seats + ' Seater' : 'N/A'}`],
      ["Fuel Type", currentCar.fuel || 'N/A', "Boot Space", `${currentCar.bootCapacity ? currentCar.bootCapacity + ' Litres' : 'N/A'}`],
      ["Max Range / Mileage", `${currentCar.range || currentCar.mileage || 'N/A'}${currentCar.fuel === 'Electric' ? ' km' : ' km/L'}`, "Top Speed", currentCar.topSpeed ? currentCar.topSpeed + ' km/h' : 'N/A']
    ];
    
    const rowHeight = 7.5;
    specRows.forEach((row, idx) => {
      const yPos = tableY + (idx * rowHeight);
      
      // Alternate row colors
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252); // slate-50
      } else {
        doc.setFillColor(255, 255, 255); // white
      }
      doc.rect(20, yPos, 170, rowHeight, 'F');
      
      // Cell border line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.3);
      doc.line(20, yPos, 190, yPos);
      
      // Column texts
      // Left specs
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(row[0], 23, yPos + 5);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(row[1], 65, yPos + 5);
      
      // Right specs
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(row[2], 110, yPos + 5);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(row[3], 150, yPos + 5);
    });
    
    // Draw outer borders and middle vertical border
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    doc.rect(20, tableY, 170, specRows.length * rowHeight, 'D');
    doc.line(105, tableY, 105, tableY + (specRows.length * rowHeight));
    
    // 5. Premium Features Section
    const featuresY = 232;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("PREMIUM FEATURES INCLUDED", 20, featuresY);
    
    // Gold Accent bar
    doc.setFillColor(234, 179, 8); // amber-500
    doc.rect(20, featuresY + 2, 170, 0.8, 'F');
    
    // Features list
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // slate-700
    const featuresStr = (currentCar.extras && currentCar.extras.length > 0)
      ? currentCar.extras.join("   •   ")
      : "Standard specifications include advanced safety airbags, premium sound speaker systems, high-definition internal multimedia touchscreen, and exterior decoration kits.";
      
    const featuresLines = doc.splitTextToSize(featuresStr, 170);
    doc.text(featuresLines, 20, featuresY + 8);
    
    // 6. Dynamic Showroom Footer
    const footerY = 270;
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(20, footerY, 190, footerY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Address: ${showroomAddress}`, 20, footerY + 5);
    doc.text(`Tel: ${showroomPhone}    |    Email: ${showroomEmail}`, 20, footerY + 9);
    
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Brochure generated dynamically by ${showroomName} CRM. Specifications subject to change without notice.`, 20, footerY + 14);
    
    // Save PDF
    doc.save(`${currentCar.make}_${currentCar.model}_Brochure.pdf`.replace(/\s+/g, '_'));
  } catch (error) {
    console.error("Failed to generate brochure PDF: ", error);
    alert("An error occurred while generating the PDF brochure. Please try again.");
  } finally {
    // Restore button
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
});

// --- Price Breakdown Toggle ---
const btnTogglePrice = document.getElementById('btn-toggle-price-breakdown');
const priceWidget = document.getElementById('fs-price-breakdown-widget');
if (btnTogglePrice && priceWidget) {
  btnTogglePrice.addEventListener('click', () => {
    priceWidget.classList.toggle('hidden');
  });
}

// --- AI Guided Chatbot ---
const chatToggle = document.getElementById('chat-toggle');
const chatWindow = document.getElementById('chat-window');
const closeChat = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatOptionsContainer = document.getElementById('chat-options-container');

if (chatToggle && chatWindow) {
  const chatTree = {
    root: {
      msg: "Hi there! I'm your showroom virtual assistant. What would you like to know about our cars?",
      options: [
        { label: "Search by Body Type", id: "search_body" },
        { label: "Search by Budget", id: "search_budget" },
        { label: "Family & Comfort (6+ Seats)", id: "search_family" },
        { label: "City Commuters", id: "search_city" },
        { label: "High Performance", id: "search_perf" }
      ]
    },
    
    // --- LIFESTYLE ---
    search_family: {
      compute: () => {
        const match = cars.filter(c => (parseInt(c.seats) || 0) >= 6);
        if (match.length === 0) return { text: "We currently don't have any large family vehicles with 6 or more seats.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = match.map(c => `<li><b>${c.make} ${c.model}</b> (${c.seats} Seats)</li>`).join("");
        const options = match.map(c => ({ label: `View ${c.make} ${c.model}`, action: 'view_car', carId: c.id }));
        options.push({ label: "Start over", id: "root" });
        return {
          text: `Perfect for the whole family! We have ${match.length} spacious options:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options
        };
      }
    },
    search_city: {
      compute: () => {
        // High mileage or electric hatchbacks/small cars
        const match = cars.filter(c => c.body.toLowerCase() === 'hatchback' || (c.fuel||'').toLowerCase().includes('electric'));
        if (match.length === 0) return { text: "We don't have typical city commuters right now.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = match.slice(0,3).map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        const options = match.slice(0,3).map(c => ({ label: `View ${c.make} ${c.model}`, action: 'view_car', carId: c.id }));
        options.push({ label: "Start over", id: "root" });
        return {
          text: `For nimble city driving, we recommend these efficient options:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options
        };
      }
    },

    // --- BODY TYPE ---
    search_body: {
      msg: "What kind of body style are you looking for?",
      options: [
        { label: "SUVs", id: "body_suv" },
        { label: "Sedans", id: "body_sedan" },
        { label: "Hatchbacks", id: "body_hatch" },
        { label: "Start over", id: "root" }
      ]
    },
    body_suv: {
      compute: () => {
        const suvs = cars.filter(c => c.body.toLowerCase() === 'suv');
        if (suvs.length === 0) return { text: "We currently don't have any SUVs.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = suvs.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return {
          text: `We have <b>${suvs.length} SUVs</b> in stock:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options: [
            { label: "Which SUV has the best mileage?", id: "suv_mileage" },
            { label: "What's the cheapest SUV?", id: "suv_cheap" },
            { label: "Start over", id: "root" }
          ]
        };
      }
    },
    body_sedan: {
      compute: () => {
        const sedans = cars.filter(c => c.body.toLowerCase() === 'sedan');
        if (sedans.length === 0) return { text: "We currently don't have any sedans.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = sedans.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return {
          text: `We have <b>${sedans.length} elegant sedans</b> available right now:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options: [
            { label: "Show me the most premium sedan.", id: "premium_sedan" },
            { label: "Start over", id: "root" }
          ]
        };
      }
    },
    body_hatch: {
      compute: () => {
        const hatchs = cars.filter(c => c.body.toLowerCase() === 'hatchback');
        if (hatchs.length === 0) return { text: "We currently don't have any hatchbacks.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = hatchs.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return {
          text: `We have <b>${hatchs.length} hatchbacks</b>, perfect for city driving:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options: [ { label: "Start over", id: "root" } ]
        };
      }
    },
    suv_mileage: {
      compute: () => {
        const suvs = cars.filter(c => c.body.toLowerCase() === 'suv');
        if (suvs.length === 0) return { text: "No SUVs found.", options: [{ label: "Start over", id: "root" }] };
        suvs.sort((a, b) => (b.mileage || 0) - (a.mileage || 0));
        const best = suvs[0];
        return {
          text: `The <b>${best.make} ${best.model}</b> offers the best mileage at <b>${best.mileage} km/l</b>, priced at ₹${formatINR.format(best.price || best.onRoadPrice || 0)}.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },
    suv_cheap: {
      compute: () => {
        const suvs = cars.filter(c => c.body.toLowerCase() === 'suv');
        if (suvs.length === 0) return { text: "No SUVs found.", options: [{ label: "Start over", id: "root" }] };
        suvs.sort((a, b) => (a.price || a.onRoadPrice || Infinity) - (b.price || b.onRoadPrice || Infinity));
        const best = suvs[0];
        return {
          text: `Our most affordable SUV is the <b>${best.make} ${best.model}</b>, priced at ₹${formatINR.format(best.price || best.onRoadPrice || 0)}.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },
    premium_sedan: {
      compute: () => {
        const sedans = cars.filter(c => c.body.toLowerCase() === 'sedan');
        if (sedans.length === 0) return { text: "No sedans found.", options: [{ label: "Start over", id: "root" }] };
        sedans.sort((a, b) => (b.price || b.onRoadPrice || 0) - (a.price || a.onRoadPrice || 0));
        const best = sedans[0];
        return {
          text: `For luxury sedans, I highly recommend the <b>${best.make} ${best.model}</b>. It is our most premium sedan, starting at ₹${formatINR.format(best.price || best.onRoadPrice || 0)}.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },

    // --- BUDGET ---
    search_budget: {
      msg: "What is your approximate budget?",
      options: [
        { label: "Under ₹10 Lakhs", id: "budget_10" },
        { label: "₹10 Lakhs to ₹20 Lakhs", id: "budget_20" },
        { label: "Above ₹20 Lakhs", id: "budget_above" },
        { label: "Start over", id: "root" }
      ]
    },
    budget_10: {
      compute: () => {
        const match = cars.filter(c => (c.price || c.onRoadPrice || Infinity) < 1000000);
        if(match.length === 0) return { text: "We don't have cars under ₹10 Lakhs right now.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = match.map(c => `<li><b>${c.make} ${c.model}</b> (₹${formatINR.format(c.price || c.onRoadPrice || 0)})</li>`).join("");
        return { text: `We have ${match.length} excellent cars under ₹10 Lakhs:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`, options: [{ label: "Start over", id: "root" }] };
      }
    },
    budget_20: {
      compute: () => {
        const match = cars.filter(c => { const p = c.price||c.onRoadPrice||0; return p >= 1000000 && p <= 2000000; });
        if(match.length === 0) return { text: "We don't have cars in the 10-20 Lakhs range right now.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = match.map(c => `<li><b>${c.make} ${c.model}</b> (₹${formatINR.format(c.price || c.onRoadPrice || 0)})</li>`).join("");
        return { text: `We have ${match.length} fantastic cars between 10 to 20 Lakhs:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`, options: [{ label: "Start over", id: "root" }] };
      }
    },
    budget_above: {
      compute: () => {
        const match = cars.filter(c => (c.price || c.onRoadPrice || 0) > 2000000);
        if(match.length === 0) return { text: "We don't have luxury cars above 20 Lakhs right now.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = match.map(c => `<li><b>${c.make} ${c.model}</b> (₹${formatINR.format(c.price || c.onRoadPrice || 0)})</li>`).join("");
        return {
          text: `We have ${match.length} premium cars above 20 Lakhs in stock:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options: [ { label: "Show me the most expensive car.", id: "expensive_car" }, { label: "Start over", id: "root" } ]
        };
      }
    },
    expensive_car: {
      compute: () => {
        if(cars.length === 0) return { text: "No inventory.", options: [{ label: "Start over", id: "root" }] };
        const best = [...cars].sort((a,b) => (b.price||b.onRoadPrice||0) - (a.price||a.onRoadPrice||0))[0];
        return {
          text: `Our top-of-the-line flagship is the <b>${best.make} ${best.model}</b> at <b>₹${formatINR.format(best.price||best.onRoadPrice||0)}</b>.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },

    // --- FUEL TYPE ---
    search_fuel: {
      msg: "Which fuel type do you prefer?",
      options: [
        { label: "Electric (EV)", id: "fuel_ev" },
        { label: "Petrol", id: "fuel_petrol" },
        { label: "Diesel", id: "fuel_diesel" },
        { label: "Start over", id: "root" }
      ]
    },
    fuel_ev: {
      compute: () => {
        const evs = cars.filter(c => (c.fuel || '').toLowerCase().includes('electric') || (c.engineType || '').toLowerCase().includes('electric') || (c.fuel || '').toLowerCase() === 'ev');
        if (evs.length === 0) return { text: "We currently don't have any Electric Vehicles.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = evs.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return {
          text: `We are currently stocking <b>${evs.length} Electric Vehicles!</b><br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`,
          options: [
            { label: "What's the cheapest EV?", id: "cheap_ev" },
            { label: "What's the EV with highest range?", id: "highest_range_ev" },
            { label: "Start over", id: "root" }
          ]
        };
      }
    },
    cheap_ev: {
      compute: () => {
        const evs = cars.filter(c => (c.fuel || '').toLowerCase().includes('electric') || (c.engineType || '').toLowerCase().includes('electric') || (c.fuel || '').toLowerCase() === 'ev');
        if (evs.length === 0) return { text: "No EVs found.", options: [{ label: "Start over", id: "root" }] };
        evs.sort((a, b) => (a.price || a.onRoadPrice || Infinity) - (b.price || b.onRoadPrice || Infinity));
        const best = evs[0];
        return {
          text: `Our most affordable Electric Vehicle is the <b>${best.make} ${best.model}</b>, priced at ₹${formatINR.format(best.price || best.onRoadPrice || 0)}.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },
    highest_range_ev: {
      compute: () => {
        const evs = cars.filter(c => (c.fuel || '').toLowerCase().includes('electric') || (c.engineType || '').toLowerCase().includes('electric') || (c.fuel || '').toLowerCase() === 'ev');
        if (evs.length === 0) return { text: "No EVs found.", options: [{ label: "Start over", id: "root" }] };
        evs.sort((a, b) => (b.range || 0) - (a.range || 0));
        const best = evs[0];
        return {
          text: `The <b>${best.make} ${best.model}</b> offers the highest range at <b>${best.range} km</b> per charge!`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },
    fuel_petrol: {
      compute: () => {
        const p = cars.filter(c => (c.fuel || '').toLowerCase() === 'petrol');
        if(p.length === 0) return { text: "No petrol cars available.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = p.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return { text: `We have ${p.length} Petrol cars ready for a test drive:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`, options: [{ label: "Start over", id: "root" }] };
      }
    },
    fuel_diesel: {
      compute: () => {
        const d = cars.filter(c => (c.fuel || '').toLowerCase() === 'diesel');
        if(d.length === 0) return { text: "No diesel cars available.", options: [{ label: "Start over", id: "root" }] };
        const listHtml = d.map(c => `<li><b>${c.make} ${c.model}</b></li>`).join("");
        return { text: `We have ${d.length} Diesel cars available with excellent torque:<br><ul class="list-disc pl-5 mt-2 space-y-1">${listHtml}</ul>`, options: [{ label: "Start over", id: "root" }] };
      }
    },

    // --- PERFORMANCE ---
    search_perf: {
      msg: "Looking for a thrill? What performance metric matters most?",
      options: [
        { label: "Top Speed", id: "perf_speed" },
        { label: "Highest Torque", id: "perf_torque" },
        { label: "Start over", id: "root" }
      ]
    },
    perf_speed: {
      compute: () => {
        if (cars.length === 0) return { text: "Our inventory is currently empty.", options: [{ label: "Start over", id: "root" }] };
        const sorted = [...cars].sort((a, b) => (b.topSpeed || 0) - (a.topSpeed || 0));
        const best = sorted[0];
        return {
          text: `Hold onto your seats! The <b>${best.make} ${best.model}</b> is our fastest car, reaching a top speed of <b>${best.topSpeed} km/h</b>.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    },
    perf_torque: {
      compute: () => {
        if (cars.length === 0) return { text: "Our inventory is currently empty.", options: [{ label: "Start over", id: "root" }] };
        const sorted = [...cars].sort((a, b) => (b.torque || 0) - (a.torque || 0));
        const best = sorted[0];
        return {
          text: `For raw pulling power, the <b>${best.make} ${best.model}</b> boasts an incredible <b>${best.torque} Nm</b> of torque.`,
          options: [ { label: `View ${best.make} ${best.model}`, action: 'view_car', carId: best.id }, { label: "Start over", id: "root" } ]
        };
      }
    }
  };

  let chatHistory = JSON.parse(localStorage.getItem('elite_fleet_chat') || '[]');

  function saveChat() {
    localStorage.setItem('elite_fleet_chat', JSON.stringify(chatHistory));
  }

  function renderChat() {
    chatMessages.innerHTML = '';
    chatHistory.forEach(item => {
      appendMessageHTML(item.sender, item.text);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendMessageHTML(sender, text) {
    const div = document.createElement('div');
    div.className = sender === 'bot' 
      ? 'bg-slate-800 text-slate-100 p-3 rounded-2xl rounded-tl-sm w-5/6 shadow-md border border-slate-700/60'
      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm ml-auto w-fit max-w-[85%] shadow-md';
    div.innerHTML = text; // Now supports rich HTML!
    chatMessages.appendChild(div);
  }

  function handleOptionClick(option) {
    // Intercept View Car action
    if(option.action === 'view_car' && option.carId) {
      const carToView = cars.find(c => c.id === option.carId);
      if(carToView) {
        if(typeof openFullCarView === 'function') openFullCarView(carToView);
        return; // Don't continue chat flow
      }
    }

    chatHistory.push({ sender: 'user', text: option.label });
    renderChat();
    chatOptionsContainer.innerHTML = '<div class="text-xs text-slate-400 italic text-center py-2">Analyzing inventory...</div>';
    
    setTimeout(() => {
      const node = chatTree[option.id];
      let replyText = node.msg || "";
      let replyOptions = node.options || [];

      if (node.compute) {
        const result = node.compute();
        if (typeof result === 'string') {
          replyText = result;
        } else {
          replyText = result.text;
          replyOptions = result.options;
        }
      }
      
      chatHistory.push({ sender: 'bot', text: replyText });
      saveChat();
      renderChat();
      renderOptions(replyOptions);
    }, 800); // slightly longer delay for "analysis" feel
  }

  function renderOptions(options) {
    chatOptionsContainer.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      if (opt.action === 'view_car') {
        btn.className = 'w-full text-left px-4 py-2.5 rounded-xl border border-blue-500 bg-blue-50 text-sm font-bold text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors shadow-sm flex items-center gap-2';
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> <span>${opt.label}</span>`;
      } else {
        btn.className = 'w-full text-left px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-950/40 text-sm font-bold text-slate-300 hover:bg-blue-950/40 hover:border-blue-900/50 hover:text-blue-400 transition-colors shadow-md';
        btn.textContent = opt.label;
      }
      btn.onclick = () => handleOptionClick(opt);
      chatOptionsContainer.appendChild(btn);
    });
  }

  function initChat() {
    if (chatHistory.length === 0) {
      chatHistory.push({ sender: 'bot', text: chatTree.root.msg });
      saveChat();
    }
    renderChat();
    // For simplicity, always show root options when reopened if we aren't storing the full tree state
    renderOptions(chatTree.root.options);
  }

  chatToggle.addEventListener('click', () => {
    chatWindow.classList.remove('hidden');
    chatWindow.classList.add('flex');
    chatToggle.classList.add('hidden');
    initChat();
  });

  closeChat.addEventListener('click', () => {
    chatWindow.classList.add('hidden');
    chatWindow.classList.remove('flex');
    chatToggle.classList.remove('hidden');
  });
}

// Mobile navigation and responsive filter panel toggles
document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Drawer Toggle
  const mobileNavToggle = document.getElementById('mobile-nav-toggle');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const mobileNavDrawerContent = document.getElementById('mobile-nav-drawer-content');
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const closeIcon = document.getElementById('close-icon');

  if (mobileNavToggle && mobileNavDrawer && mobileNavDrawerContent) {
    mobileNavToggle.addEventListener('click', () => {
      const isHidden = mobileNavDrawer.classList.contains('hidden');
      if (isHidden) {
        mobileNavDrawer.classList.remove('hidden');
        setTimeout(() => {
          mobileNavDrawerContent.classList.add('open');
          hamburgerIcon.classList.add('hidden');
          hamburgerIcon.classList.remove('block');
          closeIcon.classList.remove('hidden');
          closeIcon.classList.add('block');
        }, 10);
      } else {
        mobileNavDrawerContent.classList.remove('open');
        hamburgerIcon.classList.remove('hidden');
        hamburgerIcon.classList.add('block');
        closeIcon.classList.add('hidden');
        closeIcon.classList.remove('block');
        setTimeout(() => {
          mobileNavDrawer.classList.add('hidden');
        }, 300);
      }
    });

    // Close drawer when clicking outside the drawer content (backdrop)
    mobileNavDrawer.addEventListener('click', (e) => {
      if (e.target === mobileNavDrawer) {
        mobileNavDrawerContent.classList.remove('open');
        hamburgerIcon.classList.remove('hidden');
        hamburgerIcon.classList.add('block');
        closeIcon.classList.add('hidden');
        closeIcon.classList.remove('block');
        setTimeout(() => {
          mobileNavDrawer.classList.add('hidden');
        }, 300);
      }
    });

    // Close drawer when links are clicked
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawerContent.classList.remove('open');
        hamburgerIcon.classList.remove('hidden');
        hamburgerIcon.classList.add('block');
        closeIcon.classList.add('hidden');
        closeIcon.classList.remove('block');
        setTimeout(() => {
          mobileNavDrawer.classList.add('hidden');
        }, 300);
      });
    });
  }

  // Filter Toggle on Mobile
  const filterToggleBtn = document.getElementById('filter-toggle-btn');
  const filterOptionsPanel = document.getElementById('filter-options-panel');
  if (filterToggleBtn && filterOptionsPanel) {
    filterToggleBtn.addEventListener('click', () => {
      const isCollapsed = filterOptionsPanel.classList.contains('hidden');
      if (isCollapsed) {
        filterOptionsPanel.classList.remove('hidden');
        filterOptionsPanel.classList.add('flex');
      } else {
        filterOptionsPanel.classList.remove('flex');
        filterOptionsPanel.classList.add('hidden');
      }
    });
  }
});
