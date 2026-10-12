window.RescheduleModal = {
    emits: ['rescheduled'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title mb-0">Reschedule</h5>
                            <div class="small text-muted">Currently with Dr. {{ appointment && appointment.doctor_name }} on {{ appointment && appointment.date }} at {{ appointment && appointment.time }}</div>
                        </div>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body pt-0">
                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>
                        <slot-picker v-if="appointment" :doctor-id="appointment.doctor_id" v-model="pick" :active="open"></slot-picker>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Keep current time</button>
                        <button type="button" class="btn btn-warning" @click="reschedule" :disabled="saving || !pick.time">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            Move to {{ pick.time ? pick.date.slice(5) + ' ' + pick.time : '...' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            pick: { date: '', time: '' },
            appointment: null,
            error: '',
            saving: false,
            open: false,
            closing: false,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
        this.$refs.modal.addEventListener('hide.bs.modal', () => { this.closing = true; });
        this.$refs.modal.addEventListener('hidden.bs.modal', () => { this.closing = false; this.open = false; this.appointment = null; });
    },
    methods: {
        show(appointment) {
            if (this.closing) {
                this.$refs.modal.addEventListener('hidden.bs.modal', () => this.show(appointment), { once: true });
                return;
            }
            this.appointment = appointment;
            this.pick = { date: '', time: '' };
            this.error = '';
            this.open = true;
            this.bsModal.show();
        },
        async reschedule() {
            this.error = '';
            this.saving = true;
            try {
                const moved = await this.store.api('/appointments/' + this.appointment.id, 'PUT', this.pick);
                this.store.showAlert('Moved to ' + moved.date + ' at ' + moved.time + ' (token ' + moved.token + ')');
                this.store.pulse();
                this.bsModal.hide();
                this.$emit('rescheduled');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};
