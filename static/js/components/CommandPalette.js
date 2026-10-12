// Ctrl/Cmd + K palette. Understands short commands like "book cardiology tomorrow at 10",
// "cancel my next", "call next", "add slot friday 9-1" or "patient rahul", and takes voice input.
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function localIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// "today", "tomorrow", "fri", "friday" -> YYYY-MM-DD within the next week
function parseDay(text) {
    const t = text.toLowerCase();
    const d = new Date();
    if (/\btoday\b/.test(t)) return localIso(d);
    if (/\btomorrow\b|\btmrw\b/.test(t)) { d.setDate(d.getDate() + 1); return localIso(d); }
    for (let i = 0; i < 7; i++) {
        const name = WEEKDAYS[i];
        if (new RegExp('\\b(' + name + '|' + name.slice(0, 3) + ')\\b').test(t)) {
            const diff = (i - d.getDay() + 7) % 7;
            d.setDate(d.getDate() + diff);
            return localIso(d);
        }
    }
    return '';
}

// "at 10", "10am", "3 pm", "15:30" -> HH:MM
function parseTime(text) {
    const m = text.toLowerCase().match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (!m || !/at\s|am|pm|:/.test(m[0])) return '';
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    if (!m[3] && h >= 1 && h <= 7) h += 12;   // "at 3" almost always means the afternoon
    if (h > 23 || min > 59) return '';
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

// "9-1", "9 to 5", "14:00-18:00" -> ['09:00', '13:00']
function parseRange(text) {
    const m = text.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(?:-|to|–)\s*(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    let a = Number(m[1]), b = Number(m[3]);
    if (b <= a && b <= 12) b += 12;
    const fmt = (h, mm) => String(h).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0');
    if (b > 23) return null;
    return [fmt(a, m[2]), fmt(b, m[4])];
}

window.CommandPalette = {
    emits: ['book', 'view-history'],
    template: `
        <transition name="palette">
            <div v-if="open" class="palette-backdrop" @mousedown.self="close">
                <div class="palette" role="dialog" aria-label="Command palette">
                    <div class="palette-input">
                        <i class="bi bi-search"></i>
                        <input ref="input" v-model="query" :placeholder="placeholder" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)"
                               @keydown.enter.prevent="run(results[active])" @keydown.esc="close" aria-label="Command">
                        <button v-if="voiceSupported" class="mic" :class="{ listening }" @click="listen" :title="listening ? 'Listening...' : 'Speak a command'">
                            <i class="bi" :class="listening ? 'bi-mic-fill' : 'bi-mic'"></i>
                        </button>
                        <span class="kbd-hint">Esc</span>
                    </div>
                    <div v-if="listening" class="palette-listening"><img src="/static/img/illos/nurse-wave.webp" alt=""><span>Listening... try "{{ examples[0] }}"</span></div>
                    <ul class="palette-results">
                        <li v-for="(r, i) in results" :key="r.id" :class="{ active: i === active }" @mouseenter="active = i" @click="run(r)">
                            <i class="bi" :class="r.icon"></i>
                            <div class="flex-grow-1">
                                <div>{{ r.title }}</div>
                                <div class="small text-muted" v-if="r.hint">{{ r.hint }}</div>
                            </div>
                            <span v-if="r.badge" class="badge bg-primary-subtle text-primary">{{ r.badge }}</span>
                            <i class="bi bi-arrow-return-left text-muted small" v-if="i === active"></i>
                        </li>
                        <li v-if="!results.length" class="text-muted small no-hover">No matching command. Try one of the examples below.</li>
                    </ul>
                    <div class="palette-foot small text-muted">
                        <span>Try:</span>
                        <a href="#" v-for="ex in examples" :key="ex" @click.prevent="query = ex">{{ ex }}</a>
                    </div>
                </div>
            </div>
        </transition>
    `,
    data() {
        return {
            store: window.store,
            open: false,
            query: '',
            active: 0,
            listening: false,
            people: [],
            voiceSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
        };
    },
    computed: {
        role() { return this.store.user.role; },
        placeholder() {
            return { patient: 'Book, cancel, go to a page...', doctor: 'Call next, add slots, go to a page...', admin: 'Find a patient or doctor, go to a page...' }[this.role] || 'Type a command';
        },
        examples() {
            return {
                patient: ['book cardiology tomorrow at 10', 'cancel my next', 'my journey'],
                doctor: ['call next', 'add slot friday 9-1', 'my week'],
                admin: ['patient rahul', 'doctor mehta', 'lobby']
            }[this.role] || [];
        },
        pages() {
            const all = [
                { page: 'dashboard', title: 'Go to dashboard', icon: 'bi-grid-1x2', roles: ['admin', 'doctor', 'patient'] },
                { page: 'appointments', title: 'Go to appointments', icon: 'bi-calendar3', roles: ['admin', 'doctor', 'patient'] },
                { page: 'find-doctor', title: 'Book an appointment', icon: 'bi-plus-circle', roles: ['patient'] },
                { page: 'my-history', title: 'My journey', icon: 'bi-signpost-split', roles: ['patient'] },
                { page: 'availability', title: 'My week (availability)', icon: 'bi-calendar-week', roles: ['doctor'] },
                { page: 'doctors', title: 'Manage doctors', icon: 'bi-person-badge', roles: ['admin'] },
                { page: 'patients', title: 'Manage patients', icon: 'bi-people', roles: ['admin'] },
                { page: 'profile', title: 'My profile', icon: 'bi-person', roles: ['admin', 'doctor', 'patient'] }
            ];
            return all.filter(p => p.roles.includes(this.role)).map(p => ({ ...p, id: 'page-' + p.page, action: () => this.store.navigate(p.page) }));
        },
        results() {
            const q = this.query.trim().toLowerCase();
            const out = [...this.intents(q)];
            const simple = [
                ...this.pages,
                { id: 'lobby', title: 'Open the lobby screen', icon: 'bi-tv', action: () => window.open('/lobby', '_blank') },
                { id: 'logout', title: 'Log out', icon: 'bi-box-arrow-right', action: () => this.store.logout() }
            ];
            for (const c of simple) {
                if (!q || c.title.toLowerCase().includes(q) || q.split(' ').every(w => c.title.toLowerCase().includes(w))) out.push(c);
            }
            return out.slice(0, 8);
        }
    },
    watch: {
        query() { this.active = 0; this.lookupPeople(); },
        open(val) {
            if (val) this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
        }
    },
    mounted() {
        window.addEventListener('keydown', this.hotkey);
    },
    unmounted() {
        window.removeEventListener('keydown', this.hotkey);
    },
    methods: {
        hotkey(e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && this.store.isLoggedIn) {
                e.preventDefault();
                this.open ? this.close() : this.show();
            }
        },
        show(prefill = '') {
            // An open Bootstrap modal traps focus, so close it first and let the palette take over
            document.querySelectorAll('.modal.show').forEach(el => {
                const m = bootstrap.Modal.getInstance(el);
                if (m) m.hide();
            });
            this.query = prefill;
            this.open = true;
            // booking and cancelling by name need these
            if (this.role === 'patient') {
                if (!this.store.doctors.length) this.store.loadDoctors();
                this.store.loadAppointments();
            }
        },
        close() {
            this.open = false;
            this.listening = false;
        },
        move(step) {
            if (!this.results.length) return;
            this.active = (this.active + step + this.results.length) % this.results.length;
        },
        run(result) {
            if (!result) return;
            this.close();
            result.action();
        },

        // Turn free text into concrete actions for the current role
        *intents(q) {
            if (!q) return;
            const day = parseDay(q);
            const time = parseTime(q);
            if (this.role === 'patient' && /^(book|see|appointment|i need|need)/.test(q)) {
                const words = q.replace(/^(book|see|appointment with|appointment|i need|need)\s*(a|an|with)?\s*/, '');
                for (const d of this.matchDoctors(words).slice(0, 3)) {
                    yield {
                        id: 'book-' + d.id, icon: 'bi-calendar-plus',
                        title: `Book Dr. ${d.name}` + (day ? ` on ${this.dayLabel(day)}` : '') + (time ? ` at ${time}` : ''),
                        hint: d.department_name + ' · ' + d.room, badge: 'Book',
                        action: () => this.$emit('book', d, { date: day, time })
                    };
                }
            }
            if (this.role === 'patient' && /^cancel/.test(q)) {
                const upcoming = this.store.appointments.filter(a => this.store.isUpcoming(a))
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                const matches = upcoming.filter(a => (!day || a.date === day) && (!time || a.time === time));
                for (const a of (/next/.test(q) ? upcoming.slice(0, 1) : matches).slice(0, 3)) {
                    yield {
                        id: 'cancel-' + a.id, icon: 'bi-x-circle', badge: 'Cancel',
                        title: `Cancel Dr. ${a.doctor_name}, ${this.dayLabel(a.date)} at ${a.time}`, hint: 'Token ' + a.token,
                        action: () => this.cancel(a)
                    };
                }
            }
            if (this.role === 'doctor' && /call|next patient/.test(q)) {
                yield { id: 'call-next', title: 'Call the next patient in', icon: 'bi-megaphone', badge: 'Queue', action: () => this.callNext() };
            }
            if (this.role === 'doctor' && /^(add|open)\s*(slot|hours|availability)/.test(q)) {
                const range = parseRange(q);
                if (day && range) {
                    yield {
                        id: 'add-slot', icon: 'bi-calendar-plus', badge: 'My week',
                        title: `Open ${range[0]}-${range[1]} on ${this.dayLabel(day)}`,
                        action: () => this.addHours(day, range)
                    };
                }
            }
            if (this.role === 'admin' && /^(patient|doctor|find)\s+\S/.test(q)) {
                for (const p of this.people.slice(0, 5)) yield p;
            }
        },

        matchDoctors(words) {
            const w = words.toLowerCase().replace(/\b(today|tomorrow|at|on|for|dr\.?|doctor|\d{1,2}(:\d{2})?\s*(am|pm)?|mon|tue|wed|thu|fri|sat|sun)\w*\b/g, ' ').trim();
            const docs = this.store.doctors || [];
            if (!w) return docs;
            return docs.filter(d => w.split(/\s+/).some(t => t.length > 2 && (
                d.name.toLowerCase().includes(t) || (d.department_name || '').toLowerCase().includes(t) || (d.specialization || '').toLowerCase().includes(t)
            )));
        },
        dayLabel(iso) {
            if (iso === this.store.todayStr) return 'today';
            return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
        },

        // Admin search, debounced
        lookupPeople() {
            clearTimeout(this._t);
            const m = this.query.trim().match(/^(patient|doctor|find)\s+(.+)/i);
            if (this.role !== 'admin' || !m) { this.people = []; return; }
            this._t = setTimeout(async () => {
                try {
                    const type = m[1].toLowerCase() === 'find' ? 'all' : m[1].toLowerCase();
                    const res = await this.store.api('/search?type=' + type + '&q=' + encodeURIComponent(m[2]));
                    this.people = [
                        ...res.patients.map(p => ({ id: 'p' + p.id, icon: 'bi-person', title: p.name, hint: p.email + ' · ' + (p.phone || ''), badge: 'Patient',
                            action: () => this.$emit('view-history', p.id) })),
                        ...res.doctors.map(d => ({ id: 'd' + d.id, icon: 'bi-person-badge', title: 'Dr. ' + d.name, hint: d.department_name, badge: 'Doctor',
                            action: () => this.store.navigate('doctors') }))
                    ];
                } catch (e) { this.people = []; }
            }, 250);
        },

        async cancel(a) {
            if (!confirm(`Cancel your appointment with Dr. ${a.doctor_name} on ${a.date} at ${a.time}?`)) return;
            try {
                await this.store.api('/appointments/' + a.id + '/cancel', 'PUT');
                this.store.showAlert('Appointment cancelled', 'info');
                await this.store.loadAppointments();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async callNext() {
            try {
                const called = await this.store.api('/queue/next', 'POST', {});
                this.store.showAlert(`Calling ${called.token} (${called.patient_name}) to ${called.room}`, 'info');
                this.store.pulse();
                await this.store.loadAppointments();
            } catch (e) { this.store.showAlert(e.message, 'warning'); }
        },
        async addHours(day, [start, end]) {
            try {
                const doctorId = this.store.user.doctor && this.store.user.doctor.id;
                const week = await this.store.api('/doctors/' + doctorId + '/slots');
                const existing = (week.days.find(d => d.date === day) || { windows: [] }).windows;
                await this.store.api('/doctors/' + doctorId + '/availability/week', 'PUT', { days: { [day]: [...existing, [start, end]] } });
                this.store.showAlert(`Opened ${start}-${end} on ${this.dayLabel(day)}`, 'success');
                this.store.pulse();
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },

        listen() {
            const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!Rec || this.listening) return;
            const rec = new Rec();
            rec.lang = 'en-IN';
            rec.interimResults = true;
            this.listening = true;
            rec.onresult = e => {
                this.query = [...e.results].map(r => r[0].transcript).join(' ').toLowerCase().replace(/[.?!]/g, '');
            };
            rec.onerror = () => { this.listening = false; this.store.showAlert("Couldn't hear that. Check microphone permission.", 'warning'); };
            rec.onend = () => {
                this.listening = false;
                // run the top match straight away if it's a concrete action
                const top = this.results[0];
                if (top && top.badge) setTimeout(() => this.run(top), 400);
            };
            rec.start();
        }
    }
};
