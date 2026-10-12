// Week heatmap + time grid for one doctor. Polls for changes so slots someone else
// books while you're looking fade out with a "just taken" label.
window.SlotPicker = {
    props: {
        doctorId: { type: Number, required: true },
        modelValue: { type: Object, default: () => ({ date: '', time: '' }) },
        active: { type: Boolean, default: true }
    },
    emits: ['update:modelValue'],
    template: `
        <div class="slot-picker">
            <app-loader v-if="loading" text="Checking the doctor's diary..."></app-loader>
            <template v-else>
                <div class="week-strip mb-3" role="listbox" aria-label="Pick a day">
                    <button v-for="d in days" :key="d.date" type="button" class="day-chip"
                            :class="{ selected: d.date === modelValue.date, empty: !d.slots.length }"
                            :style="{ '--heat': heat(d) }" :disabled="!d.slots.length" @click="pickDay(d.date)">
                        <span class="dow">{{ dayName(d.date) }}</span>
                        <span class="dom">{{ d.date.slice(8) }}</span>
                        <span class="free">{{ d.slots.length ? d.slots.length + ' free' : 'full' }}</span>
                    </button>
                </div>
                <empty-state v-if="!anyFree" illo="doctor-tablet" title="Fully booked" text="No free slots in the next week. Try another doctor."></empty-state>
                <div v-else-if="currentDay">
                    <div class="d-flex justify-content-between align-items-baseline mb-2">
                        <div class="small fw-semibold">{{ longDate(currentDay.date) }}</div>
                        <div class="small text-muted"><span class="live-dot"></span> live</div>
                    </div>
                    <transition-group name="slot" tag="div" class="time-grid">
                        <button v-for="t in shownTimes" :key="currentDay.date + t" type="button" class="time-chip"
                                :class="{ selected: t === modelValue.time && currentDay.date === modelValue.date, taken: taken.has(currentDay.date + ' ' + t) }"
                                :aria-disabled="taken.has(currentDay.date + ' ' + t)" @click="!taken.has(currentDay.date + ' ' + t) && pickTime(t)">
                            {{ t }}<span v-if="taken.has(currentDay.date + ' ' + t)" class="taken-label">just taken</span>
                        </button>
                    </transition-group>
                </div>
            </template>
        </div>
    `,
    data() {
        return { days: [], loading: true, timer: null, taken: new Set() };
    },
    computed: {
        currentDay() {
            return this.days.find(d => d.date === this.modelValue.date) || null;
        },
        anyFree() {
            return this.days.some(d => d.slots.length);
        },
        maxFree() {
            return Math.max(1, ...this.days.map(d => d.slots.length));
        },
        shownTimes() {
            if (!this.currentDay) return [];
            const taken = [...this.taken].filter(k => k.startsWith(this.currentDay.date)).map(k => k.slice(11));
            return [...new Set([...this.currentDay.slots, ...taken])].sort();
        }
    },
    watch: {
        doctorId: { handler() { this.load(true); }, immediate: true },
        active(val) { val ? this.startPolling() : this.stopPolling(); }
    },
    unmounted() {
        this.stopPolling();
    },
    methods: {
        async load(first = false) {
            if (first) { this.loading = true; this.taken = new Set(); }
            try {
                const data = await window.store.api('/doctors/' + this.doctorId + '/slots');
                if (!first) this.markTaken(data.days);
                this.days = data.days;
                if (first) {
                    const firstFree = this.days.find(d => d.slots.length);
                    const preset = this.days.find(d => d.date === this.modelValue.date);
                    if (!preset && firstFree) {
                        this.pickDay(firstFree.date);
                    } else if (preset && this.modelValue.time && !preset.slots.includes(this.modelValue.time)) {
                        // a time asked for in the command palette that isn't free
                        window.store.showAlert(this.modelValue.time + ' is not free that day. Here are the times that are.', 'warning');
                        this.$emit('update:modelValue', { date: preset.date, time: '' });
                    }
                    this.startPolling();
                }
            } catch (e) {
                if (first) this.days = [];
            } finally {
                this.loading = false;
            }
        },
        // Anything that disappeared since the last poll was booked by someone else
        markTaken(newDays) {
            const next = new Set(this.taken);
            for (const old of this.days) {
                const fresh = newDays.find(d => d.date === old.date);
                for (const t of old.slots) {
                    if (fresh && !fresh.slots.includes(t)) next.add(old.date + ' ' + t);
                }
            }
            if (next.size !== this.taken.size) {
                this.taken = next;
                if (this.taken.has(this.modelValue.date + ' ' + this.modelValue.time)) {
                    this.$emit('update:modelValue', { date: this.modelValue.date, time: '' });
                    window.store.showAlert('Someone just booked the slot you picked. Please choose another.', 'warning');
                }
            }
        },
        startPolling() {
            this.stopPolling();
            if (this.active) this.timer = setInterval(() => this.load(false), 5000);
        },
        stopPolling() {
            clearInterval(this.timer);
            this.timer = null;
        },
        pickDay(date) {
            this.$emit('update:modelValue', { date, time: '' });
        },
        pickTime(time) {
            this.$emit('update:modelValue', { date: this.modelValue.date, time });
        },
        heat(d) {
            return (d.slots.length / this.maxFree).toFixed(2);
        },
        dayName(iso) {
            const d = new Date(iso + 'T00:00');
            return iso === window.store.todayStr ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
        },
        longDate(iso) {
            return new Date(iso + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        }
    }
};
