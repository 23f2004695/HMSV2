// An appointment as an airline-style boarding pass: tap to flip for prep notes,
// and on the day it shows your live place in the queue.
const PREP_NOTES = {
    'Cardiology': ['Bring any old ECGs or reports', 'Avoid caffeine for 4 hours before', 'List the medicines you take'],
    'Orthopedics': ['Bring X-rays or MRI scans if you have them', 'Wear loose clothing', 'Note when the pain started'],
    'Pediatrics': ["Bring the child's vaccination card", 'Carry a snack and water', 'Note temperature readings'],
    'Dermatology': ['Avoid makeup or creams on the area', 'Bring photos if the rash comes and goes', 'List products you use'],
    'Neurology': ['Keep a note of headache times', 'Bring previous scans', 'Come with someone if you feel dizzy'],
    'ENT': ['Note when symptoms started', 'Avoid ear drops on the day', 'Bring hearing test reports'],
    'Ophthalmology': ['Bring your glasses or lenses', "Don't drive after if eyes are dilated", 'Bring old prescriptions'],
    'General Medicine': ['Bring previous prescriptions', 'Note your symptoms and since when', 'Carry a water bottle']
};

window.BoardingPass = {
    props: {
        appointment: { type: Object, required: true },
        live: { type: Boolean, default: true }
    },
    template: `
        <div class="pass-wrap" :class="{ flipped }">
            <div class="pass" @click="flipped = !flipped" role="button" :aria-label="'Ticket ' + appointment.token + ', tap to flip'">
                <!-- FRONT -->
                <div class="pass-face pass-front">
                    <div class="pass-main">
                        <div class="pass-top">
                            <span class="pass-brand"><i class="bi bi-heart-pulse-fill"></i> HMS</span>
                            <span class="pass-kind">Appointment pass</span>
                        </div>
                        <div class="pass-route">
                            <div>
                                <div class="pass-label">Patient</div>
                                <div class="pass-big">{{ short(appointment.patient_name) }}</div>
                            </div>
                            <i class="bi bi-airplane-fill pass-plane"></i>
                            <div class="text-end">
                                <div class="pass-label">Doctor</div>
                                <div class="pass-big">Dr. {{ short(appointment.doctor_name) }}</div>
                            </div>
                        </div>
                        <div class="pass-grid">
                            <div><div class="pass-label">Date</div><div class="pass-val">{{ niceDate }}</div></div>
                            <div><div class="pass-label">Boarding</div><div class="pass-val">{{ appointment.time }}</div></div>
                            <div><div class="pass-label">Gate</div><div class="pass-val">{{ appointment.room }}</div></div>
                            <div><div class="pass-label">Dept</div><div class="pass-val">{{ appointment.department }}</div></div>
                        </div>
                    </div>
                    <div class="pass-stub">
                        <div class="pass-label">Token</div>
                        <div class="pass-token">{{ appointment.token }}</div>
                        <div class="pass-qr" ref="qr"></div>
                        <div class="pass-hint"><i class="bi bi-arrow-repeat"></i> tap to flip</div>
                    </div>
                </div>
                <!-- BACK -->
                <div class="pass-face pass-back">
                    <h6 class="fw-bold mb-2"><i class="bi bi-clipboard2-check me-1"></i> Before you come</h6>
                    <ul class="mb-2">
                        <li v-for="n in notes" :key="n">{{ n }}</li>
                        <li>Arrive 10 minutes before {{ appointment.time }}</li>
                    </ul>
                    <div v-if="appointment.reason" class="small"><span class="pass-label d-inline">Reason:</span> {{ appointment.reason }}</div>
                    <div class="pass-hint mt-auto"><i class="bi bi-arrow-repeat"></i> tap to flip back</div>
                </div>
            </div>

            <!-- LIVE STRIP -->
            <div v-if="live && appointment.status === 'Booked'" class="pass-live" :class="{ called: queue && queue.called }">
                <template v-if="queue && queue.today">
                    <div v-if="queue.called" class="d-flex align-items-center gap-2">
                        <span class="live-dot big"></span>
                        <strong>It's your turn! Please go to {{ queue.room }}.</strong>
                    </div>
                    <div v-else class="w-100">
                        <div class="d-flex justify-content-between small mb-1">
                            <span><span class="live-dot"></span> Now serving <strong>{{ queue.now_serving || '-' }}</strong></span>
                            <span>{{ queue.ahead === 0 ? "You're next!" : queue.ahead + ' ahead of you' }} &middot; ~{{ queue.estimated_wait_minutes }} min</span>
                        </div>
                        <div class="queue-dots">
                            <span v-for="i in Math.min(queue.ahead, 8)" :key="i" class="qd"></span>
                            <span class="qd you"><i class="bi bi-person-fill"></i></span>
                        </div>
                    </div>
                </template>
                <div v-else class="small"><i class="bi bi-hourglass-split me-1"></i> {{ countdown }}</div>
            </div>
        </div>
    `,
    data() {
        return { flipped: false, queue: null, now: Date.now(), timers: [] };
    },
    computed: {
        notes() {
            return PREP_NOTES[this.appointment.department] || PREP_NOTES['General Medicine'];
        },
        niceDate() {
            return new Date(this.appointment.date + 'T00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
        },
        countdown() {
            const start = new Date(this.appointment.date + 'T' + this.appointment.time);
            let mins = Math.round((start - this.now) / 60000);
            if (mins <= 0) return 'Your appointment time has arrived';
            const d = Math.floor(mins / 1440); mins -= d * 1440;
            const h = Math.floor(mins / 60); const m = mins % 60;
            return 'Boarding in ' + [d && d + 'd', h && h + 'h', m + 'm'].filter(Boolean).join(' ');
        }
    },
    mounted() {
        this.drawQr();
        if (this.live && this.appointment.status === 'Booked') {
            this.refresh();
            this.timers.push(setInterval(() => this.refresh(), 8000));
            this.timers.push(setInterval(() => { this.now = Date.now(); }, 30000));
        }
    },
    unmounted() {
        this.timers.forEach(clearInterval);
    },
    methods: {
        short(name) {
            const parts = (name || '').split(' ');
            return parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : name;
        },
        drawQr() {
            if (!window.QRCode || !this.$refs.qr) return;
            this.$refs.qr.innerHTML = '';
            new QRCode(this.$refs.qr, {
                text: 'HMS|' + this.appointment.token + '|' + this.appointment.id + '|' + this.appointment.date + ' ' + this.appointment.time,
                width: 84, height: 84, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M
            });
        },
        async refresh() {
            try {
                // null on the first load, so we only celebrate a change we actually saw happen
                const wasCalled = this.queue ? this.queue.called : null;
                this.queue = await window.store.api('/appointments/' + this.appointment.id + '/queue');
                if (this.queue.called && wasCalled === false && this.queue.today) {
                    window.store.showAlert("It's your turn! Please go to " + this.queue.room, 'success');
                    window.store.pulse();
                }
            } catch (e) { /* keep the last known state */ }
        }
    }
};
