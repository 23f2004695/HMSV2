window.HeroGreeting = {
    props: {
        subtitle: { type: String, default: '' }
    },
    template: `
        <div class="hero-greeting mb-4">
            <div class="d-flex align-items-center gap-3 position-relative" style="z-index: 1">
                <span class="hero-icon"><i class="bi" :class="icon"></i></span>
                <div>
                    <h3>{{ greeting }}, {{ displayName }}</h3>
                    <p>{{ subtitle }}</p>
                </div>
                <div class="ms-auto d-none d-md-block text-end">
                    <div class="fw-semibold">{{ today }}</div>
                    <div class="small opacity-75">{{ clock }}</div>
                </div>
            </div>
            <ecg-line class="hero-ecg" :beats="3" :height="60"></ecg-line>
        </div>
    `,
    data() {
        return { store: window.store, now: new Date(), timer: null };
    },
    computed: {
        hour() { return this.now.getHours(); },
        greeting() {
            if (this.hour < 5) return 'Working late';
            if (this.hour < 12) return 'Good morning';
            if (this.hour < 17) return 'Good afternoon';
            return 'Good evening';
        },
        icon() {
            if (this.hour < 5 || this.hour >= 20) return 'bi-moon-stars-fill';
            if (this.hour < 12) return 'bi-sunrise-fill';
            if (this.hour < 17) return 'bi-sun-fill';
            return 'bi-sunset-fill';
        },
        displayName() {
            const u = this.store.user;
            const first = (u.name || '').split(' ')[0];
            if (u.role === 'doctor') return 'Dr. ' + (u.name || '').split(' ').slice(-1)[0];
            if (u.role === 'admin') return 'Admin';
            return first;
        },
        today() {
            return this.now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        },
        clock() {
            return this.now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        }
    },
    mounted() {
        this.timer = setInterval(() => { this.now = new Date(); }, 30000);
    },
    unmounted() {
        clearInterval(this.timer);
    }
};

window.StatTile = {
    props: {
        label: String,
        value: { type: Number, default: 0 },
        icon: String,
        color: { type: String, default: '#2563eb' },
        total: { type: Number, default: 0 }
    },
    template: `
        <div class="stat-tile">
            <div class="stat-icon" :style="{ background: color + '1f', color }"><i class="bi" :class="icon"></i></div>
            <div class="flex-grow-1">
                <div class="stat-value">{{ shown }}</div>
                <div class="stat-label">{{ label }}</div>
                <div class="stat-bar" v-if="total"><span :style="{ width: barWidth, background: color }"></span></div>
            </div>
        </div>
    `,
    data() {
        return { shown: 0, barWidth: '0%' };
    },
    watch: {
        value: { handler: 'animate', immediate: true },
        total() { this.animate(this.value); }
    },
    methods: {
        // Count up from the current number to the new one
        animate(target) {
            const start = this.shown;
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const duration = reduce ? 0 : 900;
            const begin = performance.now();
            const tick = now => {
                const p = duration ? Math.min(1, (now - begin) / duration) : 1;
                const eased = 1 - Math.pow(1 - p, 3);
                this.shown = Math.round(start + (target - start) * eased);
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            this.$nextTick(() => {
                setTimeout(() => {
                    this.barWidth = this.total ? Math.min(100, (target / this.total) * 100) + '%' : '0%';
                }, 50);
            });
        }
    }
};
