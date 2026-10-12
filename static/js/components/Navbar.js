window.AppNavbar = {
    emits: ['open-palette'],
    template: `
        <nav class="navbar navbar-expand-lg hms-navbar" v-if="store.isLoggedIn">
            <div class="container-fluid">
                <a class="navbar-brand" href="#" @click.prevent="store.navigate('dashboard')">
                    <span class="brand-heart" :class="{ beat: spiking }"><i class="bi bi-heart-pulse-fill"></i></span> HMS
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-label="Menu">
                    <i class="bi bi-list fs-3"></i>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav" ref="menu" @click="closeMenu">
                    <ul class="navbar-nav me-auto gap-lg-1">
                        <li class="nav-item" v-for="link in links" :key="link.page">
                            <a class="nav-link" :class="{ active: store.currentPage === link.page }" href="#" @click.prevent="store.navigate(link.page)">
                                <i class="bi me-1" :class="link.icon"></i>{{ link.label }}
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="/lobby" target="_blank" rel="noopener" title="Open the waiting-room screen">
                                <i class="bi bi-tv me-1"></i>Lobby screen
                            </a>
                        </li>
                    </ul>
                    <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">
                        <button class="btn btn-sm btn-outline-secondary d-none d-lg-inline-flex align-items-center gap-2" @click="$emit('open-palette')">
                            <i class="bi bi-search"></i> Search or type a command <span class="kbd-hint">Ctrl K</span>
                        </button>
                        <div class="dropdown">
                            <a href="#" class="d-flex align-items-center gap-2 text-decoration-none" data-bs-toggle="dropdown" aria-expanded="false">
                                <span class="avatar" style="width:36px;height:36px;font-size:0.8rem" :style="{ background: store.avatarColor(store.user.name) }">{{ store.initials(store.user.name) }}</span>
                                <span class="d-lg-none d-xl-inline text-body small fw-semibold">{{ store.user.name }}</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end shadow">
                                <li class="px-3 py-2 small text-muted text-capitalize">{{ store.user.role }}</li>
                                <li><a class="dropdown-item" href="#" @click.prevent="store.navigate('profile')"><i class="bi bi-person me-2"></i>Profile</a></li>
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" @click.prevent="store.logout()"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    `,
    setup() {
        return { store: window.store };
    },
    data() {
        return { spiking: false };
    },
    watch: {
        // A booking (or similar) makes the logo heart beat
        'store.pulseKey'() {
            this.spiking = false;
            this.$nextTick(() => {
                this.spiking = true;
                clearTimeout(this._spikeTimer);
                this._spikeTimer = setTimeout(() => { this.spiking = false; }, 2700);
            });
        }
    },
    computed: {
        links() {
            const role = this.store.user.role;
            const all = [
                { page: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2', roles: ['admin', 'doctor', 'patient'] },
                { page: 'doctors', label: 'Doctors', icon: 'bi-person-badge', roles: ['admin'] },
                { page: 'patients', label: 'Patients', icon: 'bi-people', roles: ['admin'] },
                { page: 'appointments', label: 'Appointments', icon: 'bi-calendar3', roles: ['admin', 'doctor', 'patient'] },
                { page: 'find-doctor', label: 'Book', icon: 'bi-plus-circle', roles: ['patient'] },
                { page: 'availability', label: 'My Week', icon: 'bi-calendar-week', roles: ['doctor'] },
                { page: 'my-history', label: 'My Journey', icon: 'bi-signpost-split', roles: ['patient'] }
            ];
            return all.filter(l => l.roles.includes(role));
        }
    },
    methods: {
        // On phones the menu stays open after picking a page unless we close it
        closeMenu(e) {
            if (e.target.closest('.nav-link') && this.$refs.menu.classList.contains('show')) {
                bootstrap.Collapse.getOrCreateInstance(this.$refs.menu).hide();
            }
        }
    }
};
