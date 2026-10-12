const { reactive } = Vue;

function readStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('hms_user') || '{}');
    } catch (e) {
        return {};
    }
}

// YYYY-MM-DD in the browser's local timezone (toISOString() would give the UTC date)
function localDateStr(d) {
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

const store = reactive({
    //Auth State
    token: localStorage.getItem('hms_token') || '',
    user: readStoredUser(),
    isLoggedIn: !!localStorage.getItem('hms_token'),

    //Navigation
    currentPage: 'dashboard',

    // Toasts (store.showAlert keeps its old signature)
    toasts: [],
    _toastId: 0,

    // Bumped to make the logo heart beat, e.g. after a booking
    pulseKey: 0,


    //Shared Data
    departments: [],
    doctors: [],
    appointments: [],
    stats: {},

    //API Helper
    async api(url, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (store.token) opts.headers['Authorization'] = 'Bearer ' + store.token;
        if (body) opts.body = JSON.stringify(body);

        let res;
        try {
            res = await fetch('/api' + url, opts);
        } catch (e) {
            throw new Error('Could not reach the server. Check your connection and try again.');
        }

        let data = null;
        try {
            data = await res.json();
        } catch (e) {
            data = null;
        }

        if (res.status === 401 && store.isLoggedIn) {
            store.logout();
            store.showAlert((data && data.error) || 'Your session has expired. Please log in again.', 'warning');
        }
        if (!res.ok) throw new Error((data && (data.error || data.msg)) || 'Request failed (' + res.status + ')');
        return data;
    },

    // Download a protected file (plain links can't send the auth header)
    async download(filename) {
        const res = await fetch('/api/download/' + encodeURIComponent(filename), {
            headers: { 'Authorization': 'Bearer ' + store.token }
        });
        if (!res.ok) {
            let message = 'Download failed';
            try { message = (await res.json()).error || message; } catch (e) { /* not JSON */ }
            throw new Error(message);
        }
        const url = URL.createObjectURL(await res.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    },

    //Auth Actions
    setAuth(token, user) {
        store.token = token;
        store.user = user;
        store.isLoggedIn = true;
        localStorage.setItem('hms_token', token);
        localStorage.setItem('hms_user', JSON.stringify(user));
    },

    updateUser(fields) {
        Object.assign(store.user, fields);
        localStorage.setItem('hms_user', JSON.stringify(store.user));
    },

    logout() {
        store.token = '';
        store.user = {};
        store.isLoggedIn = false;
        store.currentPage = 'dashboard';
        store.departments = [];
        store.doctors = [];
        store.appointments = [];
        store.stats = {};
        localStorage.removeItem('hms_token');
        localStorage.removeItem('hms_user');
    },

    //Navigation
    navigate(page) {
        store.currentPage = page;
        window.scrollTo(0, 0);
    },

    //Toasts
    showAlert(message, type = 'success') {
        const id = ++store._toastId;
        store.toasts.push({ id, message, type });
        if (store.toasts.length > 4) store.toasts.shift();
        setTimeout(() => store.dismissToast(id), 5000);
    },

    dismissToast(id) {
        store.toasts = store.toasts.filter(t => t.id !== id);
    },

    pulse() {
        store.pulseKey++;
    },

    celebrate() {
        if (!window.confetti || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const colors = ['#2563eb', '#e11d48', '#10b981', '#f59e0b', '#7c3aed'];
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 }, colors });
        setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors }), 250);
        setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors }), 400);
    },

    //Avatars
    initials(name) {
        return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    },

    avatarColor(name) {
        let hash = 0;
        for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) % 360;
        return `hsl(${hash}, 62%, 48%)`;
    },

    //Data Loaders
    async loadDepartments() {
        try {
            store.departments = await store.api('/departments');
        } catch (e) { console.error('Failed to load departments:', e); }
    },

    async loadDoctors(search = '', deptId = '') {
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (deptId) params.set('department_id', deptId);
            store.doctors = await store.api('/doctors?' + params.toString());
        } catch (e) { console.error('Failed to load doctors:', e); }
    },

    async loadAppointments(statusFilter = '') {
        try {
            let url = '/appointments';
            if (statusFilter) url += '?status=' + encodeURIComponent(statusFilter);
            store.appointments = await store.api(url);
        } catch (e) { console.error('Failed to load appointments:', e); }
    },

    async loadStats() {
        try {
            store.stats = await store.api('/admin/stats');
        } catch (e) { console.error('Failed to load stats:', e); }
    },

    //Helpers
    statusBadge(status) {
        if (status === 'Booked') return 'bg-warning text-dark';
        if (status === 'Completed') return 'bg-success';
        if (status === 'Cancelled') return 'bg-danger';
        return 'bg-secondary';
    },

    isUpcoming(appointment) {
        return appointment.status === 'Booked' && appointment.date >= store.todayStr;
    },

    get todayStr() {
        return localDateStr(new Date());
    },

    get weekLaterStr() {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return localDateStr(d);
    }
});

// store globally accessible for components
window.store = store;
