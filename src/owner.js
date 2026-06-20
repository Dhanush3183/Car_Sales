import { app, db, auth } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const dashboardLayout = document.getElementById('dashboard-layout');

const inventoryTableBody = document.getElementById('inventory-table-body');
const adminSearch = document.getElementById('admin-search');
const statTotal = document.getElementById('stat-total');

const carFormModal = document.getElementById('car-form-modal');
const carForm = document.getElementById('car-form');
const btnAddCar = document.getElementById('btn-add-car');
const closeFormModal = document.getElementById('close-form-modal');
const cancelFormBtn = document.getElementById('cancel-form-btn');

// Colors
const colorPicker = document.getElementById('color-picker');
const colorHex = document.getElementById('color-hex');
const colorName = document.getElementById('color-name');
const btnAddColor = document.getElementById('btn-add-color');
const colorList = document.getElementById('color-list');
let currentColors = [];
let inventory = [];
let testDrivesData = [];
const formatINR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginScreen.classList.add('hidden');
    dashboardLayout.classList.remove('hidden');
    loadInventory();
    loadTestDrives();
    loadProfileSettings();
  } else {
    loginScreen.classList.remove('hidden');
    dashboardLayout.classList.add('hidden');
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value);
  } catch (error) {
    document.getElementById('login-error').classList.remove('hidden');
  }
});
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// Navigation logic...
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const sidebarNav = document.getElementById('sidebar-nav');
if (mobileMenuBtn && sidebarNav) {
  mobileMenuBtn.addEventListener('click', () => {
    const isHidden = sidebarNav.classList.contains('hidden');
    if (isHidden) {
      sidebarNav.classList.remove('hidden');
      setTimeout(() => {
        sidebarNav.classList.add('open');
      }, 10);
    } else {
      sidebarNav.classList.remove('open');
      setTimeout(() => {
        sidebarNav.classList.add('hidden');
      }, 300);
    }
  });
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active', 'bg-blue-600', 'text-white');
      n.classList.add('text-slate-400');
    });
    item.classList.add('active', 'bg-blue-600', 'text-white');
    item.classList.remove('text-slate-400');
    
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.getElementById(item.getAttribute('data-target')).classList.remove('hidden');
    
    // Auto-close sidebar on mobile viewports with transition
    if (sidebarNav && window.innerWidth < 768) {
      sidebarNav.classList.remove('open');
      setTimeout(() => {
        sidebarNav.classList.add('hidden');
      }, 300);
    }
    
    // Dynamic Header Title & Subtitle updates
    const target = item.getAttribute('data-target');
    const title = document.getElementById('view-title');
    const sub = document.getElementById('view-subtitle');
    if (target === 'inventory-view') {
      title.textContent = 'Inventory Management';
      sub.textContent = 'Manage your showroom vehicles and details.';
    } else if (target === 'test-drives-view') {
      title.textContent = 'Test Drive Bookings';
      sub.textContent = 'Track and contact customer inquiries.';
    } else if (target === 'trade-ins-view') {
      title.textContent = 'Trade-In Evaluations';
      sub.textContent = 'Review customer car trade-in requests and send valuations.';
      if(window.loadTradeIns) window.loadTradeIns();
    } else if (target === 'settings-view') {
      title.textContent = 'Showroom Profile';
      sub.textContent = 'Update showroom metadata, contact settings, and map location.';
    } else if (target === 'analytics-view') {
      title.textContent = 'Analytics & Insights';
      sub.textContent = 'Visualize your inventory performance and leads activity.';
      setTimeout(renderAnalytics, 50);
    }
  });
});

let trendingChartInstance = null;
let testDrivesChartInstance = null;

function renderAnalytics() {
  if (typeof Chart === 'undefined') return;
  
  // Aggregate data for Trending Models
  const modelCounts = {};
  inventory.forEach(c => {
    const key = `${c.make} ${c.model}`;
    if (!modelCounts[key]) modelCounts[key] = { inv: 1, leads: 0 };
    else modelCounts[key].inv++;
  });
  testDrivesData.forEach(td => {
    const key = `${td.carMake} ${td.carModel}`;
    if (modelCounts[key]) modelCounts[key].leads++;
    else modelCounts[key] = { inv: 0, leads: 1 };
  });

  const labels = Object.keys(modelCounts);
  const invData = labels.map(l => modelCounts[l].inv);
  const leadsData = labels.map(l => modelCounts[l].leads);

  const ctxT = document.getElementById('trendingChart')?.getContext('2d');
  if (ctxT) {
    if (trendingChartInstance) trendingChartInstance.destroy();
    trendingChartInstance = new Chart(ctxT, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Inventory Count', data: invData, backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'Test Drive Leads', data: leadsData, backgroundColor: '#10b981', borderRadius: 4 }
        ]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Inter', weight: 'bold', size: 11 } }
          }
        },
        scales: { 
          y: { 
            beginAtZero: true,
            ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.4)' }
          },
          x: {
            ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.2)' }
          }
        } 
      }
    });
  }

  // Aggregate data for Test Drives over time
  const dates = {};
  testDrivesData.forEach(td => {
    const d = new Date(td.createdAt).toLocaleDateString();
    dates[d] = (dates[d] || 0) + 1;
  });
  const sortedDates = Object.keys(dates).sort((a,b) => new Date(a) - new Date(b));
  const tdCounts = sortedDates.map(d => dates[d]);

  const ctxD = document.getElementById('testDrivesChart')?.getContext('2d');
  if (ctxD) {
    if (testDrivesChartInstance) testDrivesChartInstance.destroy();
    testDrivesChartInstance = new Chart(ctxD, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [{
          label: 'Leads Created',
          data: tdCounts,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          fill: true,
          tension: 0.4
        }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Inter', weight: 'bold', size: 11 } }
          }
        },
        scales: { 
          y: { 
            beginAtZero: true,
            ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.4)' }
          },
          x: {
            ticks: { color: '#cbd5e1', font: { family: 'Inter', size: 10 } },
            grid: { color: 'rgba(51, 65, 85, 0.2)' }
          }
        } 
      }
    });
  }

  // Populate Most Viewed Cars list
  const mostViewedContainer = document.getElementById('most-viewed-list');
  if (mostViewedContainer && inventory.length > 0) {
    const sortedCars = [...inventory]
      .filter(c => c.views > 0)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
      
    if (sortedCars.length > 0) {
      mostViewedContainer.innerHTML = sortedCars.map((c, i) => `
        <div class="flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 transition-all hover:bg-slate-800/60">
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full ${i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-amber-700' : 'bg-blue-600'} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">${i+1}</div>
            <div class="font-bold text-slate-100 text-sm">${c.make} ${c.model}</div>
          </div>
          <div class="font-bold text-blue-400 bg-blue-950/60 border border-blue-900/50 px-3 py-1 rounded-full text-xs">${c.views} views</div>
        </div>
      `).join('');
    } else {
      mostViewedContainer.innerHTML = '<p class="text-slate-400 text-sm italic">No views recorded yet. Data will appear once customers view your cars.</p>';
    }
  } else if (mostViewedContainer) {
    mostViewedContainer.innerHTML = '<p class="text-slate-400 text-sm italic">No vehicles in inventory.</p>';
  }
}

// Load Inventory
async function loadInventory() {
  try {
    const q = query(collection(db, 'cars'), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    inventory = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderInventoryTable(inventory);
    statTotal.textContent = inventory.length;
    renderAnalytics();
  } catch(e) {
    // Fallback if no index
    const snap = await getDocs(collection(db, 'cars'));
    inventory = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderInventoryTable(inventory);
    statTotal.textContent = inventory.length;
    renderAnalytics();
  }
}

function renderInventoryTable(items) {
  inventoryTableBody.innerHTML = '';
  items.forEach(car => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-900/60 border-b border-slate-800/60 transition-colors';
    row.innerHTML = `
      <td class="px-6 py-4.5 flex items-center gap-3">
        <img src="${car.images?.[0] || 'https://placehold.co/100'}" class="w-11 h-11 rounded-xl object-cover border border-slate-800 shadow-sm shrink-0">
        <div>
          <div class="font-bold text-slate-100 text-sm">${car.make} ${car.model}</div>
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${car.year} • ${car.body}</div>
        </div>
      </td>
      <td class="px-6 py-4.5 font-extrabold text-blue-400">${formatINR.format(car.onRoadPrice || car.price || 0)}</td>
      <td class="px-6 py-4.5 font-semibold text-slate-450">${car.body}</td>
      <td class="px-6 py-4.5"><button onclick="window.toggleCarStatus('${car.id}', '${car.status}')" class="px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${car.status==='Available'?'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/50':'bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/50'}">${car.status}</button></td>
      <td class="px-6 py-4.5 text-right font-medium">
        <button class="text-blue-400 hover:text-blue-300 hover:underline mr-4" onclick="window.editCar('${car.id}')">Edit</button>
        <button class="text-red-400 hover:text-red-300 hover:underline" onclick="window.deleteCar('${car.id}')">Delete</button>
      </td>
    `;
    inventoryTableBody.appendChild(row);
  });
}

adminSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderInventoryTable(inventory.filter(c => c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q)));
});

// Color logic
colorPicker.addEventListener('input', (e) => colorHex.value = e.target.value.toUpperCase());
colorHex.addEventListener('input', (e) => colorPicker.value = e.target.value);

btnAddColor.addEventListener('click', () => {
  const hex = colorHex.value.trim();
  const name = colorName.value.trim() || 'Custom Color';
  if (/^#[0-9A-F]{6}$/i.test(hex)) {
    currentColors.push({ hex, name });
    renderColors();
    colorHex.value = '';
    colorName.value = '';
  } else {
    alert('Please enter a valid HEX code (e.g., #FF0000)');
  }
});

function renderColors() {
  colorList.innerHTML = '';
  currentColors.forEach((c, idx) => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-2 bg-slate-900/60 border border-slate-800 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold text-slate-350 shadow-sm';
    el.innerHTML = `
      <div class="w-4 h-4 rounded-full border border-slate-700 shadow-sm shrink-0" style="background-color: ${c.hex}"></div>
      <span class="truncate max-w-[120px]">${c.name}</span>
      <button type="button" class="text-slate-500 hover:text-red-400 rounded-full w-5 h-5 flex items-center justify-center transition-colors font-bold text-sm" onclick="window.removeColor(${idx})">&times;</button>
    `;
    colorList.appendChild(el);
  });
}
window.removeColor = (idx) => {
  currentColors.splice(idx, 1);
  renderColors();
};

// Form Open/Close
window.editCar = (id) => openFormModal(id);
window.deleteCar = async (id) => {
  if (confirm("Are you sure you want to delete this vehicle from inventory?")) {
    await deleteDoc(doc(db, 'cars', id));
    loadInventory();
  }
};

window.toggleCarStatus = async (id, currentStatus) => {
  const newStatus = currentStatus === 'Available' ? 'Unavailable' : 'Available';
  await updateDoc(doc(db, 'cars', id), { status: newStatus });
  loadInventory();
};

function openFormModal(carId = null) {
  carForm.reset();
  document.getElementById('image-urls-container').innerHTML = '';
  currentColors = [];
  renderColors();
  
  if (carId) {
    const car = inventory.find(c => c.id === carId);
    document.getElementById('car-id').value = car.id;
    document.getElementById('car-make').value = car.make || '';
    document.getElementById('car-model').value = car.model || '';
    document.getElementById('car-year').value = car.year || '';
    document.getElementById('car-status').value = car.status || 'Available';
    document.getElementById('car-body').value = car.body || 'Sedan';
    
    document.getElementById('car-base-price').value = car.basePrice || car.price || '';
    document.getElementById('car-rto-percent').value = car.rtoPercent !== undefined ? car.rtoPercent : 10;
    document.getElementById('car-ins-percent').value = car.insPercent !== undefined ? car.insPercent : 5;
    document.getElementById('car-tcs-percent').value = car.tcsPercent !== undefined ? car.tcsPercent : 1;
    if(window.calcOnRoad) window.calcOnRoad();
    
    document.getElementById('car-engine').value = car.engineType || '';
    document.getElementById('car-drive').value = car.drive || 'FWD';
    document.getElementById('car-cc').value = car.cc || '';
    document.getElementById('car-torque').value = car.torque || '';
    document.getElementById('car-speed').value = car.topSpeed || '';
    
    document.getElementById('car-fuel').value = car.fuel || 'Petrol';
    window.updateFuelFields(); // Defined in HTML inline
    document.getElementById('car-fuel-cap').value = car.fuelCapacity || '';
    document.getElementById('car-mileage').value = car.mileage || '';
    document.getElementById('car-battery').value = car.battery || '';
    document.getElementById('car-charge-time').value = car.chargeTime || '';
    document.getElementById('car-range').value = car.range || '';
    
    document.getElementById('car-gear-type').value = car.gearType || 'Automatic';
    document.getElementById('car-gears').value = car.gears || '';
    document.getElementById('car-adas').value = car.adas || '0';
    document.getElementById('car-abs').checked = car.abs || false;
    document.getElementById('car-hill').checked = car.hillAssist || false;
    
    document.getElementById('car-dim-l').value = car.dimLength || '';
    document.getElementById('car-dim-w').value = car.dimWidth || '';
    document.getElementById('car-dim-h').value = car.dimHeight || '';
    document.getElementById('car-clearance').value = car.clearance || '';
    document.getElementById('car-seats').value = car.seats || '';
    document.getElementById('car-boot').value = car.bootCapacity || '';
    
    document.getElementById('car-extras').value = car.extras ? car.extras.join(', ') : '';
    document.getElementById('car-offers').value = car.specialOffers || '';
    
    if (car.colors) currentColors = [...car.colors];
    renderColors();
    
    if (car.images && car.images.length > 0) {
      car.images.forEach(img => addImageUrlInput(img));
    } else {
      addImageUrlInput();
    }
  } else {
    addImageUrlInput();
  }
  
  carFormModal.classList.remove('hidden');
  setTimeout(() => document.getElementById('form-content').classList.remove('opacity-0', 'translate-y-4'), 10);
}

function closeForm() {
  document.getElementById('form-content').classList.add('opacity-0', 'translate-y-4');
  setTimeout(() => carFormModal.classList.add('hidden'), 300);
}

btnAddCar.addEventListener('click', () => openFormModal());
closeFormModal.addEventListener('click', closeForm);
cancelFormBtn.addEventListener('click', closeForm);

// Images
document.getElementById('add-image-url-btn').addEventListener('click', () => addImageUrlInput());
function addImageUrlInput(val = '') {
  const wrap = document.createElement('div');
  wrap.className = 'flex gap-2 items-center';
  wrap.innerHTML = `
    <input type="url" class="image-url flex-1 p-3 glass-input rounded-xl text-sm" value="${val}" placeholder="https://images.unsplash.com/photo-...">
    <button type="button" class="px-3 py-3 border border-slate-800 rounded-xl bg-slate-950/40 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/55 transition-colors" onclick="this.parentElement.remove()">
      <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
    </button>`;
  document.getElementById('image-urls-container').appendChild(wrap);
}

// Save
carForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('car-id').value;
  const images = Array.from(document.querySelectorAll('.image-url')).map(i => i.value).filter(v => v);
  const ext = document.getElementById('car-extras').value;
  const offers = document.getElementById('car-offers').value.trim();
  
  const data = {
    make: document.getElementById('car-make').value.trim(),
    model: document.getElementById('car-model').value.trim(),
    year: parseInt(document.getElementById('car-year').value),
    status: document.getElementById('car-status').value,
    body: document.getElementById('car-body').value,
    
    basePrice: parseFloat(document.getElementById('car-base-price').value) || 0,
    rtoPercent: parseFloat(document.getElementById('car-rto-percent').value) || 10,
    insPercent: parseFloat(document.getElementById('car-ins-percent').value) || 5,
    tcsPercent: parseFloat(document.getElementById('car-tcs-percent').value) || 1,
    onRoadPrice: parseFloat(document.getElementById('car-on-road').value.replace(/[^0-9.-]+/g, '')) || 0,
    price: parseFloat(document.getElementById('car-on-road').value.replace(/[^0-9.-]+/g, '')) || 0,
    
    engineType: document.getElementById('car-engine').value.trim(),
    drive: document.getElementById('car-drive').value,
    cc: parseInt(document.getElementById('car-cc').value) || 0,
    torque: parseInt(document.getElementById('car-torque').value) || 0,
    topSpeed: parseInt(document.getElementById('car-speed').value) || 0,
    
    fuel: document.getElementById('car-fuel').value,
    fuelCapacity: parseFloat(document.getElementById('car-fuel-cap').value) || 0,
    mileage: parseFloat(document.getElementById('car-mileage').value) || 0,
    battery: parseFloat(document.getElementById('car-battery').value) || 0,
    chargeTime: parseFloat(document.getElementById('car-charge-time').value) || 0,
    range: parseInt(document.getElementById('car-range').value) || 0,
    
    gearType: document.getElementById('car-gear-type').value,
    gears: parseInt(document.getElementById('car-gears').value) || 0,
    adas: parseInt(document.getElementById('car-adas').value) || 0,
    abs: document.getElementById('car-abs').checked,
    hillAssist: document.getElementById('car-hill').checked,
    
    dimLength: parseInt(document.getElementById('car-dim-l').value) || 0,
    dimWidth: parseInt(document.getElementById('car-dim-w').value) || 0,
    dimHeight: parseInt(document.getElementById('car-dim-h').value) || 0,
    clearance: parseFloat(document.getElementById('car-clearance').value) || 0,
    seats: parseInt(document.getElementById('car-seats').value) || 0,
    bootCapacity: parseInt(document.getElementById('car-boot').value) || 0,
    
    colors: currentColors,
    extras: ext ? ext.split(',').map(s=>s.trim()) : [],
    specialOffers: offers,
    images: images,
    updatedAt: new Date().toISOString()
  };

  try {
    if (id) await updateDoc(doc(db, 'cars', id), data);
    else {
      data.createdAt = new Date().toISOString();
      await addDoc(collection(db, 'cars'), data);
    }
    closeForm();
    loadInventory();
  } catch (error) {
    alert("Error: " + error.message);
  }
});

// Test Drives Logic
async function loadTestDrives() {
  const tbody = document.getElementById('test-drives-table-body');
  const renderRows = (snap) => {
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const d = doc.data();
      const dObjPref = new Date(d.preferredDate);
      const formattedDate = `${String(dObjPref.getDate()).padStart(2, '0')}/${String(dObjPref.getMonth() + 1).padStart(2, '0')}/${dObjPref.getFullYear()}`;
      const dObjCreated = new Date(d.createdAt);
      const createdDate = `${String(dObjCreated.getDate()).padStart(2, '0')}/${String(dObjCreated.getMonth() + 1).padStart(2, '0')}/${dObjCreated.getFullYear()}`;
      // Store data in data attributes or global array. We will just pass details inline.
      const escapedName = (d.name || '').replace(/'/g, "\\'");
      const escapedEmail = (d.email || '').replace(/'/g, "\\'");
      const escapedPhone = (d.phone || '').replace(/'/g, "\\'");
      const escapedCar = (d.carMake + ' ' + d.carModel).replace(/'/g, "\\'");
      const escapedDate = formattedDate.replace(/'/g, "\\'");
      
      tbody.innerHTML += `
        <tr class="hover:bg-slate-900/60 border-b border-slate-800/60 transition-colors">
          <td class="px-6 py-4.5 font-semibold text-slate-400">${createdDate}</td>
          <td class="px-6 py-4.5">
            <div class="font-bold text-slate-100">${d.name}</div>
            <div class="text-[11px] text-slate-400 font-medium">${d.phone} | ${d.email}</div>
          </td>
          <td class="px-6 py-4.5 font-bold text-slate-300">${d.carMake} ${d.carModel}</td>
          <td class="px-6 py-4.5 font-bold text-blue-400">${formattedDate}</td>
          <td class="px-6 py-4.5 text-right flex justify-end gap-3 items-center mt-2">
            <div class="relative inline-block text-left mr-2">
              <button onclick="window.toggleDropdown('dropdown-td-${doc.id}')" class="text-blue-400 hover:text-blue-300 hover:underline font-semibold text-sm flex items-center gap-1">
                Contact Lead
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              <div id="dropdown-td-${doc.id}" class="hidden absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden text-left">
                <button onclick="window.openEmailModal('${escapedName}', '${escapedEmail}', '${escapedCar}', '${escapedDate}')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Via Gmail</button>
                <button onclick="window.contactWhatsApp('${escapedName}', '${escapedPhone}', '${escapedCar}', '${escapedDate}')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Via WhatsApp</button>
              </div>
            </div>
            <button class="text-red-400 hover:text-red-300 hover:underline font-semibold text-sm" onclick="window.delTD('${doc.id}')">Dismiss Lead</button>
          </td>
        </tr>`;
    });
  };
  try {
    const snap = await getDocs(query(collection(db, 'test_drives'), orderBy("createdAt", "desc")));
    testDrivesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderRows(snap);
    renderAnalytics();
  } catch(e) {
    // fallback
    const snap = await getDocs(collection(db, 'test_drives'));
    testDrivesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderRows(snap);
    renderAnalytics();
  }
}
window.delTD = async (id) => {
  if(confirm("Dismiss this test drive lead?")) {
    await deleteDoc(doc(db, 'test_drives', id));
    loadTestDrives();
  }
};

// Email Modal Logic
const emailModal = document.getElementById('email-modal');
const emailContent = document.getElementById('email-content');
const emailTo = document.getElementById('email-to');
const emailSubject = document.getElementById('email-subject');
const emailBody = document.getElementById('email-body');

window.openEmailModal = (name, email, car, date) => {
  const showroomName = document.getElementById('owner-admin-name')?.textContent || 'Elite Motors';
  emailTo.value = email;
  emailSubject.value = `Regarding Your Test Drive Request for ${car}`;
  emailBody.value = `Dear ${name},\n\nThank you for choosing ${showroomName}.\n\nWe are delighted to confirm that we have received your test drive request for the ${car} on ${date}. Our team is currently preparing the vehicle to ensure you have a premium experience.\n\nCould you please confirm if this date still works for you, or let us know if you'd like to adjust the timing?\n\nThank you once again for your interest. We look forward to welcoming you to our showroom.\n\nWarm regards,\n\nThe ${showroomName} Team`;
  
  emailModal.classList.remove('hidden');
  setTimeout(() => emailContent.classList.remove('opacity-0', 'translate-y-4'), 10);
};

const closeEmailModal = () => {
  emailContent.classList.add('opacity-0', 'translate-y-4');
  setTimeout(() => emailModal.classList.add('hidden'), 300);
};

document.getElementById('close-email-modal').addEventListener('click', closeEmailModal);
document.getElementById('cancel-email-btn').addEventListener('click', closeEmailModal);

document.getElementById('send-email-btn').addEventListener('click', () => {
  const to = encodeURIComponent(emailTo.value);
  const subject = encodeURIComponent(emailSubject.value);
  const body = encodeURIComponent(emailBody.value);
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`, '_blank');
  closeEmailModal();
});

// FullCalendar Logic
let calendarInstance = null;
const btnTdList = document.getElementById('btn-td-list');
const btnTdCal = document.getElementById('btn-td-cal');
const tdListContainer = document.getElementById('td-list-container');
const tdCalContainer = document.getElementById('td-cal-container');

btnTdList.addEventListener('click', () => {
  btnTdList.className = 'px-4 py-2 bg-blue-600 text-white border border-blue-500 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20';
  btnTdCal.className = 'px-4 py-2 bg-slate-950/40 border border-slate-800 text-slate-400 rounded-lg text-xs font-bold transition-all hover:bg-slate-800/80';
  tdListContainer.classList.remove('hidden');
  tdCalContainer.classList.add('hidden');
});

btnTdCal.addEventListener('click', () => {
  btnTdCal.className = 'px-4 py-2 bg-blue-600 text-white border border-blue-500 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20';
  btnTdList.className = 'px-4 py-2 bg-slate-950/40 border border-slate-800 text-slate-400 rounded-lg text-xs font-bold transition-all hover:bg-slate-800/80';
  tdListContainer.classList.add('hidden');
  tdCalContainer.classList.remove('hidden');
  
  if (!calendarInstance && window.FullCalendar) {
    const calendarEl = document.getElementById('test-drives-calendar');
    calendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth',
      headerToolbar: window.innerWidth < 768 ? {
        left: 'prev,next',
        center: 'title',
        right: 'today'
      } : {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      events: testDrivesData.map(td => ({
        title: `${td.name} - ${td.carMake} ${td.carModel}`,
        start: td.preferredDate,
        color: '#2563eb' // blue-600
      })),
      eventClick: function(info) {
        const dObj = info.event.start;
        const alertDate = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
        alert('Test Drive Request:\n' + info.event.title + '\nDate: ' + alertDate);
      }
    });
    calendarInstance.render();
  } else if (calendarInstance) {
    // Update events if data changed
    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(testDrivesData.map(td => ({
      title: `${td.name} - ${td.carMake} ${td.carModel}`,
      start: td.preferredDate,
      color: '#2563eb'
    })));
  }
});

// Global settings loading & saving
async function loadProfileSettings() {
  const snap = await getDoc(doc(db, 'settings', 'global'));
  if (snap.exists()) {
    const d = snap.data();
    document.getElementById('set-name').value = d.name || '';
    const adminName = document.getElementById('owner-admin-name');
    if (adminName) adminName.textContent = d.name || 'Elite Admin';
    document.getElementById('set-address').value = d.address || '';
    document.getElementById('set-phone').value = d.phone || '';
    document.getElementById('set-email').value = d.email || '';
    document.getElementById('set-map').value = d.mapUrl || '';
    document.getElementById('set-facebook').value = d.facebook || '';
    document.getElementById('set-instagram').value = d.instagram || '';
    document.getElementById('set-x').value = d.x || '';
    document.getElementById('set-youtube').value = d.youtube || '';
  }
}

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('save-settings-btn');
  btn.textContent = 'Saving profile...'; btn.disabled = true;
  
  try {
    const newName = document.getElementById('set-name').value.trim();
    await setDoc(doc(db, 'settings', 'global'), {
      name: newName,
      address: document.getElementById('set-address').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      mapUrl: document.getElementById('set-map').value.trim(),
      facebook: document.getElementById('set-facebook').value.trim(),
      instagram: document.getElementById('set-instagram').value.trim(),
      x: document.getElementById('set-x').value.trim(),
      youtube: document.getElementById('set-youtube').value.trim()
    });
    const adminName = document.getElementById('owner-admin-name');
    if (adminName) adminName.textContent = newName || 'Elite Admin';
    alert('Global Profile Settings updated successfully!');
  } catch(err) {
    alert('Error updating profile settings: ' + err.message);
  } finally {
    btn.textContent = 'Save Profile Changes'; btn.disabled = false;
  }
});

// Dropdown Toggles & Click Outside
window.toggleDropdown = (id) => {
  const el = document.getElementById(id);
  if (el && el.classList.contains('hidden')) {
    document.querySelectorAll('[id^="dropdown-"]').forEach(d => d.classList.add('hidden'));
    el.classList.remove('hidden');
  } else if (el) {
    el.classList.add('hidden');
  }
};
window.addEventListener('click', (e) => {
  if (!e.target.closest('.relative')) {
    document.querySelectorAll('[id^="dropdown-"]').forEach(d => d.classList.add('hidden'));
  }
});

// WhatsApp Actions
window.contactWhatsApp = (name, phone, car, date) => {
  const showroomName = document.getElementById('owner-admin-name')?.textContent || 'Elite Motors';
  const msg = `Dear ${name},\n\nThank you for choosing ${showroomName}.\n\nWe are delighted to receive your test drive request for the ${car} on ${date}. Our team is currently preparing the vehicle to ensure you have an exceptional experience.\n\nCould you please let us know if this date still works for you, or if you would like to adjust the timing?\n\nThank you once again for your interest. We look forward to welcoming you soon.\n\nWarm regards,\n\nThe ${showroomName} Team`;
  const encodedMsg = encodeURIComponent(msg);
  const cleanPhone = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
};

const getTradeInMsg = (name, year, brand, model, fuel, mileage, id) => {
  const priceInput = document.getElementById(`valuation-${id}`);
  const price = priceInput ? priceInput.value || 'To Be Decided' : 'To Be Decided';
  const showroomName = document.getElementById('owner-admin-name')?.textContent || 'Elite Motors';
  return `Dear ${name},\n\nThank you for reaching out to ${showroomName}.\n\nWe appreciate you sharing the details of your ${year} ${brand} ${model} (${fuel}, ${mileage} km). Based on the information provided, our initial estimated trade-in valuation for your vehicle is ${price}.\n\nWe would love to invite you to our showroom this week for a comprehensive physical inspection and to finalize the best possible deal for you.\n\nPlease let us know when you would be available to visit.\n\nThank you,\n\nWarm regards,\n\nThe ${showroomName} Team`;
};

window.contactTradeInGmail = (name, email, year, brand, model, fuel, mileage, id) => {
  const msg = getTradeInMsg(name, year, brand, model, fuel, mileage, id);
  const subject = encodeURIComponent(`Trade-In Valuation for your ${brand} ${model}`);
  const body = encodeURIComponent(msg);
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`, '_blank');
};

window.contactTradeInWhatsApp = (name, phone, year, brand, model, fuel, mileage, id) => {
  const msg = getTradeInMsg(name, year, brand, model, fuel, mileage, id);
  const encodedMsg = encodeURIComponent(msg);
  const cleanPhone = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
};

// Load Trade Ins
window.loadTradeIns = () => {
  const tbody = document.getElementById('trade-ins-table-body');
  if(!tbody) return;
  const leads = JSON.parse(localStorage.getItem('tradeInLeads') || '[]');
  
  if (leads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-10 text-center text-slate-500 font-medium">No trade-in requests yet.</td></tr>';
    return;
  }
  
  tbody.innerHTML = '';
  leads.forEach(d => {
    const escapedName = (d.name || '').replace(/'/g, "\\'");
    const escapedEmail = (d.email || '').replace(/'/g, "\\'");
    const escapedPhone = (d.phone || '').replace(/'/g, "\\'");
    const escapedBrand = (d.brand || '').replace(/'/g, "\\'");
    const escapedModel = (d.model || '').replace(/'/g, "\\'");
    const escapedYear = (d.year || '').replace(/'/g, "\\'");
    const escapedFuel = (d.fuel || '').replace(/'/g, "\\'");
    const escapedMileage = (d.mileage || '').replace(/'/g, "\\'");
    
    tbody.innerHTML += `
      <tr class="hover:bg-slate-900/60 border-b border-slate-800/60 transition-colors">
        <td class="px-6 py-4.5">
          <div class="font-bold text-slate-100">${d.name}</div>
          <div class="text-[11px] text-slate-400 font-medium">${d.phone} | ${d.email}</div>
        </td>
        <td class="px-6 py-4.5">
          <div class="font-bold text-slate-300">${d.year} ${d.brand} ${d.model}</div>
          <div class="text-[11px] text-slate-400 font-medium">${d.fuel} • ${d.mileage} km</div>
        </td>
        <td class="px-6 py-4.5">
          <input type="text" id="valuation-${d.id}" placeholder="e.g. ₹45,00,000" class="w-full p-2 glass-input rounded-lg outline-none text-sm font-semibold">
        </td>
        <td class="px-6 py-4.5 text-right relative flex justify-end items-center mt-2 gap-3">
          <div class="relative inline-block text-left mr-2">
            <button onclick="window.toggleDropdown('dropdown-ti-${d.id}')" class="text-blue-400 hover:text-blue-300 hover:underline font-semibold text-sm flex items-center justify-end gap-1 w-full">
              Contact
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div id="dropdown-ti-${d.id}" class="hidden absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden text-left">
              <button onclick="window.contactTradeInGmail('${escapedName}', '${escapedEmail}', '${escapedYear}', '${escapedBrand}', '${escapedModel}', '${escapedFuel}', '${escapedMileage}', '${d.id}')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Via Gmail</button>
              <button onclick="window.contactTradeInWhatsApp('${escapedName}', '${escapedPhone}', '${escapedYear}', '${escapedBrand}', '${escapedModel}', '${escapedFuel}', '${escapedMileage}', '${d.id}')" class="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">Via WhatsApp</button>
            </div>
          </div>
          <button class="text-red-400 hover:text-red-300 hover:underline font-semibold text-sm" onclick="window.delTradeIn('${d.id}')">Dismiss</button>
        </td>
      </tr>
    `;
  });
};

window.delTradeIn = (id) => {
  if (!confirm('Are you sure you want to dismiss this trade-in request?')) return;
  const leads = JSON.parse(localStorage.getItem('tradeInLeads') || '[]');
  const newLeads = leads.filter(l => l.id !== id);
  localStorage.setItem('tradeInLeads', JSON.stringify(newLeads));
  window.loadTradeIns();
};

window.calcOnRoad = () => {
  const base = parseFloat(document.getElementById('car-base-price').value) || 0;
  const rtoPct = parseFloat(document.getElementById('car-rto-percent').value) || 10;
  const insPct = parseFloat(document.getElementById('car-ins-percent').value) || 5;
  const tcsPct = parseFloat(document.getElementById('car-tcs-percent').value) || 1;
  
  const rto = base * (rtoPct / 100);
  const ins = base * (insPct / 100);
  const tcs = base * (tcsPct / 100);
  
  document.getElementById('car-ins-amount').textContent = '₹' + Math.round(ins).toLocaleString('en-IN');
  document.getElementById('car-tcs-amount').textContent = '₹' + Math.round(tcs).toLocaleString('en-IN');
  
  const onRoad = base + rto + ins + tcs;
  document.getElementById('car-on-road').value = '₹' + Math.round(onRoad).toLocaleString('en-IN');
};
