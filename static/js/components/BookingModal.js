window.BookingModal = {
    emits: ['booked'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="d-flex align-items-center gap-3" v-if="doctor">
                            <span class="avatar" :style="{ background: store.avatarColor(doctor.name) }">{{ store.initials(doctor.name) }}</span>
                            <div>
                                <h5 class="modal-title mb-0">Dr. {{ doctor.name }}</h5>
                                <div class="small text-muted">{{ doctor.department_name }} &middot; {{ doctor.room }} &middot; ₹{{ doctor.consultation_fee }}</div>
                            </div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>

                    <div class="modal-body pt-0">
                        <div class="stepper mb-4" v-if="step < 3">
                            <div v-for="(label, i) in ['Pick a time', 'Confirm']" :key="i" class="step" :class="{ active: step === i + 1, done: step > i + 1 }">
                                <span class="step-num"><i v-if="step > i + 1" class="bi bi-check-lg"></i><template v-else>{{ i + 1 }}</template></span>{{ label }}
                            </div>
                            <div class="step-bar"><span :style="{ width: step === 1 ? '50%' : '100%' }"></span></div>
                        </div>

                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>

                        <transition name="page" mode="out-in">
                            <div v-if="step === 1 && doctor" key="pick">
                                <slot-picker :doctor-id="doctor.id" v-model="pick" :active="open"></slot-picker>
                            </div>

                            <div v-else-if="step === 2" key="confirm">
                                <div class="confirm-card mb-3">
                                    <div><div class="small text-muted">When</div><div class="fw-semibold">{{ longDate }} at {{ pick.time }}</div></div>
                                    <div><div class="small text-muted">Where</div><div class="fw-semibold">{{ doctor.room }}</div></div>
                                    <div><div class="small text-muted">Fee</div><div class="fw-semibold">₹{{ doctor.consultation_fee }}</div></div>
                                </div>
                                <label class="form-label">Reason for visit</label>
                                <textarea class="form-control" v-model="reason" rows="3" maxlength="1000" placeholder="A line or two helps the doctor prepare"></textarea>
                            </div>

                            <div v-else-if="step === 3 && booked" key="done" class="text-center">
                                <svg class="success-check" viewBox="0 0 52 52" aria-hidden="true">
                                    <circle cx="26" cy="26" r="24"></circle>
                                    <path d="M14 27 l8 8 l16 -17"></path>
                                </svg>
                                <h4 class="fw-bold mt-2 mb-1">You're booked!</h4>
                                <p class="text-muted">Here's your pass. Show the QR code at reception.</p>
                                <div class="pass-pop text-start">
                                    <boarding-pass :appointment="booked" :live="false"></boarding-pass>
                                </div>
                            </div>
                        </transition>
                    </div>

                    <div class="modal-footer">
                        <template v-if="step === 1">
                            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" :disabled="!pick.time" @click="step = 2">
                                Continue <i class="bi bi-arrow-right"></i>
                            </button>
                        </template>
                        <template v-else-if="step === 2">
                            <button type="button" class="btn btn-outline-secondary" @click="step = 1"><i class="bi bi-arrow-left"></i> Back</button>
                            <button type="button" class="btn btn-primary" @click="book" :disabled="saving">
                                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                Confirm booking
                            </button>
                        </template>
                        <template v-else>
                            <button type="button" class="btn btn-outline-secondary" @click="goTo('appointments')">All appointments</button>
                            <button type="button" class="btn btn-primary" @click="goTo('dashboard')">Done</button>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            doctor: null,
            pick: { date: '', time: '' },
            reason: '',
            step: 1,
            error: '',
            saving: false,
            booked: null,
            open: false,
            closing: false,
            bsModal: null
        };
    },
    computed: {
        longDate() {
            return this.pick.date ? new Date(this.pick.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
        }
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
        this.$refs.modal.addEventListener('hide.bs.modal', () => { this.closing = true; });
        this.$refs.modal.addEventListener('hidden.bs.modal', () => { this.closing = false; this.open = false; this.doctor = null; });
    },
    methods: {
        // preset = { date, time } from the command palette, e.g. "book cardiology tomorrow at 10"
        show(doctor, preset = null) {
            // Bootstrap ignores show() while the modal is still animating closed
            if (this.closing) {
                this.$refs.modal.addEventListener('hidden.bs.modal', () => this.show(doctor, preset), { once: true });
                return;
            }
            this.doctor = doctor;
            this.pick = { date: (preset && preset.date) || '', time: (preset && preset.time) || '' };
            this.reason = '';
            this.step = 1;
            this.error = '';
            this.booked = null;
            this.open = true;
            this.bsModal.show();
        },
        async book() {
            this.error = '';
            this.saving = true;
            try {
                this.booked = await this.store.api('/appointments', 'POST', {
                    doctor_id: this.doctor.id, date: this.pick.date, time: this.pick.time, reason: this.reason
                });
                this.step = 3;
                this.store.pulse();
                this.store.showAlert('Appointment booked. Token ' + this.booked.token, 'success');
                this.$emit('booked');
            } catch (e) {
                this.error = e.message;
                this.step = 1;
                this.pick = { date: this.pick.date, time: '' };
            } finally {
                this.saving = false;
            }
        },
        goTo(page) {
            this.bsModal.hide();
            this.store.navigate(page);
        }
    }
};
