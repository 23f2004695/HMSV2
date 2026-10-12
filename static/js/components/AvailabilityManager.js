// "Paint your week": drag across the grid to mark working hours, then save.
const PAINT_START = 7 * 60;   // 07:00
const PAINT_END = 21 * 60;    // 21:00
const PAINT_STEP = 30;

function toHHMM(m) {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

function toMin(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

window.AvailabilityManager = {
    template: `
        <div>
            <div class="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                <div>
                    <h3 class="fw-bold mb-1">Paint your week</h3>
                    <p class="text-muted mb-0">Click and drag over the grid to mark when you're in. Drag over painted hours to clear them.</p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-secondary" @click="preset('weekdays')">Mon-Fri 9-5</button>
                        <button class="btn btn-outline-secondary" @click="preset('mornings')">Mornings 9-1</button>
                        <button class="btn btn-outline-secondary" @click="preset('clear')">Clear all</button>
                    </div>
                    <button class="btn btn-primary" :disabled="!dirty || saving" @click="save">
                        <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                        <i v-else class="bi bi-cloud-check me-1"></i>{{ dirty ? 'Save changes' : 'Saved' }}
                    </button>
                </div>
            </div>

            <div class="d-flex flex-wrap gap-3 small text-muted mb-2">
                <span><span class="legend painted"></span> Available</span>
                <span><span class="legend booked"></span> Booked appointment</span>
                <span><span class="legend"></span> Off</span>
                <span class="ms-auto">{{ totalHours }} hours this week</span>
            </div>

            <app-loader v-if="loading" text="Loading your diary..."></app-loader>
            <div v-else class="card">
                <div class="paint-scroll">
                    <div class="paint-grid" :style="{ gridTemplateColumns: '64px repeat(' + days.length + ', minmax(84px, 1fr))' }"
                         @pointerdown.prevent="startPaint" @pointermove="movePaint" @pointerleave="hoverCell = null">
                        <div class="paint-corner"></div>
                        <div v-for="d in days" :key="d" class="paint-day" :class="{ today: d === store.todayStr }">
                            <div class="small text-uppercase">{{ dow(d) }}</div>
                            <div class="fw-bold">{{ d.slice(8) }}</div>
                            <div class="paint-hours">{{ hoursOn(d) }}h</div>
                        </div>
                        <template v-for="m in rows" :key="m">
                            <div class="paint-time">{{ m % 60 === 0 ? label(m) : '' }}</div>
                            <div v-for="d in days" :key="d + m" class="paint-cell"
                                 :class="{ on: isOn(d, m), booked: isBooked(d, m), past: isPast(d, m), hour: m % 60 === 0 }"
                                 :data-day="d" :data-min="m" :title="cellTitle(d, m)">
                                <span v-if="isBooked(d, m)" class="booked-dot"></span>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            doctorId: null,
            days: [],
            painted: {},     // 'YYYY-MM-DD' -> Set of minute offsets
            booked: {},      // 'YYYY-MM-DD HH:MM' -> patient name
            painting: null,  // true = adding, false = erasing
            dirty: false,
            saving: false,
            loading: true,
            hoverCell: null
        };
    },
    computed: {
        rows() {
            const r = [];
            for (let m = PAINT_START; m < PAINT_END; m += PAINT_STEP) r.push(m);
            return r;
        },
        totalHours() {
            return Object.values(this.painted).reduce((sum, set) => sum + set.size, 0) * PAINT_STEP / 60;
        }
    },
    async created() {
        try {
            const me = await this.store.api('/auth/me');
            this.doctorId = me.doctor && me.doctor.id;
            await Promise.all([this.loadWeek(), this.store.loadAppointments()]);
            for (const a of this.store.appointments) {
                if (a.status === 'Booked') this.booked[a.date + ' ' + a.time] = a.patient_name;
            }
        } catch (e) {
            this.store.showAlert(e.message, 'danger');
        } finally {
            this.loading = false;
        }
        window.addEventListener('pointerup', this.endPaint);
        window.addEventListener('beforeunload', this.warnUnsaved);
    },
    unmounted() {
        window.removeEventListener('pointerup', this.endPaint);
        window.removeEventListener('beforeunload', this.warnUnsaved);
    },
    methods: {
        async loadWeek() {
            const data = await this.store.api('/doctors/' + this.doctorId + '/slots');
            this.days = data.days.map(d => d.date);
            const painted = {};
            for (const d of data.days) {
                painted[d.date] = new Set();
                for (const [start, end] of d.windows) {
                    for (let m = toMin(start); m < toMin(end); m += PAINT_STEP) painted[d.date].add(m);
                }
            }
            this.painted = painted;
            this.dirty = false;
        },
        cellFromEvent(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            return el && el.classList.contains('paint-cell') ? { day: el.dataset.day, min: Number(el.dataset.min) } : null;
        },
        startPaint(e) {
            const cell = this.cellFromEvent(e);
            if (!cell || this.isPast(cell.day, cell.min)) return;
            this.painting = !this.isOn(cell.day, cell.min);
            this.apply(cell);
        },
        movePaint(e) {
            if (this.painting === null) return;
            const cell = this.cellFromEvent(e);
            if (cell) this.apply(cell);
        },
        endPaint() {
            this.painting = null;
        },
        apply({ day, min }) {
            if (this.isPast(day, min)) return;
            const set = new Set(this.painted[day] || []);
            if (this.painting) set.add(min); else set.delete(min);
            if (set.size !== (this.painted[day] || new Set()).size) {
                this.painted = { ...this.painted, [day]: set };
                this.dirty = true;
            }
        },
        preset(kind) {
            const next = {};
            for (const d of this.days) {
                const set = new Set();
                const weekday = new Date(d + 'T00:00').getDay();
                if (kind === 'weekdays' && weekday >= 1 && weekday <= 5) {
                    for (let m = 9 * 60; m < 17 * 60; m += PAINT_STEP) set.add(m);
                }
                if (kind === 'mornings') {
                    for (let m = 9 * 60; m < 13 * 60; m += PAINT_STEP) set.add(m);
                }
                // never wipe hours that are already in the past today
                for (const m of this.painted[d] || []) if (this.isPast(d, m)) set.add(m);
                next[d] = set;
            }
            this.painted = next;
            this.dirty = true;
        },
        rangesFor(day) {
            const mins = [...(this.painted[day] || [])].sort((a, b) => a - b);
            const ranges = [];
            for (const m of mins) {
                const last = ranges[ranges.length - 1];
                if (last && last[1] === m) last[1] = m + PAINT_STEP;
                else ranges.push([m, m + PAINT_STEP]);
            }
            return ranges.map(([s, e]) => [toHHMM(s), toHHMM(Math.min(e, 23 * 60 + 59))]);
        },
        async save() {
            this.saving = true;
            try {
                const days = {};
                for (const d of this.days) days[d] = this.rangesFor(d);
                await this.store.api('/doctors/' + this.doctorId + '/availability/week', 'PUT', { days });
                this.dirty = false;
                this.store.showAlert('Your week is saved. Patients can book these hours now.', 'success');
                this.store.pulse();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            } finally {
                this.saving = false;
            }
        },
        warnUnsaved(e) {
            if (this.dirty) { e.preventDefault(); e.returnValue = ''; }
        },
        isOn(day, min) { return !!(this.painted[day] && this.painted[day].has(min)); },
        isBooked(day, min) { return !!this.booked[day + ' ' + toHHMM(min)]; },
        isPast(day, min) {
            if (day > this.store.todayStr) return false;
            if (day < this.store.todayStr) return true;
            const now = new Date();
            return min + PAINT_STEP <= now.getHours() * 60 + now.getMinutes();
        },
        hoursOn(day) { return ((this.painted[day] || new Set()).size * PAINT_STEP / 60); },
        label(m) { return toHHMM(m); },
        dow(d) { return d === this.store.todayStr ? 'Today' : new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' }); },
        cellTitle(day, min) {
            const who = this.booked[day + ' ' + toHHMM(min)];
            return toHHMM(min) + (who ? ' - booked by ' + who : '');
        }
    }
};
