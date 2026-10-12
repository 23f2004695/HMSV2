// Greeting banner with a character for each role
const HERO_ART = {
    patient: { img: 'heart-scene', tips: ['Tap a ticket to flip it over.', 'Not feeling well? Try the body map.', 'Press Ctrl + K to book by typing.'] },
    doctor:  { img: 'ward-scene', tips: ['Call the next patient from the queue.', 'Paint your hours in My Week.', 'Patients see your free slots live.'] },
    admin:   { img: 'monitor-scene', tips: ['Everything at a glance.', 'Press Ctrl + K and type "patient" plus a name.', 'The lobby screen runs at /lobby.'] }
};

window.HeroGreeting = {
    props: {
        subtitle: { type: String, default: '' }
    },
    template: `
        <div class="hero-greeting mb-4">
            <div class="hero-text">
                <h3>{{ greeting }}, {{ displayName }}</h3>
                <p>{{ subtitle }}</p>
                <span class="hero-date"><i class="bi bi-calendar3"></i> {{ today }} <span class="opacity-50">&middot;</span> {{ clock }}</span>
                <slot></slot>
            </div>
            <illo class="hero-art" :name="art.img" :tips="art.tips" float hint pop></illo>
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
        art() {
            return HERO_ART[this.store.user.role] || HERO_ART.patient;
        },
        displayName() {
            const u = this.store.user;
            if (u.role === 'doctor') return 'Dr. ' + (u.name || '').split(' ').slice(-1)[0];
            if (u.role === 'admin') return 'Admin';
            return (u.name || '').split(' ')[0];
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
        color: { type: String, default: '#3b6fe0' },
        total: { type: Number, default: 0 },
        illo: { type: String, default: '' },
        tip: { type: String, default: '' }
    },
    template: `
        <div class="stat-tile" :class="{ 'has-illo': illo }">
            <illo v-if="illo" class="stat-illo" :name="illo" :tips="tip ? [tip] : []"></illo>
            <div v-else class="stat-icon" :style="{ background: color + '1f', color }"><i class="bi" :class="icon"></i></div>
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
