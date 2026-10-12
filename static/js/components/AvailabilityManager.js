// "My Week": doctors paint the hours they're in with a brush, rub them out with an eraser, then save.
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

const SHIFT_PRESETS = [
    { id: 'morning', label: 'Morning', hours: '09:00 - 13:00', start: 9 * 60, end: 13 * 60, illo: 'nurse-notes', weekdaysOnly: false },
    { id: 'afternoon', label: 'Afternoon', hours: '14:00 - 18:00', start: 14 * 60, end: 18 * 60, illo: 'doctor-tablet', weekdaysOnly: false },
    { id: 'fullday', label: 'Full day', hours: '09:00 - 17:00', start: 9 * 60, end: 17 * 60, illo: 'doctor-standing', weekdaysOnly: false },
    { id: 'weekdays', label: 'Weekdays only', hours: 'Mon - Fri, 09:00 - 17:00', start: 9 * 60, end: 17 * 60, illo: 'medic-kit', weekdaysOnly: true }
];

window.AvailabilityManager = {
    template: `
        <div class="my-week">
            <!-- Guide -->
            <div class="week-hero mb-4">
                <illo class="week-guide" name="doctor-tablet" float hint
                      :tips="['Pick the brush, then drag down a day.', 'Made a mistake? Switch to the eraser.', 'Nothing is saved until you press Save.']"></illo>
                <div class="flex-grow-1">
                    <h3 class="fw-bold mb-1">My week</h3>
                    <p class="text-muted mb-3">Paint the hours you're in. Patients can only book 30-minute slots inside them.</p>
                    <ol class="week-steps">
                        <li :class="{ done: totalHours > 0 }"><span class="step-dot">1</span><i class="bi bi-brush"></i> Drag down a day to paint hours</li>
                        <li :class="{ done: usedEraser }"><span class="step-dot">2</span><i class="bi bi-eraser"></i> Use the eraser to clear them</li>
                        <li :class="{ done: savedOnce }"><span class="step-dot">3</span><i class="bi bi-cloud-check"></i> Save so patients can book</li>
                    </ol>
                </div>
                <div class="week-stats">
                    <div><span class="num">{{ totalHours }}</span><span>hours open</span></div>
                    <div><span class="num">{{ freeSlots }}</span><span>free slots</span></div>
                    <div><span class="num">{{ bookedCount }}</span><span>booked</span></div>
                </div>
            </div>

            <!-- Shift presets -->
            <div class="d-flex justify-content-between align-items-end mb-2">
                <h6 class="fw-bold mb-0">Quick shifts <span class="text-muted fw-semibold small">apply to every day this week</span></h6>
                <button class="btn btn-sm btn-outline-danger text-nowrap" @click="clearWeek"><i class="bi bi-trash3 me-1"></i>Clear week</button>
            </div>
            <div class="shift-row mb-4">
                <button v-for="p in presets" :key="p.id" class="shift-card" @click="applyPreset(p)">
                    <img :src="'/static/img/illos/' + p.illo + '.webp'" alt="">
                    <span class="text-start flex-grow-1">
                        <span class="shift-label d-block">{{ p.label }}</span>
                        <span class="shift-hours d-block">{{ p.hours }}</span>
                    </span>
                    <i class="bi bi-plus-circle-fill shift-add"></i>
                </button>
            </div>

            <app-loader v-if="loading" text="Opening your diary"></app-loader>
            <div v-else class="card week-card">
                <!-- Toolbar -->
                <div class="week-toolbar">
                    <div class="tool-switch" role="radiogroup" aria-label="Tool">
                        <button :class="{ active: tool === 'brush' }" @click="tool = 'brush'" role="radio" :aria-checked="tool === 'brush'">
                            <i class="bi bi-brush-fill"></i> Brush
                        </button>
                        <button :class="{ active: tool === 'eraser' }" @click="tool = 'eraser'" role="radio" :aria-checked="tool === 'eraser'">
                            <i class="bi bi-eraser-fill"></i> Eraser
                        </button>
                    </div>
                    <div class="legend-row">
                        <span><span class="legend painted"></span>Open for booking</span>
                        <span><span class="legend booked"></span>Booked</span>
                        <span><span class="legend past"></span>Past</span>
                        <span><span class="legend now"></span>Now</span>
                    </div>
                    <div class="save-group" :class="{ dirty }">
                        <span v-if="dirty" class="unsaved"><span class="unsaved-dot"></span>Unsaved changes</span>
                        <span v-else class="saved-note"><i class="bi bi-check2-circle"></i> All changes saved</span>
                        <button v-if="dirty" class="btn btn-sm btn-outline-secondary" @click="discard" :disabled="saving">Discard</button>
                        <button class="btn btn-sm btn-primary" @click="save" :disabled="saving || !dirty">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            <i v-else class="bi bi-cloud-check me-1"></i>Save changes
                        </button>
                    </div>
                </div>

                <div class="paint-scroll" ref="scroll">
                    <div class="paint-grid" :class="'tool-' + tool" :style="{ gridTemplateColumns: '64px repeat(' + days.length + ', minmax(96px, 1fr))' }"
                         @pointerdown.prevent="startPaint" @pointermove="movePaint">
                        <div class="paint-corner"></div>
                        <div v-for="d in days" :key="d" class="paint-day" :class="{ today: d === store.todayStr, weekend: isWeekend(d) }">
                            <div class="day-name">{{ dow(d) }}</div>
                            <div class="day-num">{{ d.slice(8) }}</div>
                            <div class="day-hours">
                                <span class="day-bar"><span :style="{ width: Math.min(100, hoursOn(d) / 8 * 100) + '%' }"></span></span>
                                {{ hoursOn(d) }}h
                            </div>
                            <div class="day-actions">
                                <button title="Copy this day to every weekday" @click.stop="copyToWeekdays(d)" @pointerdown.stop><i class="bi bi-files"></i></button>
                                <button title="Clear this day" @click.stop="clearDay(d)" @pointerdown.stop><i class="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <template v-for="m in rows" :key="m">
                            <div class="paint-time" :class="{ hour: m % 60 === 0, first: m === rows[0] }">{{ m % 60 === 0 ? label(m) : '' }}</div>
                            <div v-for="d in days" :key="d + m" class="paint-cell"
                                 :class="cellClass(d, m)" :data-day="d" :data-min="m" :title="cellTitle(d, m)">
                                <span v-if="blockLabel(d, m)" class="block-label">{{ blockLabel(d, m) }}</span>
                                <span v-if="isBooked(d, m)" class="booked-chip" :style="{ background: store.avatarColor(booked[d + ' ' + label(m)]) }">
                                    {{ store.initials(booked[d + ' ' + label(m)]) }}
                                </span>
                                <span v-if="nowOffset(d, m) !== null" class="now-line" :style="{ top: nowOffset(d, m) + '%' }"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Empty week coach mark -->
                <transition name="page">
                    <div v-if="totalHours === 0 && !painting" class="coach">
                        <div class="coach-hand"><i class="bi bi-hand-index-thumb-fill"></i></div>
                        <div><strong>Your week is empty.</strong> Drag down a day with the brush, or pick a quick shift above.</div>
                    </div>
                </transition>
            </div>

            <!-- Live readout while dragging -->
            <div v-if="painting !== null && dragInfo" class="paint-tip" :style="{ left: tipX + 'px', top: tipY + 'px' }">
                <i class="bi" :class="tool === 'brush' ? 'bi-brush-fill' : 'bi-eraser-fill'"></i> {{ dragInfo }}
            </div>

        </div>
    `,
    data() {
        return {
            store: window.store,
            doctorId: null,
            days: [],
            painted: {},     // 'YYYY-MM-DD' -> Set of minute offsets
            saved: {},       // last saved copy, for Discard
            booked: {},      // 'YYYY-MM-DD HH:MM' -> patient name
            tool: 'brush',
            painting: null,  // true = adding, false = erasing, null = not dragging
            dragStart: null,
            dragNow: null,
            tipX: 0,
            tipY: 0,
            dirty: false,
            saving: false,
            loading: true,
            usedEraser: false,
            savedOnce: false,
            now: new Date(),
            presets: SHIFT_PRESETS,
            clock: null
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
        },
        bookedCount() {
            return Object.keys(this.booked).filter(k => this.days.includes(k.slice(0, 10))).length;
        },
        freeSlots() {
            let free = 0;
            for (const d of this.days) {
                for (const m of this.painted[d] || []) {
                    if (!this.isPast(d, m) && !this.isBooked(d, m)) free++;
                }
            }
            return free;
        },
        dragInfo() {
            if (!this.dragStart || !this.dragNow) return '';
            const a = this.dragStart, b = this.dragNow;
            const day = new Date(b.day + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' });
            if (a.day !== b.day) return (this.tool === 'brush' ? 'Painting ' : 'Erasing ') + day + ' ' + this.label(b.min);
            const lo = Math.min(a.min, b.min), hi = Math.max(a.min, b.min) + PAINT_STEP;
            return `${day} ${this.label(lo)} - ${this.label(hi)} (${(hi - lo) / 60}h)`;
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
        this.clock = setInterval(() => { this.now = new Date(); }, 60000);
    },
    unmounted() {
        window.removeEventListener('pointerup', this.endPaint);
        window.removeEventListener('beforeunload', this.warnUnsaved);
        clearInterval(this.clock);
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
            this.saved = this.copyOf(painted);
            this.dirty = false;
        },
        copyOf(painted) {
            const out = {};
            for (const [d, set] of Object.entries(painted)) out[d] = new Set(set);
            return out;
        },

        // painting
        cellFromEvent(e) {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const cell = el && el.closest && el.closest('.paint-cell');
            return cell ? { day: cell.dataset.day, min: Number(cell.dataset.min) } : null;
        },
        startPaint(e) {
            const cell = this.cellFromEvent(e);
            if (!cell || this.isPast(cell.day, cell.min)) return;
            this.painting = this.tool === 'brush';
            if (!this.painting) this.usedEraser = true;
            this.dragStart = cell;
            this.dragNow = cell;
            this.moveTip(e);
            this.apply(cell);
        },
        movePaint(e) {
            if (this.painting === null) return;
            this.moveTip(e);
            const cell = this.cellFromEvent(e);
            if (!cell) return;
            this.dragNow = cell;
            // fill the whole stretch in this column so fast drags don't leave gaps
            if (cell.day === this.dragStart.day) {
                const lo = Math.min(cell.min, this.dragStart.min), hi = Math.max(cell.min, this.dragStart.min);
                for (let m = lo; m <= hi; m += PAINT_STEP) this.apply({ day: cell.day, min: m });
            } else {
                this.apply(cell);
            }
        },
        moveTip(e) {
            this.tipX = e.clientX + 16;
            this.tipY = e.clientY + 16;
        },
        endPaint() {
            this.painting = null;
            this.dragStart = null;
            this.dragNow = null;
        },
        apply({ day, min }) {
            if (this.isPast(day, min)) return;
            const current = this.painted[day] || new Set();
            if (current.has(min) === this.painting) return;
            const set = new Set(current);
            if (this.painting) set.add(min); else set.delete(min);
            this.painted = { ...this.painted, [day]: set };
            this.dirty = true;
        },

        // quick actions
        applyPreset(p, message) {
            const next = {};
            for (const d of this.days) {
                const set = new Set([...(this.painted[d] || [])].filter(m => this.isPast(d, m)));
                if (!p.weekdaysOnly || !this.isWeekend(d)) {
                    for (let m = p.start; m < p.end; m += PAINT_STEP) if (!this.isPast(d, m)) set.add(m);
                }
                next[d] = set;
            }
            this.painted = next;
            this.dirty = true;
            this.store.showAlert(message || p.label + ' shift added to every day. Press Save to publish it.', 'info');
        },
        clearWeek() {
            this.applyPreset({ start: 0, end: 0, weekdaysOnly: false }, 'Week cleared. Press Save to publish it.');
        },
        clearDay(day) {
            const set = new Set([...(this.painted[day] || [])].filter(m => this.isPast(day, m)));
            this.painted = { ...this.painted, [day]: set };
            this.dirty = true;
        },
        copyToWeekdays(day) {
            const source = [...(this.painted[day] || [])];
            if (!source.length) {
                this.store.showAlert('Paint some hours on that day first.', 'warning');
                return;
            }
            const next = { ...this.painted };
            for (const d of this.days) {
                if (d === day || this.isWeekend(d)) continue;
                const set = new Set([...(this.painted[d] || [])].filter(m => this.isPast(d, m)));
                for (const m of source) if (!this.isPast(d, m)) set.add(m);
                next[d] = set;
            }
            this.painted = next;
            this.dirty = true;
            this.store.showAlert('Copied ' + this.dow(day) + "'s hours to the other weekdays.", 'info');
        },
        discard() {
            this.painted = this.copyOf(this.saved);
            this.dirty = false;
        },
        rangesFor(day) {
            const mins = [...(this.painted[day] || [])].sort((a, b) => a - b);
            const ranges = [];
            for (const m of mins) {
                const last = ranges[ranges.length - 1];
                if (last && last[1] === m) last[1] = m + PAINT_STEP;
                else ranges.push([m, m + PAINT_STEP]);
            }
            return ranges;
        },
        async save() {
            this.saving = true;
            try {
                const days = {};
                for (const d of this.days) {
                    days[d] = this.rangesFor(d).map(([s, e]) => [toHHMM(s), toHHMM(Math.min(e, 23 * 60 + 59))]);
                }
                await this.store.api('/doctors/' + this.doctorId + '/availability/week', 'PUT', { days });
                this.saved = this.copyOf(this.painted);
                this.dirty = false;
                this.savedOnce = true;
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

        // display helpers
        isOn(day, min) { return !!(this.painted[day] && this.painted[day].has(min)); },
        isBooked(day, min) { return !!this.booked[day + ' ' + toHHMM(min)]; },
        isPast(day, min) {
            if (day > this.store.todayStr) return false;
            if (day < this.store.todayStr) return true;
            return min + PAINT_STEP <= this.now.getHours() * 60 + this.now.getMinutes();
        },
        isWeekend(day) {
            const wd = new Date(day + 'T00:00').getDay();
            return wd === 0 || wd === 6;
        },
        cellClass(d, m) {
            const on = this.isOn(d, m);
            return {
                on,
                'block-start': on && !this.isOn(d, m - PAINT_STEP),
                'block-end': on && !this.isOn(d, m + PAINT_STEP),
                booked: this.isBooked(d, m),
                past: this.isPast(d, m),
                hour: m % 60 === 0,
                today: d === this.store.todayStr
            };
        },
        // "09:00 - 13:00" written into the first cell of each painted block
        blockLabel(d, m) {
            if (!this.isOn(d, m) || this.isOn(d, m - PAINT_STEP)) return '';
            let end = m;
            while (this.isOn(d, end)) end += PAINT_STEP;
            const hours = (end - m) / 60;
            return hours >= 1 ? `${toHHMM(m)} - ${toHHMM(end)}` : toHHMM(m);
        },
        nowOffset(d, m) {
            if (d !== this.store.todayStr) return null;
            const mins = this.now.getHours() * 60 + this.now.getMinutes();
            if (mins < m || mins >= m + PAINT_STEP) return null;
            return ((mins - m) / PAINT_STEP) * 100;
        },
        hoursOn(day) { return ((this.painted[day] || new Set()).size * PAINT_STEP / 60); },
        label(m) { return toHHMM(m); },
        dow(d) { return d === this.store.todayStr ? 'Today' : new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' }); },
        cellTitle(day, min) {
            const who = this.booked[day + ' ' + toHHMM(min)];
            return toHHMM(min) + ' - ' + toHHMM(min + PAINT_STEP) + (who ? ' (booked by ' + who + ')' : '');
        }
    }
};
