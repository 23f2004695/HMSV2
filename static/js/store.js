const { reactive } = Vue;

const store = reactive({
    //Auth State
    token: localStorage.getItem('hms_token') || '',
    user: JSON.parse(localStorage.getItem('hms_user') || '{}'),
    isLoggedIn: !!localStorage.getItem('hms_token'),

    //Navigation
    currentPage: 'dashboard',

    // Alert System
    alertMessage: '',
    alertType: 'success',
    _alertTimer: null,

    //Shared Data 
    departments: [],
    doctors: [],
    appointments: [],
    stats: {},

    //API Helper
    async api(url, method = 'GET', body = null) {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + store.token
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch('/api' + url, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    //Auth Actions
    setAuth(token, user) {
        store.token = token;
        store.user = user;
        store.isLoggedIn = true;
        localStorage.setItem('hms_token', token);
        localStorage.setItem('hms_user', JSON.stringify(user));
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
    },

    //Alert
    showAlert(message, type = 'success') {
        store.alertMessage = message;
        store.alertType = type;
        if (store._alertTimer) clearTimeout(store._alertTimer);
        store._alertTimer = setTimeout(() => { store.alertMessage = ''; }, 5000);
    },

    //Data Loaders
    async loadDepartments() {
        try {
            store.departments = await store.api('/departments');
        } catch (e) { console.error('Failed to load departments:', e); }
    },

    async loadDoctors(search = '', deptId = '') {
        try {
            let url = '/doctors?';
            if (search) url += 'search=' + encodeURIComponent(search) + '&';
            if (deptId) url += 'department_id=' + deptId;
            store.doctors = await store.api(url);
        } catch (e) { console.error('Failed to load doctors:', e); }
    },

    async loadAppointments(statusFilter = '') {
        try {
            let url = '/appointments';
            if (statusFilter) url += '?status=' + statusFilter;
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

    get todayStr() {
        return new Date().toISOString().split('T')[0];
    },

    get weekLaterStr() {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d.toISOString().split('T')[0];
    }
});

// store globally accessible for components
window.store = store;
