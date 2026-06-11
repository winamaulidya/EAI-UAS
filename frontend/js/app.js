const BASE = 'http://localhost:8080';

// === NAVIGATION ===
function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    document.getElementById('page-title').textContent = navItem ? navItem.textContent.trim() : page;
    document.getElementById('sidebar').classList.remove('open');

    if (page === 'dashboard') loadDashboard();
    else if (page === 'registration') { loadPatients(); }
    else if (page === 'medical') { loadMedicalRecords(); }
    else if (page === 'pharmacy') { loadMedicines(); }
    else if (page === 'billing') { loadInvoices(); }
    else if (page === 'integration') { loadIntegration(); }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(item.dataset.page);
    });
});

document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// === TOAST ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// === CLOCK ===
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
setInterval(updateClock, 1000);
updateClock();

// === API HELPER ===
async function api(method, path, body = null) {
    try {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(BASE + path, opts);
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(`Server returned ${res.status}: ${text.substring(0, 120)}`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || (Array.isArray(data.detail) ? data.detail.map(d => d.msg).join(', ') : 'Request failed'));
        return data;
    } catch (err) {
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
            throw new Error('Gagal terhubung ke server. Pastikan server (Docker) sedang berjalan.');
        }
        throw err;
    }
}

// === DASHBOARD ===
async function loadDashboard() {
    const services = ['registration', 'medical', 'pharmacy', 'billing', 'integration'];
    const cards = document.querySelectorAll('.stat-card');

    for (const card of cards) {
        const svc = card.dataset.service;
        card.className = 'stat-card loading';
        card.querySelector('.stat-value').textContent = '...';
        card.querySelector('.stat-label').textContent = 'Memeriksa...';
    }

    for (const svc of services) {
        try {
            const data = await api('GET', '/' + svc + '/health');
            const card = document.querySelector(`.stat-card[data-service="${svc}"]`);
            if (card) {
                card.className = 'stat-card healthy';
                card.querySelector('.stat-value').textContent = '✓ Sehat';
                card.querySelector('.stat-label').textContent = data.status;
            }
        } catch {
            const card = document.querySelector(`.stat-card[data-service="${svc}"]`);
            if (card) {
                card.className = 'stat-card unhealthy';
                card.querySelector('.stat-value').textContent = '✗ Error';
                card.querySelector('.stat-label').textContent = 'Tidak terjangkau';
            }
        }
    }

    try {
        const patData = await api('GET', '/integration/patterns');
        const container = document.getElementById('patterns-mini');
        container.innerHTML = '';
        (patData.patterns || []).slice(0, 6).forEach(p => {
            const div = document.createElement('div');
            div.className = 'pattern-item';
            div.innerHTML = `<h4>${p.name}</h4><p>${p.description || ''}</p>`;
            container.appendChild(div);
        });
    } catch { /* ignore */ }
}

// === REGISTRATION ===
document.getElementById('form-registration').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        patient_code: document.getElementById('reg-patient_code').value.trim(),
        name: document.getElementById('reg-name').value.trim(),
        gender: document.getElementById('reg-gender').value,
        birth_date: document.getElementById('reg-birth_date').value || null,
        address: document.getElementById('reg-address').value.trim() || null,
    };
    try {
        await api('POST', '/registration/patients', data);
        showToast('Pasien berhasil didaftarkan!');
        e.target.reset();
        loadPatients();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function loadPatients() {
    const tbody = document.getElementById('tbody-patients');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="spinner"></span> Memuat...</td></tr>';
    try {
        const data = await api('GET', '/registration/patients');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Belum ada data pasien</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.patient_code}</strong></td>
                <td>${p.name}</td>
                <td>${p.gender}</td>
                <td>${p.birth_date ? formatDate(p.birth_date) : '-'}</td>
                <td>${p.address || '-'}</td>
                <td>${formatDateTime(p.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</td></tr>`;
    }
}

// === MEDICAL RECORD ===
document.getElementById('form-medical').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        patient_code: document.getElementById('med-patient_code').value.trim(),
        doctor_name: document.getElementById('med-doctor_name').value.trim(),
        diagnosis: document.getElementById('med-diagnosis').value.trim(),
        prescription: document.getElementById('med-prescription').value.trim() || null,
    };
    try {
        await api('POST', '/medical/medical-records', data);
        showToast('Rekam medis berhasil disimpan!');
        e.target.reset();
        loadMedicalRecords();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function loadMedicalRecords() {
    const tbody = document.getElementById('tbody-medical');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><span class="spinner"></span> Memuat...</td></tr>';
    try {
        const data = await api('GET', '/medical/medical-records');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">Belum ada rekam medis</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td>${r.id}</td>
                <td><strong>${r.patient_code}</strong></td>
                <td>${r.doctor_name}</td>
                <td>${truncate(r.diagnosis, 60)}</td>
                <td>${r.prescription ? truncate(r.prescription, 40) : '<span class="text-secondary">-</span>'}</td>
                <td>${formatDateTime(r.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</td></tr>`;
    }
}

// === PHARMACY ===
document.getElementById('form-medicine').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        medicine_code: document.getElementById('pharm-medicine_code').value.trim(),
        medicine_name: document.getElementById('pharm-medicine_name').value.trim(),
        stock: parseInt(document.getElementById('pharm-stock').value),
        price: parseFloat(document.getElementById('pharm-price').value),
    };
    try {
        await api('POST', '/pharmacy/medicines', data);
        showToast('Obat berhasil ditambahkan!');
        e.target.reset();
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

document.getElementById('form-prescription').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        patient_code: document.getElementById('presc-patient_code').value.trim(),
        medicine_code: document.getElementById('presc-medicine_code').value.trim(),
        quantity: parseInt(document.getElementById('presc-quantity').value),
    };
    try {
        const result = await api('POST', '/pharmacy/prescriptions', data);
        showToast(`Obat berhasil didispensasi (ID: ${result.id})`);
        e.target.reset();
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function loadMedicines() {
    const tbody = document.getElementById('tbody-medicines');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><span class="spinner"></span> Memuat...</td></tr>';
    try {
        const data = await api('GET', '/pharmacy/medicines');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">Belum ada data obat</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(m => `
            <tr>
                <td>${truncate(m.id, 10)}</td>
                <td><strong>${m.medicine_code}</strong></td>
                <td>${m.medicine_name}</td>
                <td>${m.stock}</td>
                <td>Rp ${m.price.toLocaleString('id-ID')}</td>
                <td><button class="btn-edit" onclick="showEditMedicine('${m.id}', ${m.stock}, ${m.price})">Edit</button></td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</td></tr>`;
    }
}

function showEditMedicine(id, stock, price) {
    const newStock = prompt('Stok baru:', stock);
    if (newStock === null) return;
    const newPrice = prompt('Harga baru (Rp):', price);
    if (newPrice === null) return;
    updateMedicine(id, parseInt(newStock), parseFloat(newPrice));
}

async function updateMedicine(id, stock, price) {
    try {
        await api('PUT', `/pharmacy/medicines/${id}`, { stock, price });
        showToast('Obat berhasil diperbarui!');
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// === BILLING ===
document.getElementById('form-invoice').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        patient_code: document.getElementById('bill-patient_code').value.trim(),
        service_fee: parseFloat(document.getElementById('bill-service_fee').value) || 0,
        medicine_fee: parseFloat(document.getElementById('bill-medicine_fee').value) || 0,
    };
    try {
        const result = await api('POST', '/billing/invoices', data);
        showToast(`Invoice berhasil dibuat (ID: ${result.id}, Total: Rp ${result.total_fee.toLocaleString('id-ID')})`);
        e.target.reset();
        loadInvoices();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function loadInvoices() {
    const tbody = document.getElementById('tbody-invoices');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><span class="spinner"></span> Memuat...</td></tr>';
    try {
        const data = await api('GET', '/billing/invoices');
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Belum ada invoice</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(inv => `
            <tr>
                <td>${inv.id}</td>
                <td><strong>${inv.patient_code}</strong></td>
                <td>Rp ${inv.service_fee.toLocaleString('id-ID')}</td>
                <td>Rp ${inv.medicine_fee.toLocaleString('id-ID')}</td>
                <td><strong>Rp ${inv.total_fee.toLocaleString('id-ID')}</strong></td>
                <td><span class="badge ${inv.status === 'paid' ? 'badge-success' : 'badge-pending'}">${inv.status}</span></td>
                <td>${formatDateTime(inv.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</td></tr>`;
    }
}

// === INTEGRATION ===
async function loadIntegration() {
    const patternsDiv = document.getElementById('integration-patterns');
    const queuesDiv = document.getElementById('integration-queues');

    patternsDiv.innerHTML = '<p class="text-center"><span class="spinner"></span> Memuat...</p>';
    queuesDiv.innerHTML = '<p class="text-center"><span class="spinner"></span> Memuat...</p>';

    try {
        const patData = await api('GET', '/integration/patterns');
        patternsDiv.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'patterns-list';
        (patData.patterns || []).forEach(p => {
            const div = document.createElement('div');
            div.className = 'pattern-item';
            div.innerHTML = `<h4>${p.name}</h4><p>${p.description || ''}</p>`;
            grid.appendChild(div);
        });
        patternsDiv.appendChild(grid);
    } catch (err) {
        patternsDiv.innerHTML = `<p class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</p>`;
    }

    try {
        const qData = await api('GET', '/integration/queues');
        queuesDiv.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'queue-list';
        (qData.queues || []).forEach(q => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            const isDlq = q.name.toLowerCase().includes('dlq');
            item.innerHTML = `
                <span class="queue-dot ${isDlq ? 'dlq' : ''}"></span>
                <span class="queue-name">${q.name}</span>
                <span class="queue-label">${q.dlq ? 'DLQ: ' + q.dlq : 'Primary'}</span>
            `;
            list.appendChild(item);
        });
        queuesDiv.appendChild(list);
    } catch (err) {
        queuesDiv.innerHTML = `<p class="text-center" style="color:var(--danger)">Gagal memuat: ${err.message}</p>`;
    }
}

// === UTILITY ===
function formatDate(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d) {
    if (!d) return '-';
    const dt = new Date(d);
    return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncate(str, len) {
    if (!str) return '-';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

// === INIT ===
navigate('dashboard');
